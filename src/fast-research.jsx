import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "./navbar.jsx";
import { useCurrentTime } from "./hooks/useCurrentTime.js";
import { useStops } from "./hooks/useStops.js";
import { useDisruptions } from "./hooks/useDisruptions.js";
import { useLineColors } from "./hooks/useLineColors.js";
import { useSettings } from "./hooks/useSettings.js";
import { JourneyCard } from "./components/JourneyCard.jsx";
import { JourneyDetailsSheet } from "./components/JourneyDetailsSheet.jsx";
import { JourneyResultsHeader } from "./components/JourneyResultsHeader.jsx";
import { LineInfoSheet } from "./components/LineInfoSheet.jsx";
import { SearchForm, SearchSheet } from "./components/SearchSheet.jsx";
import StopPickerMap from "./components/StopPickerMap.jsx";
import {
  buildOtpParams,
  filterByLine,
  filterByTimeWindow,
  getMinutesUntil,
  parseItinerary,
} from "./utils/journey.js";

const CACHE_KEY = "tag-express-fast-research-cache";
const CACHE_DURATION = 120000; // 2 minutes

// ─────────────────────────────────────────────────────────────────────────────
export default function FastResearch() {
  // ── Hooks partagés ────────────────────────────────────────────────────────
  const currentTime = useCurrentTime();
  const { stopsMap, stopsLoaded, findStop, suggestionsFor } = useStops();
  const { disruptionsRaw, isLineDisrupted, getLineDisruptions } =
    useDisruptions();
  const { lineColors } = useLineColors();
  const { settings, reloadSettings } = useSettings();

  const stopsList = useMemo(
    () =>
      Object.values(stopsMap).map(([fullId, name]) => {
        const [, coords] = fullId.split("::");
        const [lat, lon] = coords ? coords.split(",").map(Number) : [0, 0];
        return { id: fullId, name, lat, lon };
      }),
    [stopsMap],
  );

  // Préchargement fond de carte MapTiler
  useEffect(() => {
    if (!stopsLoaded) return;
    fetch(
      "https://api.maptiler.com/maps/019d0d02-359b-7f4b-a797-bdeabca9dce3/style.json?key=7TQErbyvEqFlis3QMmSl",
    )
      .then((r) => r.json())
      .then((style) => {
        style.sources &&
          Object.values(style.sources).forEach((source) => {
            if (source.tiles)
              source.tiles.forEach((url) =>
                fetch(url.replace("{z}/{x}/{y}", "13/4236/2938")),
              );
          });
      });
  }, [stopsLoaded]);

  // ── resolveDisplayName ────────────────────────────────────────────────────
  const resolveDisplayName = (idOrName) => {
    if (!idOrName) return idOrName;
    for (const [fullId, nomLong] of Object.values(stopsMap)) {
      if (fullId === idOrName) return nomLong;
      const shortId = fullId.split("::")[0];
      if (shortId === idOrName || idOrName.startsWith(shortId)) return nomLong;
    }
    return idOrName;
  };

  // ── État local de recherche ───────────────────────────────────────────────
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");
  const [line, setLine] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeOffset, setTimeOffset] = useState(0);
  const [searchBaseDate, setSearchBaseDate] = useState(new Date());
  const searchBaseDateRef = useRef(searchBaseDate);
  useEffect(() => {
    searchBaseDateRef.current = searchBaseDate;
  }, [searchBaseDate]);

  // ── Suggestions ───────────────────────────────────────────────────────────
  const [depSuggestions, setDepSuggestions] = useState([]);
  const [arrSuggestions, setArrSuggestions] = useState([]);
  useEffect(() => {
    setDepSuggestions(suggestionsFor(dep));
    setArrSuggestions([]);
  }, [dep, stopsMap]);
  useEffect(() => {
    setArrSuggestions(suggestionsFor(arr));
    setDepSuggestions([]);
  }, [arr, stopsMap]);

  // ── UI panels ─────────────────────────────────────────────────────────────
  const [inputsOpen, setInputsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRefreshCheck, setShowRefreshCheck] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState("dep");

  // ── Journey details ───────────────────────────────────────────────────────
  const [selectedJourney, setSelectedJourney] = useState(null);

  // ── Line info sheet ───────────────────────────────────────────────────────
  const [selectedLineInfo, setSelectedLineInfo] = useState(null);

  // ── Inputs cancel guard ───────────────────────────────────────────────────
  const initialValuesRef = useRef({ dep: "", arr: "", line: "" });
  const inputsOpenRef = useRef(inputsOpen);
  useEffect(() => {
    if (inputsOpen && !inputsOpenRef.current) {
      initialValuesRef.current = { dep, arr, line };
    }
    inputsOpenRef.current = inputsOpen;
  }, [inputsOpen]);

  // ── Refs pour le rafraîchissement auto ────────────────────────────────────
  const depRef = useRef(dep);
  const arrRef = useRef(arr);
  const lineRef = useRef(line);
  useEffect(() => {
    depRef.current = dep;
  }, [dep]);
  useEffect(() => {
    arrRef.current = arr;
  }, [arr]);
  useEffect(() => {
    lineRef.current = line;
  }, [line]);

  // ── Cache session ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setDep(parsed.dep);
          setArr(parsed.arr);
          setLine(parsed.line);
          setResults(parsed.results);
          setTimeOffset(parsed.timeOffset);
          setSearchBaseDate(new Date(parsed.searchBaseDate));
          setInputsOpen(false);
          return;
        }
        sessionStorage.removeItem(CACHE_KEY);
      }
    } catch (e) {
      console.error("Erreur chargement cache fast-research:", e);
    }
  }, []);

  // ── Recherche ─────────────────────────────────────────────────────────────
  const search = async (offset = 0, overrideDep, overrideArr, overrideLine) => {
    const depValue = overrideDep ?? depRef.current;
    const arrValue = overrideArr ?? arrRef.current;
    const lineValue = overrideLine ?? lineRef.current;

    if (!depValue || !arrValue) return;

    setError("");
    setLoading(true);

    let fromId, fromName;
    if (depValue.includes("::")) {
      fromId = depValue;
      fromName = depValue.split("::")[0];
    } else {
      const from = findStop(depValue);
      if (!from) {
        setError(`Arrêt de départ '${depValue}' non trouvé.`);
        setLoading(false);
        return;
      }
      fromId = from[0];
      fromName = from[1];
    }

    let toId, toName;
    if (arrValue.includes("::")) {
      toId = arrValue;
      toName = arrValue.split("::")[0];
    } else {
      const to = findStop(arrValue);
      if (!to) {
        setError(`Arrêt d'arrivée '${arrValue}' non trouvé.`);
        setLoading(false);
        return;
      }
      toId = to[0];
      toName = to[1];
    }

    const baseTime = searchBaseDateRef.current || new Date();
    const now = new Date();
    const anchorTime = baseTime < now ? now : baseTime;
    const queryTime = new Date(anchorTime.getTime() + offset * 60 * 60 * 1000);
    const savedSettings = JSON.parse(
      localStorage.getItem("tag-express-settings") || "{}",
    );

    const urlParams = buildOtpParams({
      fromCoords: fromId.split("::")[1] || fromId,
      toCoords: toId.split("::")[1] || toId,
      queryTime,
      settings: savedSettings,
    });

    try {
      const res = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/plan?${urlParams.toString()}`,
      );
      const json = await res.json();
      const itineraries = json.plan?.itineraries || [];

      const parsed = itineraries.map((it) =>
        parseItinerary(it, {
          depName: fromName,
          arrName: toName,
          lineFilter: lineValue,
        }),
      );
      const filtered = filterByLine(parsed, lineValue);
      const windowed = filterByTimeWindow(filtered, queryTime, 30);
      const finalResults = windowed.length > 0 ? windowed : filtered;

      setError(
        finalResults.length === 0
          ? "Aucun itinéraire trouvé pour ce créneau."
          : windowed.length === 0
            ? "Aucun trajet dans les 30 min, voici les suivants."
            : "",
      );
      setResults(finalResults);
      setTimeOffset(offset);
      setSearchBaseDate(anchorTime);
      setInputsOpen(false);

      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          dep: depValue,
          arr: arrValue,
          line: lineValue,
          results: finalResults,
          timeOffset: offset,
          searchBaseDate: anchorTime.toISOString(),
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      setError("Erreur réseau / API : " + (err.message || err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Rafraîchissement automatique toutes les 2 minutes ─────────────────────
  useEffect(() => {
    if (!stopsLoaded) return;
    const interval = setInterval(() => {
      if (depRef.current && arrRef.current) {
        search(0, depRef.current, arrRef.current, lineRef.current);
      }
    }, 120000);
    return () => clearInterval(interval);
  }, [stopsLoaded]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRefresh = () => {
    setShowRefreshCheck(true);
    setTimeout(() => setShowRefreshCheck(false), 1300);
    search(timeOffset);
  };

  const handleSettingsChanged = () => {
    reloadSettings();
    sessionStorage.removeItem(CACHE_KEY);
    if (depRef.current && arrRef.current) search(0);
  };

  const openJourneyDetails = (item) => {
    setSelectedJourney({
      ...item,
      depName: resolveDisplayName(item.depName),
      arrName: resolveDisplayName(item.arrName),
      rawDep: dep,
      rawArr: arr,
    });
    setMenuOpen(false);
    setInputsOpen(false);
  };

  const closeJourneyDetails = () => {
    setSelectedJourney(null);
  };

  const closeLineInfo = () => {
    setSelectedLineInfo(null);
  };

  const reset = () => {
    setDep("");
    setArr("");
    setLine("");
    setResults([]);
    setTimeOffset(0);
    setError("");
    setInputsOpen(true);
    setMenuOpen(false);
    setSelectedJourney(null);
    sessionStorage.removeItem(CACHE_KEY);
  };

  const cancel = () => {
    setDep(initialValuesRef.current.dep);
    setArr(initialValuesRef.current.arr);
    setLine(initialValuesRef.current.line);
    setInputsOpen(false);
  };

  const openMenu = () => {
    setInputsOpen(false);
    setSettingsOpen(false);
    setMenuOpen(true);
  };
  const openSettings = () => {
    setMenuOpen(false);
    setInputsOpen(false);
    setSettingsOpen(true);
  };
  const openInputs = () => {
    setMenuOpen(false);
    setSettingsOpen(false);
    setInputsOpen(true);
  };

  // ── Pagination temporelle ─────────────────────────────────────────────────
  const origin = new Date(
    (searchBaseDate || new Date()).getTime() + timeOffset * 60 * 60 * 1000,
  );
  const afterDate = new Date(origin.getTime() + 30 * 60 * 1000);
  const afterLabel = `après ${afterDate.toTimeString().slice(0, 5)}`;

  // visibleResults filtré par getMinutesUntil >= 0
  const visibleResults = results.filter(
    (item) => getMinutesUntil(item.dep, currentTime) >= 0,
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar
        title="Mes trajets (Test)"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onMenuOpen={openMenu}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        onSettingsOpen={openSettings}
        onSettingsChanged={handleSettingsChanged}
      />

      <div className="min-h-screen relative bg-[#F8FAFC] pb-24">
        <div className="m-4 p-4 rounded-lg border border-gray-300 bg-white shadow-xl">
          {error && (
            <div className="mt-3 p-2 bg-red-100 text-red-700 rounded">
              {error}
              {error.startsWith("Erreur réseau") && (
                <button
                  onClick={() => window.location.reload()}
                  className="block mt-1 underline underline-offset-2 text-sm font-semibold"
                >
                  Recharger la page
                </button>
              )}
            </div>
          )}

          {results.length > 0 && (
            <JourneyResultsHeader
              dep={resolveDisplayName(dep)}
              arr={resolveDisplayName(arr)}
              results={results}
              searchBaseDate={searchBaseDate}
              timeOffset={timeOffset}
              loading={loading}
              showRefreshCheck={showRefreshCheck}
              isLineDisrupted={isLineDisrupted}
              onLineClick={(lk) => setSelectedLineInfo(lk)}
              onRefresh={handleRefresh}
            />
          )}

          {/* Liste des résultats */}
          <div className="space-y-2">
            {visibleResults.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {loading ? (
                  "Recherche en cours..."
                ) : (
                  <button
                    onClick={openInputs}
                    className="font-semibold underline underline-offset-2"
                  >
                    Lancer la recherche
                  </button>
                )}
              </div>
            ) : (
              visibleResults.map((item, idx) => (
                <JourneyCard
                  key={idx}
                  item={item}
                  currentTime={currentTime}
                  isLineDisrupted={isLineDisrupted}
                  onClick={() => openJourneyDetails(item)}
                />
              ))
            )}
          </div>

          {/* Navigation temporelle */}
          <div
            className={`mt-4 flex items-center gap-2 ${results.length > 0 && timeOffset >= 0 ? "justify-between" : "justify-end"}`}
          >
            {timeOffset >= 0 && results.length > 0 && (
              <button
                className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700"
                onClick={() => search(timeOffset - 0.5)}
                disabled={loading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-4 scale-x-[-1]"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
              </button>
            )}
            {results.length > 0 && (
              <button
                className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700"
                onClick={() => search(timeOffset + 0.5)}
                disabled={loading}
              >
                rechercher pour {afterLabel}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-4 inline ml-1"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bouton fixe "Ouvrir la recherche" */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 pt-3 pb-6 shadow-lg">
          <button
            className="w-full py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
            onClick={openInputs}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 15.75 7.5-7.5 7.5 7.5"
              />
            </svg>
            Ouvrir la recherche
          </button>
        </div>

        {/* Panneau détails trajet */}
        <JourneyDetailsSheet
          journey={selectedJourney}
          isOpen={!!selectedJourney}
          onClose={closeJourneyDetails}
          lineColors={lineColors}
          getLineDisruptions={getLineDisruptions}
        />

        {/* Panneau infotrafic ligne */}
        <LineInfoSheet
          lineKey={selectedLineInfo}
          isOpen={!!selectedLineInfo}
          onClose={closeLineInfo}
          getLineDisruptions={getLineDisruptions}
        />

        {/* Panneau recherche */}
        <SearchSheet isOpen={inputsOpen} onClose={cancel}>
          <SearchForm
            title="Recherche"
            dep={dep.includes("::") ? dep.split("::")[0] : dep}
            arr={arr.includes("::") ? arr.split("::")[0] : arr}
            line={line}
            setDep={setDep}
            setArr={setArr}
            setLine={setLine}
            depSuggestions={depSuggestions}
            arrSuggestions={arrSuggestions}
            onDepBlur={() => setArrSuggestions([])}
            onArrBlur={() => setDepSuggestions([])}
            onSelectSuggestion={(v, target) => {
              if (!v) {
                if (target === "dep") setDepSuggestions([]);
                else setArrSuggestions([]);
                return;
              }
              if (target === "dep") {
                setDep(v);
                setDepSuggestions([]);
              } else {
                setArr(v);
                setArrSuggestions([]);
              }
            }}
            onSearch={() => search(0, dep, arr, line)}
            onReset={reset}
            onCancel={cancel}
            loading={loading}
            stopsLoaded={stopsLoaded}
            onOpenMapPicker={(target) => {
              setMapPickerTarget(target);
              setMapPickerOpen(true);
            }}
          />
        </SearchSheet>
      </div>

      {mapPickerOpen && (
        <StopPickerMap
          stops={stopsList}
          target={mapPickerTarget}
          onSelect={(name) => {
            if (mapPickerTarget === "dep") setDep(name);
            else setArr(name);
          }}
          onClose={() => setMapPickerOpen(false)}
        />
      )}
    </>
  );
}
