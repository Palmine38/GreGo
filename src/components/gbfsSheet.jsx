import { useEffect, useState } from "react";
import { Sheet } from "react-modal-sheet";
import { useTheme } from "../hooks/useTheme.js";
import { useGbfsPricing } from "../hooks/useGbfsPricing.js";
import { FaCar } from "react-icons/fa";

const LOGO_SRC = {
  voi: "/GBFS/Voi.svg",
  citiz: {
    light: "/GBFS/Citiz.svg",
    dark: "/GBFS/Citiz_darkmode.svg",
  },
};

const LOGO_LABEL = {
  voi: "Voi",
  citiz: "Citiz",
};

const VOI_VEHICLE_IMAGE = {
  scooter: "/GBFS/VoiScooter.png",
  bike: "/GBFS/VoiBike.png",
};

const VOI_MAX_RANGE_METERS = 80000;

const BOOKING_URL = {
  voi: "https://lqfa.adj.st/",
  citiz: "https://aura.citiz.coop/",
};

const PROPULSION_LABEL = {
  electric: "Électrique",
  hybrid: "Hybride",
  combustion: "Essence",
  human: "Manuel",
};

const PROPULSION_COLOR = {
  electric: "#16a34a",
  hybrid: "#0891b2",
  combustion: "#64748b",
  human: "#64748b",
};

function batteryColor(percent) {
  if (percent <= 20) return "#dc2626";
  if (percent <= 50) return "#d97706";
  return "#16a34a";
}

function formatEUR(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${Number(n)
    .toFixed(2)
    .replace(/\.?0+$/, "")
    .replace(".", ",")} €`;
}

// Tarif Voi : matché sur le préfixe du plan_id ("plan-scooter-…" / "plan-bike-…")
function getVoiPriceInfo(plans, type) {
  if (!plans) return null;
  const plan = plans.find((p) => p.plan_id?.startsWith(`plan-${type}`));
  if (!plan) return null;
  const perMin = plan.per_min_pricing?.[0]?.rate;
  return {
    unlock: formatEUR(plan.price),
    perMin: perMin != null ? `${formatEUR(perMin)}/min` : null,
  };
}

// Tarif Citiz : matché sur le pricing_plan_id exact du véhicule
function getCitizPriceInfo(plans, pricingPlanId) {
  if (!plans || !pricingPlanId) return null;
  const plan = plans.find((p) => p.plan_id === pricingPlanId);
  if (!plan) return null;
  const km = plan.per_km_pricing?.[0];
  const mn = plan.per_min_pricing?.[0];
  const parts = [];
  if (km?.rate != null) parts.push(`${formatEUR(km.rate)}/km`);
  if (mn?.rate != null) {
    const suffix = mn.interval ? `${mn.interval}min` : "min";
    parts.push(`${formatEUR(mn.rate)}/${suffix}`);
  }
  return {
    label: plan.name?.[0]?.text || null,
    summary: parts.join(" · "),
  };
}

function BatteryBadge({ percent, size = "normal" }) {
  if (percent == null) return null;
  const clamped = Math.max(0, Math.min(100, percent));
  const color = batteryColor(clamped);
  const big = size === "large";

  return (
    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pr-1 min-w-[52px]">
      <p
        className={`${big ? "text-2xl" : "text-lg"} font-bold tabular-nums leading-none`}
        style={{ color }}
      >
        {Math.round(clamped)}
        <span className="text-sm font-medium">%</span>
      </p>
      <div
        className={`h-1.5 ${big ? "w-16" : "w-11"} rounded-full bg-gray-200 overflow-hidden`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(6, clamped)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function PropulsionBadge({ propulsionType, count }) {
  const label = PROPULSION_LABEL[propulsionType];
  const color = PROPULSION_COLOR[propulsionType] || "#64748b";

  return (
    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pr-1 min-w-[52px]">
      {count > 1 && (
        <p className="text-lg font-bold tabular-nums leading-none text-gray-900">
          ×{count}
        </p>
      )}
      {label && (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ color, backgroundColor: `${color}1a` }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function VehicleIcon({ type, size = "normal" }) {
  const isScooter = type === "scooter";
  const isBike = type === "bike";
  const color = isScooter ? "#dc2626" : isBike ? "#ea580c" : "#2563eb";
  const bg = isScooter ? "#fee2e2" : isBike ? "#ffedd5" : "#4ac2b6";
  const big = size === "large";

  return (
    <div
      className={`${big ? "w-20 h-20" : "w-12 h-12"} flex-shrink-0 flex items-center justify-center rounded-2xl`}
      style={{ backgroundColor: bg }}
    >
      {isScooter || isBike ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          className={big ? "w-11 h-11" : "w-7 h-7"}
        >
          {isScooter && (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 19.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Zm14 0a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM5 17.75V10l3-6h2m-5 13h9.5M8 10h9l2 3.5v4.25"
            />
          )}
          {isBike && (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm14 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5 17l4-8h6l3 6m-9-6h5M13 9l1.5 8"
            />
          )}
        </svg>
      ) : (
        <FaCar color="white" className={big ? "w-9 h-9" : "w-6 h-6"} />
      )}
    </div>
  );
}

function VoiVehicleImage({ type, size = "normal" }) {
  const src = VOI_VEHICLE_IMAGE[type];
  if (!src) return null;
  const big = size === "large";

  return (
    <div
      className={`${big ? "w-20 h-20" : "w-12 h-12"} flex-shrink-0 flex items-center justify-center rounded-2xl overflow-hidden`}
    >
      <img
        src={src}
        alt={type === "scooter" ? "Trottinette Voi" : "Vélo Voi"}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

function VehicleLabel({ type }) {
  if (type === "scooter") return "Trottinette";
  if (type === "bike") return "Vélo";
  return "Véhicule";
}

function VehicleCard({ vehicle, onClick }) {
  if (vehicle.type === "car") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-3xl shadow-md text-left hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <VehicleIcon type="car" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {vehicle.name || `${vehicle.make} ${vehicle.model}`}
          </p>
          {vehicle.maxRangeMeters != null && (
            <p className="text-sm text-gray-600 mt-0.5 font-medium">
              {Math.round(vehicle.maxRangeMeters / 1000)} km d'autonomie
            </p>
          )}
        </div>
        <div className="w-px h-10 bg-gray-200 flex-shrink-0" />
        <PropulsionBadge
          propulsionType={vehicle.propulsionType}
          count={vehicle.count}
        />
      </button>
    );
  }

  const percent =
    vehicle.rangeMeters != null
      ? Math.round((vehicle.rangeMeters / VOI_MAX_RANGE_METERS) * 100)
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-3xl shadow-md text-left hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <VoiVehicleImage type={vehicle.type} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          <VehicleLabel type={vehicle.type} />
        </p>
        {vehicle.rangeMeters != null && (
          <p className="text-sm text-gray-600 mt-0.5 font-medium">
            {Math.round(vehicle.rangeMeters / 1000)} km d'autonomie
          </p>
        )}
      </div>

      {percent != null && (
        <>
          <div className="w-px h-10 bg-gray-200 flex-shrink-0" />
          <BatteryBadge percent={percent} />
        </>
      )}
    </button>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}

function PriceCard({ kind, vehicle, plans, loading, error }) {
  const info =
    kind === "voi"
      ? getVoiPriceInfo(plans, vehicle.type)
      : getCitizPriceInfo(plans, vehicle.pricingPlanId);

  return (
    <div className="w-full p-4 border-t border-slate-100">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
        Tarif
      </p>

      {loading && (
        <p className="text-sm text-slate-500">Chargement du tarif…</p>
      )}

      {!loading && error && (
        <p className="text-sm text-slate-500">
          Tarif indisponible pour le moment.
        </p>
      )}

      {!loading && !error && !info && (
        <p className="text-sm text-slate-500">
          {kind === "citiz"
            ? "Tarif non disponible pour ce véhicule."
            : "Tarif non disponible."}
        </p>
      )}

      {!loading && !error && info && kind === "voi" && (
        <p className="text-lg font-bold text-gray-900">
          {info.unlock}
          {info.perMin && (
            <span className="text-sm font-medium text-gray-600">
              {" "}
              pour débloquer + {info.perMin}
            </span>
          )}
        </p>
      )}

      {!loading && !error && info && kind === "citiz" && (
        <>
          <p className="text-lg font-bold text-gray-900">
            {info.summary || "—"}
          </p>
          {info.label && (
            <p className="text-xs text-slate-500 mt-1">{info.label}</p>
          )}
        </>
      )}
    </div>
  );
}

const VOI_LOGO_COLOR = "#F46C63";

const BOOKING_BUTTON_STYLE = {
  light: {
    className: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  },
  dark: {
    className: "bg-slate-800 text-white hover:bg-slate-700",
  },
  gray: {
    className: "bg-zinc-700 text-white hover:bg-zinc-600",
  },
};

function BookingButton({ kind, logoSrc, theme }) {
  const url = BOOKING_URL[kind];
  if (!url) return null;

  const style = BOOKING_BUTTON_STYLE[theme] || BOOKING_BUTTON_STYLE.light;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-5 flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 font-semibold text-sm transition-colors ${style.className}`}
    >
      <span>Réserver sur</span>
      {kind === "voi" ? (
        <span
          role="img"
          aria-label={LOGO_LABEL[kind]}
          className="h-5 w-14 -mt-1"
          style={{
            backgroundColor: VOI_LOGO_COLOR,
            WebkitMaskImage: `url(${logoSrc})`,
            maskImage: `url(${logoSrc})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      ) : (
        <img src={logoSrc} alt={LOGO_LABEL[kind]} className="h-5 w-auto" />
      )}
    </a>
  );
}

function VehicleDetail({
  vehicle,
  kind,
  logoSrc,
  theme,
  plans,
  pricingLoading,
  pricingError,
  onBack,
}) {
  const isCar = vehicle.type === "car";
  const percent =
    !isCar && vehicle.rangeMeters != null
      ? Math.round((vehicle.rangeMeters / VOI_MAX_RANGE_METERS) * 100)
      : null;

  return (
    <div className="mt-1">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <img src={logoSrc} alt={LOGO_LABEL[kind]} className="h-7 w-auto" />
      </div>

      <div className="mt-6 flex items-center gap-4">
        {isCar ? (
          <VehicleIcon type="car" size="large" />
        ) : (
          <VoiVehicleImage type={vehicle.type} size="large" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">
            {isCar ? (
              vehicle.name || `${vehicle.make} ${vehicle.model}`
            ) : (
              <VehicleLabel type={vehicle.type} />
            )}
          </p>
          {isCar && vehicle.maxRangeMeters != null && (
            <p className="text-sm text-gray-600 mt-0.5 font-medium">
              {Math.round(vehicle.maxRangeMeters / 1000)} km d'autonomie
            </p>
          )}
          {!isCar && vehicle.rangeMeters != null && (
            <p className="text-sm text-gray-600 mt-0.5 font-medium">
              {Math.round(vehicle.rangeMeters / 1000)} km d'autonomie
            </p>
          )}
        </div>

        {isCar ? (
          <PropulsionBadge
            propulsionType={vehicle.propulsionType}
            count={vehicle.count}
          />
        ) : (
          <BatteryBadge percent={percent} size="large" />
        )}
      </div>

      <div className="mt-5">
        <PriceCard
          kind={kind}
          vehicle={vehicle}
          plans={plans}
          loading={pricingLoading}
          error={pricingError}
        />
      </div>

      <BookingButton kind={kind} logoSrc={logoSrc} theme={theme} />
    </div>
  );
}

export function GbfsSheet({ isOpen, onClose, kind, address, vehicles = [] }) {
  const theme = useTheme();
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const {
    plans,
    loading: pricingLoading,
    error: pricingError,
  } = useGbfsPricing(kind, isOpen);

  useEffect(() => {
    if (!isOpen) setSelectedVehicle(null);
  }, [isOpen]);

  useEffect(() => {
    setSelectedVehicle(null);
  }, [kind]);

  if (!kind) return null;

  const totalVehicles = vehicles.reduce((sum, v) => sum + (v.count || 1), 0);

  const logoSrc =
    kind === "citiz"
      ? theme !== "light"
        ? LOGO_SRC.citiz.dark
        : LOGO_SRC.citiz.light
      : LOGO_SRC[kind];

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.4, 0.75, 1]}
      initialSnap={1}
    >
      <Sheet.Container
        style={{ borderRadius: "24px 24px 0 0", overflow: "hidden" }}
      >
        <Sheet.Header />
        <Sheet.Content>
          <div className="relative h-full overflow-hidden">
            {/* ── Vue liste ── */}
            <div
              className="flex h-full flex-col px-5 pb-8 overflow-y-auto transition-transform duration-300 ease-out"
              style={{
                transform: selectedVehicle
                  ? "translateX(-100%)"
                  : "translateX(0)",
              }}
            >
              <div className="flex items-center pt-1">
                <img
                  src={logoSrc}
                  alt={LOGO_LABEL[kind]}
                  className="h-8 w-auto"
                />
              </div>

              <div className="mt-4">
                <h2 className="mt-1 text-sm font-bold text-slate-900">
                  {address || "Adresse inconnue"}
                </h2>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                  {totalVehicles > 1
                    ? `${totalVehicles} véhicules disponibles`
                    : totalVehicles === 1
                      ? "Véhicule disponible"
                      : "Disponibilité"}
                </p>
                <div className="space-y-2">
                  {vehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      onClick={() => setSelectedVehicle(vehicle)}
                    />
                  ))}
                  {vehicles.length === 0 && (
                    <p className="text-sm text-slate-500 py-2">
                      Aucun véhicule disponible ici pour le moment.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Vue détail véhicule ── */}
            <div
              className="absolute inset-0 flex h-full flex-col px-5 pb-8 overflow-y-auto transition-transform duration-300 ease-out"
              style={{
                transform: selectedVehicle
                  ? "translateX(0)"
                  : "translateX(100%)",
              }}
            >
              {selectedVehicle && (
                <VehicleDetail
                  vehicle={selectedVehicle}
                  kind={kind}
                  logoSrc={logoSrc}
                  theme={theme}
                  plans={plans}
                  pricingLoading={pricingLoading}
                  pricingError={pricingError}
                  onBack={() => setSelectedVehicle(null)}
                />
              )}
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop style={{ pointerEvents: "none" }} />
    </Sheet>
  );
}
