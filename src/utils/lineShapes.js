// Géométries de référence des lignes du réseau.
//
// La polyligne fournie par OTP dans `leg.legGeometry` est approximative : elle
// coupe les virages, s'écarte de la voie et s'arrête parfois à plusieurs
// dizaines de mètres de l'arrêt déclaré. Jusqu'ici on ne corrigeait ça que pour
// les lignes B et NAVB, à partir de tracés embarqués dans l'application
// (components/lineB.json, lineNAVB_*.json).
//
// Ce module généralise la correction à toutes les lignes en récupérant leur
// vrai tracé auprès de MTAG. Deux sources, arbitrées dans computeLineGeometry :
//
//   1. /api/lines/json — le tracé statique publié pour la ligne. Complet (il
//      contient toutes les branches et variantes) mais ses extrémités sont
//      parfois sales.
//   2. /routers/default/plan — un itinéraire terminus à terminus dont on
//      extrait la polyligne. Propre, mais une seule requête ne voit qu'une
//      branche sur les lignes qui en ont plusieurs.
//
// On préfère le tracé du planificateur, sauf s'il couvre nettement moins de
// terrain que le tracé statique : c'est le signe qu'il manque une branche.
//
// Le résultat de cet arbitrage est mis en cache dans IndexedDB pour une
// semaine, de sorte qu'une ligne déjà vue ne rejoue ni les requêtes ni le
// calcul.

import { idbGet, idbSet } from "./persistentCache.js";
import { normalizeRouteRef } from "./routeRef.js";

const GEOMETRY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const LINES_ENDPOINT = "https://data.mobilites-m.fr/api/lines/json";
const PLAN_ENDPOINT = "https://data.mobilites-m.fr/api/routers/default/plan";
const STOPS_ENDPOINT_BASE =
  "https://data.mobilites-m.fr/api/routers/default/index/routes";

/**
 * @typedef {object} LineGeometry
 * @property {string} code   Code SEM_xxx de la ligne.
 * @property {object} geojson  FeatureCollection de LineString/MultiLineString.
 */

/** Normalise un code de ligne : "SEM:C1", "SEM_C1", "c1" deviennent "C1". */
function normalizeLineKey(value) {
  return normalizeRouteRef(value) || String(value || "").trim().toUpperCase();
}

function toSemCode(lineId) {
  return `SEM_${normalizeLineKey(lineId)}`;
}

function toSemRouteId(lineId) {
  const id = String(lineId || "").trim();
  if (id.startsWith("SEM:")) return id;
  return `SEM:${normalizeLineKey(id)}`;
}

/* ── 1. Tracé statique ─────────────────────────────────────────────────── */

const staticInflight = new Map();
const staticResults = new Map();

/**
 * Récupère le tracé statique d'une ligne. Mémoïsé : les géométries ne changent
 * pas en cours de session.
 *
 * @returns {Promise<LineGeometry | null>}
 */
export async function getLineGeometry(lineId, options) {
  const semCode = toSemCode(lineId);

  if (staticResults.has(semCode)) return staticResults.get(semCode) ?? null;
  if (staticInflight.has(semCode)) return staticInflight.get(semCode);

  const params = new URLSearchParams({ types: "ligne", codes: semCode });

  const promise = (async () => {
    try {
      const resp = await fetch(`${LINES_ENDPOINT}?${params}`, {
        signal: options?.signal,
      });
      if (!resp.ok) {
        staticResults.set(semCode, null);
        return null;
      }
      const data = await resp.json();

      let features;
      if (data?.type === "FeatureCollection") features = data.features;
      else if (data?.type === "Feature") features = [data];
      else if (Array.isArray(data?.features)) features = data.features;
      else {
        staticResults.set(semCode, null);
        return null;
      }

      features = (features || []).filter(
        (feature) =>
          feature?.geometry?.type === "LineString" ||
          feature?.geometry?.type === "MultiLineString",
      );
      if (features.length === 0) {
        staticResults.set(semCode, null);
        return null;
      }

      const result = {
        code: semCode,
        geojson: { type: "FeatureCollection", features },
      };
      staticResults.set(semCode, result);
      return result;
    } catch {
      return null;
    } finally {
      staticInflight.delete(semCode);
    }
  })();

  staticInflight.set(semCode, promise);
  return promise;
}

/* ── 2. Tracé issu du planificateur ────────────────────────────────────── */

const METRES_PER_DEG_LAT = 111320;
const METRES_PER_DEG_LON_AT_45 = 78710;

/** Écart maximal toléré entre une extrémité du tracé et son terminus. */
const ENDPOINT_MATCH_THRESHOLD_METERS = 300;

/**
 * Distance maximale entre un arrêt desservi et le tracé pour le considérer
 * couvert. Large : l'écart entre le quai et le centroïde du groupe d'arrêts
 * atteint déjà 100 m sur les grands boulevards.
 */
const STOP_COVERAGE_THRESHOLD_METERS = 200;

/**
 * Proportion d'arrêts devant être couverts pour retenir le tracé du moteur
 * d'itinéraires. En dessous, il manque une branche ou un bout de ligne.
 */
const MIN_STOP_COVERAGE_RATIO = 0.9;

/** Décode une polyligne Google en paires `[lon, lat]`. */
export function decodePolyline(encoded) {
  let index = 0;
  let lat = 0;
  let lon = 0;
  const coords = [];
  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
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

function distanceMeters(a, b) {
  const dLat = (a.lat - b.lat) * METRES_PER_DEG_LAT;
  const dLon = (a.lon - b.lon) * METRES_PER_DEG_LON_AT_45;
  return Math.hypot(dLat, dLon);
}

/** Distance d'un point à une polyligne, en mètres. */
function distanceToPolylineMetres(point, coords) {
  let bestSq = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [aLon, aLat] = coords[i];
    const [bLon, bLat] = coords[i + 1];

    const ax = (aLon - point.lon) * METRES_PER_DEG_LON_AT_45;
    const ay = (aLat - point.lat) * METRES_PER_DEG_LAT;
    const bx = (bLon - point.lon) * METRES_PER_DEG_LON_AT_45;
    const by = (bLat - point.lat) * METRES_PER_DEG_LAT;

    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;

    let t = 0;
    if (segLenSq > 0) {
      t = -(ax * dx + ay * dy) / segLenSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const distSq = cx * cx + cy * cy;
    if (distSq < bestSq) bestSq = distSq;
  }
  return Math.sqrt(bestSq);
}

const planCache = new Map();
const planInflight = new Map();

/**
 * Trace une ligne terminus à terminus via le moteur d'itinéraires.
 *
 * Renvoie `null` — pour que l'appelant retombe sur le tracé statique — quand :
 *   - on ne sait pas résoudre les deux termini,
 *   - le planificateur ne renvoie aucun itinéraire,
 *   - l'itinéraire renvoyé n'emprunte pas réellement cette ligne,
 *   - le tracé obtenu ne longe pas assez des arrêts de la ligne.
 *
 * @returns {Promise<LineGeometry | null>}
 */
export async function getLineGeometryViaPlan(lineId, options) {
  const key = normalizeLineKey(lineId);
  if (planCache.has(key)) return planCache.get(key) ?? null;
  if (planInflight.has(key)) return planInflight.get(key);

  const promise = (async () => {
    try {
      const stops = await getStopsServedByLine(lineId, {
        signal: options?.signal,
      });
      if (!stops || stops.length < 2) {
        planCache.set(key, null);
        return null;
      }
      const from = stops[0];
      const to = stops[stops.length - 1];

      const params = new URLSearchParams({
        fromPlace: `${from.lat},${from.lon}`,
        toPlace: `${to.lat},${to.lon}`,
        mode: "TRANSIT,WALK",
        numItineraries: "3",
      });
      const resp = await fetch(`${PLAN_ENDPOINT}?${params}`, {
        signal: options?.signal,
      });
      if (!resp.ok) {
        planCache.set(key, null);
        return null;
      }
      const data = await resp.json();
      const itineraries = data?.plan?.itineraries || [];
      if (itineraries.length === 0) {
        planCache.set(key, null);
        return null;
      }

      let bestCoords = null;
      for (const itinerary of itineraries) {
        for (const leg of itinerary?.legs || []) {
          if (leg?.mode === "WALK") continue;
          const legKey = normalizeLineKey(
            leg?.routeShortName || leg?.route || leg?.routeId || "",
          );
          if (legKey !== key) continue;
          const points = leg?.legGeometry?.points;
          if (!points) continue;
          const coords = decodePolyline(points);
          if (!bestCoords || coords.length > bestCoords.length) {
            bestCoords = coords;
          }
        }
      }

      if (!bestCoords || bestCoords.length < 2) {
        planCache.set(key, null);
        return null;
      }

      const planStart = { lon: bestCoords[0][0], lat: bestCoords[0][1] };
      const last = bestCoords[bestCoords.length - 1];
      const planEnd = { lon: last[0], lat: last[1] };
      const startGap = Math.min(
        distanceMeters(planStart, from),
        distanceMeters(planStart, to),
      );
      const endGap = Math.min(
        distanceMeters(planEnd, from),
        distanceMeters(planEnd, to),
      );
      if (
        startGap > ENDPOINT_MATCH_THRESHOLD_METERS ||
        endGap > ENDPOINT_MATCH_THRESHOLD_METERS
      ) {
        planCache.set(key, null);
        return null;
      }

      const covered = stops.filter(
        (stop) =>
          distanceToPolylineMetres(stop, bestCoords) <=
          STOP_COVERAGE_THRESHOLD_METERS,
      ).length;
      if (covered / stops.length < MIN_STOP_COVERAGE_RATIO) {
        planCache.set(key, null);
        return null;
      }

      const result = {
        code: `SEM_${key}`,
        geojson: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: bestCoords },
            },
          ],
        },
      };
      planCache.set(key, result);
      return result;
    } catch {
      return null;
    } finally {
      planInflight.delete(key);
    }
  })();

  planInflight.set(key, promise);
  return promise;
}

/* ── Arrêts desservis ──────────────────────────────────────────────────── */

const stopsResults = new Map();
const stopsInflight = new Map();

/** Extrait `{lat, lon}` d'un arrêt, quels que soient les noms de champs. */
function extractLatLon(stop) {
  const lat =
    typeof stop?.lat === "number"
      ? stop.lat
      : typeof stop?.latitude === "number"
        ? stop.latitude
        : typeof stop?.y === "number"
          ? stop.y
          : null;
  const lon =
    typeof stop?.lon === "number"
      ? stop.lon
      : typeof stop?.lng === "number"
        ? stop.lng
        : typeof stop?.longitude === "number"
          ? stop.longitude
          : typeof stop?.x === "number"
            ? stop.x
            : null;
  if (lat === null || lon === null) return null;
  return {
    lat,
    lon,
    name: typeof stop?.name === "string" ? stop.name : undefined,
  };
}

/**
 * Arrêts desservis par une ligne, dans l'ordre du parcours.
 *
 * @returns {Promise<Array<{lat: number, lon: number, name?: string}> | null>}
 */
export async function getStopsServedByLine(lineId, options) {
  const routeId = toSemRouteId(lineId);

  if (stopsResults.has(routeId)) return stopsResults.get(routeId) ?? null;
  if (stopsInflight.has(routeId)) return stopsInflight.get(routeId);

  const cacheKey = `servedStops_v1_${routeId}`;

  const promise = (async () => {
    try {
      const persisted = await idbGet(cacheKey);
      if (persisted?.value?.length) {
        stopsResults.set(routeId, persisted.value);
        return persisted.value;
      }

      const resp = await fetch(
        `${STOPS_ENDPOINT_BASE}/${encodeURIComponent(routeId)}/stops`,
        { signal: options?.signal },
      );
      if (!resp.ok) {
        stopsResults.set(routeId, null);
        return null;
      }
      const data = await resp.json();
      if (!Array.isArray(data)) {
        stopsResults.set(routeId, null);
        return null;
      }

      const points = data.map(extractLatLon).filter(Boolean);
      stopsResults.set(routeId, points);
      if (points.length > 0) void idbSet(cacheKey, points, GEOMETRY_TTL_MS);
      return points;
    } catch {
      return null;
    } finally {
      stopsInflight.delete(routeId);
    }
  })();

  stopsInflight.set(routeId, promise);
  return promise;
}

/* ── Arbitrage et cache disque ─────────────────────────────────────────── */

/** Longueur cumulée d'une géométrie, en degrés — suffisant pour un ratio. */
function totalPolylineLength(geometry) {
  let total = 0;
  for (const feature of geometry.geojson.features) {
    const geom = feature?.geometry;
    if (!geom) continue;
    const parts =
      geom.type === "LineString"
        ? [geom.coordinates]
        : geom.type === "MultiLineString"
          ? geom.coordinates
          : [];
    for (const coords of parts) {
      for (let i = 1; i < coords.length; i++) {
        total += Math.hypot(
          coords[i][0] - coords[i - 1][0],
          coords[i][1] - coords[i - 1][1],
        );
      }
    }
  }
  return total;
}

/** En dessous de ce ratio, le tracé du planificateur rate une branche. */
const PLAN_COVERAGE_THRESHOLD = 0.8;

async function computeLineGeometry(lineId) {
  const [viaPlan, staticGeometry] = await Promise.all([
    getLineGeometryViaPlan(lineId),
    getLineGeometry(lineId),
  ]);

  if (!viaPlan) return staticGeometry;
  if (!staticGeometry) return viaPlan;

  const planLength = totalPolylineLength(viaPlan);
  const staticLength = totalPolylineLength(staticGeometry);
  if (staticLength > 0 && planLength / staticLength < PLAN_COVERAGE_THRESHOLD) {
    return staticGeometry;
  }
  return viaPlan;
}

/**
 * Résout la géométrie d'une ligne en passant d'abord par IndexedDB. Le résultat
 * mis en cache est celui *après* arbitrage plan/statique : on ne rejoue ni le
 * calcul ni les requêtes au prochain affichage de la même ligne.
 *
 * @returns {Promise<LineGeometry | null>}
 */
export async function resolveLineGeometry(lineId) {
  const cacheKey = `lineGeometry_v1_${normalizeLineKey(lineId)}`;
  const cached = await idbGet(cacheKey);
  if (cached) return cached.value;

  const geometry = await computeLineGeometry(lineId);
  if (geometry) void idbSet(cacheKey, geometry, GEOMETRY_TTL_MS);
  return geometry;
}

/**
 * Aplatit une géométrie en une liste de branches `[[lon, lat], …][]`.
 *
 * On garde les branches séparées plutôt que de les concaténer : les mettre
 * bout à bout ferait tracer un segment fantôme de la fin de l'une au début de
 * la suivante, en travers de la ville.
 *
 * @param {LineGeometry | null | undefined} geometry
 * @returns {Array<Array<[number, number]>>}
 */
export function toLinePaths(geometry) {
  const paths = [];
  for (const feature of geometry?.geojson?.features || []) {
    const geom = feature?.geometry;
    if (!geom) continue;
    if (geom.type === "LineString") paths.push(geom.coordinates);
    else if (geom.type === "MultiLineString") paths.push(...geom.coordinates);
  }
  return paths.filter((path) => path.length > 1);
}

/**
 * Géométries de plusieurs lignes, indexées par code court normalisé ("C1",
 * "A", "NAVB"…). Les lignes dont le tracé est introuvable sont simplement
 * absentes de la Map : l'appelant retombe alors sur la polyligne OTP.
 *
 * @param {string[]} lineIds
 * @returns {Promise<Map<string, LineGeometry>>}
 */
export async function getLineGeometries(lineIds) {
  const keys = Array.from(
    new Set(lineIds.map(normalizeLineKey).filter(Boolean)),
  );
  const geometries = await Promise.all(keys.map(resolveLineGeometry));

  const byKey = new Map();
  keys.forEach((key, index) => {
    const geometry = geometries[index];
    if (geometry) byKey.set(key, geometry);
  });
  return byKey;
}
