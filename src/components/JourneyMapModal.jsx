import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import MapLibreMap, { Marker, useMap } from "react-map-gl/maplibre";
import { Source, Layer } from "react-map-gl/maplibre";
import LineIcon, {
  LINE_COLORS,
  preloadLineData,
  getLineDataFromCache,
} from "./lines-icons.jsx";
import { useTheme } from "../hooks/useTheme.js";

const MAPTILER_STYLE_URL_LIGHT =
  "https://api.maptiler.com/maps/019d0d02-359b-7f4b-a797-bdeabca9dce3/style.json?key=7TQErbyvEqFlis3QMmSl";
const MAPTILER_STYLE_URL_DARK =
  "https://api.maptiler.com/maps/019f7c73-0431-726f-ae5d-598a16a06771/style.json?key=7TQErbyvEqFlis3QMmSl";
const MAPTILER_STYLE_URL_DARK_BLUE =
  "https://api.maptiler.com/maps/01a00098-f343-7789-990e-687ae5296acd/style.json?key=7TQErbyvEqFlis3QMmSl";

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

/** Retourne le point médian d'un tableau de coordonnées [lon, lat] */
function midpoint(coords) {
  if (!coords.length) return null;
  const mid = Math.floor(coords.length / 2);
  return coords[mid];
}

export function JourneyMapModal({ journey, lineColors, onClose }) {
  const mapRef = useRef(null);
  const theme = useTheme();
  const mapStyle =
    theme === "dark"
      ? MAPTILER_STYLE_URL_DARK_BLUE
      : theme === "gray"
        ? MAPTILER_STYLE_URL_DARK
        : MAPTILER_STYLE_URL_LIGHT;
  const [visible, setVisible] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const allLineKeys = transitLegs
      .map((leg) =>
        (leg.routeShortName || leg.route || leg.routeId || "")
          .replace("SEM:", "")
          .toUpperCase(),
      )
      .filter(Boolean);
    preloadLineData([...new Set(allLineKeys)]).then(() => setIconsReady(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const NEGLIGIBLE_WALK_DISTANCE = 0.0008;

  function legDistance(leg) {
    const dLon = (leg.to?.lon ?? 0) - (leg.from?.lon ?? 0);
    const dLat = (leg.to?.lat ?? 0) - (leg.from?.lat ?? 0);
    return Math.sqrt(dLon ** 2 + dLat ** 2);
  }

  function isNegligibleWalk(leg) {
    return leg.mode === "WALK" && legDistance(leg) < NEGLIGIBLE_WALK_DISTANCE;
  }

  if (!journey) return null;

  const allLegs = journey.allLegs || [];
  const filteredLegs = allLegs.filter((leg) => !isNegligibleWalk(leg));

  // Legs transit uniquement (pas marche)
  const transitLegs = allLegs.filter((leg) => leg.mode !== "WALK");
  const vectorEndpoints = allLegs.flatMap((leg, legIndex) => {
    const coords = magnetizeLegGeometry(leg);
    if (coords.length < 2) return [];
    return [
      { coords: coords[0], type: "start", legIndex },
      { coords: coords[coords.length - 1], type: "end", legIndex },
    ];
  });
  const departureMarker = transitLegs[0]
    ? {
        lon: transitLegs[0].from?.lon,
        lat: transitLegs[0].from?.lat,
        name: transitLegs[0].from?.name,
      }
    : null;

  const arrivalMarker = allLegs[allLegs.length - 1]
    ? {
        lon: allLegs[allLegs.length - 1].to?.lon,
        lat: allLegs[allLegs.length - 1].to?.lat,
        name: allLegs[allLegs.length - 1].to?.name,
      }
    : null;

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

  const allCoords = allLegs.flatMap(magnetizeLegGeometry);
  const lats = allCoords.map(([, lat]) => lat);
  const lons = allCoords.map(([lon]) => lon);
  const bounds =
    allCoords.length >= 2
      ? [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ]
      : null;

  // ── Marqueurs de correspondance (fin d'un leg transit → début du suivant) ──
  // = points de transfert entre deux lignes différentes
  const transferMarkers = transitLegs
    .slice(0, -1)
    .map((leg, i) => ({
      lon: leg.to?.lon,
      lat: leg.to?.lat,
      name: leg.to?.name,
      lineName: (leg.routeShortName || leg.route || leg.routeId || "")
        .replace("SEM:", "")
        .toUpperCase(),
    }))
    .filter((m) => m.lon && m.lat);

  // ── Arrêts intermédiaires (visibles seulement si zoom >= 16) ──────────────
  const allTransitStops = transitLegs.flatMap((leg) => {
    const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
      .replace("SEM:", "")
      .toUpperCase();
    const color = LINE_COLORS[lineName] || lineColors?.[lineName] || "#94A3B8";
    return [...(leg.intermediateStops || []), leg.to]
      .filter((stop) => stop?.lon && stop?.lat)
      .map((s) => ({
        lon: s.lon,
        lat: s.lat,
        name: s.name,
        color,
      }));
  });

  // ── Icônes de ligne au milieu de chaque tracé transit ────────────────────
  const legMidpoints = transitLegs
    .map((leg) => {
      const coords = magnetizeLegGeometry(leg);
      const mid = midpoint(coords);
      if (!mid) return null;
      const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
        .replace("SEM:", "")
        .toUpperCase();
      return { lon: mid[0], lat: mid[1], lineName };
    })
    .filter(Boolean);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          backgroundColor: "rgba(0,0,0,0.55)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
        onClick={handleClose}
      />

      {/* Modal centré, ratio portrait */}
      <div
        style={{
          position: "fixed",
          zIndex: 9999,
          top: "50%",
          left: "50%",
          transform: visible
            ? "translate(-50%, -50%) scale(1)"
            : "translate(-50%, -50%) scale(0.93)",
          opacity: visible ? 1 : 0,
          transition:
            "transform 0.25s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease",
          width: "min(88vw, 420px)",
          height: "min(85vh, 600px)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          background: "white",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton fermer */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 600,
            color: "#334155",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Carte */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <MapLibreMap
            ref={mapRef}
            mapStyle={mapStyle}
            initialViewState={
              bounds
                ? { bounds, fitBoundsOptions: { padding: 48 } }
                : { longitude: 5.74892, latitude: 45.18501, zoom: 13 }
            }
            style={{ width: "100%", height: "100%" }}
            onZoom={(e) => setZoom(e.viewState.zoom)}
          >
            {/* ── Tracés ────────────────────────────────────────────── */}
            {allLegs.map((leg, i) => {
              const coords = magnetizeLegGeometry(leg);
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

            {/* ── Arrêts intermédiaires de transit ─────────────────── */}
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

            {/* ── Marqueurs de correspondance (toujours visibles) ───── */}
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
            {/* ── Marqueurs de départ et d'arrivée ────────────────────── */}
            {[departureMarker, arrivalMarker].filter(Boolean).map((m, i) => (
              <Marker
                key={`endpoint-${i}`}
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

            {/* ── Icônes de ligne au milieu du tracé ───────────────── */}
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
        </div>

        {/* Footer lignes */}
        {transitLines.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderTop: "1px solid #F1F5F9",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {transitLines.map((line) => (
              <LineIcon key={line} lineKey={line} size="w-8 h-8" />
            ))}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
