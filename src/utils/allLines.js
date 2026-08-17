// utils/allLines.js
//
// Catalogue des lignes du réseau (SEM, SE2, TER "SNC"…), avec désambiguïsation
// par priorité réseau. Centralise ce qui était dupliqué et incohérent entre
// lines-icons.jsx, JourneyTimeline.jsx et JourneyDetailsSheet.jsx : chacun
// refaisait sa propre requête `/index/routes` et son propre `.find()`, sans
// se soucier des codes partagés entre réseaux (voir NETWORK_PRIORITY
// ci-dessous). Un seul fetch, un seul cache, un seul lookup.

const ENDPOINT = "https://data.mobilites-m.fr/api/routers/default/index/routes";
const STORAGE_KEY = "greLines_allLinesCache_v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cache = null;
let inflight = null;
let cacheHydrated = false;

function canUseLocalStorage() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function hydrateCache() {
  if (cacheHydrated) return;
  cacheHydrated = true;
  if (!canUseLocalStorage()) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.data) ||
      typeof parsed.timestamp !== "number"
    )
      return;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return;
    cache = parsed.data;
  } catch {
    // cache corrompu ou localStorage indisponible : on retombe sur un fetch réseau
  }
}

function persistCache(lines) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: lines }),
    );
  } catch {
    // quota dépassé, navigation privée… tant pis, on refetch la prochaine fois
  }
}

function withHash(hex, fallback) {
  if (!hex) return fallback;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

/**
 * Réseaux prioritaires pour un code de ligne ambigu.
 *
 * Trois codes existent sur deux réseaux à la fois : `C1` et `C6` (SEM et
 * SNC), `C11` (SE2 et SNC). Ce sont des lignes TER qui portent les mêmes
 * numéros que des lignes urbaines. Sans arbitrage, la ligne retenue pour un
 * code nu dépendait de l'ordre de réponse de l'API — d'où, par le passé, des
 * badges "C1" parfois affichés avec la couleur du TER.
 *
 * L'ordre dit ce que désigne un code nu : dans cette appli centrée sur
 * l'agglomération, « C1 » veut dire la ligne urbaine.
 */
export const NETWORK_PRIORITY = [
  "SEM",
  "SE2",
  "GSV",
  "TPV",
  "BUL",
  "FUN",
  "TRA",
  "MCO",
  "SNC",
  "C38",
];

function networkRank(id) {
  const rank = NETWORK_PRIORITY.indexOf(String(id).slice(0, 3).toUpperCase());
  return rank === -1 ? NETWORK_PRIORITY.length : rank;
}

/**
 * Renvoie toutes les lignes du catalogue (id, shortName, longName, couleurs,
 * type). Mise en cache mémoire + localStorage (7 jours). Renvoie un tableau
 * vide en cas d'échec pour que les appelants puissent quand même afficher
 * des couleurs par défaut.
 */
export async function getAllLines() {
  hydrateCache();
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const resp = await fetch(ENDPOINT);
      if (!resp.ok) return [];
      const data = await resp.json();
      if (!Array.isArray(data)) return [];
      const lines = data
        .map((r) => ({
          id: String(r?.id || ""),
          shortName: String(r?.shortName || ""),
          longName: String(r?.longName || ""),
          color: withHash(r?.color, "#94A3B8"),
          textColor: withHash(r?.textColor, "#FFFFFF"),
          type: String(r?.type || ""),
        }))
        .filter((l) => l.shortName);
      cache = lines;
      persistCache(lines);
      return lines;
    } catch {
      return cache || [];
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Index des lignes, par identifiant complet et par code nu.
 *
 * L'identifiant complet ("SEM:C1") est toujours exact. Le code nu ("C1") ne
 * l'est pas quand deux réseaux le partagent : il désigne alors la ligne du
 * réseau le plus prioritaire (voir NETWORK_PRIORITY). Les appelants qui
 * connaissent l'identifiant complet doivent le passer plutôt que le code nu.
 */
export function buildLineLookup(lines) {
  const m = new Map();

  // Les identifiants complets d'abord : ils ne peuvent pas entrer en conflit.
  for (const line of lines) {
    m.set(line.id.toUpperCase().trim(), line);
  }

  // Puis les codes nus, du réseau le plus prioritaire au moins prioritaire,
  // en ne remplaçant jamais une entrée déjà posée.
  for (const line of [...lines].sort(
    (a, b) => networkRank(a.id) - networkRank(b.id),
  )) {
    const id = line.id.toUpperCase().trim();
    for (const key of [
      line.shortName.toUpperCase().trim(),
      id.replace(/^(?:SEM:|SEM_)/, ""),
    ]) {
      if (key && !m.has(key)) m.set(key, line);
    }
  }

  return m;
}
