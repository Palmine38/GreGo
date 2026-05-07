import React, { useEffect, useRef, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";

async function fetchWalkRoute(fromLat, fromLon, toLat, toLon) {
  try {
    const params = new URLSearchParams({
      fromPlace: `${fromLat},${fromLon}`,
      toPlace: `${toLat},${toLon}`,
      mode: "WALK",
      numItineraries: 1,
    });
    const res = await fetch(
      `https://data.mobilites-m.fr/api/routers/default/plan?${params}`,
    );
    const json = await res.json();
    const it = json.plan?.itineraries?.[0];
    if (!it) return null;
    const durationMin = Math.round(it.duration / 60);
    const points = decodePolyline(it.legs[0].legGeometry.points);
    return { durationMin, points };
  } catch {
    return null;
  }
}

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

export function WalkRouteSheet({
  stop,
  userLocation,
  target,
  onConfirm,
  onClose,
  mapRef,
}) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stop || !userLocation) return;
    setLoading(true);
    fetchWalkRoute(userLocation.lat, userLocation.lon, stop.lat, stop.lon).then(
      (r) => {
        setRoute(r);
        setLoading(false);
      },
    );

    // Fit la map pour montrer les deux points
    if (mapRef?.current) {
      const minLon = Math.min(userLocation.lon, stop.lon);
      const maxLon = Math.max(userLocation.lon, stop.lon);
      const minLat = Math.min(userLocation.lat, stop.lat);
      const maxLat = Math.max(userLocation.lat, stop.lat);
      mapRef.current.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 60, duration: 800 },
      );
    }
  }, [stop, userLocation]);

  const label = target === "dep" ? "départ" : "arrivée";

  const geojson = route
    ? {
        type: "Feature",
        geometry: { type: "LineString", coordinates: route.points },
      }
    : null;

  return (
    <>
      {/* Tracé sur la map via portal vers le parent MapLibreMap — on passe par props */}
      {geojson && (
        <walkRouteGeojson.Provider value={geojson}>
          {null}
        </walkRouteGeojson.Provider>
      )}

      {/* Sheet de confirmation */}
      <div className="fixed inset-x-0 bottom-0 z-[10002] bg-white rounded-t-3xl shadow-2xl border border-slate-200 px-4 pt-3 pb-10">
        <div className="flex justify-center mb-3">
          <div className="h-1.5 w-16 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Itinéraire à pied
            </p>
            <h2 className="text-base font-bold text-slate-900">{stop?.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-2">
            Calcul de l'itinéraire...
          </p>
        ) : route ? (
          <p className="text-sm text-slate-600 mb-4">
            🚶 {route.durationMin} min à pied
          </p>
        ) : (
          <p className="text-sm text-red-500 mb-4">Itinéraire introuvable.</p>
        )}

        <p className="text-sm text-slate-600 mb-4">
          Sélectionner <span className="font-semibold">{stop?.name}</span> comme
          point de {label} ?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              onConfirm(stop);
              onClose();
            }}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm"
          >
            Confirmer
          </button>
        </div>
      </div>
    </>
  );
}
