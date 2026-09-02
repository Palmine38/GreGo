// Découpe le tracé de référence d'une ligne (utils/lineShapes.js) au tronçon
// réellement parcouru par un leg d'itinéraire.
//
// Une géométrie de référence contient souvent plusieurs variantes : branches,
// services partiels, aller et retour. On ne peut donc pas prendre le tracé tel
// quel — il faut choisir la variante qui dessert à la fois l'arrêt de montée,
// l'arrêt de descente et tous les arrêts intermédiaires annoncés, puis n'en
// garder que la portion comprise entre les deux extrémités.
//
// Le résultat est un sous-chemin *exact* du tracé publié : aucun sommet n'est
// déplacé, et les deux extrémités sont les projections des arrêts sur la
// polyligne, pas les arrêts eux-mêmes. C'est ce qui garantit que le tronçon
// d'un itinéraire se superpose au tracé de la ligne affiché depuis une fiche
// d'arrêt — les deux vues montrent alors littéralement la même voie.
//
// Recaler les extrémités sur les coordonnées de l'arrêt, comme on le faisait,
// déplaçait le trait de 6 à 56 m et faisait diverger les deux vues : la
// position d'un arrêt est le centroïde de son groupe de quais, qui n'est pas
// sur la voie.
//
// Si aucune variante ne convient, on renvoie `null` et l'appelant retombe sur
// la polyligne OTP recalée (magnetizeLegGeometry).

/**
 * Écart maximal entre un terminus du tronçon et la voie. Volontairement large :
 * la position OTP est celle du groupe d'arrêts, celle de la variante celle du
 * rail ou de la chaussée.
 */
const VARIANT_ENDPOINT_TOLERANCE_M = 220;

/**
 * Même tolérance pour les arrêts intermédiaires. Un seul arrêt hors tolérance
 * suffit à écarter la variante : c'est le signe qu'on regarde une autre branche.
 */
const VARIANT_STOP_TOLERANCE_M = 260;

// Conversion degrés → mètres, suffisante à la latitude de Grenoble.
const METRES_PER_DEG_LAT = 111320;
const METRES_PER_DEG_LON_AT_45 = 78710;

/** Aplatit une géométrie en une liste de variantes `[[lon, lat], …][]`. */
function extractVariants(geometry) {
  const variants = [];
  for (const feature of geometry?.geojson?.features || []) {
    const geom = feature?.geometry;
    if (!geom) continue;
    if (geom.type === "LineString") variants.push(geom.coordinates);
    else if (geom.type === "MultiLineString") variants.push(...geom.coordinates);
  }
  return variants.filter((coords) => coords.length >= 2);
}

function toStopRef(raw) {
  const lat = Number(raw?.lat ?? raw?.latitude);
  const lon = Number(raw?.lon ?? raw?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/**
 * Projette `point` sur la polyligne et renvoie le point le plus proche *sur* le
 * trait — pas le sommet le plus proche.
 *
 * `index` et `t` situent ce point : il est sur le segment `[index, index + 1]`,
 * à la fraction `t`. C'est ce qui permet ensuite de couper au bon endroit,
 * y compris au milieu d'un long segment.
 *
 * @returns {{index: number, t: number, lon: number, lat: number, meters: number} | null}
 */
function projectOntoPolyline(coords, point) {
  let best = null;

  for (let i = 0; i < coords.length - 1; i++) {
    const ax = (coords[i][0] - point.lon) * METRES_PER_DEG_LON_AT_45;
    const ay = (coords[i][1] - point.lat) * METRES_PER_DEG_LAT;
    const bx = (coords[i + 1][0] - point.lon) * METRES_PER_DEG_LON_AT_45;
    const by = (coords[i + 1][1] - point.lat) * METRES_PER_DEG_LAT;

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

    if (!best || distSq < best.distSq) {
      best = {
        distSq,
        index: i,
        t,
        lon: point.lon + cx / METRES_PER_DEG_LON_AT_45,
        lat: point.lat + cy / METRES_PER_DEG_LAT,
      };
    }
  }

  if (!best) return null;
  return {
    index: best.index,
    t: best.t,
    lon: best.lon,
    lat: best.lat,
    meters: Math.sqrt(best.distSq),
  };
}

/**
 * Extrait la portion de `coords` comprise entre deux projections, bornes
 * incluses. Les sommets d'origine sont recopiés tels quels ; seules les deux
 * extrémités sont des points calculés, et ils tombent sur le trait.
 */
function sliceBetween(coords, from, to) {
  const start = from.index + from.t;
  const end = to.index + to.t;
  const [lo, hi] = start <= end ? [from, to] : [to, from];

  const segment = [[lo.lon, lo.lat]];
  for (let i = lo.index + 1; i <= hi.index; i++) segment.push(coords[i]);
  segment.push([hi.lon, hi.lat]);

  if (start > end) segment.reverse();
  return segment;
}

/**
 * Choisit la meilleure variante et en extrait le tronçon montée → descente.
 * Le score départage les variantes qui passent toutes le filtre : c'est la
 * somme des écarts aux deux terminus, plus l'écart moyen aux intermédiaires.
 */
function cutReferenceSegment(variants, boarding, alighting, intermediates) {
  let best = null;

  for (const variant of variants) {
    const from = projectOntoPolyline(variant, boarding);
    const to = projectOntoPolyline(variant, alighting);
    if (!from || !to) continue;
    if (
      from.meters > VARIANT_ENDPOINT_TOLERANCE_M ||
      to.meters > VARIANT_ENDPOINT_TOLERANCE_M
    ) {
      continue;
    }
    if (from.index === to.index && from.t === to.t) continue;

    const segment = sliceBetween(variant, from, to);
    if (segment.length < 2) continue;

    let stopPenalty = 0;
    let rejected = false;
    for (const stop of intermediates) {
      const nearest = projectOntoPolyline(segment, stop);
      if (!nearest || nearest.meters > VARIANT_STOP_TOLERANCE_M) {
        rejected = true;
        break;
      }
      stopPenalty += nearest.meters;
    }
    if (rejected) continue;

    const score =
      from.meters +
      to.meters +
      (intermediates.length > 0 ? stopPenalty / intermediates.length : 0);
    if (!best || score < best.score) best = { coords: segment, score };
  }

  return best?.coords ?? null;
}

/**
 * Tronçon parcouru par `leg`, découpé dans le tracé de référence `geometry`.
 *
 * Le résultat suit exactement le tracé publié de la ligne : il commence et
 * finit au point du trait le plus proche des arrêts de montée et de descente,
 * ce qui peut laisser quelques dizaines de mètres entre le bout du trait et le
 * marqueur de l'arrêt — ce dernier étant posé sur le groupe d'arrêts, pas sur
 * la voie.
 *
 * @param {object} leg          Leg OTP (from, to, intermediateStops).
 * @param {object} [geometry]   LineGeometry de la ligne empruntée.
 * @returns {Array<[number, number]> | null} `null` si aucune variante ne colle.
 */
export function getLegSegmentFromReference(leg, geometry) {
  if (!geometry) return null;

  const boarding = toStopRef(leg?.from);
  const alighting = toStopRef(leg?.to);
  if (!boarding || !alighting) return null;

  const intermediates = (leg?.intermediateStops || [])
    .map(toStopRef)
    .filter(Boolean);

  const segment = cutReferenceSegment(
    extractVariants(geometry),
    boarding,
    alighting,
    intermediates,
  );
  return segment && segment.length >= 2 ? segment : null;
}
