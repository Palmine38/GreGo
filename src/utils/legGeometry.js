// Calcul du tracé affiché pour un segment (leg) d'itinéraire.
//
// Ce module a été extrait de components/JourneyDetailsSheet.jsx : la logique est
// purement géométrique (aucun React, aucun maplibre), mais elle vivait dans un
// composant qui, lui, importe react-map-gl. Résultat, fast-research.jsx et
// StopPickerMap.jsx tiraient tout le moteur de carte (~1 Mo) uniquement pour
// appeler getLegGeometry(). L'extraction casse cette dépendance ; le
// comportement, lui, est inchangé.

import lineB from "../components/lineB.json";
import lineNAVBVerdunToPDS from "../components/lineNAVB_verdun_to_pds.json";
import lineNAVBPdsToVerdun from "../components/lineNAVB_pds_to_verdun.json";
import { getRouteCandidates } from "./routeRef.js";
import { getLegSegmentFromReference } from "./legReferenceGeometry.js";

function decodePolyline(encoded) {
  let index = 0,
    lat = 0,
    lon = 0;
  const coords = [];
  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lon / 1e5, lat / 1e5]);
  }
  return coords;
}

// OTP fournit parfois une géométrie qui s'arrête à quelques mètres de la
// position déclarée de l'arrêt. On recale le tracé affiché sur ces positions.
const STOP_SNAP_DISTANCE = 0.0007; // environ 75 m
function magnetizeLegGeometry(leg) {
  if (!leg.legGeometry?.points) return [];

  const coords = decodePolyline(leg.legGeometry.points);
  if (!coords.length) return coords;

  const snapIntermediateStop = (stop) => {
    if (!Number.isFinite(stop?.lon) || !Number.isFinite(stop?.lat)) return;

    let closestIndex = 0;
    let closestDistance = Infinity;
    coords.forEach(([lon, lat], index) => {
      const distance = (lon - stop.lon) ** 2 + (lat - stop.lat) ** 2;
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestDistance <= STOP_SNAP_DISTANCE ** 2) {
      coords[closestIndex] = [stop.lon, stop.lat];
    }
  };

  (leg.intermediateStops || []).forEach(snapIntermediateStop);
  if (Number.isFinite(leg.from?.lon) && Number.isFinite(leg.from?.lat)) {
    coords[0] = [leg.from.lon, leg.from.lat];
  }
  if (Number.isFinite(leg.to?.lon) && Number.isFinite(leg.to?.lat)) {
    coords[coords.length - 1] = [leg.to.lon, leg.to.lat];
  }
  return coords;
}

export function midpoint(coords) {
  if (!coords.length) return null;
  return coords[Math.floor(coords.length / 2)];
}

export function cleanStopName(name) {
  return name?.replace(/^[^,]+,\s*/, "") || "";
}

export function getLegLineName(leg) {
  return (leg.routeShortName || leg.route || leg.routeId || "")
    .replace("SEM:", "")
    .toUpperCase();
}

// La géométrie fournie par OTP peut être approximative pour certaines lignes.
// Pour la ligne B, on utilise le tracé de référence embarqué dans l'application.
const LINE_B_COORDINATES = lineB.features?.[0]?.geometry?.coordinates || [];

// Ligne NAVB : deux tracés distincts selon la direction. Les deux tracés
// suivent globalement la même route physique, juste parcourue dans l'ordre
// inverse — impossible de choisir entre eux en mesurant "lequel colle le
// mieux au leg" (les deux seraient quasiment aussi proches). On détermine
// donc la direction directement à partir de la position du leg, en la
// comparant à deux repères fixes (les deux termini de la ligne).
const LINE_NAVB_VERDUN_TO_PDS_COORDINATES =
  lineNAVBVerdunToPDS.features?.[0]?.geometry?.coordinates || [];
const LINE_NAVB_PDS_TO_VERDUN_COORDINATES =
  lineNAVBPdsToVerdun.features?.[0]?.geometry?.coordinates || [];
const NAVB_TERMINI = {
  verdun: { lat: 45.18829, lon: 5.73164 }, // Grenoble, Verdun - Préfecture
  pds: { lat: 45.1878, lon: 5.78454 }, // Gières, Plaine des Sports
};

function isCloserToPdsThanVerdun(point) {
  const distToVerdun = Math.hypot(
    point.lat - NAVB_TERMINI.verdun.lat,
    point.lon - NAVB_TERMINI.verdun.lon,
  );
  const distToPds = Math.hypot(
    point.lat - NAVB_TERMINI.pds.lat,
    point.lon - NAVB_TERMINI.pds.lon,
  );
  return distToPds < distToVerdun;
}

function isLegHeadingTowardPds(leg) {
  const point =
    Number.isFinite(leg.from?.lat) && Number.isFinite(leg.from?.lon)
      ? leg.from
      : leg.to;
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return true;
  return !isCloserToPdsThanVerdun(point);
}

function nearestCoordinate(coords, stop) {
  if (!Number.isFinite(stop?.lon) || !Number.isFinite(stop?.lat)) return null;

  let index = -1;
  let distance = Infinity;
  coords.forEach(([lon, lat], currentIndex) => {
    const currentDistance = Math.hypot(lon - stop.lon, lat - stop.lat);
    if (currentDistance < distance) {
      index = currentIndex;
      distance = currentDistance;
    }
  });
  return index >= 0 ? { index, distance } : null;
}

function getCustomLineSegment(coordinates, leg) {
  const from = nearestCoordinate(coordinates, leg.from);
  const to = nearestCoordinate(coordinates, leg.to);
  // Les arrêts doivent correspondre au tracé : tolérance totale d'environ 300 m.
  if (!from || !to || from.distance + to.distance > 0.003) return null;

  const start = Math.min(from.index, to.index);
  const end = Math.max(from.index, to.index);
  const coords = coordinates.slice(start, end + 1);
  if (from.index > to.index) coords.reverse();

  const snapStop = (stop) => {
    const closest = nearestCoordinate(coords, stop);
    if (closest && closest.distance <= STOP_SNAP_DISTANCE) {
      coords[closest.index] = [stop.lon, stop.lat];
    }
  };
  (leg.intermediateStops || []).forEach(snapStop);
  snapStop(leg.from);
  snapStop(leg.to);
  return coords;
}

function getLineBSegment(leg) {
  return getCustomLineSegment(LINE_B_COORDINATES, leg);
}

function getNavbSegment(leg) {
  const coordinates = isLegHeadingTowardPds(leg)
    ? LINE_NAVB_VERDUN_TO_PDS_COORDINATES
    : LINE_NAVB_PDS_TO_VERDUN_COORDINATES;
  return getCustomLineSegment(coordinates, leg);
}

// Exporté pour que les autres vues de carte utilisent exactement la même
// logique de tracé.
//
// Par ordre de préférence :
//   1. le tracé publié par MTAG pour la ligne, découpé au tronçon parcouru —
//      c'est `lineShapes`, chargé par hooks/useJourneyLineShapes.js ;
//   2. les tracés de référence embarqués dans l'application (B, NAVB) ;
//   3. à défaut, la polyligne OTP recalée sur les arrêts.
//
// Le tracé publié passe en premier parce que c'est aussi celui qu'affiche la
// carte quand on sélectionne une ligne depuis un arrêt : les deux vues montrent
// ainsi la même voie, au mètre près. Les tracés embarqués restent le filet —
// indispensable pour NAVB, qui n'a pas de tracé publié, et pour B si jamais
// aucune variante ne correspond (leurs deux tracés concordent à 10 m près, donc
// l'ordre ne change rien à la forme, seulement à la source).
//
// `lineShapes` est facultatif : sans lui, la fonction se comporte comme avant.
export function getLegGeometry(leg, lineShapes) {
  if (leg.mode !== "WALK") {
    if (lineShapes?.size) {
      const key = getRouteCandidates(
        leg.routeShortName,
        leg.route,
        leg.routeId,
      )[0];
      const segment = key
        ? getLegSegmentFromReference(leg, lineShapes.get(key))
        : null;
      if (segment) return segment;
    }

    const lineName = getLegLineName(leg);
    if (lineName === "B")
      return getLineBSegment(leg) || magnetizeLegGeometry(leg);
    if (lineName === "NAVB")
      return getNavbSegment(leg) || magnetizeLegGeometry(leg);
  }
  return magnetizeLegGeometry(leg);
}
