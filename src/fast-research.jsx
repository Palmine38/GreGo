import React, { memo, useEffect, useRef, useState } from "react";
import Navbar from "./navbar.jsx";
import { useCurrentTime } from "./hooks/useCurrentTime.js";
import { useStops } from "./hooks/useStops.js";
import { useDisruptions } from "./hooks/useDisruptions.js";
import { useLineColors } from "./hooks/useLineColors.js";
import { useSettings } from "./hooks/useSettings.js";
import { getLegGeometry } from "./components/JourneyDetailsSheet.jsx";
import { FastResearchResultSheet } from "./components/FastResearchResultSheet.jsx";
import { LineInfoSheet } from "./components/LineInfoSheet.jsx";
import { NotificationToast } from "./components/NotificationToast.jsx";
import StopPickerMap from "./components/StopPickerMap.jsx";
import { StopDetailsSheet } from "./components/StopDetailsSheet.jsx";
import { useGbfs } from "./hooks/useGbfs.js";
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

function isUsableLineGeometry(coordinates) {
  return (
    Array.isArray(coordinates) &&
    coordinates.length > 1 &&
    coordinates.every(
      ([lon, lat]) =>
        Number.isFinite(lon) &&
        Number.isFinite(lat) &&
        Math.abs(lon) <= 180 &&
        Math.abs(lat) <= 90,
    )
  );
}

function getTransitLegForLine(plan, lineName) {
  const candidates = (plan?.itineraries || [])
    .flatMap((itinerary) => itinerary.legs || [])
    .filter(
      (candidate) =>
        (candidate.transitLeg || candidate.mode !== "WALK") &&
        String(
          candidate.routeShortName ||
            candidate.route ||
            candidate.routeId ||
            "",
        )
          .replace("SEM:", "")
          .toUpperCase() === lineName &&
        candidate.legGeometry?.points,
    );

  // L'API peut renvoyer plusieurs options. On garde le segment de la ligne
  // qui contient le plus d'arrêts, plutôt que le premier tronçon parfois
  // interrompu par une correspondance.
  return candidates.sort(
    (a, b) =>
      (b.intermediateStops?.length || 0) - (a.intermediateStops?.length || 0),
  )[0];
}

// ─────────────────────────────────────────────────────────────────────────────
export default function FastResearch() {
  // ── Hooks partagés ────────────────────────────────────────────────────────
  const currentTime = useCurrentTime();
  const {
    stopsMap,
    stopsList,
    stopsLoaded,
    findStop,
    suggestionsFor,
    getRouteLongName,
  } = useStops();
  const { disruptionsRaw, isLineDisrupted, getLineDisruptions } =
    useDisruptions();
  const { lineColors } = useLineColors();
  const { settings, reloadSettings } = useSettings();
  const { voiVehicles, citizStations, citizVehicleTypes } = useGbfs();
  const stopLineRequestRef = useRef(0);

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
    // Valeurs formatées "Label::lat,lon" (adresse libre ou position GPS déjà
    // résolue, ex. "Votre position::45.23,5.68") : on n'affiche que le label.
    return idOrName.split("::")[0];
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
      (stopName) =>
        normalizeStopName(stopName) === normalizeStopName(quickSearch),
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
    getCurrentLocationCoords()
      .then(setUserPosition)
      .catch(() => {});
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

  // ── Résultats de recherche (liste de JourneyCard cliquables) ─────────────
  const [resultsSheetOpen, setResultsSheetOpen] = useState(false);

  // ── Line info sheet ───────────────────────────────────────────────────────
  const [selectedLineInfo, setSelectedLineInfo] = useState(null);
  const [selectedMapStop, setSelectedMapStop] = useState(null);
  const [activeStopLine, setActiveStopLine] = useState(null);
  const [activeStopInfoLine, setActiveStopInfoLine] = useState(null);
  const [activeStopLineTrace, setActiveStopLineTrace] = useState([]);
  const [activeStopLineStops, setActiveStopLineStops] = useState([]);

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
          setSearchTime(
            parsed.searchTime || formatTimeInputValue(cachedBaseDate),
          );
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
        setError(
          `L'arrêt de départ « ${depValue} » est introuvable. Sélectionnez un arrêt dans les suggestions.`,
        );
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
        setError(
          `L'arrêt d'arrivée « ${arrValue} » est introuvable. Sélectionnez un arrêt dans les suggestions.`,
        );
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
      if (openDetails && finalResults.length > 0) {
        // On ouvre la liste des résultats plutôt que le détail directement,
        // pour laisser l'utilisateur choisir le trajet.
        setResultsSheetOpen(true);
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

  // Enrichit le résultat cliqué (noms résolus, valeurs brutes de recherche
  // nécessaires à JourneyTimeline) et le renvoie à FastResearchResultSheet,
  // qui affiche le détail par-dessus la liste (swipe interne) plutôt que
  // d'ouvrir une nouvelle sheet.
  const openJourneyDetails = (item) => {
    // Le tracé affiché en fond de carte doit correspondre au trajet
    // effectivement sélectionné, pas juste au premier résultat.
    setOtpJourney(item);
    setMenuOpen(false);
    setInputsOpen(false);
    return {
      ...item,
      depName: resolveDisplayName(item.depName),
      arrName: resolveDisplayName(item.arrName),
      rawDep: dep,
      rawArr: arr,
    };
  };

  // Appelée quand on revient de la vue détail à la liste (bouton retour) :
  // le tracé du trajet sélectionné ne doit plus s'afficher.
  const backFromJourneyDetails = () => {
    setOtpJourney(null);
  };

  const closeResultsSheet = () => {
    setResultsSheetOpen(false);
    setOtpJourney(null);
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
    setResultsSheetOpen(false);
    setOtpJourney(null);
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

  const selectStopLine = async (lineKey, openInfo = true) => {
    const rawLineKey = String(lineKey || "").toUpperCase();
    const normalizedLine = rawLineKey.replace(/^[A-Z0-9]+:/, "");
    const apiRouteId = rawLineKey.includes(":")
      ? rawLineKey
      : `SEM:${normalizedLine}`;
    const apiRouteIdEncoded = encodeURIComponent(apiRouteId).replace(
      /%3A/g,
      ":",
    );
    const requestId = ++stopLineRequestRef.current;
    // Si Fast Research affiche déjà cette ligne, sa géométrie est précisément
    // celle visible sur la carte et celle de JourneyDetailsSheet. La réutiliser
    // évite de recalculer une autre course de la même ligne.
    const displayedJourneyLeg = getTransitLegForLine(
      { itineraries: [{ legs: otpJourney?.allLegs || [] }] },
      normalizedLine,
    );
    const displayedJourneyGeometry = displayedJourneyLeg
      ? getLegGeometry(displayedJourneyLeg)
      : [];
    setActiveStopLine(normalizedLine);
    setActiveStopInfoLine(openInfo ? normalizedLine : null);
    setActiveStopLineTrace(
      isUsableLineGeometry(displayedJourneyGeometry)
        ? displayedJourneyGeometry
        : [],
    );
    setActiveStopLineStops([]);
    // Les poteaux (stops) d'une ligne sont déjà ordonnés selon son parcours :
    // ils constituent un repli fiable lorsque la géométrie détaillée n'est pas fournie.
    try {
      const response = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/index/routes/${apiRouteIdEncoded}/stops`,
      );
      if (!response.ok) throw new Error("Unable to load line stops");
      const stops = await response.json();
      const lineStops = (Array.isArray(stops) ? stops : [])
        .map((stop) => ({
          name: stop.name,
          stopId: stop.id,
          // Format "SEM:GENxxx", requis par /clusters/{id}/stoptimes
          // (prochains passages, voir StopDetailsSheet.jsx).
          stopTimesClusterId: stop.cluster || null,
          // OTP attend un identifiant de cluster différent, au format
          // "SEM:xxx" (sans le "GEN"), reconstruit ici à partir de
          // clusterGtfsId pour garder le fallback OTP fonctionnel (voir
          // plus bas) — même convention que useStops.js.
          clusterId: stop.clusterGtfsId ? `SEM:${stop.clusterGtfsId}` : null,
          lon: Number(stop.lon),
          lat: Number(stop.lat),
        }))
        .filter(
          (stop) => Number.isFinite(stop.lon) && Number.isFinite(stop.lat),
        );
      if (requestId !== stopLineRequestRef.current) return;

      // /index/routes/{id}/stops renvoie l'ensemble des arrêts desservis par
      // la ligne, dans l'ordre du trajet — MAIS la course continue parfois
      // au-delà du vrai terminus commercial (repli/sortie dépôt). Ex. ligne E :
      // après "Palluel" (vrai terminus), le véhicule continue jusqu'à
      // "Foch-Ferrié" pour rejoindre le dépôt, alors que ce n'est plus un
      // arrêt voyageurs. Prendre lineStops[0]/[length-1] peut donc pointer
      // sur ces arrêts techniques et fausser le tracé retourné par /plan.
      //
      // /index/routes/{id}/patterns n'existe pas sur cette instance OTP
      // (404), et l'essai via /index/stops/{code}/patterns n'a pas donné de
      // résultat exploitable non plus. On récupère donc les vrais terminus
      // autrement : le "longName" de la route (ex. pour SEM:E :
      // "Fontanil-Cornillon Palluel / Grenoble Louise Michel") est composé de
      // "Commune NomDuTerminus" pour chaque sens, séparés par un "/". En
      // retirant le préfixe "Commune " de chaque partie, il reste exactement
      // le nom de l'arrêt terminus (ex. "Palluel", "Louise Michel") — on
      // retrouve alors l'arrêt correspondant dans la liste des arrêts de la
      // ligne par correspondance de suffixe (le nom de la commune pouvant
      // compter plusieurs mots, ex. "Fontanil-Cornillon", on ne peut pas se
      // contenter de retirer le premier mot).
      const normalizeName = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      let firstStop = lineStops[0];
      let lastStop = lineStops[lineStops.length - 1];
      try {
        // /index/routes/{id}/patterns et /index/routes/{id} (route unique)
        // n'existent pas sur cette instance OTP (404). /index/routes (liste
        // complète) est de toute façon déjà chargé par useStops() pour
        // construire la liste des arrêts : on réutilise directement son
        // cache de longName via getRouteLongName, sans requête réseau ici.
        const longName = getRouteLongName(apiRouteId);
        const [rawA, rawB] = longName.split("/").map((s) => (s || "").trim());

        if (rawA && rawB) {
          const normA = normalizeName(rawA);
          const normB = normalizeName(rawB);

          // Cherche, parmi les arrêts de la ligne, celui dont le nom est un
          // suffixe de la partie du longName (donc précédé uniquement du nom
          // de commune). En cas d'ambiguïté on garde la correspondance la
          // plus longue (la plus spécifique).
          const findStopForLabel = (normLabel) => {
            let best = null;
            let bestLen = -1;
            for (const s of lineStops) {
              const normStopName = normalizeName(s.name);
              if (
                normStopName &&
                normLabel.endsWith(normStopName) &&
                normStopName.length > bestLen
              ) {
                best = s;
                bestLen = normStopName.length;
              }
            }
            return best;
          };

          const stopA = findStopForLabel(normA);
          const stopB = findStopForLabel(normB);
          if (stopA && stopB) {
            firstStop = stopA;
            lastStop = stopB;
          }
        }
      } catch (err) {
        console.error(
          "[selectStopLine] Error resolving line termini from longName",
          err,
        );
        // Repli sur firstStop/lastStop calculés depuis /routes/{id}/stops
        // (mieux que rien, même si potentiellement faux).
      }

      // lineStops est ordonné selon le parcours réel (voir plus haut), donc
      // une fois les deux vrais terminus identifiés on peut en déduire les
      // index de début/fin et ne garder que les arrêts entre les deux
      // (départ, intermédiaires, arrivée) — le tracé va d'un terminus à
      // l'autre, pas jusqu'aux arrêts techniques de dépôt qui suivent
      // parfois le terminus dans la liste brute.
      let routeLineStops = lineStops;
      const startIdx = lineStops.indexOf(firstStop);
      const endIdx = lineStops.indexOf(lastStop);
      if (startIdx !== -1 && endIdx !== -1 && startIdx !== endIdx) {
        const lo = Math.min(startIdx, endIdx);
        const hi = Math.max(startIdx, endIdx);
        routeLineStops = lineStops.slice(lo, hi + 1);
      }
      if (requestId !== stopLineRequestRef.current) return;
      setActiveStopLineStops(routeLineStops);

      let geometry = displayedJourneyGeometry;
      if (
        !isUsableLineGeometry(geometry) &&
        firstStop?.clusterId &&
        lastStop?.clusterId
      ) {
        // OTP reconnaît les identifiants de clusters, pas leurs coordonnées.
        // Avec des lat/lon il échouait ou proposait une autre ligne, donc le
        // fallback en segments droits était systématiquement affiché.
        const params = buildOtpParams({
          fromCoords: `${firstStop.name}::${firstStop.clusterId}`,
          toCoords: `${lastStop.name}::${lastStop.clusterId}`,
          queryTime: new Date(),
          settings,
        });
        // Sans cette préférence, OTP peut construire un trajet multi-lignes
        // et ne laisser à la ligne cliquée qu'un court tronçon.
        params.set("preferredRoutes", `SEM:${normalizedLine}`);
        params.set("otherThanPreferredRoutesPenalty", "999999");
        try {
          const planResponse = await fetch(
            `https://data.mobilites-m.fr/api/routers/default/plan?${params}`,
          );
          if (planResponse.ok) {
            const payload = await planResponse.json();
            console.log(
              "[selectStopLine] plan response",
              normalizedLine,
              payload,
            );
            const transitLeg = getTransitLegForLine(
              payload.plan,
              normalizedLine,
            );
            console.log(
              "[selectStopLine] itineraries legs",
              normalizedLine,
              payload.plan.itineraries.map((it) =>
                it.legs.map((leg) => ({
                  mode: leg.mode,
                  route: leg.routeShortName || leg.route || leg.routeId,
                  transitLeg: leg.transitLeg,
                  hasGeometry: !!leg.legGeometry?.points,
                  nStops: leg.intermediateStops?.length,
                })),
              ),
            );
            console.log(
              "[selectStopLine] transitLeg found?",
              !!transitLeg,
              transitLeg?.legGeometry?.points?.length,
            );
            // Même fonction que JourneyDetailsSheet : inclut les formes de
            // référence et le recalage sur les arrêts du leg.
            geometry = transitLeg ? getLegGeometry(transitLeg) : [];
          }
        } catch (err) {
          console.error("[selectStopLine] Error fetching plan", err);
          // Retain the stop-to-stop fallback if the planner is unavailable.
        }
      }

      if (requestId !== stopLineRequestRef.current) return;
      const stopFallback = routeLineStops.map((cluster) => [
        cluster.lon,
        cluster.lat,
      ]);
      // Certaines réponses OTP contiennent une polyline tronquée ou invalide.
      // MapLibre ne dessine alors rien, même si les arrêts ont bien été chargés.
      setActiveStopLineTrace(
        isUsableLineGeometry(geometry) ? geometry : stopFallback,
      );
    } catch {
      if (requestId !== stopLineRequestRef.current) return;
      setActiveStopLineTrace([]);
      setActiveStopLineStops([]);
    }
    // Le tracé apparaît derrière la fiche, qui reste ouverte sur l'arrêt.
  };

  const setStopAsArrival = async (stop) => {
    const value = `${stop.name}::${stop.lat},${stop.lon}`;
    setSelectedMapStop(null);
    setActiveStopLine(null);
    setActiveStopInfoLine(null);
    setActiveStopLineTrace([]);
    setActiveStopLineStops([]);
    setError("");
    setArr(value);
    setQuickSearch(stop.name);
    setQuickSearchActive(false);
    try {
      // La carte a généralement déjà fourni la position : on la réutilise pour
      // ouvrir les détails sans relancer une demande de géolocalisation.
      const location = userPosition || (await getCurrentLocationCoords());
      setUserPosition(location);
      const departure = `${CURRENT_LOCATION_LABEL}::${location.lat},${location.lon}`;
      setDep(departure);
      await search(0, departure, value, "", searchTime, true);
    } catch (locationError) {
      setError(
        locationError.message || "Votre position est indisponible. Réessayez.",
      );
    }
  };

  const openMapStop = (stop) => {
    // Ferme le clavier virtuel si la barre de recherche avait le focus
    // (cas d'ouverture depuis une suggestion d'arrêt) — sans effet sinon
    // (ex. clic sur un poteau depuis la carte).
    quickSearchRef.current?.blur();
    setActiveStopLine(null);
    setActiveStopInfoLine(null);
    setActiveStopLineTrace([]);
    setActiveStopLineStops([]);
    setSelectedMapStop(stop);
  };

  // Sélection d'un ARRÊT (pas une adresse) depuis la barre de recherche
  // rapide : on ouvre sa fiche détail (StopDetailsSheet, prochains passages,
  // lignes desservies…) plutôt que de lancer directement une recherche
  // d'itinéraire vers cet arrêt.
  const openStopFromSearch = (stopName) => {
    setQuickSearch(stopName);
    setQuickSearchActive(false);
    setAddressSuggestions([]);
    setError("");

    const stopPosition = findStop(stopName)[0];
    if (!stopPosition) {
      setError(`L'arrêt « ${stopName} » est introuvable.`);
      return;
    }
    openMapStop(stopPosition);
  };

  const closeMapStop = () => {
    setSelectedMapStop(null);
    setActiveStopLine(null);
    setActiveStopInfoLine(null);
    setActiveStopLineTrace([]);
    setActiveStopLineStops([]);
  };

  const selectQuickDestination = async (
    value,
    label = value.split("::")[0],
  ) => {
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
      setError(
        locationError.message || "Votre position est indisponible. Réessayez.",
      );
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
      openStopFromSearch(stopName);
      return;
    }

    const matchingAddress = addressSuggestions.find(
      (address) =>
        normalizeStopName(address.label) === normalizeStopName(query),
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

      <NotificationToast
        message={error}
        onClose={() => setError("")}
        variant={error.startsWith("Aucun") ? "warning" : "error"}
      />

      <div className="fixed top-24 left-4 right-4 z-30">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="size-5 shrink-0 text-slate-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            ref={quickSearchRef}
            value={quickSearch}
            onChange={(event) => {
              setQuickSearch(event.target.value);
              setQuickSearchActive(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitQuickSearch();
              }
            }}
            onFocus={() => setQuickSearchActive(true)}
            placeholder="On va où ?"
            className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none placeholder:text-slate-500"
            aria-label="Rechercher un arrêt ou une adresse"
          />
        </div>
        {!quickSearchActive &&
          quickSearch &&
          !hasExactStopMatch &&
          (loading || results.length === 0) && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-slate-700 shadow">
              {loading && (
                <span
                  className="size-3 animate-pulse rounded-full bg-blue-600"
                  aria-hidden="true"
                />
              )}
              <span>
                {loading
                  ? `Recherche vers ${quickSearch}…`
                  : `Destination : ${quickSearch}`}
              </span>
            </div>
          )}
        {quickSearchActive && quickSearch.trim() && !hasExactStopMatch && (
          <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
            {stopSuggestions.length > 0 && (
              <p className="px-4 pt-2 pb-1 text-[11px] font-bold tracking-widest text-slate-400">
                ARRÊTS
              </p>
            )}
            {stopSuggestions.map((stop) => (
              <button
                key={`stop-${stop}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => openStopFromSearch(stop)}
                className="flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {stop}
                </span>
                <span className="text-xs text-slate-500">Arrêt</span>
              </button>
            ))}
            {addressSuggestions.length > 0 && (
              <p className="border-t border-slate-100 px-4 pt-3 pb-1 text-[11px] font-bold tracking-widest text-slate-400">
                ADRESSES
              </p>
            )}
            {addressSuggestions.map((address) => (
              <button
                key={address.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  selectQuickDestination(address.value, address.label)
                }
                className="flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {address.label}
                </span>
                <span className="truncate text-xs text-slate-500">
                  {address.detail}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-screen relative bg-transparent pb-28">
        {/* Fast Research reste volontairement une vue carte : la carte reste
            visible derrière la liste de résultats et le détail du trajet. */}

        {/* Panneau liste des résultats + détail du trajet (swipe interne,
            pas de sheet séparée) */}
        <FastResearchResultSheet
          results={visibleResults}
          isOpen={resultsSheetOpen}
          onClose={closeResultsSheet}
          currentTime={currentTime}
          isLineDisrupted={isLineDisrupted}
          dep={resolveDisplayName(dep)}
          arr={resolveDisplayName(arr)}
          timeOffset={timeOffset}
          loading={loading}
          onSelectJourney={openJourneyDetails}
          onBackFromJourney={backFromJourneyDetails}
          onSearchOffset={(offset) => search(offset)}
          afterLabel={afterLabel}
          lineColors={lineColors}
          getLineDisruptions={getLineDisruptions}
          hideMap
          onLineClick={(lk) => setSelectedLineInfo(lk)}
        />

        {/* Panneau infotrafic ligne */}
        <LineInfoSheet
          lineKey={selectedLineInfo}
          isOpen={!!selectedLineInfo}
          onClose={closeLineInfo}
          getLineDisruptions={getLineDisruptions}
          initialSnap={0.6}
        />

        <StopDetailsSheet
          stop={selectedMapStop}
          isOpen={!!selectedMapStop}
          onClose={closeMapStop}
          onSetArrival={setStopAsArrival}
          onLineSelect={selectStopLine}
          activeLine={activeStopInfoLine}
          onBack={() => setActiveStopInfoLine(null)}
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
          journey={
            // Le tracé ne doit être visible que tant que la sheet (liste ou
            // détail du trajet, qui vivent désormais toutes deux sous
            // resultsSheetOpen) est ouverte. Sans ce garde, le rafraîchissement
            // automatique (toutes les 2 min) ou un simple handleRefresh
            // réaffiche le tracé même sheet fermée.
            resultsSheetOpen ? otpJourney : null
          }
          lineColors={lineColors}
          voiVehicles={voiVehicles}
          citizStations={citizStations}
          citizVehicleTypes={citizVehicleTypes}
          allowAddressSelection={false}
          userPosition={userPosition}
          onSelect={(name) => selectQuickDestination(name)}
          onClose={() => setMapPickerOpen(false)}
          onStopClick={openMapStop}
          activeLine={activeStopLine}
          activeLineTrace={activeStopLineTrace}
          activeLineStops={activeStopLineStops}
          selectedStop={selectedMapStop}
        />
      )}
    </>
  );
}
