// Mode léger — désactivé par défaut.
//
// Objectif : réduire ce que l'application télécharge et demande au réseau au
// démarrage, au prix de fonctionnalités de confort. Il s'adresse aux connexions
// lentes, aux forfaits limités et aux téléphones anciens.
//
// Ce qu'il coupe (voir chaque point dans le code concerné) :
//   1. le préchargement du moteur de carte      (~290 ko de moins au démarrage)
//   2. les tracés de lignes exacts              (plusieurs requêtes par trajet)
//   3. les véhicules en libre-service (GBFS)    (4 requêtes + 2 images)
//   4. les scripts de statistiques d'usage      (2 scripts externes)
//   5. la fraîcheur du cache local              (24 h -> 7 jours)
//
// ── Pourquoi un module à part plutôt qu'un simple champ de useSettings ──────
// useSettings charge les réglages dans un effet React, donc *après* le premier
// rendu. Or ce mode doit être connu avant : au moment où l'on décide de
// précharger le moteur de carte, l'application n'a pas encore fini de monter.
// La valeur est donc lue de façon synchrone depuis localStorage, comme l'est
// déjà le thème dans index.html.

const STORAGE_KEY = "tag-express-settings";
export const LIGHT_MODE_CHANGE_EVENT = "tag-express-light-mode-change";

// Durées de validité du cache local des données réseau (arrêts, catalogue de
// lignes). Le mode léger allonge la fenêtre : moins de reconstructions
// coûteuses, au prix d'un référentiel qui peut retarder d'une poignée de jours.
export const CACHE_TTL_NORMAL = 24 * 60 * 60 * 1000; // 24 h
export const CACHE_TTL_LIGHT = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Mémoïsé : isLightMode() est appelé pendant le rendu, il ne doit pas relire et
// reparser localStorage à chaque fois. Le cache est invalidé par les événements
// installés plus bas.
let cachedValue = null;

function readFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.lightMode === true;
  } catch {
    // localStorage indisponible (navigation privée stricte, quota) ou JSON
    // corrompu : on retombe sur le comportement complet, qui est le défaut.
    return false;
  }
}

/** @returns {boolean} Vrai si le mode léger est actif. Lecture synchrone. */
export function isLightMode() {
  if (cachedValue === null) cachedValue = readFromStorage();
  return cachedValue;
}

/** Invalide le cache mémoire (appelé quand le réglage change). */
export function refreshLightMode() {
  cachedValue = readFromStorage();
  return cachedValue;
}

/** Durée de cache à appliquer aux données réseau, selon le mode courant. */
export function getCacheTtl() {
  return isLightMode() ? CACHE_TTL_LIGHT : CACHE_TTL_NORMAL;
}

if (typeof window !== "undefined") {
  // Changement depuis la page Réglages, ou depuis un autre onglet.
  window.addEventListener(LIGHT_MODE_CHANGE_EVENT, refreshLightMode);
  window.addEventListener("storage", refreshLightMode);
}
