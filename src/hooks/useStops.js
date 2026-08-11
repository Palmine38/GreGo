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
let cachedStopsPromise = null;

async function fetchStops() {
  if (cachedStopsPromise) return cachedStopsPromise;

  cachedStopsPromise = (async () => {
    const stopsMap = {};
    const stopsList = [];

    try {
      const routesResp = await fetch(
        "https://data.mobilites-m.fr/api/routers/default/index/routes",
      );
      const routes = await routesResp.json();
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
    } catch {
      cachedStopsMap = {};
      cachedStopsList = [];
    }

    return { stopsMap: cachedStopsMap, stopsList: cachedStopsList };
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
  const [stopsLoaded, setStopsLoaded] = useState(!!cachedStopsMap);

  useEffect(() => {
    if (cachedStopsMap) {
      setStopsMap(cachedStopsMap);
      setStopsList(cachedStopsList);
      setStopsLoaded(true);
      return;
    }

    let active = true;
    fetchStops().then(({ stopsMap, stopsList }) => {
      if (!active) return;
      setStopsMap(stopsMap);
      setStopsList(stopsList);
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

  return { stopsMap, stopsList, stopsLoaded, findStop, suggestionsFor };
}
