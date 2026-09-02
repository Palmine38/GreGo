// Chargement différé des vues cartographiques.
//
// maplibre-gl + react-map-gl pèsent à eux seuls ~1 Mo (≈270 ko compressés),
// soit plus que tout le reste de l'application réunie. Or aucune carte n'est
// visible au premier écran : elles n'apparaissent qu'après une action de
// l'utilisateur (ouvrir le sélecteur d'arrêt, consulter le détail d'un trajet).
// Les importer statiquement plaçait donc ce mégaoctet sur le chemin critique du
// démarrage — c'est la principale cause de lenteur en connexion faible.
//
// Ces composants sont des remplaçants directs : mêmes props, `Suspense` intégré,
// et surtout mêmes conditions de rendu que les originaux (voir les gardes
// ci-dessous). Les appelants n'ont rien à changer.
//
// Pour que le différé ne se paie pas d'une attente au premier clic, le chunk est
// préchargé dès que le navigateur est inactif (voir `prefetchMapChunk`) : le
// téléchargement a lieu pendant que l'utilisateur lit son écran d'accueil, hors
// du chemin critique, et la carte s'ouvre instantanément le moment venu.

import React, { lazy, Suspense } from "react";
import {
  loadJourneyDetailsSheet,
  loadStopPickerMap,
} from "./mapChunkLoaders.js";

const LazyStopPickerMap = lazy(loadStopPickerMap);
const LazyJourneyDetailsSheet = lazy(() =>
  loadJourneyDetailsSheet().then((m) => ({ default: m.JourneyDetailsSheet })),
);
const LazyJourneyDetailsContent = lazy(() =>
  loadJourneyDetailsSheet().then((m) => ({ default: m.JourneyDetailsContent })),
);

// Rien n'est affiché pendant le chargement : ces vues sont des surcouches
// (sheet, plein écran) — avant leur ouverture, l'écran dessous est déjà complet.
// Un indicateur intermédiaire n'apporterait qu'un clignotement.
const FALLBACK = null;

// Exporté à la fois par défaut et nommément : StopPickerMap.jsx avait un export
// par défaut (utilisé par fast-research.jsx), et mes-trajets.jsx importe
// désormais les deux vues d'un même module.
export function StopPickerMap(props) {
  return (
    <Suspense fallback={FALLBACK}>
      <LazyStopPickerMap {...props} />
    </Suspense>
  );
}

export default StopPickerMap;

export function JourneyDetailsSheet(props) {
  // Le composant réel renvoie `null` tant qu'aucun trajet n'est sélectionné.
  // On reproduit ce garde ici, en amont : sans lui, monter le composant
  // paresseux déclencherait le téléchargement du chunk carte dès l'affichage de
  // la page, ce qui reviendrait exactement à l'import statique qu'on supprime.
  if (!props.journey) return null;

  return (
    <Suspense fallback={FALLBACK}>
      <LazyJourneyDetailsSheet {...props} />
    </Suspense>
  );
}

// Vue détail d'un trajet, utilisée par FastResearchResultSheet. L'appelant ne la
// monte déjà que lorsqu'un trajet est sélectionné, d'où l'absence de garde ici.
export function JourneyDetailsContent(props) {
  return (
    <Suspense fallback={FALLBACK}>
      <LazyJourneyDetailsContent {...props} />
    </Suspense>
  );
}

