// Catalogue brut des lignes OTP, partagé par toute l'application.
// Chaque appelant conserve sa logique de présentation : ce module évite
// seulement que plusieurs composants demandent /index/routes en parallèle.
const ENDPOINT =
  "https://data.mobilites-m.fr/api/routers/default/index/routes";

let routesCache = null;
let routesPromise = null;

export function getRoutes() {
  if (routesCache) return Promise.resolve(routesCache);
  if (routesPromise) return routesPromise;

  routesPromise = fetch(ENDPOINT)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Impossible de charger les lignes (${response.status})`);
      }
      return response.json();
    })
    .then((routes) => {
      if (!Array.isArray(routes)) {
        throw new Error("Réponse des lignes invalide");
      }
      routesCache = routes;
      return routes;
    })
    .finally(() => {
      routesPromise = null;
    });

  return routesPromise;
}

export function getCachedRoutes() {
  return routesCache;
}

export const preloadRoutes = getRoutes;
