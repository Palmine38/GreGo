import React, { useEffect, useRef, useState } from "react";
import { JourneyTimeline } from "./JourneyTimeline.jsx";
import { useCurrentTime } from "../hooks/useCurrentTime.js";
import { formatTimeUntil } from "../utils/journey.js";
import MapLibreMap, { Marker, Source, Layer } from "react-map-gl/maplibre";
import LineIcon, { LINE_COLORS, preloadLineData } from "./lines-icons.jsx";
import { Sheet } from "react-modal-sheet";

const MAPTILER_STYLE_URL =
  "https://api.maptiler.com/maps/019d0d02-359b-7f4b-a797-bdeabca9dce3/style.json?key=7TQErbyvEqFlis3QMmSl";

const ArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5 flex-shrink-0"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
    />
  </svg>
);

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

function midpoint(coords) {
  if (!coords.length) return null;
  return coords[Math.floor(coords.length / 2)];
}

/**
 * Carte inline déroulante pour un itinéraire.
 * S'affiche/masque avec une animation CSS height.
 */
export function InlineJourneyMap({ journey, lineColors, isOpen }) {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(13);
  const [iconsReady, setIconsReady] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);

  // On monte la carte dès le premier open pour éviter de la re-créer
  useEffect(() => {
    if (isOpen && !mapMounted) setMapMounted(true);
  }, [isOpen, mapMounted]);

  useEffect(() => {
    if (!journey) return;
    const allLegs = journey.allLegs || [];
    const transitLegs = allLegs.filter((l) => l.mode !== "WALK");
    const allLineKeys = transitLegs
      .map((leg) =>
        (leg.routeShortName || leg.route || leg.routeId || "")
          .replace("SEM:", "")
          .toUpperCase(),
      )
      .filter(Boolean);
    preloadLineData([...new Set(allLineKeys)]).then(() => setIconsReady(true));
  }, [journey]);

  if (!journey) return null;

  const allLegs = journey.allLegs || [];
  const transitLegs = allLegs.filter((leg) => leg.mode !== "WALK");

  const allCoords = allLegs.flatMap((leg) =>
    leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : [],
  );
  const lats = allCoords.map(([, lat]) => lat);
  const lons = allCoords.map(([lon]) => lon);
  const bounds =
    allCoords.length >= 2
      ? [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ]
      : null;

  const departureMarker = transitLegs[0]
    ? { lon: transitLegs[0].from?.lon, lat: transitLegs[0].from?.lat }
    : null;
  const arrivalMarker = transitLegs[transitLegs.length - 1]
    ? {
        lon: transitLegs[transitLegs.length - 1].to?.lon,
        lat: transitLegs[transitLegs.length - 1].to?.lat,
      }
    : null;

  const transferMarkers = transitLegs
    .slice(0, -1)
    .map((leg) => ({
      lon: leg.to?.lon,
      lat: leg.to?.lat,
      name: leg.to?.name,
    }))
    .filter((m) => m.lon && m.lat);

  const allIntermediateStops = transitLegs.flatMap((leg) => {
    const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
      .replace("SEM:", "")
      .toUpperCase();
    const color = LINE_COLORS[lineName] || lineColors?.[lineName] || "#94A3B8";
    return (leg.intermediateStops || []).map((s) => ({
      lon: s.lon,
      lat: s.lat,
      name: s.name,
      color,
    }));
  });

  const legMidpoints = transitLegs
    .map((leg) => {
      if (!leg.legGeometry?.points) return null;
      const coords = decodePolyline(leg.legGeometry.points);
      const mid = midpoint(coords);
      if (!mid) return null;
      const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
        .replace("SEM:", "")
        .toUpperCase();
      return { lon: mid[0], lat: mid[1], lineName };
    })
    .filter(Boolean);

  const transitLines = [
    ...new Set(
      transitLegs
        .map((leg) =>
          (leg.routeShortName || leg.route || leg.routeId || "")
            .replace("SEM:", "")
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        transition: "grid-template-rows 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            height: 280,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 16,
            opacity: isOpen ? 1 : 0,
            transition: "opacity 0.3s ease 0.1s",
            touchAction: "none",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
        >
          {mapMounted && (
            <MapLibreMap
              ref={mapRef}
              mapStyle={MAPTILER_STYLE_URL}
              initialViewState={
                bounds
                  ? { bounds, fitBoundsOptions: { padding: 32 } }
                  : { longitude: 5.74892, latitude: 45.18501, zoom: 13 }
              }
              style={{ width: "100%", height: "100%" }}
              onZoom={(e) => setZoom(e.viewState.zoom)}
            >
              {/* Tracés */}
              {allLegs.map((leg, i) => {
                if (!leg.legGeometry?.points) return null;
                const coords = decodePolyline(leg.legGeometry.points);
                const isWalk = leg.mode === "WALK";
                const lineName = (
                  leg.routeShortName ||
                  leg.route ||
                  leg.routeId ||
                  ""
                )
                  .replace("SEM:", "")
                  .toUpperCase();
                const color =
                  LINE_COLORS[lineName] || lineColors?.[lineName] || "#94A3B8";
                return (
                  <Source
                    key={`leg-${i}`}
                    id={`leg-${i}`}
                    type="geojson"
                    data={{
                      type: "Feature",
                      geometry: { type: "LineString", coordinates: coords },
                    }}
                  >
                    <Layer
                      id={`leg-line-${i}`}
                      type="line"
                      beforeId="Road labels"
                      paint={{
                        "line-color": isWalk ? "#94A3B8" : color,
                        "line-width": isWalk ? 3 : 5,
                        "line-dasharray": isWalk ? [2, 2] : [1],
                      }}
                      layout={{ "line-cap": "round", "line-join": "round" }}
                    />
                  </Source>
                );
              })}

              {/* Arrêts intermédiaires (zoom >= 16) */}
              {zoom >= 16 &&
                allIntermediateStops.map((m, i) => (
                  <Marker
                    key={`stop-${i}`}
                    longitude={m.lon}
                    latitude={m.lat}
                    anchor="center"
                  >
                    <div
                      title={m.name}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: "white",
                        border: `2px solid ${m.color}`,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }}
                    />
                  </Marker>
                ))}

              {/* Correspondances */}
              {transferMarkers.map((m, i) => (
                <Marker
                  key={`transfer-${i}`}
                  longitude={m.lon}
                  latitude={m.lat}
                  anchor="center"
                >
                  <div
                    title={m.name}
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      backgroundColor: "white",
                      border: "2.5px solid #334155",
                      boxShadow: "0 1px 5px rgba(0,0,0,0.35)",
                    }}
                  />
                </Marker>
              ))}

              {/* Noms départ/arrivée — zoom >= 11 */}
              {zoom >= 9 &&
                [
                  transitLegs[0] && {
                    lon: transitLegs[0].from?.lon,
                    lat: transitLegs[0].from?.lat,
                    name: transitLegs[0].from?.name,
                  },
                  transitLegs.length > 0 && {
                    lon: transitLegs[transitLegs.length - 1].to?.lon,
                    lat: transitLegs[transitLegs.length - 1].to?.lat,
                    name: transitLegs[transitLegs.length - 1].to?.name,
                  },
                ]
                  .filter((s) => s && s.lon && s.lat && s.name)
                  .map((s, i) => (
                    <Marker
                      key={`endlabel-${i}`}
                      longitude={s.lon}
                      latitude={s.lat}
                      anchor="top"
                    >
                      <div
                        style={{
                          marginTop: 6,
                          background: "white",
                          borderRadius: 6,
                          padding: "2px 6px",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                          whiteSpace: "nowrap",
                          fontFamily: "Montserrat, sans-serif",
                          pointerEvents: "none",
                        }}
                      >
                        {s.name.replace(/^[^,]+,\s*/, "")}
                      </div>
                    </Marker>
                  ))}

              {/* Noms arrêts intermédiaires — zoom >= 14 */}
              {zoom >= 14 &&
                transitLegs.slice(1).map(
                  (leg, i) =>
                    leg.from?.lon &&
                    leg.from?.lat &&
                    leg.from?.name && (
                      <Marker
                        key={`midlabel-${i}`}
                        longitude={leg.from.lon}
                        latitude={leg.from.lat}
                        anchor="top"
                      >
                        <div
                          style={{
                            marginTop: 6,
                            background: "white",
                            borderRadius: 6,
                            padding: "2px 6px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#334155",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                            whiteSpace: "nowrap",
                            fontFamily: "Montserrat, sans-serif",
                            pointerEvents: "none",
                          }}
                        >
                          {leg.from.name.replace(/^[^,]+,\s*/, "")}
                        </div>
                      </Marker>
                    ),
                )}

              {/* Départ / arrivée */}
              {[departureMarker, arrivalMarker].filter(Boolean).map((m, i) => (
                <Marker
                  key={`endpoint-${i}`}
                  longitude={m.lon}
                  latitude={m.lat}
                  anchor="center"
                >
                  <div
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      backgroundColor: "white",
                      border: "2.5px solid #334155",
                      boxShadow: "0 1px 5px rgba(0,0,0,0.35)",
                    }}
                  />
                </Marker>
              ))}
              {/* Icônes de ligne */}
              {iconsReady &&
                legMidpoints.map((m, i) => (
                  <Marker
                    key={`lineicon-${i}`}
                    longitude={m.lon}
                    latitude={m.lat}
                    anchor="center"
                  >
                    <div
                      style={{
                        all: "initial",
                        fontFamily: "Montserrat, sans-serif",
                      }}
                    >
                      <LineIcon lineKey={m.lineName} size="w-7 h-7" />
                    </div>
                  </Marker>
                ))}
            </MapLibreMap>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Panneau glissant affichant le détail d'un trajet.
 *
 * Props :
 *   journey        — itinéraire sélectionné (ou null)
 *   isOpen         — bool
 *   onClose        — callback fermeture
 *   lineColors     — map couleurs
 *   getLineDisruptions — fn(lineName) → []
 */
export function JourneyDetailsSheet({
  journey,
  isOpen,
  onClose,
  lineColors,
  getLineDisruptions,
  hideBackdrop = false,
}) {
  const currentTime = useCurrentTime();
  const [height, setHeight] = useState(60);
  const [mapOpen, setMapOpen] = useState(false);
  const scrollRef = useRef(null);

  // Reset quand un nouveau trajet est sélectionné
  useEffect(() => {
    if (journey) {
      setHeight(60);
      setMapOpen(false);
    }
  }, [journey]);

  const handleToggleMap = () => {
    setMapOpen((prev) => !prev);
    // Agrandir légèrement la sheet si elle est petite pour laisser de la place à la carte
    if (!mapOpen && height < 80) setHeight(85);
  };

  if (!journey) return null;

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        snapPoints={[0, 0.6, 1]}
        initialSnap={1}
      >
        <Sheet.Container style={{ borderRadius: "24px 24px 0 0" }}>
          <Sheet.Header />
          <Sheet.Content
            disableDrag={(state) => state.scrollPosition !== "top"}
          >
            {/* Contenu scrollable */}
            <div ref={scrollRef} className="overflow-y-auto flex-1 px-4 pb-4">
              <button
                type="button"
                onClick={onClose}
                className="text-black font-semibold text-lg absolute top-4 right-4 hover:opacity-70"
              >
                ×
              </button>

              <div className="mb-2">
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  Détails du trajet
                </p>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{journey.depName}</span>
                  <ArrowIcon />
                  <span>{journey.arrName}</span>
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {journey.direction}
                </p>
              </div>
              {/* Lignes du trajet */}
              {journey.lineKeys?.length > 0 && (
                <div className="flex items-center gap-2 mb-4 mt-4 flex-wrap">
                  {journey.lineKeys.map((lk) =>
                    getLineDisruptions(lk)?.length > 0 ? (
                      <div key={lk} className="relative">
                        <LineIcon lineKey={lk} size="w-8 h-8" />
                        <span
                          className="absolute -bottom-1 -right-0.5"
                          style={{ color: "#e61e1e" }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="size-3.5"
                          >
                            <path d="M8 3.5 3 12.5h10L8 3.5Z" fill="white" />
                            <path
                              fillRule="evenodd"
                              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      </div>
                    ) : (
                      <div key={lk}>
                        <LineIcon lineKey={lk} size="w-8 h-8" />
                      </div>
                    ),
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 mb-6 p-3 rounded-2xl">
                <div>
                  <p className="text-xl font-bold">{journey.dep}</p>
                  <p className="text-xs text-slate-600">
                    {formatTimeUntil(journey.dep, currentTime)}
                  </p>
                </div>
                <div className="flex-1 border-t border-dashed border-slate-500" />
                <p className="text-sm text-slate-600">{journey.dur}</p>
                <div className="flex-1 border-t border-dashed border-slate-500" />
                <div className="text-right">
                  <p className="text-xl font-bold">{journey.arr}</p>
                </div>
              </div>

              <button
                onClick={handleToggleMap}
                className="flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold mb-3 transition-colors"
                style={{ color: mapOpen ? "#2563EB" : "#3B82F6" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.159.69.159 1.006 0Z"
                  />
                </svg>
                {mapOpen ? "Masquer la carte" : "Voir sur la carte"}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5 ml-0.5"
                  style={{
                    transform: mapOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition:
                      "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
                  }}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {/* Carte inline — HORS du scroll aussi, juste en dessous du bouton */}
              <div className="flex-shrink-0 px-4">
                <InlineJourneyMap
                  journey={journey}
                  lineColors={lineColors}
                  isOpen={mapOpen}
                />
              </div>

              <JourneyTimeline
                journey={journey}
                lineColors={lineColors}
                getLineDisruptions={getLineDisruptions}
                onOpenMap={handleToggleMap}
                mapOpen={mapOpen}
              />

              <div style={{ height: "30vh" }} />
            </div>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={onClose} />
      </Sheet>
    </>
  );
}
