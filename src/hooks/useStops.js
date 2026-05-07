import { useEffect, useState } from "react";
import { removeAccents } from "../utils/journey.js";

export function useStops() {
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
                const key = stop.name.toLowerCase();
                if (!newMap[key]) {
                  list.push({
                    id: stop.id,
                    code: stop.code,
                    name: stop.name,
                    lat: stop.lat,
                    lon: stop.lon,
                  });
                }
                newMap[key] = [
                  `${stop.id}::${stop.lat},${stop.lon}`,
                  stop.name,
                  stop.code,
                ];
              });
            } catch {}
          }),
        );

        setStopsList(list);
        setStopsMap(newMap);
      } catch {
        setStopsMap({});
      } finally {
        setStopsLoaded(true);
      }
    };
    fetchStops();
  }, []);

  const findStop = (query) => {
    if (!query?.trim()) return null;
    const key = removeAccents(query.trim().toLowerCase());
    for (const [k, v] of Object.entries(stopsMap)) {
      if (removeAccents(k) === key) return v;
    }
    for (const [k, v] of Object.entries(stopsMap)) {
      const normalizedK = removeAccents(k);
      if (normalizedK.includes(key) || key.includes(normalizedK)) return v;
    }
    return null;
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
      .filter((k) => removeAccents(stopsMap[k][1].toLowerCase()) !== q)
      .slice(0, 10)
      .map((k) => stopsMap[k][1]);
  };

  return { stopsMap, stopsList, stopsLoaded, findStop, suggestionsFor };
}
