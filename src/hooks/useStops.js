import { useEffect, useState } from "react";
import { removeAccents } from "../utils/journey.js";

const roundCoord = (n) => Math.round(n * 1e5) / 1e5;

export function useStops() {
  // name -> [{ id, stopId, name, lat, lon, code, lines }, ...]
  const [stopsMap, setStopsMap] = useState({});
  const [stopsList, setStopsList] = useState([]);
  const [stopsLoaded, setStopsLoaded] = useState(false);

  useEffect(() => {
    const fetchStops = async () => {
      try {
        const routesResp = await fetch(
          "https://data.mobilites-m.fr/api/routers/default/index/routes",
        );
        const routes = await routesResp.json();
        const semLines = routes
          .map((route) => route.id)
          .filter((id) => id?.startsWith("SEM:"))
          .map((id) => id.replace("SEM:", ""));

        // name (lowercase) -> Map(positionKey -> position)
        const newMap = {};
        const list = [];

        await Promise.all(
          semLines.map(async (l) => {
            try {
              const r = await fetch(
                `https://data.mobilites-m.fr/api/routers/default/index/routes/SEM:${l}/clusters`,
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
                    clusterId: stop.id,
                    name: stop.name,
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

        const seen = new Set();
        const dedupedList = [];
        for (const stop of list) {
          const key = `${stop.id}::${stop.lat},${stop.lon}`;
          if (!seen.has(key)) {
            seen.add(key);
            dedupedList.push(stop);
          }
        }

        setStopsList(dedupedList);
        setStopsMap(finalMap);
      } catch {
        setStopsMap({});
      } finally {
        setStopsLoaded(true);
      }
    };
    fetchStops();
  }, []);

  const findStop = (query, preferredLine) => {
    if (!query?.trim()) return [];
    const key = removeAccents(query.trim().toLowerCase());

    const prioritizeLine = (positions) => {
      if (!preferredLine?.trim()) return positions;
      const line = preferredLine.replace("SEM:", "").toUpperCase();
      return [...positions].sort(
        (a, b) =>
          Number(b.lines.includes(line)) - Number(a.lines.includes(line)),
      );
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
      .filter(
        (k) => removeAccents(stopsMap[k][0].name.toLowerCase()) !== q,
      )
      .slice(0, 10)
      .map((k) => stopsMap[k][0].name);
  };

  return { stopsMap, stopsList, stopsLoaded, findStop, suggestionsFor };
}
