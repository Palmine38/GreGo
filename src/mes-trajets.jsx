import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Sheet } from "react-modal-sheet";
import Navbar from "./navbar.jsx";
import LineIcon from "./lines-icons.jsx";
import { useCurrentTime } from "./hooks/useCurrentTime.js";
import { useStops } from "./hooks/useStops.js";
import { useDisruptions } from "./hooks/useDisruptions.js";
import { useLineColors } from "./hooks/useLineColors.js";
import { useLineLookup } from "./hooks/useLineLookup.js";
import { useSettings } from "./hooks/useSettings.js";
import { JourneyCard } from "./components/JourneyCard.jsx";
import { JourneyTimeline } from "./components/JourneyTimeline.jsx";
import { JourneyResultsHeader } from "./components/JourneyResultsHeader.jsx";
import { DisruptionItem } from "./components/DisruptionItem.jsx";
import { SearchForm } from "./components/SearchSheet.jsx";
import { NotificationToast } from "./components/NotificationToast.jsx";
import SplashScreen, { useSplashScreen } from "./components/SplashScreen.jsx";
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
const TRAJET_KEYS = Array.from({ length: 10 }, (_, i) => `T${i + 1}`);
const MAX_TRAJETS = TRAJET_KEYS.length;
const TRAJET_ORDER_STORAGE_KEY = "tag-express-trajet-order";

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
  const lineLookup = useLineLookup();
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
  const [trajets, setTrajets] = useState(() =>
    Object.fromEntries(TRAJET_KEYS.map((t) => [t, { ...DEFAULT_TRAJET }])),
  );
  const [currentTrajet, setCurrentTrajet] = useState("T1");
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadedTrajetsRef = useRef(null);
  const storedTrajetsSearchedRef = useRef(false);
  const trajetsRef = useRef(trajets);
  const currentTrajetRef = useRef(currentTrajet);
  const autoRefreshingRef = useRef(false);

  // ── Écran de chargement initial ───────────────────────────────────────────
  // Affiché uniquement au lancement de la PWA (pas en revenant depuis un
  // autre écran), tant que le premier résultat d'itinéraire du trajet actif
  // n'est pas revenu (ou immédiatement masqué si aucun trajet n'est
  // configuré). Logique et rendu délégués à components/SplashScreen.jsx.
  const { splashVisible, markSplashDone } = useSplashScreen();

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
  const [trajetResultsMap, setTrajetResultsMap] = useState(() =>
    Object.fromEntries(
      TRAJET_KEYS.map((t) => [
        t,
        { results: [], error: "", timeOffset: 0, searchBaseDate: new Date() },
      ]),
    ),
  );
  const trajetsCacheRef = useRef({});
  const trajetsCacheTimestampRef = useRef({});

  // ── Ordre des trajets (pour le sélecteur avec scroll + réorganisation) ────
  const [trajetOrder, setTrajetOrder] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(TRAJET_ORDER_STORAGE_KEY) || "null",
      );
      if (Array.isArray(saved)) {
        const filtered = saved.filter((k) => TRAJET_KEYS.includes(k));
        const missing = TRAJET_KEYS.filter((k) => !filtered.includes(k));
        return [...filtered, ...missing];
      }
    } catch (e) {
      console.error("Erreur chargement ordre des trajets:", e);
    }
    return [...TRAJET_KEYS];
  });
  useEffect(() => {
    localStorage.setItem(TRAJET_ORDER_STORAGE_KEY, JSON.stringify(trajetOrder));
  }, [trajetOrder]);
  const isConfigured = (t) => !!(trajets[t]?.depName && trajets[t]?.arrName);
  const configuredTrajetKeys = trajetOrder.filter(isConfigured);

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
          setDep(
            isCurrentLocationValue(stored.depId)
              ? CURRENT_LOCATION_VALUE
              : stored.depName || stored.depId || "",
          );
          setArr(
            isCurrentLocationValue(stored.arrId)
              ? CURRENT_LOCATION_VALUE
              : stored.arrName || stored.arrId || "",
          );
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

    const activeTrajet = cleanedTrajets[activeKey];
    if (!activeTrajet?.depId || !activeTrajet?.arrId) {
      markSplashDone();
    }

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

    let fromCoords, depName;
    if (isCurrentLocationValue(trajet.depId)) {
      try {
        const current = await getCurrentLocationCoords();
        fromCoords = `${current.lat},${current.lon}`;
        depName = CURRENT_LOCATION_LABEL;
      } catch (err) {
        console.error("searchById: position indisponible", err);
        if (trajetKey === currentTrajetRef.current) markSplashDone();
        return; // pas de position dispo, on annule cette recherche
      }
    }

    const depPosition = fromCoords ? null : findStopPosition(trajet.depId);
    const arrPosition = findStopPosition(trajet.arrId);
    const depId = fromCoords ? trajet.depId : depPosition?.id || trajet.depId;
    const arrId = arrPosition?.id || trajet.arrId;
    if (!depId || !arrId) {
      if (trajetKey === currentTrajetRef.current) markSplashDone();
      return;
    }

    depName = depName || depPosition?.name || trajet.depName || trajet.depId;
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
      fromCoords:
        fromCoords ||
        (depPosition
          ? otpPlaceParam(depPosition)
          : depId.split("::")[1] || depId),
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
        markSplashDone();
      }
    } catch (err) {
      console.error("searchById error:", err);
      if (trajetKey === currentTrajetRef.current) markSplashDone();
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
    setDep(
      isCurrentLocationValue(trajet.depId)
        ? CURRENT_LOCATION_VALUE
        : trajet.depName || trajet.depId || "",
    );
    setArr(
      isCurrentLocationValue(trajet.arrId)
        ? CURRENT_LOCATION_VALUE
        : trajet.arrName || trajet.arrId || "",
    );
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

  const handleAddTrajet = () => {
    if (configuredTrajetKeys.length >= MAX_TRAJETS) return;
    const nextKey = trajetOrder.find((t) => !isConfigured(t));
    if (!nextKey) return;
    currentTrajetRef.current = nextKey;
    setCurrentTrajet(nextKey);
    setDep("");
    setArr("");
    setLine("");
    setResults([]);
    setError("");
    setTimeOffset(0);
    setSearchBaseDate(new Date());
    setSearchTime("");
    setDepartureTime("");
    setArrivalTime("");
    setSelectedJourney(null);
    setJourneyDetailsOpen(false);
    localStorage.setItem("tag-express-active-trajet", nextKey);
    openInputs();
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

  // ── Sélecteur de trajets : scroll horizontal + réorganisation par appui long ──
  // On gère nous-mêmes le scroll horizontal (au lieu de laisser le navigateur
  // le faire) pour éviter tout conflit entre "je scrolle" et "je fais un appui
  // long pour réorganiser" : les deux gestes partent d'un pointerdown sur le
  // même bouton, donc c'est nous qui devons trancher.
  //
  // Pendant la réorganisation, le bouton saisi reste toujours monté dans le DOM
  // (juste estompé) pour ne jamais perdre le pointer capture / les handlers en
  // cours de geste. Un clone flottant (position fixed) suit le doigt, et un
  // repère "||" apparaît entre les boutons pour indiquer où le trajet sera
  // inséré au relâchement.
  const LONG_PRESS_MS = 450;
  const SCROLL_START_THRESHOLD = 6; // px de mouvement avant la fin de l'appui long = c'est un scroll

  const trajetScrollRef = useRef(null);
  const trajetButtonRefs = useRef({});
  const longPressTimerRef = useRef(null);
  // mode: "pending" (on ne sait pas encore) | "scrolling" | "dragging"
  const dragStateRef = useRef(null);
  const wasDraggingRef = useRef(false);
  const [draggingTrajetKey, setDraggingTrajetKey] = useState(null);
  const [dragTranslate, setDragTranslate] = useState({ x: 0, y: 0 });
  const [dragTargetIndex, setDragTargetIndex] = useState(null);
  const [dragStartRect, setDragStartRect] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [deletingTrajetKey, setDeletingTrajetKey] = useState(null);
  const trashZoneRef = useRef(null);
  const [trashDockMounted, setTrashDockMounted] = useState(false);
  const [trashDockVisible, setTrashDockVisible] = useState(false);

  useEffect(() => {
    if (draggingTrajetKey) {
      setTrashDockMounted(true);
      // deux rAF pour être sûr que le navigateur a bien peint l'état initial
      // (dock caché) avant de basculer vers l'état visible → la transition CSS
      // s'applique correctement au lieu d'apparaître d'un coup.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTrashDockVisible(true));
      });
    } else {
      setTrashDockVisible(false);
      const timer = setTimeout(() => setTrashDockMounted(false), 260);
      return () => clearTimeout(timer);
    }
  }, [draggingTrajetKey]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const deleteTrajet = (trajetKey) => {
    const configuredCount = TRAJET_KEYS.filter((k) => isConfigured(k)).length;
    if (configuredCount <= 1 && isConfigured(trajetKey)) {
      setError("Vous devez garder au moins un trajet.");
      return;
    }
    const updated = {
      ...trajetsRef.current,
      [trajetKey]: { ...DEFAULT_TRAJET },
    };
    setTrajets(updated);
    trajetsRef.current = updated;
    localStorage.setItem("tag-express-trajets", JSON.stringify(updated));
    trajetsCacheRef.current[trajetKey] = null;
    trajetsCacheTimestampRef.current[trajetKey] = null;
    setTrajetResultsMap((prev) => ({
      ...prev,
      [trajetKey]: {
        results: [],
        error: "",
        timeOffset: 0,
        searchBaseDate: new Date(),
      },
    }));

    if (trajetKey === currentTrajetRef.current) {
      const remaining = TRAJET_KEYS.filter(
        (k) => k !== trajetKey && updated[k]?.depName && updated[k]?.arrName,
      );
      const nextKey = remaining[0];
      if (nextKey) {
        const nextTrajet = updated[nextKey];
        const nextData = trajetResultsMap[nextKey] || {};
        currentTrajetRef.current = nextKey;
        setCurrentTrajet(nextKey);
        setDep(nextTrajet.depName || nextTrajet.depId || "");
        setArr(nextTrajet.arrName || nextTrajet.arrId || "");
        setLine(nextTrajet.line || "");
        setResults(nextData.results || []);
        setError(nextData.error || "");
        setTimeOffset(nextData.timeOffset || 0);
        setSearchBaseDate(nextData.searchBaseDate || new Date());
        localStorage.setItem("tag-express-active-trajet", nextKey);
      } else {
        currentTrajetRef.current = "T1";
        setCurrentTrajet("T1");
        setDep("");
        setArr("");
        setLine("");
        setResults([]);
        setError("");
        setTimeOffset(0);
        setSearchBaseDate(new Date());
        localStorage.setItem("tag-express-active-trajet", "T1");
      }
    }
  };

  const triggerDeleteAnimation = (trajetKey) => {
    if (navigator.vibrate) navigator.vibrate(30);
    setDeletingTrajetKey(trajetKey);
    setTimeout(() => {
      deleteTrajet(trajetKey);
      setDraggingTrajetKey(null);
      setDragTranslate({ x: 0, y: 0 });
      setDragTargetIndex(null);
      setDragStartRect(null);
      setDeletingTrajetKey(null);
    }, 260);
  };

  // Insère `draggedKey` juste avant le `targetIndex`-ième élément de
  // `visibleKeys` (la liste des trajets configurés SANS le trajet saisi).
  // targetIndex === visibleKeys.length signifie "à la toute fin".
  const applyTrajetReorder = (draggedKey, targetIndex, visibleKeys) => {
    if (targetIndex == null) return;
    setTrajetOrder((prev) => {
      const withoutDragged = prev.filter((k) => k !== draggedKey);
      let insertAt;
      if (targetIndex >= visibleKeys.length) {
        const lastKey = visibleKeys[visibleKeys.length - 1];
        insertAt = lastKey
          ? withoutDragged.indexOf(lastKey) + 1
          : withoutDragged.length;
      } else {
        const anchorKey = visibleKeys[targetIndex];
        insertAt = withoutDragged.indexOf(anchorKey);
        if (insertAt === -1) insertAt = withoutDragged.length;
      }
      const next = [...withoutDragged];
      next.splice(insertAt, 0, draggedKey);
      return next;
    });
  };

  const endTrajetGesture = () => {
    const state = dragStateRef.current;
    if (state?.mode === "dragging") {
      wasDraggingRef.current = true;
      if (isOverTrash) {
        clearLongPressTimer();
        dragStateRef.current = null;
        setIsOverTrash(false);
        if (configuredTrajetKeys.length <= 1) {
          setError("Vous devez garder au moins un trajet.");
          // pas de suppression : on laisse le nettoyage commun ci-dessous
          // remettre la carte en place normalement.
        } else {
          triggerDeleteAnimation(state.key);
          return;
        }
      }
      const visibleKeys = configuredTrajetKeys.filter((k) => k !== state.key);
      applyTrajetReorder(state.key, dragTargetIndex, visibleKeys);
    }
    clearLongPressTimer();
    dragStateRef.current = null;
    setDraggingTrajetKey(null);
    setDragTranslate({ x: 0, y: 0 });
    setDragTargetIndex(null);
    setDragStartRect(null);
    setIsOverTrash(false);
  };

  const handleTrajetPointerDown = (e, key) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearLongPressTimer();
    dragStateRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: trajetScrollRef.current?.scrollLeft || 0,
      mode: "pending",
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore si non supporté
    }
    longPressTimerRef.current = setTimeout(() => {
      const state = dragStateRef.current;
      if (!state || state.key !== key || state.mode !== "pending") return;
      state.mode = "dragging";
      const el = trajetButtonRefs.current[key];
      const rect = el ? el.getBoundingClientRect() : null;
      state.startRect = rect;
      setDragStartRect(rect);
      setDraggingTrajetKey(key);
      // Au moment de la saisie, le repère d'insertion démarre à la position
      // actuelle du bouton (nombre de trajets configurés qui le précèdent).
      setDragTargetIndex(configuredTrajetKeys.indexOf(key));
      if (navigator.vibrate) navigator.vibrate(15);
    }, LONG_PRESS_MS);
  };

  const handleTrajetPointerMove = (e) => {
    const state = dragStateRef.current;
    if (!state) return;
    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    if (state.mode === "pending") {
      if (Math.hypot(deltaX, deltaY) > SCROLL_START_THRESHOLD) {
        // On bouge avant la fin de l'appui long : c'est un scroll, pas une réorganisation.
        clearLongPressTimer();
        state.mode = "scrolling";
      } else {
        return;
      }
    }

    if (state.mode === "scrolling") {
      if (trajetScrollRef.current) {
        trajetScrollRef.current.scrollLeft = state.startScrollLeft - deltaX;
      }
      return;
    }

    // state.mode === "dragging" : le clone flottant suit le pointeur, et on
    // recalcule entre quels boutons il se trouve pour placer le repère "||".
    e.preventDefault?.();
    setDragTranslate({ x: deltaX, y: deltaY });
    if (!state.startRect) return;

    const cloneCenterX =
      state.startRect.left + state.startRect.width / 2 + deltaX;
    const visibleKeys = configuredTrajetKeys.filter((k) => k !== state.key);
    let newIndex = visibleKeys.length;
    for (let i = 0; i < visibleKeys.length; i++) {
      const el = trajetButtonRefs.current[visibleKeys[i]];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      if (cloneCenterX < centerX) {
        newIndex = i;
        break;
      }
    }
    setDragTargetIndex(newIndex);
    // Détection du survol de la corbeille : distance entre le centre du
    // clone flottant et le centre de la zone de la corbeille.
    let nowOverTrash = false;
    if (trashZoneRef.current) {
      const trashRect = trashZoneRef.current.getBoundingClientRect();
      const cloneCenterY =
        state.startRect.top + state.startRect.height / 2 + deltaY;
      const trashCenterX = trashRect.left + trashRect.width / 2;
      const trashCenterY = trashRect.top + trashRect.height / 2;
      const distance = Math.hypot(
        cloneCenterX - trashCenterX,
        cloneCenterY - trashCenterY,
      );
      nowOverTrash =
        cloneCenterX >= trashRect.left &&
        cloneCenterX <= trashRect.right &&
        cloneCenterY >= trashRect.top + 20;
    }
    setIsOverTrash(nowOverTrash);
  };

  const handleTrajetPointerUp = () => {
    endTrajetGesture();
  };

  const handleTrajetClick = (t) => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    loadTrajet(t);
  };

  // ── Couleur d'ombre du bouton en cours de réorganisation, selon le thème ──
  const dragShadowColor =
    theme === "gray"
      ? "#252526"
      : theme === "dark"
        ? "#182235"
        : "rgba(15, 23, 42, 0.25)";

  const trashIdleColor =
    theme === "gray" ? "#3a3a3a" : theme === "dark" ? "#334155" : "#9ca3af";
  const trashActiveColor =
    theme === "gray" || theme === "dark" ? "#ef4444" : "#dc2626";
  const trashShadowColor =
    theme === "gray"
      ? "rgba(0,0,0,0.5)"
      : theme === "dark"
        ? "rgba(0,0,0,0.5)"
        : "rgba(0,0,0,0.35)";

  // Petit repère "||" affiché entre deux boutons pendant le drag, pour
  // indiquer où le trajet saisi sera inséré si on relâche ici.
  const renderInsertSlot = (idx) => {
    const active = dragTargetIndex === idx;
    return (
      <div
        key={`slot-${idx}`}
        className="flex-none flex items-center justify-center"
        style={{ width: active ? 18 : 8, transition: "width 120ms ease" }}
      >
        <span
          className="flex gap-[3px] transition-opacity duration-150"
          style={{ opacity: active ? 1 : 0, height: 34 }}
        >
          <span className="w-[3px] h-full rounded-full bg-blue-500" />
          <span className="w-[3px] h-full rounded-full bg-blue-500" />
        </span>
      </div>
    );
  };

  // ── Pagination temporelle ─────────────────────────────────────────────────
  const origin = new Date(
    (searchBaseDate || new Date()).getTime() + timeOffset * 60 * 60 * 1000,
  );
  const afterDate = new Date(origin.getTime() + 30 * 60 * 1000);
  const afterLabel = `après ${afterDate.toTimeString().slice(0, 5)}`;

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
      {splashVisible && <SplashScreen theme={theme} />}

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

      {/* ── Voile d'arrière-plan pendant la réorganisation ─────────────── */}
      {draggingTrajetKey && (
        <div
          className="fixed inset-0 z-[9990] bg-black/65 transition-opacity duration-200"
          style={{ pointerEvents: "none" }}
          aria-hidden="true"
        />
      )}

      <div className="min-h-screen relative bg-[#F8FAFC] pb-28">
        {/* ── Sélecteur de trajets ────────────────────────────────────── */}
        <div
          className="px-4 pt-4 pb-4"
          style={{
            position: "relative",
            zIndex: draggingTrajetKey ? 9995 : "auto",
            backgroundColor:
              theme === "dark"
                ? "#1e293b"
                : theme === "gray"
                  ? "#252526"
                  : "#ffffff",
            borderBottom: `2px solid ${
              theme === "dark"
                ? "#334155"
                : theme === "gray"
                  ? "#3a3a3a"
                  : "#e5e7eb"
            }`,
          }}
        >
          <style>{`
            .trajet-scroll::-webkit-scrollbar { display: none; }
            .trajet-scroll { scrollbar-width: none; -ms-overflow-style: none; }
            .trajet-btn {
              -webkit-tap-highlight-color: transparent;
              outline: none;
            }
            .trajet-btn:focus,
            .trajet-btn:focus-visible {
              outline: none;
              box-shadow: none;
            }
          `}</style>
          <div className="relative">
            <div
              ref={trajetScrollRef}
              className="trajet-scroll flex flex-nowrap items-center gap-3 overflow-x-auto -mx-1 px-1 pb-1"
            >
              {(() => {
                const nodes = [];
                let visIdx = 0;
                configuredTrajetKeys.forEach((t) => {
                  const trajetName = trajets[t]?.name || t;
                  const isTruncated = trajetName.length > 8;
                  const isDragging = draggingTrajetKey === t;

                  // Repère "||" avant ce bouton, seulement pendant un drag et
                  // seulement entre des boutons "réels" (pas le fantôme).
                  if (draggingTrajetKey && !isDragging) {
                    if (visIdx === dragTargetIndex) {
                      nodes.push(renderInsertSlot(visIdx));
                    }
                    visIdx++;
                  }

                  nodes.push(
                    <button
                      key={t}
                      ref={(el) => {
                        trajetButtonRefs.current[t] = el;
                      }}
                      onClick={() => handleTrajetClick(t)}
                      onPointerDown={(e) => handleTrajetPointerDown(e, t)}
                      onPointerMove={handleTrajetPointerMove}
                      onPointerUp={handleTrajetPointerUp}
                      onPointerCancel={handleTrajetPointerUp}
                      title={trajetName}
                      style={{
                        touchAction: "none",
                        position: "relative",
                      }}
                      className={`trajet-btn flex-none w-24 select-none py-2 px-3 font-semibold text-center rounded-lg transition-opacity ${
                        isDragging ? "opacity-30" : "transition-colors"
                      } ${
                        currentTrajet === t
                          ? "bg-blue-600 text-white"
                          : "bg-blue-100 text-blue-800 hover:bg-blue-200"
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
                    </button>,
                  );
                });
                // Repère final, pour insérer après le dernier bouton.
                if (draggingTrajetKey && dragTargetIndex === visIdx) {
                  nodes.push(renderInsertSlot(visIdx));
                }
                return nodes;
              })()}
              {/* Espace pour pouvoir scroller le dernier bouton hors de sous le "+" superposé */}
              {configuredTrajetKeys.length < MAX_TRAJETS && (
                <div className="flex-none w-20" aria-hidden="true" />
              )}
            </div>

            {/* Clone flottant du trajet en cours de réorganisation : rendu en
                position fixed pour toujours passer au-dessus de tout le reste
                de l'UI (carte, sheets, etc.), sans jamais être masqué. */}
            {draggingTrajetKey && dragStartRect && (
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  position: "fixed",
                  left: dragStartRect.left,
                  top: dragStartRect.top,
                  width: dragStartRect.width,
                  height: dragStartRect.height,
                  transform: deletingTrajetKey
                    ? `translate(${dragTranslate.x}px, ${dragTranslate.y + 40}px) scale(0.15) rotate(15deg)`
                    : `translate(${dragTranslate.x}px, ${dragTranslate.y}px) scale(1.05)`,
                  opacity: deletingTrajetKey ? 0 : 1,
                  transition: deletingTrajetKey
                    ? "transform 260ms cubic-bezier(0.4,0,0.2,1), opacity 260ms ease-out"
                    : "none",
                  zIndex: 9999,
                  pointerEvents: "none",
                  boxShadow: `0 10px 15px -3px ${dragShadowColor}, 0 4px 6px -4px ${dragShadowColor}`,
                }}
                className={`trajet-btn select-none py-2 px-3 font-semibold text-center rounded-lg opacity-95 ${
                  currentTrajet === draggingTrajetKey
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                <span className="block truncate">
                  {trajets[draggingTrajetKey]?.name || draggingTrajetKey}
                </span>
              </button>
            )}

            {trashDockMounted && (
              <div
                ref={trashZoneRef}
                className="fixed z-[9998] pointer-events-none rounded-full flex items-start justify-center"
                style={{
                  left: "50%",
                  width: "220vw",
                  aspectRatio: "1 / 1",
                  bottom: !trashDockVisible
                    ? "-220vw"
                    : isOverTrash
                      ? "calc(-220vw + 200px)"
                      : "calc(-220vw + 170px)",
                  transform: "translateX(-50%)",
                  backgroundColor: isOverTrash
                    ? trashActiveColor
                    : trashIdleColor,
                  boxShadow: `0 -8px 24px ${trashShadowColor}`,
                  paddingTop: isOverTrash ? 60 : 70,
                  transition:
                    "bottom 260ms cubic-bezier(0.4,0,0.2,1), background-color 200ms ease-out, padding-top 200ms ease-out",
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth={1.8}
                    style={{
                      width: isOverTrash ? 34 : 28,
                      height: isOverTrash ? 34 : 28,
                      transition: "width 200ms ease, height 200ms ease",
                    }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 7h12M9.5 7V5.25A1.25 1.25 0 0 1 10.75 4h2.5A1.25 1.25 0 0 1 14.5 5.25V7m-7 0 .69 11.02A2 2 0 0 0 10.18 20h3.64a2 2 0 0 0 1.99-1.98L16.5 7m-6 3.5v5m3-5v5"
                    />
                  </svg>
                  <span
                    className="text-white text-xs font-semibold transition-opacity duration-150"
                    style={{ opacity: isOverTrash ? 1 : 0.7 }}
                  >
                    {isOverTrash ? "Relâcher pour supprimer" : "Supprimer"}
                  </span>
                </div>
              </div>
            )}
            {configuredTrajetKeys.length < MAX_TRAJETS && (
              <>
                <div
                  className="pointer-events-none absolute -right-1 top-0 bottom-1 w-28"
                  style={{
                    background: `linear-gradient(to left, ${
                      theme === "dark"
                        ? "#1e293b"
                        : theme === "gray"
                          ? "#252526"
                          : "#ffffff"
                    } 55%, ${
                      theme === "dark"
                        ? "#1e293bF2"
                        : theme === "gray"
                          ? "#252526F2"
                          : "#ffffffF2"
                    } 80%, transparent)`,
                  }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={handleAddTrajet}
                  title="Ajouter un trajet"
                  aria-label="Ajouter un trajet"
                  style={{
                    backgroundColor:
                      theme === "dark"
                        ? "#1e293b"
                        : theme === "gray"
                          ? "#252526"
                          : "#ffffff",
                    borderColor:
                      theme === "dark"
                        ? "#94a3b8"
                        : theme === "gray"
                          ? "#8a8a8a"
                          : "#d1d5db",
                    WebkitTapHighlightColor: "transparent",
                    outline: "none",
                  }}
                  className={`trajet-btn absolute -right-1 top-0 z-10 w-20 h-[42px] flex items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    theme !== "light"
                      ? "text-slate-200"
                      : "text-gray-400 hover:text-blue-600 hover:border-blue-400"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="size-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Carte principale ────────────────────────────────────────── */}
        <div className="m-4 p-4 rounded-2xl border border-gray-300 bg-white shadow-xl">
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
          lineLookup={lineLookup}
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
                    Renommer {trajets[currentTrajet]?.name || currentTrajet}
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
                      const fallback = Object.fromEntries(
                        TRAJET_KEYS.map((t, i) => [t, `Trajet ${i + 1}`]),
                      );
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
                title={trajets[currentTrajet]?.name || currentTrajet}
                onRename={() => {
                  inputsOpenBeforeRenameRef.current = inputsOpen;
                  setInputsOpen(false);
                  setNewTrajetName(trajets[currentTrajet]?.name || "");
                  setRenameOpen(true);
                }}
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
                onSwapAndSearch={() => {
                  const newDep = arr;
                  const newArr = dep;
                  setDep(newDep);
                  setArr(newArr);
                  search(0, {
                    dep: newDep,
                    arr: newArr,
                    manual: true,
                    searchDate: searchBaseDate,
                    searchTime,
                    departureTime,
                    arrivalTime,
                  });
                }}
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
