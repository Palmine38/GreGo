import React, { useEffect, useRef, useState } from "react";
import { JourneyTimeline } from "./JourneyTimeline.jsx";
import { useCurrentTime } from "../hooks/useCurrentTime.js";
import { useSettings } from "../hooks/useSettings.js";
import { formatTimeUntil } from "../utils/journey.js";
import MapLibreMap, { Marker, Source, Layer } from "react-map-gl/maplibre";
import LineIcon, { LINE_COLORS, preloadLineData } from "./lines-icons.jsx";
import { Sheet } from "react-modal-sheet";
import lineB from "./lineB.json";
import lineNAVBVerdunToPDS from "./lineNAVB_verdun_to_pds.json";
import lineNAVBPdsToVerdun from "./lineNAVB_pds_to_verdun.json";
import { useTheme } from "../hooks/useTheme.js";

const MAPTILER_STYLE_URL_LIGHT =
  "https://api.maptiler.com/maps/019f7c76-a3f8-751b-bedb-d7fe9d83d122/style.json?key=7TQErbyvEqFlis3QMmSl";
const MAPTILER_STYLE_URL_DARK =
  "https://api.maptiler.com/maps/019f7c73-0431-726f-ae5d-598a16a06771/style.json?key=7TQErbyvEqFlis3QMmSl";
const MAPTILER_STYLE_URL_DARK_BLUE =
  "https://api.maptiler.com/maps/01a00098-f343-7789-990e-687ae5296acd/style.json?key=7TQErbyvEqFlis3QMmSl";
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

function midpoint(coords) {
  if (!coords.length) return null;
  return coords[Math.floor(coords.length / 2)];
}

function cleanStopName(name) {
  return name?.replace(/^[^,]+,\s*/, "") || "";
}

function getLegLineName(leg) {
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
// logique de tracé (notamment les géométries de référence B et NAVB).
export function getLegGeometry(leg) {
  if (leg.mode !== "WALK") {
    const lineName = getLegLineName(leg);
    if (lineName === "B")
      return getLineBSegment(leg) || magnetizeLegGeometry(leg);
    if (lineName === "NAVB")
      return getNavbSegment(leg) || magnetizeLegGeometry(leg);
  }
  return magnetizeLegGeometry(leg);
}

function formatClock(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemaining(target, now) {
  const minutes = Math.max(0, Math.ceil((new Date(target) - now) / 60000));
  if (minutes <= 0) return "maintenant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function formatLegDuration(leg) {
  const minutes = Math.max(
    1,
    Math.round((new Date(leg.endTime) - new Date(leg.startTime)) / 60000),
  );
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ""}`;
}

/* ---------------------------------------------------------------------
 * Bouton "Lancer le trajet" et panneau de navigation associé — désactivés.
 * (fonctions et composants commentés ci-dessous)
 * ---------------------------------------------------------------------

function getStartInstruction(journey, now) {
  const firstLeg = journey?.allLegs?.[0];
  if (!firstLeg) return null;

  const departureIn = formatRemaining(firstLeg.startTime, now);
  if (firstLeg.mode === "WALK") {
    const stopName = cleanStopName(firstLeg.to?.name) || "votre prochain arrêt";
    return {
      title: `Marchez jusqu’à ${stopName}`,
      subtitle:
        departureIn === "maintenant"
          ? `${formatLegDuration(firstLeg)} de marche`
          : `Partez dans ${departureIn} · ${formatLegDuration(firstLeg)} de marche`,
      buttonLabel:
        departureIn === "maintenant"
          ? "Commencer à marcher"
          : `Partir dans ${departureIn}`,
    };
  }

  const lineName = getLegLineName(firstLeg);
  const stopName = cleanStopName(firstLeg.from?.name) || "votre arrêt";
  return {
    title:
      departureIn === "maintenant"
        ? "Partez maintenant"
        : `Partez dans ${departureIn}`,
    subtitle: `Prenez la ligne ${lineName} à ${stopName}`,
    buttonLabel:
      departureIn === "maintenant"
        ? "Démarrer le trajet"
        : `Partir dans ${departureIn}`,
  };
}

function getNavigationState(journey, now) {
  const legs = journey?.allLegs || [];
  if (!legs.length) return null;

  const firstStart = new Date(legs[0].startTime);
  const lastEnd = new Date(legs[legs.length - 1].endTime);

  if (now < firstStart) {
    const startInstruction = getStartInstruction(journey, now);
    return {
      status: "waiting",
      activeLeg: legs[0],
      nextLeg: legs[1],
      progress: 0,
      title: startInstruction?.title || "Préparez-vous à partir",
      subtitle:
        startInstruction?.subtitle ||
        `Départ à ${formatClock(legs[0].startTime)}`,
      etaLabel: `dans ${formatRemaining(legs[0].startTime, now)}`,
    };
  }

  if (now >= lastEnd) {
    return {
      status: "arrived",
      activeLeg: legs[legs.length - 1],
      nextLeg: null,
      progress: 100,
      title: "Vous êtes arrivé",
      subtitle: cleanStopName(journey.arrName),
      etaLabel: formatClock(lastEnd),
    };
  }

  const activeIndex = legs.findIndex((leg) => {
    const start = new Date(leg.startTime);
    const end = new Date(leg.endTime);
    return now >= start && now < end;
  });
  const index =
    activeIndex >= 0
      ? activeIndex
      : legs.findIndex((leg) => now < new Date(leg.startTime));
  const activeLeg = legs[Math.max(0, index)];
  const nextLeg = legs[index + 1] || null;
  const start = new Date(activeLeg.startTime);
  const end = new Date(activeLeg.endTime);
  const progress = Math.min(
    100,
    Math.max(0, ((now - start) / Math.max(1, end - start)) * 100),
  );

  if (activeLeg.mode === "WALK") {
    return {
      status: "walking",
      activeLeg,
      nextLeg,
      progress,
      title: `Marchez vers ${cleanStopName(activeLeg.to?.name)}`,
      subtitle: `Arrivée à ${formatClock(activeLeg.endTime)}`,
      etaLabel: formatRemaining(activeLeg.endTime, now),
    };
  }

  const lineName = getLegLineName(activeLeg);
  const direction = activeLeg.headsign || activeLeg.to?.name;
  return {
    status: "transit",
    activeLeg,
    nextLeg,
    progress,
    title: `Prenez la ligne ${lineName}`,
    subtitle: direction ? `Direction ${cleanStopName(direction)}` : "",
    etaLabel: formatRemaining(activeLeg.endTime, now),
  };
}

function JourneyNavigationPanel({ journey, currentTime, onStop }) {
  const nav = getNavigationState(journey, currentTime);
  if (!nav) return null;

  const nextLabel = nav.nextLeg
    ? nav.nextLeg.mode === "WALK"
      ? `Puis marcher vers ${cleanStopName(nav.nextLeg.to?.name)}`
      : `Puis prendre ${getLegLineName(nav.nextLeg)}`
    : "Dernière étape";

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-slate-400">
              Trajet démarré
            </p>
            <h3 className="mt-1 text-lg font-bold leading-tight">
              {nav.title}
            </h3>
            {nav.subtitle && (
              <p className="mt-1 text-sm text-slate-600">{nav.subtitle}</p>
            )}
          </div>
        </div>

        <div className="mt-4 h-1.5 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-500"
            style={{ width: `${nav.progress}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{nextLabel}</p>
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Arrêter
          </button>
        </div>
      </div>
    </div>
  );
}

function JourneyStartPanel({ onStart }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-4"
      >
        <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.23-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
      </svg>
      Lancer le trajet
    </button>
  );
}

--------------------------------------------------------------------- */

/**
 * Carte inline déroulante pour un itinéraire.
 * S'affiche/masque avec une animation CSS height.
 */
export function InlineJourneyMap({
  journey,
  lineColors,
  isOpen,
  showIntermediateStops = true,
}) {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(13);
  const [iconsReady, setIconsReady] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const theme = useTheme();
  const mapStyle =
    theme === "dark"
      ? MAPTILER_STYLE_URL_DARK_BLUE
      : theme === "gray"
        ? MAPTILER_STYLE_URL_DARK
        : MAPTILER_STYLE_URL_LIGHT;

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
  const vectorEndpoints = allLegs.flatMap((leg, legIndex) => {
    const coords = getLegGeometry(leg);
    if (coords.length < 2) return [];
    return [
      { coords: coords[0], type: "start", legIndex },
      { coords: coords[coords.length - 1], type: "end", legIndex },
    ];
  });

  const allCoords = allLegs.flatMap(getLegGeometry);
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
  const arrivalMarker = allLegs[allLegs.length - 1]
    ? {
        lon: allLegs[allLegs.length - 1].to?.lon,
        lat: allLegs[allLegs.length - 1].to?.lat,
        name: allLegs[allLegs.length - 1].to?.name,
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

  const allTransitStops = showIntermediateStops
    ? transitLegs.flatMap((leg) => {
        const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
          .replace("SEM:", "")
          .toUpperCase();
        const color =
          LINE_COLORS[lineName] || lineColors?.[lineName] || "#94A3B8";
        return [...(leg.intermediateStops || []), leg.to]
          .filter((stop) => stop?.lon && stop?.lat)
          .map((s) => ({
            lon: s.lon,
            lat: s.lat,
            name: s.name,
            color,
          }));
      })
    : [];

  const walkTransitionStops = allLegs
    .flatMap((leg, index) =>
      leg.mode !== "WALK" && allLegs[index + 1]?.mode === "WALK"
        ? [leg.to]
        : [],
    )
    .filter((stop) => stop?.lon && stop?.lat && stop?.name);

  const legMidpoints = transitLegs
    .map((leg) => {
      const coords = getLegGeometry(leg);
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
              mapStyle={mapStyle}
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
                const coords = getLegGeometry(leg);
                if (coords.length < 2) return null;
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

              {/* Arrêts intermédiaires de transit */}
              {vectorEndpoints.map((endpoint) => (
                <Marker
                  key={`vector-endpoint-${endpoint.legIndex}-${endpoint.type}`}
                  longitude={endpoint.coords[0]}
                  latitude={endpoint.coords[1]}
                  anchor="center"
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: "white",
                      border: "2px solid #64748B",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                    }}
                  />
                </Marker>
              ))}

              {allTransitStops.map((m, i) => (
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
                  arrivalMarker,
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

              {/* Noms des correspondances et des fins de tronçons transit */}
              {zoom >= 14 &&
                [
                  ...transitLegs.slice(1).map((leg) => leg.from),
                  ...walkTransitionStops,
                ]
                  .filter((stop) => stop?.lon && stop?.lat && stop?.name)
                  .map((stop, i) => (
                    <Marker
                      key={`midlabel-${i}`}
                      longitude={stop.lon}
                      latitude={stop.lat}
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
                        {stop.name.replace(/^[^,]+,\s*/, "")}
                      </div>
                    </Marker>
                  ))}

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
 * Contenu du détail d'un trajet, SANS le Sheet englobant.
 *
 * Exporté séparément de JourneyDetailsSheet pour pouvoir être intégré
 * directement dans une autre sheet (ex. FastResearchResultSheet) avec une
 * animation de swipe droite→gauche façon vue "liste → détail" (voir
 * GbfsSheet), plutôt que d'ouvrir une nouvelle Sheet par-dessus.
 *
 * Props :
 *   journey        — itinéraire sélectionné (ou null)
 *   lineColors     — map couleurs
 *   getLineDisruptions — fn(lineName) → []
 *   hideMap        — bool, masque le bouton/la carte inline
 *   onLineClick    — fn(lineKey, currentSnap)
 *   currentSnap    — snap courant de la sheet englobante (optionnel, transmis à onLineClick)
 *   onBack         — si fourni, une flèche retour apparaît en haut à la place du simple label
 */
export function JourneyDetailsContent({
  journey,
  lineColors,
  getLineDisruptions,
  hideMap = false,
  onLineClick,
  currentSnap,
  onBack,
}) {
  const currentTime = useCurrentTime();
  const { settings } = useSettings();
  const [height, setHeight] = useState(60);
  const [mapOpen, setMapOpen] = useState(false);
  // const [tripStarted, setTripStarted] = useState(false); // bouton "Lancer le trajet" désactivé

  // Reset quand un nouveau trajet est sélectionné
  useEffect(() => {
    if (journey) {
      setHeight(60);
      setMapOpen(false);
      // setTripStarted(false); // bouton "Lancer le trajet" désactivé
    }
  }, [journey]);

  const handleToggleMap = () => {
    setMapOpen((prev) => !prev);
    // Agrandir légèrement la sheet si elle est petite pour laisser de la place à la carte
    if (!mapOpen && height < 80) setHeight(85);
  };

  if (!journey) return null;

  return (
    <div className="overflow-y-auto flex-1 px-4 pb-4">
      <div className="mb-2">
        {onBack ? (
          <div className="flex items-center gap-2 -ml-2 mb-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="Retour"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-5 h-5 text-gray-700"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Détails du trajet
            </p>
          </div>
        ) : (
          <p className="text-xs uppercase tracking-widest text-slate-400">
            Détails du trajet
          </p>
        )}
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>{journey.depName}</span>
          <ArrowIcon />
          <span>{journey.arrName}</span>
        </h2>
        <p className="text-sm text-slate-600 mt-1">{journey.direction}</p>
      </div>
      {/* Lignes du trajet */}
      {journey.lineKeys?.length > 0 && (
        <div className="flex items-center gap-2 mb-4 mt-4 flex-wrap">
          {journey.lineKeys.map((lk) =>
            getLineDisruptions(lk)?.length > 0 ? (
              <button
                key={lk}
                className="relative"
                onClick={() => onLineClick?.(lk, currentSnap)}
              >
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
              </button>
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

      {/* Bouton "Lancer le trajet" / panneau de navigation — désactivé
      {tripStarted ? (
        <JourneyNavigationPanel
          journey={journey}
          currentTime={currentTime}
          onStop={() => setTripStarted(false)}
        />
      ) : (
        <JourneyStartPanel
          onStart={() => {
            setTripStarted(true);
            if (height < 80) setHeight(85);
          }}
        />
      )}
      */}

      {!hideMap && (
        <>
          <button
            onClick={handleToggleMap}
            className="flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold mb-7 transition-colors"
            style={{ color: mapOpen ? "#3B82F6" : "#3B82F6" }}
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
                transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {/* Carte inline*/}
          <div className="flex-shrink-0 px-4">
            <InlineJourneyMap
              journey={journey}
              lineColors={lineColors}
              isOpen={mapOpen}
              showIntermediateStops={settings.showIntermediateStops}
            />
          </div>
        </>
      )}

      <JourneyTimeline
        journey={journey}
        lineColors={lineColors}
        getLineDisruptions={getLineDisruptions}
        showDisruptions={settings.showJourneyDisruptions}
        showIntermediateStops={settings.showIntermediateStops}
        onOpenMap={hideMap ? undefined : handleToggleMap}
        mapOpen={!hideMap && mapOpen}
      />

      <div style={{ height: "30vh" }} />
    </div>
  );
}

/**
 * Panneau glissant affichant le détail d'un trajet, dans sa propre Sheet.
 *
 * Reste utilisé tel quel partout où le détail doit s'ouvrir en tant que
 * sheet indépendante. Pour une intégration "swipe" au sein d'une autre
 * sheet (sans en ouvrir une nouvelle), utiliser JourneyDetailsContent
 * directement (voir FastResearchResultSheet).
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
  hideMap = false,
  snapPoints = [0, 0.6, 1],
  initialSnap = 1,
  onLineClick,
}) {
  const [currentSnap, setCurrentSnap] = useState(initialSnap);

  if (!journey) return null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnap={initialSnap}
      onSnap={(snapIndex) => setCurrentSnap(snapIndex)}
    >
      <Sheet.Container
        style={{
          borderRadius: "24px 24px 0 0",
          backgroundColor: "var(--sheet-bg)",
          overflow: "hidden",
        }}
      >
        <Sheet.Header />
        <Sheet.Content disableDrag={(state) => state.scrollPosition !== "top"}>
          <JourneyDetailsContent
            journey={journey}
            lineColors={lineColors}
            getLineDisruptions={getLineDisruptions}
            hideMap={hideMap}
            onLineClick={onLineClick}
            currentSnap={currentSnap}
          />
        </Sheet.Content>
      </Sheet.Container>
      {!hideBackdrop && <Sheet.Backdrop onTap={onClose} />}
    </Sheet>
  );
}
