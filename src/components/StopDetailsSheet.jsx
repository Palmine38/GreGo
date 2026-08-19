import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "react-modal-sheet";
import LineIcon from "./lines-icons.jsx";
import { DisruptionItem } from "./DisruptionItem.jsx";
import { useTheme } from "../hooks/useTheme.js";

const lineKey = (value) =>
  String(value || "")
    .replace("SEM:", "")
    .toUpperCase();

function linesFromStopTimes(payload) {
  const values = Array.isArray(payload) ? payload : [];
  const lines = new Set();
  values.forEach((item) => {
    const route =
      item.pattern?.route?.shortName || item.pattern?.id?.split(":")?.[1];
    if (route) lines.add(lineKey(route));
  });
  return [...lines];
}

// Fonction générique : extrait les passages d'un payload OTP (temps réel OU
// horaires théoriques via /stoptimes/:date, même format de réponse), filtrés
// sur une fenêtre [minMinutes, maxMinutes] par rapport à "maintenant".
// - targetLine absent : retourne tous les passages, avec la ligne (`route`)
// - targetLine présent : ne garde que cette ligne, direction seule
function extractPassages(
  payload,
  { targetLine, minMinutes = 0, maxMinutes = 90 } = {},
) {
  if (!Array.isArray(payload)) return [];
  const now = Date.now() / 1000;
  const flat = [];
  const wantedLine = targetLine ? lineKey(targetLine) : null;

  payload.forEach((item) => {
    const route = lineKey(
      item.pattern?.route?.shortName || item.pattern?.id?.split(":")?.[1],
    );
    if (!route) return;
    if (wantedLine && route !== wantedLine) return;

    // Fallback direction : headsign du pattern ou lastStopName
    const patternDirection =
      item.pattern?.headsign || item.pattern?.lastStopName || "—";

    const times = Array.isArray(item.times) ? item.times : [];
    times.forEach((st) => {
      const serviceDay = st.serviceDay ?? 0;
      const arrival = st.realtimeArrival ?? st.scheduledArrival ?? 0;
      const ts = serviceDay + arrival;
      const minutes = Math.round((ts - now) / 60);
      if (minutes < minMinutes || minutes > maxMinutes) return;

      // La direction réelle est sur chaque stoptime
      const direction =
        st.headsign || st.tripHeadsign || patternDirection || "—";

      flat.push(
        wantedLine
          ? { direction, min: minutes, ts: ts * 1000 }
          : { route, direction, min: minutes, ts: ts * 1000 },
      );
    });
  });

  return flat.sort((a, b) => a.min - b.min);
}

// Format "XX:XX" à partir d'un timestamp absolu (ms) — utilisé pour l'heure
// absolue affichée à gauche des cards.
function formatTimeAt(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// Format "XXhXX" à partir d'un timestamp absolu (ms) — utilisé pour l'heure
// affichée à droite des cards en vue horaires théoriques.
function formatHourMinAt(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}
// AAAAMMJJ attendu par /index/clusters/:code/stoptimes/:date
function formatDateParam(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// Cache mémoire (hors composant) des horaires théoriques déjà chargés,
// pour éviter de re-fetch le même jour en naviguant d'une heure à l'autre,
// et pour partager la requête entre la vue "tous les passages" et la vue
// "détail d'une ligne" qui utilisent le même cluster.
const theoreticalCache = new Map();

async function fetchTheoreticalStoptimes(clusterId, dateStr) {
  const cacheKey = `${clusterId}::${dateStr}`;
  if (theoreticalCache.has(cacheKey)) return theoreticalCache.get(cacheKey);
  const res = await fetch(
    `https://data.mobilites-m.fr/api/routers/default/index/clusters/${clusterId}/stoptimes/${dateStr}`,
  );
  if (!res.ok) throw new Error("Échec du chargement des horaires théoriques");
  const data = await res.json();
  theoreticalCache.set(cacheKey, data);
  return data;
}

function DirectionText({ direction }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const check = () => {
      if (containerRef.current && measureRef.current) {
        setOverflowing(
          measureRef.current.scrollWidth > containerRef.current.clientWidth,
        );
      }
    };
    check();
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [direction]);

  return (
    <div ref={containerRef} className="relative overflow-hidden w-full h-5">
      {/* mesure invisible, toujours présente */}
      <span
        ref={measureRef}
        className="text-sm font-semibold whitespace-nowrap invisible absolute -z-10"
      >
        {direction}
      </span>

      {overflowing ? (
        <>
          <span className="line-icon-marquee-track text-sm font-semibold text-gray-900 absolute top-0 left-0">
            {direction}
          </span>
          <span className="line-icon-marquee-track-delayed text-sm font-semibold text-gray-900">
            {direction}
          </span>
        </>
      ) : (
        <p className="text-sm font-semibold text-gray-900 truncate absolute inset-0">
          {direction}
        </p>
      )}

      <style>{`
  @keyframes lineIconMarquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
  .line-icon-marquee-track { display: inline-block; white-space: nowrap; animation: lineIconMarquee 19s linear infinite; padding-right: 2em; }
  .line-icon-marquee-track-delayed { display: inline-block; white-space: nowrap; animation: lineIconMarquee 19s linear infinite; animation-delay: -9.5s; position: absolute; top: 0; left: 0; padding-right: 2em; }
`}</style>
    </div>
  );
}

function PassageCard({
  route,
  direction,
  min,
  ts,
  showLine = true,
  theoretical = false,
}) {
  const isNow = min === 0;
  const isSoon = min > 0 && min <= 5;

  return (
    <div className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-3xl shadow-md">
      {showLine && (
        <>
          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
            <LineIcon lineKey={route} size="w-12 h-12" />
          </div>
        </>
      )}

      {/* Direction + heure absolue */}
      <div className="flex-1 min-w-0">
        <DirectionText direction={direction} />
        <p className="text-sm text-gray-600 mt-0.5 font-medium">
          {formatTimeAt(ts)}
        </p>
      </div>

      {/* Séparateur */}
      <div className="w-px h-10 bg-gray-200 flex-shrink-0" />

      {/* Horaires théoriques : heure au format XXhXX / Temps réel : minutes restantes */}
      <div className="flex-shrink-0 text-right pr-1 min-w-[48px]">
        {theoretical ? (
          <p className="text-lg tabular-nums text-gray-900 font-bold">
            {formatHourMinAt(ts)}
          </p>
        ) : (
          <p
            className={`text-lg tabular-nums ${
              isNow
                ? "text-red-500 font-bold"
                : isSoon
                  ? "text-amber-500 font-bold"
                  : "text-gray-900 font-bold"
            }`}
          >
            {isNow ? (
              <>
                <span className="font-bold">0</span>
                <span className="font-medium">m</span>
              </>
            ) : (
              <>
                <span className="font-bold">{min}</span>
                <span className="font-medium">m</span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function PassageList({
  passages,
  loading,
  showLine = true,
  theoretical = false,
}) {
  if (loading && passages.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-3xl bg-slate-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!loading && passages.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">
        Aucun passage dans les 90 prochaines minutes.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {passages.map((p, i) => (
        <PassageCard
          key={`${p.route ?? ""}-${p.direction}-${p.min}-${i}`}
          route={p.route}
          direction={p.direction}
          min={p.min}
          ts={p.ts}
          showLine={showLine}
          theoretical={theoretical}
        />
      ))}
    </div>
  );
}

// Bloc "Prochains passages" : temps réel par défaut, avec repli automatique
// (et bascule manuelle) sur les horaires théoriques via
// /index/clusters/:code/stoptimes/:date. La vue théorique montre toujours
// la journée complète (de minuit à 23h59), sans navigation par fenêtre.
function PassageSection({
  title,
  realtimePassages,
  realtimeLoading,
  clusterId,
  targetLine,
  showLine,
}) {
  const [manualTheoretical, setManualTheoretical] = useState(false);
  const [dayPayload, setDayPayload] = useState(null);
  const [loadedDate, setLoadedDate] = useState(null);
  const [theoreticalLoading, setTheoreticalLoading] = useState(false);
  const [theoreticalError, setTheoreticalError] = useState(false);
  // Ref miroir de dayPayload : évite de dépendre d'une référence d'objet
  // dans le tableau de deps du useEffect ci-dessous, qui provoquait un
  // rechargement en boucle (loading infini) sur certains enchaînements
  // de renders (ex : clic sur une ligne sans passage temps réel).
  const dayPayloadRef = useRef(null);

  const noRealtime = !realtimeLoading && realtimePassages.length === 0;
  const isTheoreticalView = manualTheoretical || noRealtime;

  // Reset à chaque changement d'arrêt / de ligne affichée
  useEffect(() => {
    setManualTheoretical(false);
    setDayPayload(null);
    dayPayloadRef.current = null;
    setLoadedDate(null);
    setTheoreticalError(false);
  }, [clusterId, targetLine]);

  // Si le temps réel redevient disponible, on repasse dessus automatiquement
  useEffect(() => {
    if (!noRealtime) setManualTheoretical(false);
  }, [noRealtime]);

  useEffect(() => {
    if (!isTheoreticalView || !clusterId) return undefined;

    const dateStr = formatDateParam(new Date());
    if (dateStr === loadedDate && dayPayloadRef.current) return undefined;

    let cancelled = false;
    setTheoreticalLoading(true);
    setTheoreticalError(false);

    fetchTheoreticalStoptimes(clusterId, dateStr)
      .then((data) => {
        if (cancelled) return;
        dayPayloadRef.current = data;
        setDayPayload(data);
        setLoadedDate(dateStr);
      })
      .catch(() => {
        if (cancelled) return;
        dayPayloadRef.current = [];
        setDayPayload([]);
        setLoadedDate(dateStr);
        setTheoreticalError(true);
      })
      .finally(() => {
        if (!cancelled) setTheoreticalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTheoreticalView, clusterId, loadedDate]);

  const theoreticalPassages = useMemo(() => {
    if (!dayPayload) return [];
    // Journée complète : le payload est déjà scopé à une seule journée
    // (endpoint /stoptimes/:date), on prend tout, trié du plus tôt (minuit)
    // au plus tard (23h59), sans filtrer sur une fenêtre relative à "maintenant".
    return extractPassages(dayPayload, {
      targetLine,
      minMinutes: -2000,
      maxMinutes: 2000,
    });
  }, [dayPayload, targetLine]);

  return (
    <div>
      {(title || isTheoreticalView) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {title}
            </p>
          ) : (
            <span />
          )}
          {isTheoreticalView && (
            <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
              Horaires théoriques
            </span>
          )}
        </div>
      )}

      {isTheoreticalView ? (
        <>
          {theoreticalPassages.length === 0 && !theoreticalLoading ? (
            <p className="text-sm text-slate-500 py-2">
              {theoreticalError
                ? "Horaires théoriques indisponibles."
                : "Aucun horaire théorique aujourd'hui."}
            </p>
          ) : (
            <PassageList
              passages={theoreticalPassages}
              loading={theoreticalLoading}
              showLine={showLine}
              theoretical
            />
          )}

          {!noRealtime && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
                onClick={() => setManualTheoretical(false)}
              >
                Revenir au temps réel
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <PassageList
            passages={realtimePassages}
            loading={realtimeLoading}
            showLine={showLine}
          />
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
              onClick={() => setManualTheoretical(true)}
            >
              Voir horaires théoriques
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function StopDetailsSheet({
  stop,
  isOpen,
  onClose,
  onSetArrival,
  onLineSelect,
  activeLine,
  onBack,
  getLineDisruptions,
}) {
  const theme = useTheme();
  const disruptedColor = theme !== "light" ? "#ea580c" : "#e61e1e";
  const pdfActionClass =
    theme === "light"
      ? "text-slate-500 hover:text-slate-800 focus-visible:text-slate-700 focus-visible:ring-slate-400 focus-visible:ring-offset-white"
      : "text-slate-300 hover:text-white focus-visible:text-white focus-visible:ring-slate-500 focus-visible:ring-offset-slate-800";
  const [rawPayload, setRawPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const autoSelectedStopId = useRef(null);

  useEffect(() => {
    if (!isOpen || !stop?.stopTimesClusterId) return undefined;
    let cancelled = false;
    setLoading(true);
    setRawPayload(null);

    fetch(
      `https://data.mobilites-m.fr/api/routers/default/index/clusters/${stop.stopTimesClusterId}/stoptimes`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setRawPayload(data);
      })
      .catch(() => {
        if (!cancelled) setRawPayload([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, stop?.stopTimesClusterId]);

  const apiLines = useMemo(
    () => (rawPayload ? linesFromStopTimes(rawPayload) : []),
    [rawPayload],
  );

  const lines = useMemo(
    () => [
      ...new Set(
        [...(stop?.lines || []), ...apiLines].map(lineKey).filter(Boolean),
      ),
    ],
    [stop?.lines, apiLines],
  );

  const allPassages = useMemo(
    () => (rawPayload ? extractPassages(rawPayload) : []),
    [rawPayload],
  );

  const activeLinePassages = useMemo(() => {
    if (!activeLine || !rawPayload) return [];
    return extractPassages(rawPayload, { targetLine: activeLine });
  }, [activeLine, rawPayload]);

  useEffect(() => {
    if (!isOpen) {
      autoSelectedStopId.current = null;
      return;
    }
    if (lines.length === 1 && autoSelectedStopId.current !== stop?.stopId) {
      autoSelectedStopId.current = stop?.stopId;
      onLineSelect?.(lines[0], false);
    }
  }, [isOpen, lines, stop?.stopId]);

  if (!stop) return null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.35, 0.72, 1]}
      initialSnap={2}
    >
      <Sheet.Container
        style={{ borderRadius: "24px 24px 0 0", overflow: "hidden" }}
      >
        <Sheet.Header />
        <Sheet.Content>
          <div className="relative h-full overflow-hidden">
            {/* ── Vue principale ── */}
            <div
              className="flex h-full flex-col px-5 pb-8 overflow-y-auto transition-transform duration-300 ease-out"
              style={{
                transform: activeLine ? "translateX(-100%)" : "translateX(0)",
              }}
            >
              <div className="flex items-start justify-between gap-4 pt-1">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Arrêt
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {stop.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {stop.city || "Grenoble et agglomération"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSetArrival(stop)}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm active:scale-95 flex items-center gap-2"
                >
                  GO
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-4 border-tpt-5">
                {loading && lines.length === 0 ? (
                  <p className="text-sm text-slate-500">Chargement…</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {lines.map((line) => {
                      const disrupted = getLineDisruptions?.(line)?.length > 0;
                      return (
                        <button
                          key={line}
                          type="button"
                          onClick={() => onLineSelect?.(line)}
                          className="relative rounded-2xl p-1 transition active:scale-95"
                          aria-label={`Afficher la ligne ${line}`}
                        >
                          <LineIcon lineKey={line} size="w-12 h-12" />
                          {disrupted && (
                            <span
                              className="absolute -bottom-1 -right-1"
                              style={{ color: disruptedColor }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="size-6"
                              >
                                <path
                                  d="M8 3.5 3 12.5h10L8 3.5Z"
                                  fill="white"
                                />
                                <path
                                  fillRule="evenodd"
                                  d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {!loading && lines.length === 0 && (
                      <p className="text-sm text-slate-500">
                        Aucune ligne disponible.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <PassageSection
                  title="Prochains passages"
                  realtimePassages={allPassages}
                  realtimeLoading={loading}
                  clusterId={stop.stopTimesClusterId}
                  showLine
                />
              </div>
            </div>

            {/* ── Vue détail ligne ── */}
            <div
              className="absolute inset-0 flex h-full flex-col px-5 pb-8 overflow-y-auto transition-transform duration-300 ease-out"
              style={{
                transform: activeLine ? "translateX(0)" : "translateX(100%)",
              }}
            >
              {activeLine && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onBack}
                      aria-label="Retour à l'arrêt"
                      className="flex size-9 items-center justify-center rounded-full text-slate-700"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 19.5 8.25 12l7.5-7.5"
                        />
                      </svg>
                    </button>
                    <LineIcon lineKey={activeLine} size="w-10 h-10" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Ligne {activeLine}
                      </p>
                      <h2 className="text-lg font-bold text-slate-900">
                        Prochains passages
                      </h2>
                    </div>
                  </div>

                  <div className="mt-5 pb-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                      Infotrafic
                    </p>
                    {(getLineDisruptions?.(activeLine) || []).length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aucune perturbation en cours.
                      </p>
                    ) : (
                      getLineDisruptions(activeLine).map((evt, index) => (
                        <DisruptionItem key={index} evt={evt} />
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex justify-left gap-5 border-b border-slate-100 pb-3">
                    <a
                      href={`https://www.reso-m.fr/ftp/fiche_horaires/fiche_horaires_2014/PLAN_${lineKey(activeLine)}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${pdfActionClass}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="size-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
                        />
                      </svg>
                      Plan en PDF
                    </a>
                    <a
                      href={`https://www.reso-m.fr/ftp/fiche_horaires/fiche_horaires_2014/PLAN_${lineKey(activeLine)}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${pdfActionClass}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="size-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                      </svg>
                      Horaires en PDF
                    </a>
                  </div>

                  <div className="mt-5">
                    <PassageSection
                      realtimePassages={activeLinePassages}
                      realtimeLoading={loading}
                      clusterId={stop.stopTimesClusterId}
                      targetLine={activeLine}
                      showLine={false}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop style={{ pointerEvents: "none" }} />
    </Sheet>
  );
}
