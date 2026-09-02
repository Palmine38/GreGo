import { useEffect, useState } from "react";
import { removeAccents } from "../utils/journey.js";
import { normalizeRouteRef } from "../utils/routeLineResolver.js";
import { getRoutes } from "../utils/routesCache.js";
import { idbGet, idbSet } from "../utils/persistentCache.js";
import { getCacheTtl } from "../utils/lightMode.js";

const roundCoord = (n) => Math.round(n * 1e5) / 1e5;

// Le référentiel d'arrêts se reconstruit à partir d'une requête par ligne du
// réseau, soit plusieurs dizaines d'appels. C'est de loin le poste réseau le
// plus lourd du démarrage, alors que son résultat ne change qu'au rythme des
// évolutions du réseau. On le garde donc sur le disque du navigateur : seule la
// première visite (ou la première de la journée) paie le coût complet.
const STOPS_CACHE_KEY = "stops:v1";

// Plafond de requêtes simultanées. Sans lui, les quelques dizaines d'appels
// partaient d'un bloc : en HTTP/2 ils sont tous multiplexés sur la même
// connexion et se partagent la bande passante, ce qui, en 3G, retarde
// *chacun* d'eux — et avec eux le premier écran exploitable. Les traiter par
// petits lots fait arriver les premiers résultats bien plus tôt.
const MAX_CONCURRENT_REQUESTS = 6;

async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

// Réseaux exploités sur data.mobilites-m.fr (agglo grenobloise + périurbain)
const NETWORK_PREFIXES = [
  "SEM", // tram + bus urbains (SEMITAG)
  "SMA", // ?
  "SE2",
  "GSV",
  "FUN", // funiculaire / téléphérique (Bastille ?)
  "BUL",
  "C38",
  "MCO",
  "TRA", // transisère (cars régionaux) ?
];

let cachedStopsMap = null;
let cachedStopsList = null;
let cachedRouteLongNames = null;
let cachedStopsPromise = null;

async function fetchStops() {
  if (cachedStopsPromise) return cachedStopsPromise;

  cachedStopsPromise = (async () => {
    const stopsMap = {};
    const stopsList = [];
    const routeLongNames = {};

    // Cache disque : s'il répond, on évite l'intégralité des requêtes réseau.
    try {
      const cached = await idbGet(STOPS_CACHE_KEY);
      if (cached?.value?.stopsList?.length) {
        cachedStopsMap = cached.value.stopsMap;
        cachedStopsList = cached.value.stopsList;
        cachedRouteLongNames = cached.value.routeLongNames;
        return {
          stopsMap: cachedStopsMap,
          stopsList: cachedStopsList,
          routeLongNames: cachedRouteLongNames,
        };
      }
    } catch {
      // Cache indisponible : on retombe simplement sur le chemin réseau.
    }

    try {
      const routes = await getRoutes();
      // On garde le longName de chaque ligne au passage : il sert ensuite à
      // retrouver les vrais terminus d'une ligne (voir selectStopLine dans
      // fast-research.jsx), sans requête supplémentaire puisque /index/routes
      // est de toute façon déjà chargé ici.
      routes.forEach((route) => {
        if (route?.id) {
          routeLongNames[String(route.id).toUpperCase()] = route.longName || "";
        }
      });
      const networkLines = routes
        .filter((route) =>
          NETWORK_PREFIXES.some((prefix) =>
            route?.id?.startsWith(`${prefix}:`),
          ),
        )
        .map((route) => ({
          id: route.id,
          shortName: route.shortName || route.id,
        }));

      // name (lowercase) -> Map(positionKey -> position)
      const newMap = {};
      const list = [];

      await mapWithConcurrency(
        networkLines,
        MAX_CONCURRENT_REQUESTS,
        async ({ id: routeId, shortName }) => {
          const l = shortName;
          try {
            const r = await fetch(
              `https://data.mobilites-m.fr/api/routers/default/index/routes/${routeId}/stops`,
            );
            const clusters = await r.json();
            clusters.forEach((stop) => {
              const nameKey = stop.name.toLowerCase();
              const lat = roundCoord(stop.lat);
              const lon = roundCoord(stop.lon);
              const positionKey = `${lat},${lon}`;

              if (!newMap[nameKey]) newMap[nameKey] = new Map();

              const existing = newMap[nameKey].get(positionKey);
              if (existing) {
                existing.lines.add(l);
              } else {
                newMap[nameKey].set(positionKey, {
                  id: `${stop.id}::${lat},${lon}`,
                  stopId: stop.id,
                  // Format "SEM:xxx", utilisé par otpPlaceParam (journey.js)
                  // pour pointer OTP vers le cluster plutôt qu'une
                  // plateforme précise en lat/lon.
                  clusterId: stop.clusterGtfsId
                    ? `SEM:${stop.clusterGtfsId}`
                    : null,
                  // Format "SEM:GENxxx", requis par
                  // /clusters/{id}/stoptimes (prochains passages) —
                  // différent du clusterId ci-dessus utilisé par OTP.
                  stopTimesClusterId: stop.cluster || null,
                  name: stop.name,
                  city: stop.city || stop.locality || stop.municipality,
                  lat: stop.lat,
                  lon: stop.lon,
                  code: stop.code,
                  lines: new Set([l]),
                });
              }

              list.push({
                id: stop.id,
                stopId: stop.id,
                clusterId: stop.clusterGtfsId
                  ? `SEM:${stop.clusterGtfsId}`
                  : null,
                stopTimesClusterId: stop.cluster || null,
                code: stop.code,
                name: stop.name,
                city: stop.city || stop.locality || stop.municipality,
                lat: stop.lat,
                lon: stop.lon,
                line: l,
              });
            });
          } catch {}
        },
      );

      const finalMap = {};
      for (const [nameKey, positions] of Object.entries(newMap)) {
        finalMap[nameKey] = Array.from(positions.values()).map(
          ({ lines, ...position }) => ({
            ...position,
            lines: Array.from(lines),
          }),
        );
      }

      const stopsByName = new Map();
      for (const stop of list) {
        const key = `${removeAccents(stop.name || "").toLowerCase()}::${removeAccents(stop.city || "").toLowerCase()}`;
        const existing = stopsByName.get(key);
        if (existing) {
          existing.lines = [
            ...new Set([...existing.lines, ...(stop.lines || [stop.line])]),
          ];
          existing.stopIds = [...new Set([...existing.stopIds, stop.id])];
        } else {
          stopsByName.set(key, {
            ...stop,
            lines: stop.lines || [stop.line],
            stopIds: [stop.id],
          });
        }
      }

      cachedStopsMap = finalMap;
      cachedStopsList = [...stopsByName.values()];
      cachedRouteLongNames = routeLongNames;

      // Écriture non attendue : elle ne doit pas retarder le premier rendu.
      // Seul un référentiel complet est mémorisé, pour ne jamais figer sur le
      // disque un résultat partiel dû à des requêtes échouées.
      if (cachedStopsList.length) {
        void idbSet(
          STOPS_CACHE_KEY,
          {
            stopsMap: cachedStopsMap,
            stopsList: cachedStopsList,
            routeLongNames: cachedRouteLongNames,
          },
          getCacheTtl(),
        );
      }
    } catch {
      cachedStopsMap = {};
      cachedStopsList = [];
      cachedRouteLongNames = {};
    }

    return {
      stopsMap: cachedStopsMap,
      stopsList: cachedStopsList,
      routeLongNames: cachedRouteLongNames,
    };
  })();

  return cachedStopsPromise;
}

export function preloadStops() {
  fetchStops();
}

export function useStops() {
  // name -> [{ id, stopId, name, lat, lon, code, lines }, ...]
  const [stopsMap, setStopsMap] = useState(cachedStopsMap || {});
  const [stopsList, setStopsList] = useState(cachedStopsList || []);
  const [routeLongNames, setRouteLongNames] = useState(
    cachedRouteLongNames || {},
  );
  const [stopsLoaded, setStopsLoaded] = useState(!!cachedStopsMap);

  useEffect(() => {
    if (cachedStopsMap) {
      setStopsMap(cachedStopsMap);
      setStopsList(cachedStopsList);
      setRouteLongNames(cachedRouteLongNames);
      setStopsLoaded(true);
      return;
    }

    let active = true;
    fetchStops().then(({ stopsMap, stopsList, routeLongNames }) => {
      if (!active) return;
      setStopsMap(stopsMap);
      setStopsList(stopsList);
      setRouteLongNames(routeLongNames);
      setStopsLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const findStop = (query, preferredLine) => {
    if (!query?.trim()) return [];
    const rawQuery = query.trim();
    const key = removeAccents(rawQuery.toLowerCase());

    const prioritizeLine = (positions) => {
      if (!preferredLine?.trim()) return positions;
      // on tolère un preferredLine avec ou sans préfixe réseau ("1" ou "SEM:1") ;
      // même normalisation que celle utilisée pour résoudre les couleurs de
      // ligne ailleurs dans l'appli (voir utils/routeLineResolver.js).
      const line = normalizeRouteRef(preferredLine) || "";
      return [...positions].sort((a, b) => {
        const matches = (stop) =>
          stop.lines.some((x) => {
            const code = x.toUpperCase();
            return code === line || code.endsWith(`:${line}`);
          });
        return Number(matches(b)) - Number(matches(a));
      });
    };

    // Un trajet restauré peut contenir un identifiant OTP interne (par ex.
    // "SEM:GENPVC") alors que le champ affiche déjà son nom via
    // resolveDisplayName. Le reconnaître ici évite de traiter cet identifiant
    // comme un texte d'arrêt et conserve l'affichage « Pont de Vence ».
    const matchingIds = Object.values(stopsMap)
      .flat()
      .filter(
        (position) =>
          position.id === rawQuery ||
          position.stopId === rawQuery ||
          position.id.startsWith(`${rawQuery}::`),
      );
    if (matchingIds.length) return prioritizeLine(matchingIds);

    for (const [k, v] of Object.entries(stopsMap)) {
      if (removeAccents(k) === key) return prioritizeLine(v);
    }
    for (const [k, v] of Object.entries(stopsMap)) {
      const normalizedK = removeAccents(k);
      if (normalizedK.includes(key) || key.includes(normalizedK)) {
        return prioritizeLine(v);
      }
    }
    return [];
  };

  const suggestionsFor = (value) => {
    if (!value.trim()) return [];
    const q = removeAccents(value.trim().toLowerCase());
    if (value === value.trim()) {
      for (const [k] of Object.entries(stopsMap)) {
        if (removeAccents(k) === q) return [];
      }
    }
    return Object.keys(stopsMap)
      .filter((k) => removeAccents(k).includes(q))
      .filter((k) => removeAccents(stopsMap[k][0].name.toLowerCase()) !== q)
      .slice(0, 10)
      .map((k) => stopsMap[k][0].name);
  };

  // Longname complet d'une ligne (ex. "Fontanil-Cornillon Palluel / Grenoble
  // Louise Michel" pour SEM:E), utilisé pour en extraire les vrais terminus.
  const getRouteLongName = (routeId) =>
    routeLongNames[String(routeId || "").toUpperCase()] || "";

  return {
    stopsMap,
    stopsList,
    stopsLoaded,
    findStop,
    suggestionsFor,
    routeLongNames,
    getRouteLongName,
  };
}
