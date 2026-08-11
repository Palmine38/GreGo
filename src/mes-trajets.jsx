import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Sheet } from "react-modal-sheet";
import Navbar from "./navbar.jsx";
import LineIcon from "./lines-icons.jsx";
import { useCurrentTime } from "./hooks/useCurrentTime.js";
import { useStops } from "./hooks/useStops.js";
import { useDisruptions } from "./hooks/useDisruptions.js";
import { useLineColors } from "./hooks/useLineColors.js";
import { useSettings } from "./hooks/useSettings.js";
import { JourneyCard } from "./components/JourneyCard.jsx";
import { JourneyTimeline } from "./components/JourneyTimeline.jsx";
import { JourneyResultsHeader } from "./components/JourneyResultsHeader.jsx";
import { DisruptionItem } from "./components/DisruptionItem.jsx";
import { SearchForm } from "./components/SearchSheet.jsx";
import { NotificationToast } from "./components/NotificationToast.jsx";
import StopPickerMap from "./components/StopPickerMap.jsx";
import { JourneyMapModal } from "./components/JourneyMapModal.jsx";
import { JourneyDetailsSheet } from "./components/JourneyDetailsSheet.jsx";
import { InlineJourneyMap } from "./components/JourneyDetailsSheet.jsx";
import { LineInfoSheet } from "./components/LineInfoSheet.jsx";
import { useTheme } from "./hooks/useTheme.js";
import {
  buildOtpParams,
  filterByLine,
  filterByTimeWindow,
  formatTimeUntil,
  getMinutesUntil,
  otpPlaceParam,
  parseItinerary,
} from "./utils/journey.js";
import {
  CURRENT_LOCATION_LABEL,
  getCurrentLocationCoords,
  isCurrentLocationValue,
} from "./utils/currentLocation.js";
import {
  findAddressSuggestions,
  normalizeSearchText,
} from "./utils/addressSuggestions.js";
import { getSearchErrorMessage } from "./utils/searchError.js";

// ─── Constantes ───────────────────────────────────────────────────────────────
const DEFAULT_TRAJET = {
  name: "",
  line: "",
  depId: "",
  arrId: "",
  depName: "",
  arrName: "",
};
const TRAJET_KEYS = ["T1", "T2", "T3"];

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
export default function MesTrajets() {
  const [searchParams] = useSearchParams();

  // ── Hooks partagés ────────────────────────────────────────────────────────
  const currentTime = useCurrentTime();
  const theme = useTheme();
  const { stopsMap, stopsList, stopsLoaded, findStop, suggestionsFor } =
    useStops();
  const { disruptionsRaw, isLineDisrupted, getLineDisruptions } =
    useDisruptions();
  const { lineColors } = useLineColors();
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
  const resolveCoords = (value) => {
    if (!value) return null;
    if (isCurrentLocationValue(value)) return null;
    if (value.includes("::")) {
      const [reference, coords] = value.split("::");
      const [lat, lon] = coords.split(",").map(Number);
      const matchingStop = Object.values(stopsMap)
        .flat()
        .find((position) => position.stopId === reference);
      return { lat, lon, name: matchingStop?.name || reference };
    }
    const stop = findStop(value);
    if (!stop.length) return null;
    return { lat: stop[0].lat, lon: stop[0].lon, name: stop[0].name };
  };

  const findStopPosition = (shortId) => {
    if (!shortId) return null;
    const positions = Object.values(stopsMap).flat();
    return positions.find(
      (position) => position.stopId === shortId || position.id === shortId,
    );
  };

  const findPositionForValue = (value, preferredLine) => {
    if (!value?.includes("::")) return null;
    const [reference, coords] = value.split("::");
    const positions = Object.values(stopsMap).flat();
    const byId = positions.find(
      (position) => position.id === value || position.stopId === reference,
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

  // ── Trajets persistés ─────────────────────────────────────────────────────
  const [trajets, setTrajets] = useState({
    T1: { ...DEFAULT_TRAJET },
    T2: { ...DEFAULT_TRAJET },
    T3: { ...DEFAULT_TRAJET },
  });
  const [currentTrajet, setCurrentTrajet] = useState("T1");
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadedTrajetsRef = useRef(null);
  const storedTrajetsSearchedRef = useRef(false);
  const trajetsRef = useRef(trajets);
  const currentTrajetRef = useRef(currentTrajet);
  const autoRefreshingRef = useRef(false);
  useEffect(() => {
    trajetsRef.current = trajets;
  }, [trajets]);
  useEffect(() => {
    currentTrajetRef.current = currentTrajet;
  }, [currentTrajet]);

  // ── Champs de recherche ───────────────────────────────────────────────────
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");
  const [line, setLine] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeOffset, setTimeOffset] = useState(0);
  const [searchBaseDate, setSearchBaseDate] = useState(new Date());
  const [searchTime, setSearchTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [mapPickerOpenSearch, setMapPickerOpenSearch] = useState(false);
  const searchBaseDateRef = useRef(searchBaseDate);
  useEffect(() => {
    searchBaseDateRef.current = searchBaseDate;
  }, [searchBaseDate]);

  // ── Suggestions ───────────────────────────────────────────────────────────
  const [depSuggestions, setDepSuggestions] = useState([]);
  const [arrSuggestions, setArrSuggestions] = useState([]);
  const [depAddressSuggestions, setDepAddressSuggestions] = useState([]);
  const [arrAddressSuggestions, setArrAddressSuggestions] = useState([]);
  useEffect(() => {
    setDepSuggestions(suggestionsFor(dep));
    setArrSuggestions([]);
  }, [dep, stopsMap]);
  useEffect(() => {
    setArrSuggestions(suggestionsFor(arr));
    setDepSuggestions([]);
  }, [arr, stopsMap]);
  useEffect(() => {
    const hasExactStopMatch = Object.keys(stopsMap).some(
      (stopName) => normalizeSearchText(stopName) === normalizeSearchText(dep),
    );
    if (hasExactStopMatch) {
      setDepAddressSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setDepAddressSuggestions(await findAddressSuggestions(dep));
    }, 250);
    return () => clearTimeout(timer);
  }, [dep, stopsMap]);
  useEffect(() => {
    const hasExactStopMatch = Object.keys(stopsMap).some(
      (stopName) => normalizeSearchText(stopName) === normalizeSearchText(arr),
    );
    if (hasExactStopMatch) {
      setArrAddressSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setArrAddressSuggestions(await findAddressSuggestions(arr));
    }, 250);
    return () => clearTimeout(timer);
  }, [arr, stopsMap]);

  // ── Résultats par trajet ───────────────────────────────────────────────────
  const [trajetResultsMap, setTrajetResultsMap] = useState({
    T1: { results: [], error: "", timeOffset: 0, searchBaseDate: new Date() },
    T2: { results: [], error: "", timeOffset: 0, searchBaseDate: new Date() },
    T3: { results: [], error: "", timeOffset: 0, searchBaseDate: new Date() },
  });
  const trajetsCacheRef = useRef({});
  const trajetsCacheTimestampRef = useRef({});

  // ── UI panels ─────────────────────────────────────────────────────────────
  const [inputsOpen, setInputsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRefreshCheck, setShowRefreshCheck] = useState(false);
  const [isBottomBarCompact, setIsBottomBarCompact] = useState(
    () => window.scrollY > 48,
  );
  const [isLeavingTrips, setIsLeavingTrips] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newTrajetName, setNewTrajetName] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState("dep");
  const [detailMapOpen, setDetailMapOpen] = useState(false);
  const inputsOpenBeforeRenameRef = useRef(false);
  const initialValuesRef = useRef({
    dep: "",
    arr: "",
    line: "",
    searchBaseDate: new Date(),
    searchTime: "",
    departureTime: "",
    arrivalTime: "",
  });
  const inputsOpenRef = useRef(inputsOpen);
  const sheetRef = useRef(null);
  useEffect(() => {
    const onScroll = () => setIsBottomBarCompact(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (inputsOpen && !inputsOpenRef.current) {
      // Une nouvelle recherche doit partir de l'heure à laquelle le panneau est ouvert.
      const now = new Date();
      const initialSearchTime = searchTime || formatTimeInputValue(now);

      initialValuesRef.current = {
        dep,
        arr,
        line,
        searchBaseDate: searchTime ? searchBaseDate : now,
        searchTime: initialSearchTime,
        departureTime,
        arrivalTime,
      };
      if (!searchTime) {
        setSearchBaseDate(now);
        setSearchTime(initialSearchTime);
      }
    }
    inputsOpenRef.current = inputsOpen;
  }, [
    inputsOpen,
    dep,
    arr,
    line,
    searchBaseDate,
    searchTime,
    departureTime,
    arrivalTime,
  ]);

  // ── Journey details ───────────────────────────────────────────────────────
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [journeyDetailsOpen, setJourneyDetailsOpen] = useState(false);
  const [lineInfoInitialSnap, setLineInfoInitialSnap] = useState(1);
  useEffect(() => {
    if (selectedJourney)
      requestAnimationFrame(() => setJourneyDetailsOpen(true));
  }, [selectedJourney]);

  // ── Line info sheet ───────────────────────────────────────────────────────
  const [selectedLineInfo, setSelectedLineInfo] = useState(null);
  const [lineInfoOpen, setLineInfoOpen] = useState(false);
  useEffect(() => {
    if (selectedLineInfo) requestAnimationFrame(() => setLineInfoOpen(true));
  }, [selectedLineInfo]);

  // ── Persistance localStorage ──────────────────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem("tag-express-trajets", JSON.stringify(trajets));
  }, [trajets]);

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const savedTrajets = localStorage.getItem("tag-express-trajets");
    const savedActive = localStorage.getItem("tag-express-active-trajet");
    const activeKey = TRAJET_KEYS.includes(savedActive) ? savedActive : "T1";
    let cleanedTrajets = {};

    if (savedTrajets) {
      try {
        const parsed = JSON.parse(savedTrajets);
        cleanedTrajets = Object.fromEntries(
          Object.entries(parsed).filter(([k]) => TRAJET_KEYS.includes(k)),
        );
        localStorage.setItem(
          "tag-express-trajets",
          JSON.stringify(cleanedTrajets),
        );
        loadedTrajetsRef.current = cleanedTrajets;
        setTrajets(cleanedTrajets);

        if (parsed[activeKey]) {
          setCurrentTrajet(activeKey);
          currentTrajetRef.current = activeKey;
          const stored = parsed[activeKey];
          setDep(stored.depName || stored.depId || "");
          setArr(stored.arrName || stored.arrId || "");
          setLine(stored.line || "");
        }
      } catch (e) {
        console.error("Erreur chargement localStorage trajets:", e);
      }
    }

    TRAJET_KEYS.forEach((t) => {
      const trajet = cleanedTrajets[t];
      if (trajet?.depId && trajet?.arrId) searchById(t, trajet);
    });

    setLoadedFromStorage(true);
    localStorage.setItem("tag-express-active-trajet", activeKey);
  }, []);

  // ── Recherche automatique après chargement des arrêts pour corriger les noms
  useEffect(() => {
    if (!loadedFromStorage || storedTrajetsSearchedRef.current) return;
    if (!stopsLoaded) return;

    TRAJET_KEYS.forEach((t) => {
      const trajet = loadedTrajetsRef.current?.[t] || trajetsRef.current[t];
      if (
        trajet?.depId &&
        trajet?.arrId &&
        (!trajet.depName ||
          !trajet.arrName ||
          trajet.depName === trajet.depId ||
          trajet.arrName === trajet.arrId)
      ) {
        searchById(t, trajet);
      }
    });

    storedTrajetsSearchedRef.current = true;
  }, [loadedFromStorage, stopsLoaded]);

  // ── Rafraîchissement automatique toutes les 2 minutes ─────────────────────
  useEffect(() => {
    if (!loadedFromStorage) return;
    const interval = setInterval(() => {
      TRAJET_KEYS.forEach((t) => {
        const trajet = trajetsRef.current[t];
        if (
          (trajet?.depName || trajet?.depId) &&
          (trajet?.arrName || trajet?.arrId)
        ) {
          if (trajet.depId && trajet.arrId) {
            search(0, {
              dep: trajet.depId || trajet.depName,
              arr: trajet.arrId || trajet.arrName,
              line: trajet.line,
              trajetKey: t,
              keepInputsOpen: true,
            });
          } else if (stopsLoaded) {
            search(0, {
              dep: trajet.depName || trajet.depId,
              arr: trajet.arrName || trajet.arrId,
              line: trajet.line,
              trajetKey: t,
              keepInputsOpen: true,
            });
          }
        }
      });
    }, 120000);
    return () => clearInterval(interval);
  }, [loadedFromStorage, stopsLoaded]);

  // ── URL params ────────────────────────────────────────────────────────────
  useEffect(() => {
    let hasUrlParams = false;
    const urlTrajets = {};
    TRAJET_KEYS.forEach((t) => {
      const param = searchParams.get(t);
      if (param) {
        hasUrlParams = true;
        const [lineParam, depId, arrId] = param.split(":");
        if (lineParam && depId && arrId) {
          const depStop = Object.values(stopsMap)
            .flat()
            .find((position) => position.stopId === depId);
          const arrStop = Object.values(stopsMap)
            .flat()
            .find((position) => position.stopId === arrId);
          urlTrajets[t] = {
            line: lineParam.toUpperCase(),
            depId,
            arrId,
            depName: depStop ? depStop.name : depId,
            arrName: arrStop ? arrStop.name : arrId,
          };
        }
      }
    });
    if (hasUrlParams) {
      setTrajets((prev) => {
        const next = { ...prev };
        Object.keys(urlTrajets).forEach((t) => {
          if (!prev[t]?.line) next[t] = urlTrajets[t];
        });
        return next;
      });
    }
  }, [searchParams, stopsMap]);

  // ─────────────────────────────────────────────────────────────────────────
  const searchById = async (trajetKey, trajet) => {
    const findStopPosition = (shortId) => {
      if (shortId?.includes("::")) return null;
      for (const positions of Object.values(stopsMap)) {
        const position = positions.find(
          (item) => item.stopId === shortId || item.id.includes(shortId),
        );
        if (position) return position;
      }
      return null;
    };
    const depPosition = findStopPosition(trajet.depId);
    const arrPosition = findStopPosition(trajet.arrId);
    const depId = depPosition?.id || trajet.depId;
    const arrId = arrPosition?.id || trajet.arrId;
    if (!depId || !arrId) return;

    const depName = depPosition?.name || trajet.depName || trajet.depId;
    const arrName = arrPosition?.name || trajet.arrName || trajet.arrId;

    if (stopsLoaded) {
      let updated = false;
      const nextTrajets = { ...trajetsRef.current };
      if (!nextTrajets[trajetKey]?.depName && depPosition?.name) {
        nextTrajets[trajetKey] = {
          ...nextTrajets[trajetKey],
          depName: depPosition.name,
        };
        updated = true;
      }
      if (!nextTrajets[trajetKey]?.arrName && arrPosition?.name) {
        nextTrajets[trajetKey] = {
          ...nextTrajets[trajetKey],
          arrName: arrPosition.name,
        };
        updated = true;
      }
      if (updated) {
        setTrajets(nextTrajets);
        trajetsRef.current = nextTrajets;
        localStorage.setItem(
          "tag-express-trajets",
          JSON.stringify(nextTrajets),
        );
      }
    }

    const savedSettings = JSON.parse(
      localStorage.getItem("tag-express-settings") || "{}",
    );
    const now = new Date();
    const urlParams = buildOtpParams({
      fromCoords: depPosition
        ? otpPlaceParam(depPosition)
        : depId.split("::")[1] || depId,
      toCoords: arrPosition
        ? otpPlaceParam(arrPosition)
        : arrId.split("::")[1] || arrId,
      queryTime: now,
      settings: savedSettings,
    });

    try {
      const res = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/plan?${urlParams.toString()}`,
      );
      if (!res.ok)
        throw Object.assign(new Error("Itinerary request failed"), {
          status: res.status,
        });
      const json = await res.json();
      const itineraries = json.plan?.itineraries || [];
      const parsed = itineraries.map((it) =>
        parseItinerary(it, {
          depName,
          arrName,
          lineFilter: trajet.line,
        }),
      );
      const filtered = filterByLine(parsed, trajet.line);
      const windowed = filterByTimeWindow(filtered, now, 30);
      const finalResults = windowed.length > 0 ? windowed : filtered;
      const trajetData = {
        results: finalResults,
        error:
          finalResults.length === 0
            ? "Aucun itinéraire trouvé."
            : windowed.length === 0
              ? "Aucun trajet dans les 30 min, voici les suivants."
              : "",
        timeOffset: 0,
        searchBaseDate: now,
        searchTime: formatTimeInputValue(now),
      };
      trajetsCacheRef.current[trajetKey] = trajetData;
      trajetsCacheTimestampRef.current[trajetKey] = Date.now();
      setTrajetResultsMap((prev) => ({ ...prev, [trajetKey]: trajetData }));
      if (trajetKey === currentTrajetRef.current) {
        setResults(finalResults);
        setError(trajetData.error);
        setTimeOffset(0);
        setSearchBaseDate(now);
        setSearchTime(formatTimeInputValue(now));
      }
    } catch (err) {
      console.error("searchById error:", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  const search = async (offset = 0, params = {}) => {
    const depValue = params.dep ?? dep;
    const arrValue = params.arr ?? arr;
    const lineValue = params.line ?? line;
    const trajetKey = params.trajetKey || currentTrajet;
    const isManual = params.manual === true;
    const keepInputsOpen = params.keepInputsOpen === true;
    const shouldUpdateGlobal =
      !params.trajetKey || params.trajetKey === currentTrajetRef.current;

    if (shouldUpdateGlobal) {
      setError("");
      setLoading(true);
    }

    let fromId, fromName, fromPosition;
    if (isCurrentLocationValue(depValue)) {
      try {
        const current = await getCurrentLocationCoords();
        fromId = `${CURRENT_LOCATION_LABEL}::${current.lat},${current.lon}`;
        fromName = CURRENT_LOCATION_LABEL;
      } catch (err) {
        if (shouldUpdateGlobal) {
          setError(
            err.message || "Votre position est indisponible. Réessayez.",
          );
          setLoading(false);
        }
        return;
      }
    } else if (depValue.includes("::")) {
      fromId = depValue;
      fromName = depValue.split("::")[0];
      fromPosition = findPositionForValue(depValue, lineValue);
    } else {
      const from = findStop(depValue, lineValue);
      if (!from.length) {
        if (shouldUpdateGlobal)
          setError(
            `L'arrêt de départ « ${depValue} » est introuvable. Sélectionnez un arrêt dans les suggestions.`,
          );
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
        if (shouldUpdateGlobal)
          setError(
            `L'arrêt d'arrivée « ${arrValue} » est introuvable. Sélectionnez un arrêt dans les suggestions.`,
          );
        return;
      }
      toPosition = to[0];
      toId = to[0].id;
      toName = to[0].name;
    }

    const requestedTime = getNextDateForTime(
      params.departureTime || params.arrivalTime || params.searchTime,
      params.searchDate || searchBaseDateRef.current,
    );
    const baseTime =
      requestedTime ||
      (trajetKey === currentTrajetRef.current
        ? searchBaseDateRef.current
        : null) ||
      new Date();
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
      arriveBy: Boolean(params.arrivalTime && !params.departureTime),
    });

    try {
      const res = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/plan?${urlParams.toString()}`,
      );
      if (!res.ok)
        throw Object.assign(new Error("Itinerary request failed"), {
          status: res.status,
        });
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

      if (isManual) {
        const updated = {
          ...trajetsRef.current,
          [trajetKey]: {
            ...trajetsRef.current[trajetKey],
            line: lineValue.toUpperCase(),
            depId: isCurrentLocationValue(depValue) ? depValue : fromId,
            arrId: toId,
            depName: fromName,
            arrName: toName,
            depIsAddress:
              isCurrentLocationValue(depValue) || depValue.includes("::"),
            arrIsAddress: arrValue.includes("::"),
          },
        };
        setTrajets(updated);
        trajetsCacheRef.current[trajetKey] = null;
        trajetsCacheTimestampRef.current[trajetKey] = null;
      }

      const trajetData = {
        results: finalResults,
        error:
          finalResults.length === 0
            ? "Aucun itinéraire trouvé pour ce créneau."
            : windowed.length === 0
              ? "Aucun trajet dans les 30 min, voici les suivants."
              : "",
        timeOffset: offset,
        searchBaseDate: anchorTime,
        searchTime: formatTimeInputValue(queryTime),
      };
      trajetsCacheRef.current[trajetKey] = trajetData;
      trajetsCacheTimestampRef.current[trajetKey] = Date.now();
      setTrajetResultsMap((prev) => ({ ...prev, [trajetKey]: trajetData }));

      if (shouldUpdateGlobal) {
        setResults(finalResults);
        setError(
          finalResults.length === 0
            ? "Aucun itinéraire trouvé pour ce créneau."
            : windowed.length === 0
              ? "Aucun trajet dans les 30 min, voici les suivants."
              : "",
        );
        setTimeOffset(offset);
        setSearchBaseDate(anchorTime);
        if (!params.departureTime && !params.arrivalTime) {
          setSearchTime(formatTimeInputValue(queryTime));
        }
        if (!keepInputsOpen) setInputsOpen(false);
      }
    } catch (err) {
      const errorMsg = getSearchErrorMessage(err);
      if (shouldUpdateGlobal) {
        setError(errorMsg);
        setResults([]);
      }
      const trajetErrorData = {
        results: [],
        error: errorMsg,
        timeOffset: 0,
        searchBaseDate: new Date(),
        searchTime: formatTimeInputValue(),
      };
      trajetsCacheRef.current[trajetKey] = trajetErrorData;
      setTrajetResultsMap((prev) => ({
        ...prev,
        [trajetKey]: trajetErrorData,
      }));
    } finally {
      if (shouldUpdateGlobal) setLoading(false);
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setShowRefreshCheck(true);
    setTimeout(() => setShowRefreshCheck(false), 1300);
    await search(timeOffset, {
      trajetKey: currentTrajet,
      keepInputsOpen: true,
    });
  };

  const handleSettingsChanged = () => {
    TRAJET_KEYS.forEach((t) => {
      trajetsCacheRef.current[t] = null;
    });
    const active = loadedTrajetsRef.current || trajetsRef.current;
    TRAJET_KEYS.forEach((t) => {
      const trajet = active[t];
      if (trajet?.depName && trajet?.arrName) {
        search(0, {
          dep: trajet.depId || trajet.depName,
          arr: trajet.arrId || trajet.arrName,
          line: trajet.line,
          trajetKey: t,
          keepInputsOpen: true,
        });
      }
    });
  };

  const loadTrajet = (trajetKey) => {
    const trajet = trajets[trajetKey];
    const data = trajetResultsMap[trajetKey] || {};
    currentTrajetRef.current = trajetKey;
    setCurrentTrajet(trajetKey);
    setDep(trajet.depName || trajet.depId || "");
    setArr(trajet.arrName || trajet.arrId || "");
    setLine(trajet.line || "");
    setResults(data.results || []);
    setError(data.error || "");
    setTimeOffset(data.timeOffset || 0);
    setSearchBaseDate(data.searchBaseDate || new Date());
    setSearchTime(
      data.searchTime ||
        formatTimeInputValue(
          data.searchBaseDate
            ? new Date(
                data.searchBaseDate.getTime() +
                  (data.timeOffset || 0) * 60 * 60 * 1000,
              )
            : new Date(),
        ),
    );
    setInputsOpen(false);
    localStorage.setItem("tag-express-active-trajet", trajetKey);
  };

  const reset = () => {
    setDep("");
    setArr("");
    setLine("");
    setResults([]);
    setTimeOffset(0);
    setSearchBaseDate(new Date());
    setSearchTime("");
    setDepartureTime("");
    setArrivalTime("");
    setError("");
    setInputsOpen(true);
    setMenuOpen(false);
    setSelectedJourney(null);
    setJourneyDetailsOpen(false);
    const updated = {
      ...trajetsRef.current,
      [currentTrajet]: {
        ...DEFAULT_TRAJET,
        name: trajetsRef.current[currentTrajet]?.name || "",
      },
    };
    setTrajets(updated);
    loadedTrajetsRef.current = updated;
    trajetsCacheRef.current[currentTrajet] = null;
  };

  const cancel = () => {
    setDep(initialValuesRef.current.dep);
    setArr(initialValuesRef.current.arr);
    setLine(initialValuesRef.current.line);
    setSearchBaseDate(initialValuesRef.current.searchBaseDate);
    setSearchTime(initialValuesRef.current.searchTime);
    setDepartureTime(initialValuesRef.current.departureTime);
    setArrivalTime(initialValuesRef.current.arrivalTime);
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
    setRenameOpen(false);
    setInputsOpen(true);
  };
  const closeJourneyDetails = () => {
    setJourneyDetailsOpen(false);
    setDetailMapOpen(false);
    setTimeout(() => setSelectedJourney(null), 300);
  };

  const closeLineInfo = () => {
    setLineInfoOpen(false);
    setTimeout(() => setSelectedLineInfo(null), 300);
  };

  // ── Pagination temporelle ─────────────────────────────────────────────────
  const origin = new Date(
    (searchBaseDate || new Date()).getTime() + timeOffset * 60 * 60 * 1000,
  );
  const afterDate = new Date(origin.getTime() + 30 * 60 * 1000);
  const afterLabel = `après ${afterDate.toTimeString().slice(0, 5)}`;

  const isConfigured = (t) => !!(trajets[t]?.depName && trajets[t]?.arrName);
  const resultSearchTime = new Date(
    searchBaseDate.getTime() + timeOffset * 60 * 60 * 1000,
  );
  const referenceTime = resultSearchTime;
  const visibleResults = results.filter(
    (item) => getMinutesUntil(item.dep, referenceTime) >= 0,
  );
  useEffect(() => {
    if (timeOffset !== 0) return; // uniquement en mode "temps réel"
    if (loading) return;
    if (results.length === 0) return; // rien à afficher, pas un bug
    if (visibleResults.length > 0) {
      autoRefreshingRef.current = false;
      return;
    }
    if (autoRefreshingRef.current) return; // déjà en train de rafraîchir

    autoRefreshingRef.current = true;
    search(timeOffset, {
      trajetKey: currentTrajet,
      keepInputsOpen: true,
    }).finally(() => {
      autoRefreshingRef.current = false;
    });
  }, [
    visibleResults.length,
    results.length,
    loading,
    timeOffset,
    currentTrajet,
  ]);

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
        shiftCompactBarForAction={!isLeavingTrips}
        actionBarFurtherLeft
        onBeforeTabNavigate={(path) => {
          if (path === "/mes-trajets") return false;
          setIsLeavingTrips(true);
          return true;
        }}
      />

      <div className="min-h-screen relative bg-[#F8FAFC] pb-28">
        {/* ── Sélecteur de trajets ────────────────────────────────────── */}
        <div className="bg-white border-b-2 border-gray-200 px-4 pt-4 pb-4">
          <div className="flex gap-3">
            {TRAJET_KEYS.map((t) => {
              const trajetName = trajets[t]?.name || t;
              const isTruncated = trajetName.length > 8;
              return (
                <button
                  key={t}
                  onClick={() => loadTrajet(t)}
                  title={trajetName}
                  className={`flex-1 py-2 px-3 font-semibold transition-colors text-center rounded-lg overflow-hidden ${
                    currentTrajet === t
                      ? "bg-blue-600 text-white"
                      : isConfigured(t)
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {isTruncated ? (
                    <div
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        width: "100%",
                        height: "1.2em",
                      }}
                    >
                      <style>{`
                        @keyframes marqueeSlide { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
                        .marquee-track { display: inline-block; white-space: nowrap; animation: marqueeSlide 11s linear infinite; padding-right: 2rem; }
                        .marquee-track-delayed { display: inline-block; white-space: nowrap; animation: marqueeSlide 11s linear infinite; animation-delay: -5.5s; position: absolute; top: 0; left: 0; padding-right: 1.5rem; }
                      `}</style>
                      <span className="marquee-track">{trajetName}</span>
                      <span className="marquee-track-delayed">
                        {trajetName}
                      </span>
                    </div>
                  ) : (
                    <span>{trajetName}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Carte principale ────────────────────────────────────────── */}
        <div className="m-4 p-4 rounded-lg border border-gray-300 bg-white shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {trajets[currentTrajet]?.name || currentTrajet}
              </h1>
              <button
                type="button"
                onClick={() => {
                  inputsOpenBeforeRenameRef.current = inputsOpen;
                  setInputsOpen(false);
                  setNewTrajetName(trajets[currentTrajet]?.name || "");
                  setRenameOpen(true);
                }}
                aria-label="Renommer le trajet"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="shrink-0 size-5"
                  aria-hidden="true"
                >
                  <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                </svg>
              </button>
            </div>
          </div>

          <NotificationToast
            message={error}
            onClose={() => setError("")}
            variant={error.startsWith("Aucun") ? "warning" : "error"}
          />

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
              onHeaderClick={openInputs}
              onRefresh={handleRefresh}
            />
          )}

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
                  onClick={() => {
                    setDetailMapOpen(false);
                    setSelectedJourney({
                      ...item,
                      depName: resolveDisplayName(item.depName),
                      arrName: resolveDisplayName(item.arrName),
                      rawDep: dep,
                      rawArr: arr,
                    });
                    setJourneyDetailsOpen(false);
                    setMenuOpen(false);
                    setInputsOpen(false);
                  }}
                />
              ))
            )}
          </div>

          <div
            className={`mt-4 flex items-center gap-2 ${(results.length > 0 || error) && timeOffset >= 0 ? "justify-between" : "justify-end"}`}
          >
            {timeOffset >= 0 && (results.length > 0 || error) && (
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
            {(results.length > 0 || error) && (
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

        {/* ── Sheet : Détails du trajet ─────────────────────────────── */}
        <JourneyDetailsSheet
          isOpen={journeyDetailsOpen}
          onClose={closeJourneyDetails}
          journey={selectedJourney}
          lineColors={lineColors}
          getLineDisruptions={getLineDisruptions}
          onLineClick={(lk, snapIndex) => {
            setSelectedLineInfo(lk);
            setLineInfoInitialSnap(snapIndex);
            requestAnimationFrame(() => setLineInfoOpen(true));
          }}
        />

        {/* ── Sheet : Infotrafic ligne ──────────────────────────────── */}
        <LineInfoSheet
          lineKey={selectedLineInfo}
          isOpen={lineInfoOpen}
          onClose={closeLineInfo}
          getLineDisruptions={getLineDisruptions}
          initialSnap={lineInfoInitialSnap}
        />

        {/* ── Sheet : Renommer ──────────────────────────────────────── */}
        <Sheet
          isOpen={renameOpen}
          onClose={() => {
            setRenameOpen(false);
            setInputsOpen(inputsOpenBeforeRenameRef.current);
          }}
          detent="content"
        >
          <Sheet.Container
            style={{
              borderRadius: "24px 24px 0 0",
              backgroundColor:
                theme === "dark"
                  ? "#1e293b"
                  : theme === "gray"
                    ? "#252526"
                    : "#ffffff",
              overflow: "hidden",
            }}
          >
            <Sheet.Content disableDrag>
              <div className="px-4 pt-4 pb-10">
                <div className="flex justify-between items-center mb-4">
                  <span
                    className={`font-bold text-lg ${theme !== "light" ? "text-slate-100" : "text-slate-900"}`}
                  >
                    Renommer le trajet {currentTrajet}
                  </span>
                  <button
                    className={
                      theme !== "light"
                        ? "text-slate-500 hover:text-slate-200"
                        : "text-slate-400 hover:text-slate-700"
                    }
                    onClick={() => {
                      setRenameOpen(false);
                      setInputsOpen(inputsOpenBeforeRenameRef.current);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="size-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m19.5 8.25-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>
                </div>
                <div className="space-y-3">
                  <label className="space-y-1 block">
                    <span
                      className={`text-sm ${theme !== "light" ? "text-slate-400" : "text-gray-600"}`}
                    >
                      Nouveau nom du trajet
                    </span>
                    <input
                      value={newTrajetName}
                      onChange={(e) => setNewTrajetName(e.target.value)}
                      className={`w-full p-2 rounded-lg border ${
                        theme !== "light"
                          ? "bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                      }`}
                      placeholder="ex: Maison - Travail"
                      maxLength="30"
                    />
                  </label>
                  <button
                    onClick={() => {
                      const fallback = {
                        T1: "Trajet 1",
                        T2: "Trajet 2",
                        T3: "Trajet 3",
                      };
                      setTrajets((prev) => ({
                        ...prev,
                        [currentTrajet]: {
                          ...prev[currentTrajet],
                          name: newTrajetName.trim() || fallback[currentTrajet],
                        },
                      }));
                      setRenameOpen(false);
                      setInputsOpen(inputsOpenBeforeRenameRef.current);
                    }}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold"
                  >
                    Confirmer
                  </button>
                  <button
                    onClick={() => {
                      setRenameOpen(false);
                      setInputsOpen(inputsOpenBeforeRenameRef.current);
                    }}
                    className={`w-full px-4 py-3 rounded-xl font-semibold ${
                      theme !== "light"
                        ? "bg-slate-700 text-slate-200"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </Sheet.Content>
          </Sheet.Container>
          <Sheet.Backdrop
            onTap={() => {
              setRenameOpen(false);
              setInputsOpen(inputsOpenBeforeRenameRef.current);
            }}
          />
        </Sheet>

        {/* ── Sheet : Recherche ──────────────────────────────────────── */}
        <Sheet isOpen={inputsOpen} onClose={cancel} detent="content">
          <Sheet.Container style={{ borderRadius: "24px 24px 0 0" }}>
            <Sheet.Content disableDrag>
              <SearchForm
                title={`Configuration — ${trajets[currentTrajet]?.name || currentTrajet}`}
                dep={dep}
                arr={arr}
                depDisplay={resolveDisplayName(dep)}
                arrDisplay={resolveDisplayName(arr)}
                line={line}
                searchDate={searchBaseDate}
                searchTime={searchTime}
                departureTime={departureTime}
                arrivalTime={arrivalTime}
                setDep={setDep}
                setArr={setArr}
                setLine={setLine}
                setSearchDate={setSearchBaseDate}
                setSearchTime={setSearchTime}
                setDepartureTime={setDepartureTime}
                setArrivalTime={setArrivalTime}
                depSuggestions={depSuggestions}
                arrSuggestions={arrSuggestions}
                depAddressSuggestions={depAddressSuggestions}
                arrAddressSuggestions={arrAddressSuggestions}
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
                    setDepAddressSuggestions([]);
                  } else {
                    setArr(v);
                    setArrSuggestions([]);
                    setArrAddressSuggestions([]);
                  }
                }}
                onSearch={() =>
                  search(0, {
                    manual: true,
                    searchDate: searchBaseDate,
                    searchTime,
                    departureTime,
                    arrivalTime,
                  })
                }
                onReset={reset}
                onCancel={cancel}
                loading={loading}
                error={error}
                stopsLoaded={stopsLoaded}
                onOpenMapPicker={(target) => {
                  setMapPickerTarget(target);
                  setMapPickerOpenSearch(false);
                  setMapPickerOpen(true);
                }}
              />
            </Sheet.Content>
          </Sheet.Container>
          <Sheet.Backdrop onTap={cancel} />
        </Sheet>
      </div>

      {/* ── StopPickerMap ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={openInputs}
        title={
          isConfigured(currentTrajet)
            ? "Modifier le trajet"
            : "Ajouter le trajet"
        }
        aria-label={
          isConfigured(currentTrajet)
            ? "Modifier le trajet"
            : "Ajouter le trajet"
        }
        className={`fixed z-40 flex flex-col items-center justify-center gap-0 transition-[width,height,bottom,right,background-color,opacity,transform] duration-300 ease-in-out active:scale-95 ${
          isBottomBarCompact
            ? "size-14 rounded-full border border-blue-300 bg-blue-600 text-white hover:bg-blue-700"
            : "size-16 rounded-full border border-blue-300 bg-blue-600 text-white hover:bg-blue-700"
        } ${isLeavingTrips ? "pointer-events-none scale-90 opacity-0" : "opacity-100"}`}
        style={{
          bottom: isBottomBarCompact
            ? "calc(1rem + env(safe-area-inset-bottom))"
            : "calc(1.375rem + env(safe-area-inset-bottom))",
          right: isBottomBarCompact
            ? "max(1rem, calc((100% - 13rem) / 2 - 2.5rem))"
            : "max(1rem, calc((100% - 15rem) / 2 - 3rem))",
        }}
      >
        {isConfigured(currentTrajet) ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="#c4ffff"
            className={`shrink-0 transition-[width,height,transform] duration-300 ease-in-out ${
              isBottomBarCompact ? "size-5" : "size-7"
            }`}
            aria-hidden="true"
          >
            <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`shrink-0 transition-[width,height,transform] duration-300 ease-in-out ${
              isBottomBarCompact ? "size-5" : "size-7"
            }`}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        )}
      </button>

      {mapPickerOpen && (
        <StopPickerMap
          stops={stopsList}
          target={mapPickerTarget}
          depCoords={resolveCoords(dep)}
          arrCoords={resolveCoords(arr)}
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
