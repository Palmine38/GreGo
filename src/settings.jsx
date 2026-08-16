import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Navbar from "./navbar.jsx";
import {
  applyTheme,
  normalizeTheme,
  watchSystemTheme,
  THEMES,
} from "./hooks/useTheme.js";
import { usePerfSettings } from "./hooks/usePerfSettings.js";
import { NotificationToast } from "./components/NotificationToast.jsx";
const DEBUG = true;

const DEFAULTS = {
  wheelchair: false,
  walkSpeed: 1.4,
  numItineraries: 50,
  headerLines: "all",
  showJourneyDisruptions: true,
  showIntermediateStops: true,
  theme: THEMES.AUTO,
};

const SLIDER_MAX = 20;
const NUM_ITINERARIES_MAX = 50;

function sliderToItineraries(sliderVal) {
  return sliderVal === SLIDER_MAX ? NUM_ITINERARIES_MAX : sliderVal;
}

function itinerariesToSlider(num) {
  return num === NUM_ITINERARIES_MAX ? SLIDER_MAX : num;
}

export default function Settings() {
  const fileInputRef = useRef(null);
  const isFirstRender = useRef(true);
  const { settings: perfSettings, setOverlayVisible } = usePerfSettings();

  const getInitialSettings = () => {
    try {
      const saved = localStorage.getItem("tag-express-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          wheelchair: parsed.wheelchair ?? DEFAULTS.wheelchair,
          walkSpeed: parsed.walkSpeed ?? DEFAULTS.walkSpeed,
          numItineraries: parsed.numItineraries ?? DEFAULTS.numItineraries,
          headerLines: parsed.headerLines ?? DEFAULTS.headerLines,
          showJourneyDisruptions:
            parsed.showJourneyDisruptions ?? DEFAULTS.showJourneyDisruptions,
          showIntermediateStops:
            parsed.showIntermediateStops ?? DEFAULTS.showIntermediateStops,
          theme: normalizeTheme(parsed.theme),
        };
      }
    } catch (e) {
      console.error("Erreur chargement settings:", e);
    }
    return DEFAULTS;
  };

  const initial = getInitialSettings();
  const [wheelchair, setWheelchair] = useState(initial.wheelchair);
  const [walkSpeed, setWalkSpeed] = useState(initial.walkSpeed);
  const [numItineraries, setNumItineraries] = useState(initial.numItineraries);
  const [headerLines, setHeaderLines] = useState(initial.headerLines);
  const [showJourneyDisruptions, setShowJourneyDisruptions] = useState(
    initial.showJourneyDisruptions,
  );
  const [showIntermediateStops, setShowIntermediateStops] = useState(
    initial.showIntermediateStops,
  );
  const [theme, setTheme] = useState(initial.theme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );
  const [resetStep, setResetStep] = useState(null); // null | 'warn' | 'confirm'
  const [resetClosing, setResetClosing] = useState(false);
  const [isBottomBarCompact, setIsBottomBarCompact] = useState(
    () => window.scrollY > 48,
  );
  const [isPreparingTrips, setIsPreparingTrips] = useState(false);
  const [importError, setImportError] = useState("");

  useEffect(() => {
    const onScroll = () => setIsBottomBarCompact(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const downloadLocalStorage = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
    }
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `localStorage-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const uploadLocalStorage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result || "{}");
        for (const key in data) {
          localStorage.setItem(key, data[key]);
        }
        alert("localStorage importé avec succès!");
        window.location.reload();
      } catch {
        setImportError(
          "Import impossible : le fichier ne contient pas une sauvegarde JSON valide.",
        );
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileUpload = () => fileInputRef.current?.click();

  const closeReset = () => {
    setResetClosing(true);
    setTimeout(() => {
      setResetStep(null);
      setResetClosing(false);
    }, 200);
  };

  const doReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem(
      "tag-express-settings",
      JSON.stringify({
        wheelchair,
        walkSpeed,
        numItineraries,
        headerLines,
        showJourneyDisruptions,
        showIntermediateStops,
        theme,
      }),
    );
    applyTheme(theme);
    window.dispatchEvent(new Event("tag-express-theme-change"));
    if (DEBUG)
      console.log("⚙️ Settings sauvegardés:", {
        wheelchair,
        walkSpeed,
        numItineraries,
        headerLines,
        showJourneyDisruptions,
        showIntermediateStops,
        theme,
      });
  }, [
    wheelchair,
    walkSpeed,
    numItineraries,
    headerLines,
    showJourneyDisruptions,
    showIntermediateStops,
    theme,
  ]);

  useEffect(() => {
    return watchSystemTheme(() =>
      setSystemPrefersDark(
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    );
  }, []);

  useEffect(() => {
    if (theme !== THEMES.AUTO) return;
    const unsubscribe = watchSystemTheme(() => {
      applyTheme(theme);
      window.dispatchEvent(new Event("tag-express-theme-change"));
    });
    return unsubscribe;
  }, [theme]);

  const speedInKmh = (walkSpeed * 3.6).toFixed(1);
  const handleSpeedChange = (kmh) => setWalkSpeed(kmh / 3.6);

  const sliderVal = itinerariesToSlider(numItineraries);
  const isMax = sliderVal === SLIDER_MAX;
  const handleNumItinerariesChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setNumItineraries(sliderToItineraries(val));
  };

  const sliderStyle = (value, min, max) => {
    const pct = ((value - min) / (max - min)) * 100;
    return {
      appearance: "none",
      WebkitAppearance: "none",
      width: "100%",
      height: "6px",
      borderRadius: "3px",
      outline: "none",
      cursor: "pointer",
      background: `linear-gradient(to right, #2563eb ${pct}%, #d1d5db ${pct}%)`,
    };
  };

  return (
    <>
      <NotificationToast
        message={importError}
        onClose={() => setImportError("")}
      />
      <Navbar
        shiftCompactBarForAction={isPreparingTrips}
        actionBarFurtherLeft
        onBeforeTabNavigate={(path) => {
          if (path !== "/mes-trajets") return false;
          setIsPreparingTrips(true);
          return true;
        }}
      />
      <main className="min-h-screen bg-[#F8FAFC] px-4 pb-32 pt-5">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="mb-5 text-xl font-bold text-slate-900">Paramètres</h1>
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <span className="block text-sm font-semibold mb-3">
                Apparence
              </span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme(THEMES.AUTO)}
                  aria-label="Thème automatique (système)"
                  aria-pressed={theme === THEMES.AUTO}
                  className={`flex h-14 items-center justify-center rounded-lg border transition-colors ${
                    theme === THEMES.AUTO
                      ? systemPrefersDark
                        ? "border-slate-400 bg-[#3c3c3c] text-slate-100"
                        : "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme(THEMES.LIGHT)}
                  aria-label="Thème clair"
                  aria-pressed={theme === THEMES.LIGHT}
                  className={`flex h-14 items-center justify-center rounded-lg border transition-colors ${theme === THEMES.LIGHT ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:bg-gray-100"}`}
                >
                  <svg viewBox="0 0 24 24" className="size-9">
                    <defs>
                      <clipPath id="themeSwatchLight">
                        <circle cx="12" cy="12" r="12" />
                      </clipPath>
                    </defs>
                    <g clipPath="url(#themeSwatchLight)">
                      <rect x="0" y="0" width="24" height="24" fill="#6A7282" />
                      <polygon points="24,0 24,24 0,24" fill="#FFFFFF" />
                    </g>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme(THEMES.DARK)}
                  aria-label="Thème bleu foncé"
                  aria-pressed={theme === THEMES.DARK}
                  className={`flex h-14 items-center justify-center rounded-lg border transition-colors ${theme === THEMES.DARK ? "border-blue-500 bg-blue-950" : "border-gray-300 hover:bg-gray-100"}`}
                >
                  <svg viewBox="0 0 24 24" className="size-9">
                    <defs>
                      <clipPath id="themeSwatchBlue">
                        <circle cx="12" cy="12" r="12" />
                      </clipPath>
                    </defs>
                    <g clipPath="url(#themeSwatchBlue)">
                      <rect x="0" y="0" width="24" height="24" fill="#0F172A" />
                      <polygon points="24,0 24,24 0,24" fill="#2e4166" />
                    </g>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme(THEMES.GRAY)}
                  aria-label="Thème sombre"
                  aria-pressed={theme === THEMES.GRAY}
                  className={`flex h-14 items-center justify-center rounded-lg border transition-colors ${theme === THEMES.GRAY ? "border-slate-400 bg-[#3c3c3c]" : "border-gray-300 hover:bg-gray-100"}`}
                >
                  <svg viewBox="0 0 24 24" className="size-9">
                    <defs>
                      <clipPath id="themeSwatchGray">
                        <circle cx="12" cy="12" r="12" />
                      </clipPath>
                    </defs>
                    <g clipPath="url(#themeSwatchGray)">
                      <rect x="0" y="0" width="24" height="24" fill="#1E1E1E" />
                      <polygon points="24,0 24,24 0,24" fill="#454547" />
                    </g>
                  </svg>
                </button>
              </div>
            </div>
            <div className="border-b border-gray-200 pb-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-semibold">Accessibilité PMR</span>
                <input
                  type="checkbox"
                  checked={wheelchair}
                  onChange={(e) => setWheelchair(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Ce paramètre oblige le système à inclure seulement les trajets
                accessibles aux personnes en fauteuil roulant
              </p>
            </div>

            <div className="pb-4">
              <label className="block text-sm font-semibold mb-2">
                Vitesse de marche
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  value={speedInKmh}
                  onChange={(e) =>
                    handleSpeedChange(parseFloat(e.target.value) || 0)
                  }
                  step="0.5"
                  min="2"
                  max="20"
                  style={sliderStyle(parseFloat(speedInKmh), 2, 20)}
                  className="flex-1"
                />
                <span className="text-sm font-semibold w-12 text-right">
                  {speedInKmh} km/h
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ce paramètre permet de modifier la vitesse de marche prise en
                compte dans les calculs. (Défaut : 5 km/h)
              </p>
            </div>

            <div className="pb-4">
              <label className="block text-sm font-semibold mb-2">
                Nombre d'itinéraires retournés
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  value={sliderVal}
                  onChange={handleNumItinerariesChange}
                  min="0"
                  max={SLIDER_MAX}
                  style={sliderStyle(sliderVal, 0, SLIDER_MAX)}
                  className="flex-1"
                />
                <span className="text-sm font-semibold w-12 text-right">
                  {isMax ? "Max" : numItineraries}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ce paramètre permet de modifier le nombre d'itinéraires
                retournés par la recherche.
              </p>
            </div>

            <div className="pb-4">
              <label className="block text-sm font-semibold mb-2">
                Lignes dans le résumé de recherche
              </label>
              <div className="flex flex-col gap-2">
                {[
                  { value: "all", label: "Afficher tout" },
                  {
                    value: "disrupted",
                    label: "Seulement les lignes perturbées",
                  },
                  { value: "hidden", label: "Masquer" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="headerLines"
                      value={opt.value}
                      checked={headerLines === opt.value}
                      onChange={() => setHeaderLines(opt.value)}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 pb-4">
              <label className="flex items-center justify-between cursor-pointer gap-4">
                <span className="text-sm font-semibold">
                  Afficher l'infotrafic dans les détails du trajet
                </span>
                <input
                  type="checkbox"
                  checked={showJourneyDisruptions}
                  onChange={(e) => setShowJourneyDisruptions(e.target.checked)}
                  className="w-4 h-4 cursor-pointer flex-shrink-0"
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Affiche les perturbations au-dessus des lignes concernées.
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4 pb-4">
              <label className="flex items-center justify-between cursor-pointer gap-4">
                <span className="text-sm font-semibold">
                  Afficher les arrêts intermédiaires
                </span>
                <input
                  type="checkbox"
                  checked={showIntermediateStops}
                  onChange={(e) => setShowIntermediateStops(e.target.checked)}
                  className="w-4 h-4 cursor-pointer flex-shrink-0"
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Affiche les arrêts desservis entre le départ et l'arrivée.
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4 pb-4">
              <label className="flex items-center justify-between cursor-pointer gap-4">
                <span className="text-sm font-semibold">
                  Afficher les statistiques
                </span>
                <input
                  type="checkbox"
                  checked={perfSettings.devMode && perfSettings.devOverlay}
                  onChange={(e) => setOverlayVisible(e.target.checked)}
                  className="w-4 h-4 cursor-pointer flex-shrink-0"
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Affiche un encart avec les indicateurs de performance (images
                par seconde, mémoire, requêtes réseau...) en haut à droite de
                l'écran.
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-semibold mb-3">
                Paramètres avancés
              </label>
              <div className="space-y-2">
                <button
                  onClick={downloadLocalStorage}
                  className="w-full py-2 px-3 border border-gray-500 text-gray-800 rounded hover:bg-gray-100 transition-colors text-sm font-semibold"
                >
                  Télécharger les données
                </button>
                <button
                  onClick={triggerFileUpload}
                  className="w-full py-2 px-3 border border-gray-500 text-gray-800 rounded hover:bg-gray-100 transition-colors text-sm font-semibold"
                >
                  Importer des données
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={uploadLocalStorage}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => {
                    console.log("🔴 Reset button clicked");
                    setResetStep("warn");
                  }}
                  className="w-full py-2 px-3 border border-red-800 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-semibold"
                >
                  Réinitialiser les données
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div
        aria-hidden="true"
        className={`pointer-events-none fixed z-40 flex flex-col items-center justify-center rounded-full border border-blue-300 bg-blue-600 text-white transition-[width,height,bottom,right,opacity,transform] duration-300 ease-in-out ${
          isBottomBarCompact ? "size-14" : "size-16"
        } ${isPreparingTrips ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        style={{
          bottom: isBottomBarCompact
            ? "calc(1rem + env(safe-area-inset-bottom))"
            : "calc(1.375rem + env(safe-area-inset-bottom))",
          right: isBottomBarCompact
            ? "max(1rem, calc((100% - 13rem) / 2 - 2.5rem))"
            : "max(1rem, calc((100% - 15rem) / 2 - 3rem))",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={isBottomBarCompact ? "size-5" : "size-7"}
        >
          <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
        </svg>
      </div>

      {resetStep &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
              backgroundColor: "rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 16px",
            }}
            onClick={closeReset}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              style={{
                animation: resetClosing
                  ? "popOut 0.2s ease forwards"
                  : "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <style>{`
              @keyframes popIn  { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
              @keyframes popOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.85); opacity: 0; } }
            `}</style>

              {resetStep === "warn" && (
                <>
                  <div className="px-5 pt-5 pb-2 text-center">
                    <div className="flex justify-end mb-1">
                      <button
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
                        onClick={() => {
                          setResetClosing(true);
                          setTimeout(() => {
                            setResetStep("confirm");
                            setResetClosing(false);
                          }, 200);
                        }}
                      >
                        Passer
                      </button>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3 z-[100000]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5 text-yellow-600"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-gray-900">
                      Sauvegardez vos données
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Il est recommandé de télécharger vos données avant de
                      réinitialiser. Cette action est irréversible.
                    </p>
                  </div>
                  <div className="flex border-t border-gray-100 mt-3">
                    <button
                      className="flex-1 py-3.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                      onClick={closeReset}
                    >
                      Annuler
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                      className="flex-1 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        downloadLocalStorage();
                        setResetClosing(true);
                        setTimeout(() => {
                          setResetStep("confirm");
                          setResetClosing(false);
                        }, 200);
                      }}
                    >
                      Continuer
                    </button>
                  </div>
                </>
              )}

              {resetStep === "confirm" && (
                <>
                  <div className="px-5 pt-5 pb-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5 text-red-600"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                      Confirmation
                    </p>
                    <p className="text-base font-bold text-gray-900">
                      Supprimer toutes les données ?
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Voulez-vous vraiment supprimer vos données ? Cette action
                      est définitive.
                    </p>
                  </div>
                  <div className="flex border-t border-gray-100 mt-3">
                    <button
                      className="flex-1 py-3.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                      onClick={closeReset}
                    >
                      Annuler
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                      className="flex-1 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                      onClick={doReset}
                    >
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
