// Points d'entrée du chunk cartographique.
//
// Séparés de lazyMaps.jsx, qui ne doit exporter que des composants (le
// rafraîchissement à chaud de React se désactive sur un module mêlant
// composants et fonctions utilitaires).
//
// Les deux modules ci-dessous sont importés dynamiquement par le même
// spécifieur partout dans l'application : le bundler les regroupe donc dans un
// unique chunk, et le navigateur mémoïse l'import — précharger puis afficher
// une carte ne provoque qu'un seul téléchargement.

import { scheduleIdle } from "../utils/scheduleIdle.js";
import { isLightMode } from "../utils/lightMode.js";

export const loadStopPickerMap = () => import("./StopPickerMap.jsx");
export const loadJourneyDetailsSheet = () => import("./JourneyDetailsSheet.jsx");
// react-map-gl ne charge maplibre qu'au montage effectif d'une carte : sans cet
// import, précharger les deux modules ci-dessus laisserait de côté le plus gros
// morceau (~270 ko compressés), et la première ouverture de carte le paierait.
const loadMapLibre = () => import("maplibre-gl");

// Le préchargement est un pari : on dépense de la bande passante maintenant
// pour une carte que l'utilisateur ouvrira peut-être. Le pari est bon en Wi-Fi,
// mauvais en 2G ou en mode économiseur de données, où cette dépense retarderait
// le contenu réellement demandé. Dans ce cas on s'abstient : les composants
// restent chargés à la demande, simplement sans avance.
function shouldPrefetch() {
  // Mode léger : c'est ici que se joue l'essentiel de son gain au démarrage
  // (~290 ko épargnés). La carte reste pleinement fonctionnelle, elle se
  // charge simplement à l'ouverture plutôt qu'à l'avance.
  if (isLightMode()) return false;

  const connection =
    typeof navigator !== "undefined"
      ? navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection
      : null;
  if (!connection) return true; // information indisponible : comportement par défaut
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType || "");
}

/**
 * Précharge le chunk cartographique quand le navigateur est au repos.
 *
 * Appelé une fois au démarrage. maplibre pèse à lui seul près de 270 ko
 * compressés : le sortir du chemin critique était nécessaire, mais le charger
 * seulement au premier clic aurait déplacé l'attente au lieu de la supprimer.
 * Le précharger pendant que l'utilisateur lit son écran d'accueil donne les
 * deux : un démarrage léger et une carte immédiate.
 *
 * Sans effet si le chunk est déjà chargé, et silencieux en cas d'échec : le
 * chargement à la demande reste le filet de sécurité.
 */
export function prefetchMapChunk() {
  if (!shouldPrefetch()) return;

  scheduleIdle(
    () => {
      loadStopPickerMap().catch(() => {});
      loadJourneyDetailsSheet().catch(() => {});
      loadMapLibre().catch(() => {});
    },
    { timeout: 6000 },
  );
}
