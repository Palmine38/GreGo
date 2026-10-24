// Regroupement des perturbations TC par ligne, partagé par les vues desktop.
// Même logique que la page Infotrafic et sa sheet.

const TRAM_ORDER = ["A", "B", "C", "D", "E"];

export const NETWORKS = [
  { id: "all", label: "Tous" },
  { id: "TRAM", label: "Tram" },
  { id: "CHRONO", label: "Chrono" },
  { id: "PROXIMO", label: "Proximo" },
  { id: "FLEXO", label: "Flexo" },
  { id: "AUTRES", label: "Autres" },
];

export function lineName(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  const match = raw.match(/(?:SEM:|[A-Z0-9]+_)(.+)$/);
  return (match ? match[1] : raw).trim();
}

function networkFor(route) {
  const type = String(route?.type || "").toUpperCase();
  if (type === "TRAM") return "TRAM";
  if (type === "CHRONO" || type === "CHRONO_PERI") return "CHRONO";
  if (type === "PROXIMO") return "PROXIMO";
  if (type === "FLEXO") return "FLEXO";
  return "AUTRES";
}

function rankOf({ name, network }) {
  if (network === "TRAM") {
    const idx = TRAM_ORDER.indexOf(name);
    return { group: 0, order: idx === -1 ? 99 : idx };
  }
  if (network === "CHRONO") {
    const match = name.match(/^C(\d+)$/i);
    return { group: 1, order: match ? Number(match[1]) : 999 };
  }
  if (network === "PROXIMO") return { group: 2, order: null };
  if (network === "FLEXO") return { group: 3, order: null };
  return { group: 4, order: null };
}

function sortLines(a, b) {
  const ra = rankOf(a);
  const rb = rankOf(b);
  if (ra.group !== rb.group) return ra.group - rb.group;
  if (ra.order !== null && rb.order !== null) return ra.order - rb.order;
  return a.name.localeCompare(b.name, "fr", { numeric: true });
}

export function groupDisruptedLines(disruptionsRaw, routes) {
  const grouped = new Map();
  Object.values(disruptionsRaw || {}).forEach((event) => {
    if (!event.visibleTC) return;
    const name = lineName(event.listeLigne);
    if (!name) return;
    const route = routes.find(
      (item) => String(item.shortName || "").toUpperCase() === name,
    );
    const current = grouped.get(name) || {
      name,
      route,
      network: networkFor(route),
      events: [],
    };
    current.events.push(event);
    grouped.set(name, current);
  });
  return [...grouped.values()].sort(sortLines);
}

export function filterByNetwork(lines, network) {
  if (network === "all") return lines.filter((l) => l.network !== "AUTRES");
  return lines.filter((l) => l.network === network);
}

// Titre court d'une perturbation, sans le préfixe « Ligne X : ».
export function disruptionTitle(evt) {
  const first = String(evt?.texte || "")
    .split("|")[0]
    .trim()
    .replace(/^.*?:\s*/, "");
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}
