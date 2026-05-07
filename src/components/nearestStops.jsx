import React, { useRef, useState, useEffect } from "react";
import { Sheet } from "react-modal-sheet";
import LineIcon from "./lines-icons.jsx";

async function fetchStopLines(stopCode) {
  try {
    const res = await fetch(
      `https://data.mobilites-m.fr/api/routers/default/index/clusters/${stopCode}/routes?allRoutes=true`,
    );
    const json = await res.json();
    return json.map((r) => r.shortName).filter(Boolean);
  } catch {
    return [];
  }
}

export function NearestStopsSheet({
  isOpen,
  onClose,
  stops,
  userLocation,
  onSelectStop,
  onWalkTo,
}) {
  const [selectedStop, setSelectedStop] = useState(null);
  const [stopLines, setStopLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [showCount, setShowCount] = useState(5);
  const lastStopRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedStop(null);
      setStopLines([]);
      setPage(0);
      setShowCount(5);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedStop) return;
    setLinesLoading(true);
    fetchStopLines(selectedStop.code).then((lines) => {
      setStopLines(lines);
      setLinesLoading(false);
    });
  }, [selectedStop]);

  useEffect(() => {
    if (showCount > 5 && scrollContainerRef.current) {
      setTimeout(() => {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    }
  }, [showCount]);

  const goToDetail = (stop) => {
    setSelectedStop(stop);
    requestAnimationFrame(() => requestAnimationFrame(() => setPage(1)));
  };

  const goToList = () => {
    setPage(0);
    setTimeout(() => {
      setSelectedStop(null);
      setStopLines([]);
    }, 300);
  };

  const nearest = userLocation
    ? [...stops]
        .map((s) => ({
          ...s,
          dist: Math.hypot(s.lat - userLocation.lat, s.lon - userLocation.lon),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, showCount)
    : [];

  const formatDist = (deg) => {
    const m = Math.round(deg * 111000);
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.35, 0.6, 1]}
      initialSnap={1}
      dragVelocityThreshold={200}
      dragCloseThreshold={0.3}
    >
      <Sheet.Container style={{ borderRadius: "24px 24px 0 0" }}>
        <Sheet.Header />
        <Sheet.Content disableDrag={(state) => state.scrollPosition !== "top"}>
          {/* Carrousel */}
          <div
            style={{
              overflow: "hidden",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "200%",
                height: "100%",
                transform: page === 0 ? "translateX(0)" : "translateX(-50%)",
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Page 0 — Liste */}
              <div
                style={{
                  width: "50%",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">
                      À proximité
                    </p>
                    <h2 className="text-base font-bold text-slate-900">
                      Arrêts les plus proches
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                  >
                    ×
                  </button>
                </div>
                <div
                  ref={scrollContainerRef}
                  className="overflow-y-auto flex-1 px-4 pb-8"
                >
                  {nearest.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">
                      Position non disponible.
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-100">
                      {nearest.map((stop, i) => (
                        <button
                          key={stop.id}
                          ref={i === nearest.length - 1 ? lastStopRef : null}
                          className="flex items-center justify-between py-3 w-full text-left hover:bg-slate-50 rounded-lg px-1 transition-colors"
                          onClick={() => goToDetail(stop)}
                        >
                          <span className="text-sm font-medium text-slate-800">
                            {stop.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                              {formatDist(stop.dist)}
                            </span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-4 h-4 text-slate-300"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m8.25 4.5 7.5 7.5-7.5 7.5"
                              />
                            </svg>
                          </div>
                        </button>
                      ))}
                      {showCount < 30 && stops.length > showCount && (
                        <button
                          className="py-3 w-full text-center text-sm text-blue-600 font-medium"
                          onClick={() =>
                            setShowCount((c) => Math.min(c + 5, 30))
                          }
                        >
                          Afficher plus
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Page 1 — Détail */}
              <div
                style={{
                  width: "50%",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToList}
                      className="text-slate-400 hover:text-slate-700 mr-1"
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
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        Arrêt
                      </p>
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedStop?.name}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                  >
                    ×
                  </button>
                </div>
                <div
                  ref={scrollContainerRef}
                  className="overflow-y-auto flex-1 px-4 pb-8"
                >
                  <div className="flex flex-col gap-4 pt-1">
                    <div>
                      {linesLoading ? (
                        <div className="flex gap-2">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="w-10 h-10 rounded-full bg-slate-100 animate-pulse"
                            />
                          ))}
                        </div>
                      ) : stopLines.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Aucune ligne trouvée.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {stopLines.map((line) => (
                            <LineIcon
                              key={line}
                              lineKey={line}
                              size="w-10 h-10"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <button
                        onClick={() => {
                          onWalkTo(selectedStop);
                          onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-normal text-xs"
                      >
                        Utiliser cet arrêt
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
