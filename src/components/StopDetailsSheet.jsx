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

function getAllPassages(payload) {
  if (!Array.isArray(payload)) return [];
  const now = Date.now() / 1000;
  const flat = [];

  payload.forEach((item) => {
    const route = lineKey(
      item.pattern?.route?.shortName || item.pattern?.id?.split(":")?.[1],
    );
    if (!route) return;

    // Fallback direction : headsign du pattern ou lastStopName
    const patternDirection =
      item.pattern?.headsign || item.pattern?.lastStopName || "—";

    const times = Array.isArray(item.times) ? item.times : [];
    times.forEach((st) => {
      const serviceDay = st.serviceDay ?? 0;
      const arrival = st.realtimeArrival ?? st.scheduledArrival ?? 0;
      const ts = serviceDay + arrival;
      const minutes = Math.round((ts - now) / 60);
      if (minutes < 0 || minutes > 90) return;

      // La direction réelle est sur chaque stoptime
      const direction =
        patternDirection || st.headsign || st.tripHeadsign || "—";

      flat.push({ route, direction, min: minutes });
    });
  });

  return flat.sort((a, b) => a.min - b.min);
}

function getPassagesForLine(payload, targetLine) {
  if (!Array.isArray(payload)) return [];
  const now = Date.now() / 1000;
  const flat = [];

  payload.forEach((item) => {
    const route = lineKey(
      item.pattern?.route?.shortName || item.pattern?.id?.split(":")?.[1],
    );
    if (route !== lineKey(targetLine)) return;

    const patternDirection =
      item.pattern?.headsign || item.pattern?.lastStopName || "—";

    const times = Array.isArray(item.times) ? item.times : [];
    times.forEach((st) => {
      const serviceDay = st.serviceDay ?? 0;
      const arrival = st.realtimeArrival ?? st.scheduledArrival ?? 0;
      const ts = serviceDay + arrival;
      const minutes = Math.round((ts - now) / 60);
      if (minutes < 0 || minutes > 90) return;

      const direction = st.headsign || st.tripHeadsign || patternDirection;

      flat.push({ direction, min: minutes });
    });
  });

  return flat.sort((a, b) => a.min - b.min);
}

function formatAbsoluteTime(min) {
  const d = new Date(Date.now() + min * 60000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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

function PassageCard({ route, direction, min, showLine = true }) {
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
          {formatAbsoluteTime(min)}
        </p>
      </div>

      {/* Séparateur */}
      <div className="w-px h-10 bg-gray-200 flex-shrink-0" />

      {/* Minutes restantes */}
      <div className="flex-shrink-0 text-right pr-1 min-w-[48px]">
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
      </div>
    </div>
  );
}

function PassageList({ passages, loading, showLine = true }) {
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
          showLine={showLine}
        />
      ))}
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
    () => (rawPayload ? getAllPassages(rawPayload) : []),
    [rawPayload],
  );

  const activeLinePassages = useMemo(() => {
    if (!activeLine || !rawPayload) return [];
    return getPassagesForLine(rawPayload, activeLine);
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
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Prochains passages
                </p>
                <PassageList
                  passages={allPassages}
                  loading={loading}
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

                  <div className="mt-5">
                    <PassageList
                      passages={activeLinePassages}
                      loading={loading}
                      showLine={false}
                    />
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
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
