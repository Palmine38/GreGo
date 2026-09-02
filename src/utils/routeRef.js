// Normalisation des références de ligne, sans dépendance à React.
//
// Ces deux fonctions vivaient dans routeLineResolver.js, qui importe
// components/lines-icons.jsx pour ses couleurs. Les modules purement données
// (utils/lineShapes.js) n'ont pas besoin des couleurs mais héritaient de cette
// dépendance à un composant, ce qui les rendait inutilisables hors du bundler.
//
// routeLineResolver.js les réexporte : tous les appelants existants continuent
// de les importer depuis là.

/** "SEM:C1", "SEM_C1", "se2:c1" deviennent tous "C1". `null` si vide. */
export const normalizeRouteRef = (value) => {
  if (!value) return null;
  const code = String(value)
    .toUpperCase()
    .replace(/^(?:SEM|SE2):?/, "")
    .replace(/^(?:SEM|SE2)_/, "")
    .trim();
  return code || null;
};

/**
 * Codes normalisés distincts pour un jeu de références (routeShortName, route,
 * routeId…), dans l'ordre où ils ont été fournis.
 */
export const getRouteCandidates = (...values) => {
  const candidates = values.map(normalizeRouteRef).filter(Boolean);
  return Array.from(new Set(candidates));
};
