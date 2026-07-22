import React, { memo, useEffect, useRef, useState } from "react";
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
import { NotificationToast } from "./components/NotificationToast.jsx";
import StopPickerMap from "./components/StopPickerMap.jsx";
import {
  buildOtpParams,
  filterByLine,
  filterByTimeWindow,
  getMinutesUntil,
  otpPlaceParam,
  parseItinerary,
} from "./utils/journey.js";
import {
  CURRENT_LOCATION_LABEL,
  CURRENT_LOCATION_VALUE,
  getCurrentLocationCoords,
  isCurrentLocationValue,
} from "./utils/currentLocation.js";
import {
  findAddressSuggestions,
  normalizeSearchText as normalizeStopName,
} from "./utils/addressSuggestions.js";
import { getSearchErrorMessage } from "./utils/searchError.js";

const CACHE_KEY = "tag-express-fast-research-cache";
const CACHE_DURATION = 120000; // 2 minutes

const formatTimeInputValue = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;

const getNextDateForTime = (timeValue, baseDate = new Date()) => {
  if (!/^\d{2}:\d{2}$/.test(timeValue || "")) return null;
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function FastResearch() {
  // ── Hooks partagés ────────────────────────────────────────────────────────
  const currentTime = useCurrentTime();
  const { stopsMap, stopsList, stopsLoaded, findStop, suggestionsFor } =
    useStops();
  const { disruptionsRaw, isLineDisrupted, getLineDisruptions } =
    useDisruptions();
  const { lineColors } = useLineColors();
  const { settings, reloadSettings } = useSettings();

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
    if (isCurrentLocationValue(idOrName)) return CURRENT_LOCATION_LABEL;
    for (const positions of Object.values(stopsMap)) {
      for (const position of positions) {
        if (position.id === idOrName) return position.name;
        if (
          position.stopId === idOrName ||
          idOrName.startsWith(position.stopId)
        ) {
          return position.name;
        }
      }
    }
    return idOrName;
  };

  const findPositionForValue = (value, preferredLine) => {
    if (!value?.includes("::")) return null;
    const [reference, coords] = value.split("::");
    const positions = Object.values(stopsMap).flat();
    const byId = positions.find(
      (position) =>
        position.id === value || position.stopId === reference,
    );
    if (byId || !coords) return byId || null;

    const [lat, lon] = coords.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return findStop(reference, preferredLine).find(
      (position) =>
        Math.abs(position.lat - lat) < 1e-5 &&
        Math.abs(position.lon - lon) < 1e-5,
    );
  };

  // ── État local de recherche ───────────────────────────────────────────────
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");
  const [line, setLine] = useState("");
  const [results, setResults] = useState([]);
  const [otpJourney, setOtpJourney] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeOffset, setTimeOffset] = useState(0);
  const [searchBaseDate, setSearchBaseDate] = useState(new Date());
  const [searchTime, setSearchTime] = useState(() => formatTimeInputValue());
  const searchBaseDateRef = useRef(searchBaseDate);
  useEffect(() => {
    searchBaseDateRef.current = searchBaseDate;
  }, [searchBaseDate]);

  // ── Suggestions ───────────────────────────────────────────────────────────
  const [quickSearch, setQuickSearch] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [quickSearchActive, setQuickSearchActive] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const quickSearchRef = useRef(null);
  const stopSuggestions = suggestionsFor(quickSearch);
  const hasExactStopMatch =
    !!quickSearch.trim() &&
    Object.keys(stopsMap).some(
      (stopName) => normalizeStopName(stopName) === normalizeStopName(quickSearch),
    );
  useEffect(() => {
    if (hasExactStopMatch) {
      setAddressSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setAddressSuggestions(await findAddressSuggestions(quickSearch));
    }, 250);
    return () => clearTimeout(timer);
  }, [quickSearch, hasExactStopMatch]);

  useEffect(() => {
    getCurrentLocationCoords().then(setUserPosition).catch(() => {});
  }, []);

  // ── UI panels ─────────────────────────────────────────────────────────────
  const [inputsOpen, setInputsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRefreshCheck, setShowRefreshCheck] = useState(false);
  const [isBottomBarCompact, setIsBottomBarCompact] = useState(
    () => window.scrollY > 48,
  );
  const [isPreparingTrips, setIsPreparingTrips] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(true);
  const [mapPickerTarget, setMapPickerTarget] = useState("dep");

  useEffect(() => {
    const onScroll = () => setIsBottomBarCompact(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Journey details ───────────────────────────────────────────────────────
  const [selectedJourney, setSelectedJourney] = useState(null);

  // ── Line info sheet ───────────────────────────────────────────────────────
  const [selectedLineInfo, setSelectedLineInfo] = useState(null);

  // ── Inputs cancel guard ───────────────────────────────────────────────────
  const initialValuesRef = useRef({
    dep: "",
    arr: "",
    line: "",
    searchBaseDate: new Date(),
    searchTime: formatTimeInputValue(),
  });
  const inputsOpenRef = useRef(inputsOpen);
  useEffect(() => {
    if (inputsOpen && !inputsOpenRef.current) {
      initialValuesRef.current = { dep, arr, line, searchBaseDate, searchTime };
    }
    inputsOpenRef.current = inputsOpen;
  }, [inputsOpen, dep, arr, line, searchBaseDate, searchTime]);

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
          const cachedBaseDate = new Date(parsed.searchBaseDate);
          setSearchBaseDate(cachedBaseDate);
          setSearchTime(parsed.searchTime || formatTimeInputValue(cachedBaseDate));
          setQuickSearch(parsed.arr.split("::")[0]);
          return;
        }
        sessionStorage.removeItem(CACHE_KEY);
      }
    } catch (e) {
      console.error("Erreur chargement cache fast-research:", e);
    }
  }, []);

  // ── Recherche ─────────────────────────────────────────────────────────────
  const search = async (
    offset = 0,
    overrideDep,
    overrideArr,
    overrideLine,
    overrideSearchTime,
    openDetails = false,
  ) => {
    const depValue = overrideDep ?? depRef.current;
    const arrValue = overrideArr ?? arrRef.current;
    const lineValue = overrideLine ?? lineRef.current;

    if (!depValue || !arrValue) return;

    setError("");
    setLoading(true);

    let fromId, fromName, fromPosition;
    if (isCurrentLocationValue(depValue)) {
      try {
        const current = await getCurrentLocationCoords();
        fromId = `${CURRENT_LOCATION_LABEL}::${current.lat},${current.lon}`;
        fromName = CURRENT_LOCATION_LABEL;
      } catch (err) {
        setError(err.message || "Votre position est indisponible. Réessayez.");
        setLoading(false);
        return;
      }
    } else if (depValue.includes("::")) {
      fromId = depValue;
      fromName = depValue.split("::")[0];
      fromPosition = findPositionForValue(depValue, lineValue);
    } else {
      const from = findStop(depValue, lineValue);
      if (!from.length) {
        setError(`L'arrêt de départ « ${depValue} » est introuvable. Sélectionnez un arrêt dans les suggestions.`);
        setLoading(false);
        return;
      }
      fromPosition = from[0];
      fromId = from[0].id;
      fromName = from[0].name;
    }

    let toId, toName, toPosition;
    if (arrValue.includes("::")) {
      toId = arrValue;
      toName = arrValue.split("::")[0];
      toPosition = findPositionForValue(arrValue, lineValue);
    } else {
      const to = findStop(arrValue, lineValue);
      if (!to.length) {
        setError(`L'arrêt d'arrivée « ${arrValue} » est introuvable. Sélectionnez un arrêt dans les suggestions.`);
        setLoading(false);
        return;
      }
      toPosition = to[0];
      toId = to[0].id;
      toName = to[0].name;
    }

    const requestedTime = getNextDateForTime(
      overrideSearchTime,
      searchBaseDateRef.current,
    );
    const baseTime = requestedTime || searchBaseDateRef.current || new Date();
    const now = new Date();
    const anchorTime = requestedTime || (baseTime < now ? now : baseTime);
    const queryTime = new Date(anchorTime.getTime() + offset * 60 * 60 * 1000);
    const savedSettings = JSON.parse(
      localStorage.getItem("tag-express-settings") || "{}",
    );

    const urlParams = buildOtpParams({
      fromCoords: fromPosition
        ? otpPlaceParam(fromPosition)
        : fromId.split("::")[1] || fromId,
      toCoords: toPosition
        ? otpPlaceParam(toPosition)
        : toId.split("::")[1] || toId,
      queryTime,
      settings: savedSettings,
    });

    try {
      const res = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/plan?${urlParams.toString()}`,
      );
      if (!res.ok) throw Object.assign(new Error("Itinerary request failed"), { status: res.status });
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
      // StopPickerMap attend l'itinéraire enrichi par parseItinerary, qui
      // expose les legs complets sous `allLegs` pour dessiner les vecteurs.
      setOtpJourney(finalResults[0] || null);

      setError(
        finalResults.length === 0
          ? "Aucun itinéraire trouvé pour ce créneau."
          : windowed.length === 0
            ? "Aucun trajet dans les 30 min, voici les suivants."
            : "",
      );
      setResults(finalResults);
      if (openDetails && finalResults[0]) {
        setSelectedJourney({
          ...finalResults[0],
          depName: resolveDisplayName(finalResults[0].depName),
          arrName: resolveDisplayName(finalResults[0].arrName),
          rawDep: depValue,
          rawArr: arrValue,
        });
      }
      setTimeOffset(offset);
      setSearchBaseDate(anchorTime);
      setSearchTime(formatTimeInputValue(queryTime));
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
          searchTime: formatTimeInputValue(queryTime),
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      setError(getSearchErrorMessage(err));
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
    setSearchBaseDate(new Date());
    setSearchTime(formatTimeInputValue());
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
    setSearchBaseDate(initialValuesRef.current.searchBaseDate);
    setSearchTime(initialValuesRef.current.searchTime);
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
    setQuickSearchActive(true);
    requestAnimationFrame(() => quickSearchRef.current?.focus());
  };

  const selectQuickDestination = async (value, label = value.split("::")[0]) => {
    // La destination doit rester visible même si la géolocalisation est refusée
    // ou prend quelques secondes à répondre.
    setDep(CURRENT_LOCATION_VALUE);
    setArr(value);
    setQuickSearch(label);
    setQuickSearchActive(false);
    setAddressSuggestions([]);
    setError("");
    setLoading(true);

    try {
      // La demande d'autorisation est faite immédiatement, avant le calcul du trajet.
      const location = await getCurrentLocationCoords();
      setUserPosition(location);
      const departure = `${CURRENT_LOCATION_LABEL}::${location.lat},${location.lon}`;
      setDep(departure);
      search(0, departure, value, "", searchTime, true);
    } catch (locationError) {
      setError(locationError.message || "Votre position est indisponible. Réessayez.");
      setLoading(false);
    }
  };

  const submitQuickSearch = async () => {
    const query = quickSearch.trim();
    if (!query || loading) return;

    const matchingStopKey = Object.keys(stopsMap).find(
      (stopName) => normalizeStopName(stopName) === normalizeStopName(query),
    );
    if (matchingStopKey) {
      const stopName = stopsMap[matchingStopKey]?.[0]?.name || matchingStopKey;
      selectQuickDestination(stopName);
      return;
    }

    const matchingAddress = addressSuggestions.find(
      (address) => normalizeStopName(address.label) === normalizeStopName(query),
    );
    if (matchingAddress) {
      selectQuickDestination(matchingAddress.value, matchingAddress.label);
      return;
    }

    const [firstAddress] = await findAddressSuggestions(query);
    if (firstAddress) {
      selectQuickDestination(firstAddress.value, firstAddress.label);
      return;
    }

    setError("Adresse ou arrêt introuvable.");
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
        shiftCompactBarForAction={isPreparingTrips}
        actionBarFurtherLeft
        onBeforeTabNavigate={(path) => {
          if (path !== "/mes-trajets") return false;
          setIsPreparingTrips(true);
          return true;
        }}
      />

      <div className="fixed top-24 left-4 right-4 z-30">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 shrink-0 text-slate-400" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
          <input ref={quickSearchRef} value={quickSearch} onChange={(event) => { setQuickSearch(event.target.value); setQuickSearchActive(true); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitQuickSearch(); } }} onFocus={() => setQuickSearchActive(true)} placeholder="On va où ?" className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none placeholder:text-slate-500" aria-label="Rechercher un arrêt ou une adresse" />
        </div>
        {!quickSearchActive && quickSearch && (loading || results.length === 0) && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-slate-700 shadow">
            {loading && <span className="size-3 animate-pulse rounded-full bg-blue-600" aria-hidden="true" />}
            <span>{loading ? `Recherche vers ${quickSearch}…` : `Destination : ${quickSearch}`}</span>
          </div>
        )}
        <NotificationToast
          message={error}
          onClose={() => setError("")}
          variant={error.startsWith("Aucun") ? "warning" : "error"}
        />
        {quickSearchActive && quickSearch.trim() && !hasExactStopMatch && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
            {stopSuggestions.length > 0 && <p className="px-4 pt-2 pb-1 text-[11px] font-bold tracking-widest text-slate-400">ARRÊTS</p>}
            {stopSuggestions.map((stop) => <button key={`stop-${stop}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectQuickDestination(stop)} className="flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50"><span className="text-sm font-semibold text-slate-800">{stop}</span><span className="text-xs text-slate-500">Arrêt</span></button>)}
            {addressSuggestions.length > 0 && <p className="border-t border-slate-100 px-4 pt-3 pb-1 text-[11px] font-bold tracking-widest text-slate-400">ADRESSES</p>}
            {addressSuggestions.map((address) => <button key={address.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectQuickDestination(address.value, address.label)} className="flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50"><span className="text-sm font-semibold text-slate-800">{address.label}</span><span className="truncate text-xs text-slate-500">{address.detail}</span></button>)}
          </div>
        )}
      </div>

      <div className="min-h-screen relative bg-transparent pb-28">
        {/* Fast Research reste volontairement une vue carte : les résultats
            servent au calcul du tracé mais ne sont pas affichés au centre. */}
        <div className="hidden">

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
                ) : null}
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

        {/* Panneau détails trajet */}
        <JourneyDetailsSheet
          journey={selectedJourney}
          isOpen={!!selectedJourney}
          onClose={closeJourneyDetails}
          lineColors={lineColors}
          getLineDisruptions={getLineDisruptions}
          hideBackdrop
          hideMap
          snapPoints={[0, 0.3, 0.6, 1]}
          initialSnap={1}
          onLineClick={(lk) => {
            setSelectedLineInfo(lk);
            requestAnimationFrame(() => setLineInfoOpen(true));
          }}
        />

        {/* Panneau infotrafic ligne */}
        <LineInfoSheet
          lineKey={selectedLineInfo}
          isOpen={!!selectedLineInfo}
          onClose={closeLineInfo}
          getLineDisruptions={getLineDisruptions}
        />

        {/* Panneau recherche */}
      </div>

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

      {mapPickerOpen && (
        <StopPickerMap
          stops={stopsList}
          target="arr"
          embedded
          journey={otpJourney}
          lineColors={lineColors}
          allowAddressSelection={false}
          userPosition={userPosition}
          onSelect={(name) => selectQuickDestination(name)}
          onClose={() => setMapPickerOpen(false)}
        />
      )}
    </>
  );
}
