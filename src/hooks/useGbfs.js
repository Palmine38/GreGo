import { useEffect, useState } from "react";

const VOI_FREE_BIKE_URL =
  "https://data.mobilites-m.fr/api/gbfs/voi_grenoble/free_bike_status";
const CITIZ_STATION_INFO_URL =
  "https://data.mobilites-m.fr/api/gbfs/citiz_grenoble/station_information";
const CITIZ_STATION_STATUS_URL =
  "https://data.mobilites-m.fr/api/gbfs/citiz_grenoble/station_status";
const CITIZ_VEHICLE_TYPES_URL =
  "https://data.mobilites-m.fr/api/gbfs/citiz_grenoble/vehicle_types";

const VOI_REFRESH_MS = 60_000; // véhicules mobiles -> rafraîchi souvent
const CITIZ_REFRESH_MS = 5 * 60_000; // stations fixes -> rafraîchi moins souvent

// Le réseau Citiz dépasse largement l'agglo grenobloise (Chambéry, Annecy,
// Valence, Saint-Étienne...) : on filtre sur une bbox large autour de
// Grenoble pour ne garder que les stations pertinentes pour Fast Research.
const GRENOBLE_BBOX = { south: 44.95, north: 45.35, west: 5.55, east: 5.95 };

const inGrenobleBbox = (lat, lon) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  lat >= GRENOBLE_BBOX.south &&
  lat <= GRENOBLE_BBOX.north &&
  lon >= GRENOBLE_BBOX.west &&
  lon <= GRENOBLE_BBOX.east;

export function useGbfs() {
  const [voiVehicles, setVoiVehicles] = useState([]);
  const [citizStations, setCitizStations] = useState([]);
  const [citizVehicleTypes, setCitizVehicleTypes] = useState({});
  const [voiLoaded, setVoiLoaded] = useState(false);
  const [citizLoaded, setCitizLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchVoi = async () => {
      try {
        const res = await fetch(VOI_FREE_BIKE_URL);
        const json = await res.json();
        const bikes = json.data?.bikes || [];
        if (cancelled) return;
        setVoiVehicles(
          bikes
            .filter(
              (bike) =>
                Number.isFinite(bike.lat) &&
                Number.isFinite(bike.lon) &&
                !bike.is_disabled &&
                !bike.is_reserved,
            )
            .map((bike) => ({
              id: bike.bike_id,
              lat: bike.lat,
              lon: bike.lon,
              type: bike.vehicle_type_id === "voi_scooter" ? "scooter" : "bike",
              rangeMeters: bike.current_range_meters ?? null,
            })),
        );
      } catch {
        // on garde les données précédentes en cas d'échec ponctuel
      } finally {
        if (!cancelled) setVoiLoaded(true);
      }
    };

    fetchVoi();
    const interval = setInterval(fetchVoi, VOI_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCitiz = async () => {
      try {
        const [infoRes, statusRes, typesRes] = await Promise.all([
          fetch(CITIZ_STATION_INFO_URL),
          fetch(CITIZ_STATION_STATUS_URL),
          fetch(CITIZ_VEHICLE_TYPES_URL),
        ]);
        const infoJson = await infoRes.json();
        const statusJson = await statusRes.json();
        const typesJson = await typesRes.json();
        if (cancelled) return;

        const statusByStation = new Map(
          (statusJson.data?.stations || []).map((s) => [s.station_id, s]),
        );

        const vehicleTypesMap = {};
        (typesJson.data?.vehicle_types || []).forEach((vt) => {
          vehicleTypesMap[vt.vehicle_type_id] = {
            name: vt.name?.[0]?.text || "Véhicule Citiz",
            make: vt.make?.[0]?.text || "",
            model: vt.model?.[0]?.text || "",
            propulsionType: vt.propulsion_type || null,
            maxRangeMeters:
              vt.max_range_meters > 0 ? vt.max_range_meters : null,
            defaultPricingPlanId: vt.default_pricing_plan_id || null,
          };
        });
        setCitizVehicleTypes(vehicleTypesMap);

        const stations = (infoJson.data?.stations || [])
          .filter((station) => inGrenobleBbox(station.lat, station.lon))
          .map((station) => {
            const status = statusByStation.get(station.station_id);
            return {
              id: station.station_id,
              name: station.name?.[0]?.text || "Station Citiz",
              lat: station.lat,
              lon: station.lon,
              address: station.address || "",
              vehiclesAvailable: status?.num_vehicles_available ?? 0,
              isRenting: status?.is_renting ?? true,
              vehicleTypesAvailable: status?.vehicle_types_available || [],
            };
          })
          // Une station sans véhicule dispo n'est pas exploitable pour l'instant
          .filter(
            (station) => station.isRenting && station.vehiclesAvailable > 0,
          );

        setCitizStations(stations);
      } catch {
        // idem, on ne casse pas l'affichage sur un échec réseau ponctuel
      } finally {
        if (!cancelled) setCitizLoaded(true);
      }
    };

    fetchCitiz();
    const interval = setInterval(fetchCitiz, CITIZ_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return {
    voiVehicles,
    citizStations,
    citizVehicleTypes,
    gbfsLoaded: voiLoaded && citizLoaded,
  };
}
