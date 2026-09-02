// Catalogue brut des lignes OTP, partagé par toute l'application.
// Chaque appelant conserve sa logique de présentation : ce module évite
// seulement que plusieurs composants demandent /index/routes en parallèle.
//
// Deux niveaux de cache :
//   - en mémoire, pour la durée de la session (évite les appels concurrents) ;
//   - sur disque (IndexedDB), pour éviter de retélécharger le catalogue à
//     chaque visite. Le contenu ne bouge qu'au rythme des évolutions du réseau,
//     alors que la réponse est volumineuse et bloque le premier écran en
//     connexion faible.
import { idbGet, idbSet } from "./persistentCache.js";
import { getCacheTtl } from "./lightMode.js";

const ENDPOINT =
  "https://data.mobilites-m.fr/api/routers/default/index/routes";

const CACHE_KEY = "routes:v1";

let routesCache = null;
let routesPromise = null;

export function getRoutes() {
  if (routesCache) return Promise.resolve(routesCache);
  if (routesPromise) return routesPromise;

  routesPromise = (async () => {
    const cached = await idbGet(CACHE_KEY);
    if (Array.isArray(cached?.value) && cached.value.length) {
      routesCache = cached.value;
      return routesCache;
    }

    const response = await fetch(ENDPOINT);
    if (!response.ok) {
      throw new Error(`Impossible de charger les lignes (${response.status})`);
    }
    const routes = await response.json();
    if (!Array.isArray(routes)) {
      throw new Error("Réponse des lignes invalide");
    }

    routesCache = routes;
    // Volontairement non attendu : l'écriture disque ne doit pas retarder
    // l'affichage, et son échec est sans conséquence (idbSet est silencieux).
    void idbSet(CACHE_KEY, routes, getCacheTtl());
    return routes;
  })().finally(() => {
    routesPromise = null;
  });

  return routesPromise;
}

export function getCachedRoutes() {
  return routesCache;
}

export const preloadRoutes = getRoutes;
