import { useRef, useState, useCallback, useEffect } from "react";
import MapLibreMap, { Marker } from "react-map-gl/maplibre";
import { createPortal } from "react-dom";
import { MapSheet } from "./MapSheet.jsx";
import { Source, Layer } from "react-map-gl/maplibre";
import { Sheet } from "react-modal-sheet";
import LineIcon from "./lines-icons.jsx";
import { NearestStopsSheet } from "./nearestStops.jsx";

const MAPTILER_STYLE_URL =
  "https://api.maptiler.com/maps/019d0d02-359b-7f4b-a797-bdeabca9dce3/style.json?key=7TQErbyvEqFlis3QMmSl";

const GRENOBLE_CENTER = { longitude: 5.74892, latitude: 45.18501 };

const throttle = (fn, delay) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon},${lat}.json?key=7TQErbyvEqFlis3QMmSl&language=fr`,
    );
    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return null;
    const parts = feature.place_name?.split(",") || [];
    return parts.slice(0, 2).join(",").trim() || feature.place_name || null;
  } catch {
    return null;
  }
}

async function forwardGeocode(query) {
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=7TQErbyvEqFlis3QMmSl&language=fr&bbox=5.5,45.0,6.0,45.4`,
    );
    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return null;
    const [lon, lat] = feature.center;
    const parts = feature.place_name?.split(",") || [];
    const name = parts.slice(0, 2).join(",").trim() || feature.place_name;
    return { name, lat, lon };
  } catch {
    return null;
  }
}

export default function StopPickerMap({ stops, onSelect, onClose, target }) {
  const mapRef = useRef(null);
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(13);
  const [locLoading, setLocLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [visible, setVisible] = useState(false);
  const [pendingStop, setPendingStop] = useState(null);
  const [pendingClosing, setPendingClosing] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [isCentered, setIsCentered] = useState(false);
  const [nearestOpen, setNearestOpen] = useState(false);
  const [walkStop, setWalkStop] = useState(null);
  const [walkRoute, setWalkRoute] = useState(null);
  const [walkLoading, setWalkLoading] = useState(false);
  const [showMoreNearest, setShowMoreNearest] = useState(false);

  const showLabels = zoom >= 14;
  const SNAP_THRESHOLD_DEG = 0.00018;

  const nearestList = userLocation
    ? [...stops]
        .map((s) => ({
          ...s,
          dist: Math.hypot(s.lat - userLocation.lat, s.lon - userLocation.lon),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, showMoreNearest ? 10 : 5)
    : [];

  const formatNearestDist = (deg) => {
    const m = Math.round(deg * 111000);
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
  };

  async function fetchNearestStopLines(stopCode) {
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

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const closePending = () => {
    setPendingClosing(true);
    setTimeout(() => {
      setPendingStop(null);
      setPendingClosing(false);
    }, 200);
  };

  const fetchWalkRoute = async (stop) => {
    setWalkLoading(true);
    setWalkRoute(null);
    try {
      const params = new URLSearchParams({
        fromPlace: `${userLocation.lat},${userLocation.lon}`,
        toPlace: `${stop.lat},${stop.lon}`,
        mode: "WALK",
        numItineraries: 1,
      });
      const res = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/plan?${params}`,
      );
      const json = await res.json();
      const it = json.plan?.itineraries?.[0];
      if (!it) return;
      const durationMin = Math.round(it.duration / 60);
      const points = decodePolyline(it.legs[0].legGeometry.points);
      setWalkRoute({ durationMin, points });
    } catch {
    } finally {
      setWalkLoading(false);
    }
  };

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

  const visibleStops = stops.filter((s) => {
    if (!bounds) return true;
    const pad = zoom > 14 ? 0.005 : zoom > 12 ? 0.01 : 0.02;
    return (
      s.lat >= bounds.south - pad &&
      s.lat <= bounds.north + pad &&
      s.lon >= bounds.west - pad &&
      s.lon <= bounds.east + pad
    );
  });

  const updateBounds = useCallback(() => {
    if (!mapRef.current) return;
    const b = mapRef.current.getBounds();
    setBounds({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
    setZoom(mapRef.current.getZoom());
    if (userLocation) {
      const center = mapRef.current.getCenter();
      const dist = Math.hypot(
        center.lat - userLocation.lat,
        center.lng - userLocation.lon,
      );
      setIsCentered(dist < 0.002);
    }
  }, [stops, userLocation]);

  const handleMove = useCallback(throttle(updateBounds, 250), [updateBounds]);

  useEffect(() => {
    const t = setTimeout(updateBounds, 300);
    return () => clearTimeout(t);
  }, []);

  const handleMapClick = useCallback(
    async (e) => {
      const { lat, lng } = e.lngLat;
      let closest = null,
        minDist = Infinity;
      stops.forEach((s) => {
        const d = Math.hypot(s.lat - lat, s.lon - lng);
        if (d < minDist) {
          minDist = d;
          closest = s;
        }
      });
      if (closest && minDist < SNAP_THRESHOLD_DEG) {
        setPendingStop({
          name: closest.name,
          lat: closest.lat,
          lon: closest.lon,
          isAddress: false,
          isNearest: false,
        });
      } else {
        const address = await reverseGeocode(lat, lng);
        if (address)
          setPendingStop({
            name: address,
            lat,
            lon: lng,
            isAddress: true,
            isNearest: false,
          });
      }
    },
    [stops],
  );

  const handleLocate = () => {
    if (userLocation) {
      mapRef.current?.flyTo({
        center: [userLocation.lon, userLocation.lat],
        zoom: 16,
        duration: 800,
      });
      setIsCentered(true);
      setNearestOpen(true);
      setNearestSelectedStop(null);
      setNearestPage(0);
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setUserLocation({ lat, lon });
        setIsCentered(true);
        mapRef.current?.flyTo({ center: [lon, lat], zoom: 16, duration: 800 });
        setLocLoading(false);
        setNearestOpen(true);
        setNearestPage(0);
      },
      () => setLocLoading(false),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const confirmSelection = () => {
    if (!pendingStop) return;
    if (pendingStop.isAddress) {
      onSelect(`${pendingStop.name}::${pendingStop.lat},${pendingStop.lon}`);
    } else {
      onSelect(pendingStop.name);
    }
    handleClose();
  };

  const label = target === "dep" ? "départ" : "arrivée";

  return (
    <>
      {createPortal(
        <>
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
              backgroundColor: visible ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
              transition: "background-color 0.3s ease",
            }}
            onClick={handleClose}
          >
            <div
              className="relative bg-white shadow-2xl overflow-hidden flex flex-col"
              style={{
                width: "100vw",
                height: "100dvh",
                opacity: visible ? 1 : 0,
                transform: visible
                  ? "translateY(0) scale(1)"
                  : "translateY(30px) scale(0.97)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    Choisir sur la carte
                  </p>
                  <p className="font-semibold text-gray-800 text-sm">
                    Arrêt de {label}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Map */}
              <div className="flex-1 relative">
                {zoom < 14 && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm text-xs text-gray-600 px-3 py-1.5 rounded-full shadow pointer-events-none">
                    Zoomez pour voir les arrêts
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchSheetOpen(true);
                  }}
                  className="absolute top-3 left-3 z-10 flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: "#A1A1A1" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 text-white"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLocate();
                  }}
                  disabled={locLoading}
                  className="absolute top-16 left-3 z-10 flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50"
                  style={{ background: "#A1A1A1" }}
                >
                  {locLoading ? (
                    <svg
                      className="w-4 h-4 animate-spin text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 256 256"
                    >
                      <g transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)">
                        <path
                          d="M 26.731 55.583 L 1.142 45.289 c -1.682 -0.677 -1.459 -3.168 0.362 -4.041 L 87.116 0.205 c 1.71 -0.82 3.499 0.969 2.679 2.679 L 48.752 88.496 c -0.873 1.821 -3.364 2.044 -4.041 0.362 L 34.417 63.269 C 33.009 59.767 30.233 56.991 26.731 55.583 z"
                          style={{
                            fill: isCentered ? "white" : "none",
                            stroke: "white",
                            strokeWidth: 4,
                          }}
                        />
                      </g>
                    </svg>
                  )}
                </button>
                <MapLibreMap
                  ref={mapRef}
                  mapStyle={MAPTILER_STYLE_URL}
                  initialViewState={{ ...GRENOBLE_CENTER, zoom: 13 }}
                  style={{ width: "100%", height: "100%" }}
                  onMove={handleMove}
                  onClick={handleMapClick}
                  cursor="crosshair"
                >
                  {visibleStops.map((stop) => (
                    <Marker
                      key={stop.id}
                      longitude={stop.lon}
                      latitude={stop.lat}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingStop({
                            name: stop.name,
                            lat: stop.lat,
                            lon: stop.lon,
                            isAddress: false,
                            isNearest: false,
                          });
                          mapRef.current?.flyTo({
                            center: [stop.lon, stop.lat],
                            zoom: Math.max(zoom, 15),
                            duration: 600,
                          });
                        }}
                      >
                        <div
                          style={{
                            width: "13px",
                            height: "13px",
                            borderRadius: "50%",
                            backgroundColor: "#facc15",
                            border: "2px solid white",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                          }}
                        />
                        {showLabels && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              color: "#1e293b",
                              backgroundColor: "rgba(255,255,255,0.85)",
                              padding: "1px 4px",
                              borderRadius: "4px",
                              marginTop: "2px",
                              whiteSpace: "nowrap",
                              pointerEvents: "none",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                            }}
                          >
                            {stop.name}
                          </span>
                        )}
                      </div>
                    </Marker>
                  ))}
                  {userLocation && (
                    <Marker
                      longitude={userLocation.lon}
                      latitude={userLocation.lat}
                    >
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          backgroundColor: "#3B82F6",
                          border: "2px solid white",
                          boxShadow: "0 2px 6px rgba(59,130,246,0.5)",
                        }}
                      />
                    </Marker>
                  )}
                  {walkRoute && (
                    <Source
                      id="walk-route"
                      type="geojson"
                      data={{
                        type: "Feature",
                        geometry: {
                          type: "LineString",
                          coordinates: walkRoute.points,
                        },
                      }}
                    >
                      <Layer
                        id="walk-route-line"
                        type="line"
                        paint={{
                          "line-color": "#94a3b8",
                          "line-width": 3,
                          "line-dasharray": [2, 2],
                        }}
                      />
                    </Source>
                  )}
                </MapLibreMap>
              </div>

              {/* Popup de confirmation */}
              {pendingStop && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center px-4"
                  style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                  onClick={closePending}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                    style={{
                      animation: pendingClosing
                        ? "popOut 0.2s ease forwards"
                        : "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <style>{`
                      @keyframes popIn  { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                      @keyframes popOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.85); opacity: 0; } }
                    `}</style>
                    <div className="px-5 pt-5 pb-2 text-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${pendingStop.isAddress ? "bg-indigo-100" : "bg-blue-100"}`}
                      >
                        {pendingStop.isAddress ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5 text-indigo-600"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5 text-blue-600"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                        {pendingStop.isAddress
                          ? "Adresse sélectionnée"
                          : "Arrêt sélectionné"}
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {pendingStop.name}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Utiliser comme{" "}
                        {pendingStop.isAddress ? "adresse" : "arrêt"} de {label}{" "}
                        ?
                      </p>
                    </div>
                    <div className="flex border-t border-gray-100 mt-3">
                      <button
                        className="flex-1 py-3.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                        onClick={closePending}
                      >
                        Annuler
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button
                        className="flex-1 py-3.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                        onClick={confirmSelection}
                      >
                        Confirmer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-400 text-center">
                  Appuyez sur un arrêt ou n'importe où sur la carte
                </p>
              </div>
            </div>
          </div>

          {/* MapSheet */}
          <MapSheet
            isOpen={searchSheetOpen}
            onClose={() => setSearchSheetOpen(false)}
            title="Rechercher une adresse"
          >
            <div className="space-y-3 pt-1">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== "Enter" || !searchQuery.trim()) return;
                  setSearchLoading(true);
                  const result = await forwardGeocode(searchQuery);
                  setSearchLoading(false);
                  if (!result) return;
                  setPendingStop({
                    ...result,
                    isAddress: true,
                    isNearest: false,
                  });
                  setSearchSheetOpen(false);
                  setSearchQuery("");
                  mapRef.current?.flyTo({
                    center: [result.lon, result.lat],
                    zoom: 16,
                    duration: 800,
                  });
                }}
                className="w-full border p-2 rounded-lg"
                placeholder="ex: 12 rue Félix Viallet, Grenoble"
              />
              <button
                onClick={async () => {
                  if (!searchQuery.trim()) return;
                  setSearchLoading(true);
                  const result = await forwardGeocode(searchQuery);
                  setSearchLoading(false);
                  if (!result) return;
                  setPendingStop({
                    ...result,
                    isAddress: true,
                    isNearest: false,
                  });
                  setSearchSheetOpen(false);
                  setSearchQuery("");
                  mapRef.current?.flyTo({
                    center: [result.lon, result.lat],
                    zoom: 16,
                    duration: 800,
                  });
                }}
                disabled={searchLoading || !searchQuery.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-60"
              >
                {searchLoading ? "Recherche..." : "Rechercher"}
              </button>
            </div>
          </MapSheet>

          {/* Sheet walk */}
          {walkStop && (
            <div className="fixed inset-x-0 bottom-0 z-[10002] bg-white rounded-t-3xl shadow-2xl border border-slate-200 px-4 pt-5 pb-10">
              <div className="flex items-center justify-between mb-3"></div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">
                    Itinéraire à pied
                  </p>
                  <h2 className="text-base font-bold text-slate-900">
                    {walkStop.name}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setWalkStop(null);
                    setWalkRoute(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                >
                  ×
                </button>
              </div>
              {walkLoading ? (
                <p className="text-sm text-slate-500 mb-3">
                  Calcul de l'itinéraire...
                </p>
              ) : walkRoute ? (
                <p className="text-sm text-slate-600 mb-3 flex items-center gap-2">
                  <img
                    src="/walk.svg"
                    alt="marche"
                    className="w-4 h-4 opacity-60"
                  />
                  {walkRoute.durationMin} min à pied
                </p>
              ) : (
                <p className="text-sm text-red-500 mb-3">
                  Itinéraire introuvable.
                </p>
              )}
              <p className="text-sm text-slate-600 mb-4">
                Sélectionner{" "}
                <span className="font-semibold">{walkStop.name}</span> comme
                point de {label} ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setWalkStop(null);
                    setWalkRoute(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    onSelect(walkStop.name);
                    handleClose();
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm"
                >
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}

      {/* Sheet nearest — portal séparé */}
      <NearestStopsSheet
        isOpen={nearestOpen}
        onClose={() => setNearestOpen(false)}
        stops={stops}
        userLocation={userLocation}
        onSelectStop={() => {}}
        onWalkTo={(stop) => {
          setWalkStop(stop);
          fetchWalkRoute(stop);
          mapRef.current?.fitBounds(
            [
              [
                Math.min(userLocation.lon, stop.lon),
                Math.min(userLocation.lat, stop.lat),
              ],
              [
                Math.max(userLocation.lon, stop.lon),
                Math.max(userLocation.lat, stop.lat),
              ],
            ],
            { padding: 60, duration: 800 },
          );
        }}
      />
    </>
  );
}
