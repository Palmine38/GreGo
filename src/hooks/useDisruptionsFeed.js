import { useMemo, useSyncExternalStore } from "react";
import { getRoutes } from "../utils/routesCache.js";
import { groupDisruptedLines } from "../utils/disruptedLines.js";

// Flux de perturbations partagé par tous les éléments du shell desktop
// (pastille de la barre latérale, bandeau d'en-tête, panneau Infotrafic) :
// un seul appel réseau quel que soit le nombre d'abonnés, contrairement à
// useDisruptions() qui interroge l'API à chaque instance.
const REFRESH_MS = 60_000;
const API_URL = "https://data.mobilites-m.fr/api/dyn/evtTC/json";

let state = { raw: {}, routes: [], loaded: false, updatedAt: null };
const listeners = new Set();
let timer = null;

const emit = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

async function refresh() {
  try {
    const res = await fetch(API_URL);
    emit({ raw: await res.json(), loaded: true, updatedAt: new Date() });
  } catch {
    emit({ loaded: true });
  }
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    if (!state.routes.length) {
      getRoutes()
        .then((routes) => emit({ routes }))
        .catch(() => {});
    }
    timer = setInterval(refresh, REFRESH_MS);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) clearInterval(timer);
  };
}

export function useDisruptionsFeed() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const lines = useMemo(
    () => groupDisruptedLines(snapshot.raw, snapshot.routes),
    [snapshot.raw, snapshot.routes],
  );
  return { lines, loaded: snapshot.loaded, updatedAt: snapshot.updatedAt };
}

export { refresh as refreshDisruptions };
