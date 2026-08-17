// utils/routeLineResolver.js
//
// Résout un leg d'itinéraire (routeShortName / route / routeId) vers sa
// ligne affichable : nom court, couleur de fond, couleur de texte.
//
// Avant ce fichier, ce même calcul était copié-collé une bonne dizaine de
// fois entre lines-icons.jsx, JourneyTimeline.jsx et JourneyDetailsSheet.jsx,
// toujours sous la forme :
//
//   const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
//     .replace("SEM:", "")
//     .toUpperCase();
//   const color = LINE_COLORS[lineName] || lineColors[lineName] || "#94A3B8";
//
// Le `.replace("SEM:", "")` ne gère ni "SE2:", ni les variantes "SEM_xxx",
// et ne désambiguïse pas les codes partagés entre réseaux (voir
// utils/allLines.js). resolveRouteLine centralise ça.

import { LINE_COLORS } from "../components/lines-icons.jsx";

export const normalizeRouteRef = (value) => {
  if (!value) return null;
  const code = String(value)
    .toUpperCase()
    .replace(/^(?:SEM|SE2):?/, "")
    .replace(/^(?:SEM|SE2)_/, "")
    .trim();
  return code || null;
};

export const getRouteCandidates = (...values) => {
  const candidates = values.map(normalizeRouteRef).filter(Boolean);
  return Array.from(new Set(candidates));
};

const isCLine = (shortName) =>
  /^C[1-8]$/.test(String(shortName || "").toUpperCase());

/**
 * Couleur de fond + couleur de texte finales pour un code de ligne.
 *
 * Les couleurs "maison" de LINE_COLORS (Chrono/Proximo) priment sur celles
 * de l'API — elles corrigent des couleurs GTFS jugées peu lisibles — puis on
 * retombe sur la couleur API, puis sur un gris neutre. Le texte suit la même
 * convention qu'ailleurs dans l'appli : noir sur les lignes C (fond jaune
 * clair), blanc partout ailleurs.
 */
function resolveLineStyle(normalized, apiColor) {
  const backgroundColor = LINE_COLORS[normalized] || apiColor || "#94A3B8";
  const color = isCLine(normalized) ? "#000000" : "#FFFFFF";
  return { backgroundColor, color };
}

/**
 * @param {object} params
 * @param {string} [params.routeShortName]
 * @param {string} [params.route]
 * @param {string} [params.routeId]
 * @param {Map} [params.lineLookup] — voir utils/allLines.js#buildLineLookup
 * @returns {{id: string, shortName: string, type: string, color: string, textColor: string, normalized: string} | null}
 */
export function resolveRouteLine({
  routeShortName,
  route,
  routeId,
  lineLookup,
}) {
  const candidates = getRouteCandidates(routeShortName, route, routeId);
  const normalized = candidates[0] || null;
  if (!normalized) return null;

  const resolved = candidates
    .map((candidate) => lineLookup?.get(candidate))
    .find(Boolean);

  const style = resolveLineStyle(normalized, resolved?.color);

  return {
    id: resolved?.id || normalized,
    shortName: resolved?.shortName || normalized,
    type: resolved?.type || "",
    color: style.backgroundColor,
    textColor: style.color,
    normalized,
  };
}
