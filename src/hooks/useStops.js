import { useEffect, useState } from "react";
import { removeAccents } from "../utils/journey.js";

const roundCoord = (n) => Math.round(n * 1e5) / 1e5;

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

    try {
      const routesResp = await fetch(
        "https://data.mobilites-m.fr/api/routers/default/index/routes",
      );
      const routes = await routesResp.json();
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
        .map((route) => route.id)
        .filter((id) =>
          NETWORK_PREFIXES.some((prefix) => id?.startsWith(`${prefix}:`)),
        );

      // name (lowercase) -> Map(positionKey -> position)
      const newMap = {};
      const list = [];

      await Promise.all(
        networkLines.map(async (routeId) => {
          const l = routeId;
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
        }),
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
    const key = removeAccents(query.trim().toLowerCase());

    const prioritizeLine = (positions) => {
      if (!preferredLine?.trim()) return positions;
      // on tolère un preferredLine avec ou sans préfixe réseau ("1" ou "SEM:1")
      const line = preferredLine.replace(/^[A-Z0-9]+:/i, "").toUpperCase();
      return [...positions].sort((a, b) => {
        const matches = (stop) =>
          stop.lines.some((x) => {
            const code = x.toUpperCase();
            return code === line || code.endsWith(`:${line}`);
          });
        return Number(matches(b)) - Number(matches(a));
      });
    };

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
