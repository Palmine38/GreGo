{
  /* NEW ONE */
}

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
import StopPickerMap from "./components/StopPickerMap.jsx";
import { JourneyMapModal } from "./components/JourneyMapModal.jsx";
import { JourneyDetailsSheet } from "./components/JourneyDetailsSheet.jsx";
import { InlineJourneyMap } from "./components/JourneyDetailsSheet.jsx";
import { LineInfoSheet } from "./components/LineInfoSheet.jsx";
import { TrajetTabBar } from "./components/TrajetTabBar.jsx";
import {
  buildOtpParams,
  filterByLine,
  filterByTimeWindow,
  formatTimeUntil,
  getMinutesUntil,
  parseItinerary,
} from "./utils/journey.js";

// ─── Constantes ───────────────────────────────────────────────────────────────
const DEFAULT_TRAJET = {
  name: "",
  line: "",
  depId: "",
  arrId: "",
  depName: "",
  arrName: "",
};
const ALL_KEYS = ["T1", "T2", "T3", "T4", "T5"];

// ─────────────────────────────────────────────────────────────────────────────
export default function MesTrajets() {
  const [searchParams] = useSearchParams();

  // ── Hooks partagés ────────────────────────────────────────────────────────
  const currentTime = useCurrentTime();
  const { stopsMap, stopsList, stopsLoaded, findStop, suggestionsFor } =
    useStops();
  const { disruptionsRaw, isLineDisrupted, getLineDisruptions } =
    useDisruptions();
  const { lineColors } = useLineColors();
  const resolveDisplayName = (idOrName) => {
    if (!idOrName) return idOrName;
    for (const [fullId, nomLong] of Object.values(stopsMap)) {
      if (fullId === idOrName) return nomLong;
      const shortId = fullId.split("::")[0];
      if (shortId === idOrName || idOrName.startsWith(shortId)) return nomLong;
    }
    return idOrName;
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

  // ── Clés de trajets dynamiques ────────────────────────────────────────────
  const [trajetKeys, setTrajetKeys] = useState(["T1"]);
  const trajetKeysRef = useRef(["T1"]);
  useEffect(() => {
    trajetKeysRef.current = trajetKeys;
  }, [trajetKeys]);

  // ── Trajets persistés ─────────────────────────────────────────────────────
  const [trajets, setTrajets] = useState({
    T1: { ...DEFAULT_TRAJET },
  });
  const [currentTrajet, setCurrentTrajet] = useState("T1");
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadedTrajetsRef = useRef(null);
  const trajetsRef = useRef(trajets);
  const currentTrajetRef = useRef(currentTrajet);
  useEffect(() => {
    trajetsRef.current = trajets;
  }, [trajets]);
  useEffect(() => {
    currentTrajetRef.current = currentTrajet;
  }, [currentTrajet]);

  const reorderTrajets = (newKeys) => {
    setTrajetKeys(newKeys);
  };

  // ── Champs de recherche ───────────────────────────────────────────────────
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

  // ── Résultats par trajet ───────────────────────────────────────────────────
  const [trajetResultsMap, setTrajetResultsMap] = useState({
    T1: { results: [], error: "", timeOffset: 0, searchBaseDate: new Date() },
  });
  const trajetsCacheRef = useRef({});
  const trajetsCacheTimestampRef = useRef({});

  // ── UI panels ─────────────────────────────────────────────────────────────
  const [inputsOpen, setInputsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRefreshCheck, setShowRefreshCheck] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newTrajetName, setNewTrajetName] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState("dep");
  const [detailMapOpen, setDetailMapOpen] = useState(false);
  const inputsOpenBeforeRenameRef = useRef(false);
  const initialValuesRef = useRef({ dep: "", arr: "", line: "" });
  const inputsOpenRef = useRef(inputsOpen);
  const sheetRef = useRef(null);
  useEffect(() => {
    if (inputsOpen && !inputsOpenRef.current)
      initialValuesRef.current = { dep, arr, line };
    inputsOpenRef.current = inputsOpen;
  }, [inputsOpen]);

  // ── Journey details ───────────────────────────────────────────────────────
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [journeyDetailsOpen, setJourneyDetailsOpen] = useState(false);
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

  useEffect(() => {
    if (isFirstRender.current) return;
    localStorage.setItem("tag-express-trajet-keys", JSON.stringify(trajetKeys));
  }, [trajetKeys]);

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Charger les clés sauvegardées
    const savedKeys = localStorage.getItem("tag-express-trajet-keys");
    const parsedKeys = savedKeys
      ? JSON.parse(savedKeys).filter((k) => ALL_KEYS.includes(k))
      : ["T1"];
    const activeKeys = parsedKeys.length > 0 ? parsedKeys : ["T1"];
    setTrajetKeys(activeKeys);
    trajetKeysRef.current = activeKeys;

    const savedTrajets = localStorage.getItem("tag-express-trajets");
    const savedActive = localStorage.getItem("tag-express-active-trajet");
    const activeKey = activeKeys.includes(savedActive)
      ? savedActive
      : activeKeys[0];
    let cleanedTrajets = {};

    if (savedTrajets) {
      try {
        const parsed = JSON.parse(savedTrajets);
        cleanedTrajets = Object.fromEntries(
          Object.entries(parsed).filter(([k]) => activeKeys.includes(k)),
        );
        localStorage.setItem(
          "tag-express-trajets",
          JSON.stringify(cleanedTrajets),
        );
        loadedTrajetsRef.current = cleanedTrajets;
        setTrajets(cleanedTrajets);

        // Initialiser les résultats pour toutes les clés
        setTrajetResultsMap(
          Object.fromEntries(
            activeKeys.map((k) => [
              k,
              {
                results: [],
                error: "",
                timeOffset: 0,
                searchBaseDate: new Date(),
              },
            ]),
          ),
        );

        if (parsed[activeKey]) {
          setCurrentTrajet(activeKey);
          const stored = parsed[activeKey];
          setDep(stored.depId || stored.depName || "");
          setArr(stored.arrId || stored.arrName || "");
          setLine(stored.line || "");
        }
      } catch (e) {
        console.error("Erreur chargement localStorage trajets:", e);
      }
    }

    activeKeys.forEach((t) => {
      const trajet = cleanedTrajets[t];
      if (trajet?.depId && trajet?.arrId) searchById(t, trajet);
    });

    setLoadedFromStorage(true);
    localStorage.setItem("tag-express-active-trajet", activeKey);
  }, []);

  // ── Recherche automatique après chargement des stops ─────────────────────
  useEffect(() => {
    if (!stopsLoaded || !loadedFromStorage) return;
    trajetKeysRef.current.forEach((t) => {
      const trajet = trajetsRef.current[t];
      if (
        (trajet?.depName || trajet?.depId) &&
        (trajet?.arrName || trajet?.arrId)
      ) {
        search(0, {
          dep: trajet.depId || trajet.depName,
          arr: trajet.arrId || trajet.arrName,
          line: trajet.line,
          trajetKey: t,
          keepInputsOpen: true,
        });
      }
    });
  }, [stopsLoaded]);

  // ── Rafraîchissement automatique toutes les 2 minutes ─────────────────────
  useEffect(() => {
    if (!stopsLoaded || !loadedFromStorage) return;
    const interval = setInterval(() => {
      trajetKeysRef.current.forEach((t) => {
        const trajet = trajetsRef.current[t];
        if (
          (trajet?.depName || trajet?.depId) &&
          (trajet?.arrName || trajet?.arrId)
        ) {
          search(0, {
            dep: trajet.depId || trajet.depName,
            arr: trajet.arrId || trajet.arrName,
            line: trajet.line,
            trajetKey: t,
            keepInputsOpen: true,
          });
        }
      });
    }, 120000);
    return () => clearInterval(interval);
  }, [stopsLoaded, loadedFromStorage]);

  // ── URL params ────────────────────────────────────────────────────────────
  useEffect(() => {
    let hasUrlParams = false;
    const urlTrajets = {};
    ALL_KEYS.forEach((t) => {
      const param = searchParams.get(t);
      if (param) {
        hasUrlParams = true;
        const [lineParam, depId, arrId] = param.split(":");
        if (lineParam && depId && arrId) {
          const depStop = Object.values(stopsMap).find(([id]) =>
            id.includes(depId),
          );
          const arrStop = Object.values(stopsMap).find(([id]) =>
            id.includes(arrId),
          );
          urlTrajets[t] = {
            line: lineParam.toUpperCase(),
            depId,
            arrId,
            depName: depStop ? depStop[1] : depId,
            arrName: arrStop ? arrStop[1] : arrId,
          };
        }
      }
    });
    if (hasUrlParams) {
      // Ajouter les clés URL manquantes
      const urlKeys = Object.keys(urlTrajets);
      setTrajetKeys((prev) => {
        const merged = [...new Set([...prev, ...urlKeys])].filter((k) =>
          ALL_KEYS.includes(k),
        );
        return merged;
      });
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
    const findFullId = (shortId) => {
      if (shortId?.includes("::")) return shortId;
      for (const [fullId] of Object.values(stopsMap)) {
        if (fullId.includes(shortId)) return fullId;
      }
      return null;
    };
    const depId = findFullId(trajet.depId);
    const arrId = findFullId(trajet.arrId);
    if (!depId || !arrId) return;

    const savedSettings = JSON.parse(
      localStorage.getItem("tag-express-settings") || "{}",
    );
    const now = new Date();
    const urlParams = buildOtpParams({
      fromCoords: depId.split("::")[1] || depId,
      toCoords: arrId.split("::")[1] || arrId,
      queryTime: now,
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
          depName: trajet.depName,
          arrName: trajet.arrName,
          lineFilter: trajet.line,
        }),
      );
      const filtered = filterByLine(parsed, trajet.line);
      const trajetData = {
        results: filtered,
        error: filtered.length === 0 ? "Aucun itinéraire trouvé." : "",
        timeOffset: 0,
        searchBaseDate: now,
      };
      trajetsCacheRef.current[trajetKey] = trajetData;
      trajetsCacheTimestampRef.current[trajetKey] = Date.now();
      setTrajetResultsMap((prev) => ({ ...prev, [trajetKey]: trajetData }));
      if (trajetKey === currentTrajetRef.current) {
        setResults(filtered);
        setError(trajetData.error);
        setTimeOffset(0);
        setSearchBaseDate(now);
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

    let fromId, fromName;
    if (depValue.includes("::")) {
      fromId = depValue;
      fromName = depValue.split("::")[0];
    } else {
      const from = findStop(depValue);
      if (!from) {
        if (shouldUpdateGlobal)
          setError(`Arrêt de départ '${depValue}' non trouvé.`);
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
        if (shouldUpdateGlobal)
          setError(`Arrêt d'arrivée '${arrValue}' non trouvé.`);
        return;
      }
      toId = to[0];
      toName = to[1];
    }

    const baseTime =
      (trajetKey === currentTrajetRef.current
        ? searchBaseDateRef.current
        : null) || new Date();
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

      if (isManual) {
        const updated = {
          ...trajetsRef.current,
          [trajetKey]: {
            ...trajetsRef.current[trajetKey],
            line: lineValue.toUpperCase(),
            depId: fromId,
            arrId: toId,
            depName: fromName,
            arrName: toName,
            depIsAddress: depValue.includes("::"),
            arrIsAddress: arrValue.includes("::"),
          },
        };
        setTrajets(updated);
        trajetsCacheRef.current[trajetKey] = null;
        trajetsCacheTimestampRef.current[trajetKey] = null;
      }

      const trajetData = {
        results: filtered,
        error:
          filtered.length === 0
            ? "Aucun itinéraire trouvé pour ce créneau."
            : "",
        timeOffset: offset,
        searchBaseDate: anchorTime,
      };
      trajetsCacheRef.current[trajetKey] = trajetData;
      trajetsCacheTimestampRef.current[trajetKey] = Date.now();
      setTrajetResultsMap((prev) => ({ ...prev, [trajetKey]: trajetData }));

      if (shouldUpdateGlobal) {
        setResults(filtered);
        setError(
          filtered.length === 0
            ? "Aucun itinéraire trouvé pour ce créneau."
            : "",
        );
        setTimeOffset(offset);
        setSearchBaseDate(anchorTime);
        if (!keepInputsOpen) setInputsOpen(false);
      }
    } catch (err) {
      const errorMsg = "Erreur réseau / API : " + (err.message || err);
      if (shouldUpdateGlobal) {
        setError(errorMsg);
        setResults([]);
      }
      const trajetErrorData = {
        results: [],
        error: errorMsg,
        timeOffset: 0,
        searchBaseDate: new Date(),
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
    reloadSettings();
    trajetKeysRef.current.forEach((t) => {
      trajetsCacheRef.current[t] = null;
    });
    const active = loadedTrajetsRef.current || trajetsRef.current;
    trajetKeysRef.current.forEach((t) => {
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
    const trajet = trajets[trajetKey] || DEFAULT_TRAJET;
    const data = trajetResultsMap[trajetKey] || {};
    currentTrajetRef.current = trajetKey;
    setCurrentTrajet(trajetKey);
    setDep(trajet.depId || trajet.depName || "");
    setArr(trajet.arrId || trajet.arrName || "");
    setLine(trajet.line || "");
    setResults(data.results || []);
    setError(data.error || "");
    setTimeOffset(data.timeOffset || 0);
    setSearchBaseDate(data.searchBaseDate || new Date());
    setInputsOpen(false);
    localStorage.setItem("tag-express-active-trajet", trajetKey);
  };

  const addTrajet = () => {
    const next = ALL_KEYS.find((k) => !trajetKeysRef.current.includes(k));
    if (!next) return;
    setTrajetKeys((prev) => [...prev, next]);
    setTrajets((prev) => ({ ...prev, [next]: { ...DEFAULT_TRAJET } }));
    setTrajetResultsMap((prev) => ({
      ...prev,
      [next]: {
        results: [],
        error: "",
        timeOffset: 0,
        searchBaseDate: new Date(),
      },
    }));
  };

  const deleteTrajet = (key) => {
    const keys = trajetKeysRef.current;
    if (keys.length <= 1) return;
    const newKeys = keys.filter((k) => k !== key);
    setTrajetKeys(newKeys);
    setTrajets((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTrajetResultsMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    trajetsCacheRef.current[key] = null;
    if (key === currentTrajetRef.current) {
      loadTrajet(newKeys[0]);
    }
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
        {/* ── Sélecteur de trajets ────────────────────────────────────── */}
        <TrajetTabBar
          trajetKeys={trajetKeys}
          trajets={trajets}
          currentTrajet={currentTrajet}
          isConfigured={isConfigured}
          onSelect={loadTrajet}
          onAdd={addTrajet}
          onDelete={deleteTrajet}
          onReorder={reorderTrajets}
        />

        {/* ── Carte principale ────────────────────────────────────────── */}
        <div className="m-4 p-4 rounded-lg border border-gray-300 bg-white shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-2xl font-bold">
              {trajets[currentTrajet]?.name || currentTrajet}
            </h1>
            <button
              onClick={() => {
                inputsOpenBeforeRenameRef.current = inputsOpen;
                setNewTrajetName(trajets[currentTrajet]?.name || "");
                setInputsOpen(false);
                setRenameOpen(true);
              }}
              className="text-gray-700 hover:text-gray-900 transition-colors p-2 flex items-center gap-1 text-sm underline underline-offset-2"
              title="Renommer le trajet"
            >
              Renommer
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-5"
              >
                <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
              </svg>
            </button>
          </div>

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

        {/* ── Sheet : Détails du trajet ─────────────────────────────── */}
        <JourneyDetailsSheet
          isOpen={journeyDetailsOpen}
          onClose={closeJourneyDetails}
          journey={selectedJourney}
          lineColors={lineColors}
          getLineDisruptions={getLineDisruptions}
        />

        {/* ── Sheet : Infotrafic ligne ──────────────────────────────── */}
        <LineInfoSheet
          lineKey={selectedLineInfo}
          isOpen={lineInfoOpen}
          onClose={closeLineInfo}
          getLineDisruptions={getLineDisruptions}
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
          <Sheet.Container style={{ borderRadius: "24px 24px 0 0" }}>
            <Sheet.Content disableDrag>
              <div className="px-4 pt-4 pb-10">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-lg">
                    Renommer le trajet {currentTrajet}
                  </span>
                  <button
                    className="text-slate-400 hover:text-slate-700"
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
                    <span className="text-sm text-gray-600">
                      Nouveau nom du trajet
                    </span>
                    <input
                      value={newTrajetName}
                      onChange={(e) => setNewTrajetName(e.target.value)}
                      className="w-full border p-2 rounded-lg"
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
                        T4: "Trajet 4",
                        T5: "Trajet 5",
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
                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
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
                dep={resolveDisplayName(dep)}
                arr={resolveDisplayName(arr)}
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
                onSearch={() => search(0, { manual: true })}
                onReset={reset}
                onCancel={cancel}
                loading={loading}
                stopsLoaded={stopsLoaded}
                onOpenMapPicker={(target) => {
                  setMapPickerTarget(target);
                  setMapPickerOpen(true);
                }}
              />
            </Sheet.Content>
          </Sheet.Container>
          <Sheet.Backdrop onTap={cancel} />
        </Sheet>
      </div>

      {/* ── StopPickerMap ─────────────────────────────────────────────── */}
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
