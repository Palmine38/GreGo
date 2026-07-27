import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "./navbar.jsx";
import LineIcon from "./components/lines-icons.jsx";
import { DisruptionItem } from "./components/DisruptionItem.jsx";
import { useDisruptions } from "./hooks/useDisruptions.js";

const TRAM_ORDER = ["A", "B", "C", "D", "E"];

const NETWORKS = [
  { id: "all", label: "Tous" },
  { id: "TRAM", label: "Tram" },
  { id: "CHRONO", label: "Chrono" },
  { id: "PROXIMO", label: "Proximo" },
  { id: "FLEXO", label: "Flexo" },
  { id: "AUTRES", label: "Autres" },
];

function lineName(value) {
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

function rankOf(line) {
  const { name, network } = line;

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

export default function InfoTrafic() {
  const { disruptionsRaw } = useDisruptions();
  const [routes, setRoutes] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [network, setNetwork] = useState("all");
  const detailRef = useRef(null);

  useEffect(() => {
    fetch("https://data.mobilites-m.fr/api/routers/default/index/routes")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRoutes)
      .catch(() => setRoutes([]));
  }, []);

  const disruptedLines = useMemo(() => {
    const grouped = new Map();
    Object.values(disruptionsRaw).forEach((event) => {
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
  }, [disruptionsRaw, routes]);

  const visibleLines = disruptedLines.filter((line) => {
    if (network === "all") return line.network !== "AUTRES";
    return line.network === network;
  });

  const selectedLineData = disruptedLines.find(
    (line) => line.name === selectedLine,
  );

  const selectLine = (name) => {
    setSelectedLine(name);
  };

  // Scroll vers le détail dès que la ligne sélectionnée change (et donc dès
  // le premier clic, une fois la section montée dans le DOM). On recorrige
  // la position tant que le layout bouge encore (icônes qui chargent,
  // accordéon des perturbations qui s'ouvre, etc.), sinon le scroll peut
  // s'arrêter trop tôt ou trop tard selon ce qui a fini de se dessiner.
  useEffect(() => {
    if (!selectedLine) return;
    const target = detailRef.current;
    if (!target) return;

    const scrollToTarget = () =>
      target.scrollIntoView({ behavior: "smooth", block: "start" });

    let correctionTimeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(correctionTimeout);
      correctionTimeout = setTimeout(scrollToTarget, 50);
    });
    observer.observe(document.body);

    const initialFrame = requestAnimationFrame(() =>
      requestAnimationFrame(scrollToTarget),
    );

    // On arrête d'observer après un court laps de temps : le temps que les
    // images et animations se stabilisent, sans continuer indéfiniment.
    const stopObserving = setTimeout(() => observer.disconnect(), 800);

    return () => {
      cancelAnimationFrame(initialFrame);
      clearTimeout(correctionTimeout);
      clearTimeout(stopObserving);
      observer.disconnect();
    };
  }, [selectedLine]);

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Infotrafic</h1>
          {disruptedLines.length > 0 && (
            <select
              value={network}
              onChange={(event) => setNetwork(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
              aria-label="Trier par réseau"
            >
              {NETWORKS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="mt-2 text-sm text-slate-600">
          {disruptedLines.length
            ? `${disruptedLines.length} ligne${disruptedLines.length > 1 ? "s" : ""} perturbée${disruptedLines.length > 1 ? "s" : ""} actuellement.`
            : "Aucune perturbation en cours."}
        </p>

        {disruptedLines.length > 0 && (
          <section
            className="mt-4 grid grid-cols-5 gap-4"
            aria-label="Lignes perturbées"
          >
            {visibleLines.map((line) => (
              <button
                key={line.name}
                type="button"
                onClick={() => selectLine(line.name)}
                className="flex items-center justify-center rounded-lg transition active:scale-95"
                aria-label={`Voir les perturbations de la ligne ${line.name}`}
                title={`Ligne ${line.name}`}
              >
                <LineIcon lineKey={line.name} size="w-10 h-10" />
              </button>
            ))}
            {visibleLines.length === 0 && (
              <p className="col-span-5 rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                Aucune ligne dans ce réseau.
              </p>
            )}
          </section>
        )}

        {disruptedLines.length === 0 && (
          <p className="mt-6 rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            Le réseau ne signale aucune perturbation actuellement.
          </p>
        )}

        {selectedLineData && (
          <section
            ref={detailRef}
            className="mt-6 scroll-mt-6"
            aria-live="polite"
          >
            <div className="mb-3 mt-12 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LineIcon lineKey={selectedLineData.name} size="w-10 h-10" />
                <div>
                  <h2 className="font-bold text-slate-900">
                    Ligne {selectedLineData.name}
                  </h2>
                  <p className="text-xs font-medium text-amber-700">
                    {selectedLineData.events.length} perturbation
                    {selectedLineData.events.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLine(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fermer le détail"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-5"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {selectedLineData.events.map((evt, i) => (
                <DisruptionItem key={evt.id || i} evt={evt} defaultOpen />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
