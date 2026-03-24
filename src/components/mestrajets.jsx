import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from './navbar.jsx';

const LINE_NAME_MAP = {
    E: 'Fontanil-Cornillon Palluel / Grenoble Louise Michel',
    A: 'Grenoble Hôtel de Ville / Gières Gare',
    C1: 'Cardeur / Presqu\u00eele',
    C2: 'Camille-Gros / Presqu\u00eele',
    B: 'Bishop / Campus',
};

const FALLBACK_STOPS = {
    'pont de vence': ['SEM:GENPTVENCE::45.23009,5.6823', 'Pont de Vence'],
    'alsace lorraine': ['SEM:GENALSACELO::45.18911,5.7193', 'Alsace Lorraine'],
    'neron': ['SEM:NERON::45.21782,5.69334', 'N\u00e9ron'],
};

// Structure d'un trajet : { line: 'E', depId: 'genptvence', arrId: 'genalsacelo', depName: 'Pont de Vence', arrName: 'Alsace Lorraine' }
const DEFAULT_TRAJET = { line: '', depId: '', arrId: '', depName: '', arrName: '' };

export default function MesTrajets() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [stopsMap, setStopsMap] = useState(FALLBACK_STOPS);
    const [stopsLoaded, setStopsLoaded] = useState(false);
    const [loadedFromStorage, setLoadedFromStorage] = useState(false);
    const [currentTrajet, setCurrentTrajet] = useState('T1');
    const [trajets, setTrajets] = useState({
        T1: { ...DEFAULT_TRAJET },
        T2: { ...DEFAULT_TRAJET },
        T3: { ...DEFAULT_TRAJET }
    });

    // Permet d'éviter d'exécuter le chargement deux fois en mode strict
    const hasLoadedRef = useRef(false);

    // États pour la recherche active
    const [dep, setDep] = useState('');
    const [arr, setArr] = useState('');
    const [line, setLine] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timeOffset, setTimeOffset] = useState(0);
    const [searchBaseDate, setSearchBaseDate] = useState(new Date());
    const [depSuggestions, setDepSuggestions] = useState([]);
    const [arrSuggestions, setArrSuggestions] = useState([]);
    const [inputsOpen, setInputsOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState(''); // '', 'saved', 'saved-idle'
    const [menuOpen, setMenuOpen] = useState(false);

    // État pour mettre à jour l'heure locale toutes les secondes (pour "dans x min")
    const [currentTime, setCurrentTime] = useState(new Date());

    // Désactiver le débogage console des recherches (false = off)
    const DEBUG = false;

    // Stockage des résultats pour chaque trajet (caching en mémoire, reset au refresh / sortie de page)
    const [trajetResultsMap, setTrajetResultsMap] = useState({
        T1: { results: [], error: '', timeOffset: 0, searchBaseDate: new Date() },
        T2: { results: [], error: '', timeOffset: 0, searchBaseDate: new Date() },
        T3: { results: [], error: '', timeOffset: 0, searchBaseDate: new Date() }
    });

    // Cache en mémoire volatile (non persistant entre refresh)
    const trajetsCacheRef = useRef({});

    // Réinitialiser le statut de sauvegarde quand l'utilisateur modifie la sélection
    useEffect(() => {
        const trajet = trajets[currentTrajet];
        const currentLine = line.trim().toUpperCase();
        const savedLine = (trajet?.line || '').trim().toUpperCase();
        const currentDep = dep.trim();
        const currentArr = arr.trim();
        const savedDep = trajet?.depName?.trim() || '';
        const savedArr = trajet?.arrName?.trim() || '';

        if ((saveStatus === 'saved' || saveStatus === 'saved-idle') && (currentLine !== savedLine || currentDep !== savedDep || currentArr !== savedArr)) {
            setSaveStatus('');
        }
    }, [dep, arr, line, currentTrajet, trajets, saveStatus]);

    // Charger les arrêts au démarrage
    useEffect(() => {
        const fetchStops = async () => {
            try {
                const routesResp = await fetch('https://data.mobilites-m.fr/api/routers/default/index/routes');
                const routes = await routesResp.json();
                const semLines = routes
                    .map((route) => route.id)
                    .filter((id) => id?.startsWith('SEM:'))
                    .map((id) => id.replace('SEM:', ''));

                const newMap = { ...FALLBACK_STOPS };

                await Promise.all(
                    semLines.map(async (l) => {
                        try {
                            const r = await fetch(`https://data.mobilites-m.fr/api/routers/default/index/routes/SEM:${l}/clusters`);
                            const clusters = await r.json();
                            clusters.forEach((stop) => {
                                const key = stop.name.toLowerCase();
                                newMap[key] = [`${stop.id}::${stop.lat},${stop.lon}`, stop.name];
                            });
                        } catch {
                            // ignore une ligne échouée
                        }
                    })
                );

                setStopsMap(newMap);
                setStopsLoaded(true);
            } catch {
                setStopsMap(FALLBACK_STOPS);
                setStopsLoaded(true);
            }
        };

        fetchStops();
    }, []);

    // Charger les trajets depuis localStorage et URL
    useEffect(() => {
        if (hasLoadedRef.current) {
            return;
        }
        hasLoadedRef.current = true;

        // Charger depuis localStorage
        const savedTrajets = localStorage.getItem('tag-express-trajets');

        console.log('Chargement localStorage:', { savedTrajets });

        let activeKey = 'T1';
        const savedActive = localStorage.getItem('tag-express-active-trajet');
        if (savedActive && ['T1', 'T2', 'T3'].includes(savedActive)) {
            activeKey = savedActive;
        }

        if (savedTrajets) {
            try {
                const parsed = JSON.parse(savedTrajets);
                console.log('Trajets chargés:', parsed);
                setTrajets(parsed);

                if (parsed[activeKey]) {
                    setCurrentTrajet(activeKey);
                    const stored = parsed[activeKey];
                    const depValue = stored.depName || stored.depId || '';
                    const arrValue = stored.arrName || stored.arrId || '';
                    const lineValue = stored.line || '';

                    setDep(depValue);
                    setArr(arrValue);
                    setLine(lineValue);

                    if (depValue && arrValue) {
                        search(0, { dep: depValue, arr: arrValue, line: lineValue }).catch(e => console.error(e));
                    }
                }
            } catch (e) {
                console.error('Erreur chargement localStorage trajets:', e);
            }
        }

        setLoadedFromStorage(true);
        localStorage.setItem('tag-express-active-trajet', activeKey);
    }, []);

    // Pre-search for all configured trajets once stops and trajets are loaded
    useEffect(() => {
        if (stopsLoaded && loadedFromStorage) {
            console.log('🔄 Pré-chargement de tous les trajets...');
            ['T1', 'T2', 'T3'].forEach(t => {
                const trajet = trajets[t];
                const hasConfig = trajet && trajet.depName && trajet.arrName;
                console.log(`  T${t.slice(1)}: ${hasConfig ? '✓ Configuré - Recherche...' : '✗ Pas configuré'}`);
                if (hasConfig) {
                    search(0, { dep: trajet.depName, arr: trajet.arrName, line: trajet.line, trajetKey: t, save: false });
                }
            });
        }
    }, [stopsLoaded, loadedFromStorage, trajets]);

    // Vider le cache en mémoire lorsque l'utilisateur quitte la page / dé-monte le composant
    useEffect(() => {
        return () => {
            trajetsCacheRef.current = {};
        };
    }, []);

    // Mise à jour de l'heure locale toutes les secondes pour "dans x min"
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Charger depuis URL si paramètres présents
    useEffect(() => {
        const urlTrajets = {};
        let hasUrlParams = false;

        ['T1', 'T2', 'T3'].forEach(t => {
            const param = searchParams.get(t);
            if (param) {
                hasUrlParams = true;
                // Format: E:genptvence:genalsacelo
                const [line, depId, arrId] = param.split(':');
                if (line && depId && arrId) {
                    // Trouver les noms depuis stopsMap
                    const depStop = Object.values(stopsMap).find(([id]) => id.includes(depId));
                    const arrStop = Object.values(stopsMap).find(([id]) => id.includes(arrId));

                    urlTrajets[t] = {
                        line: line.toUpperCase(),
                        depId,
                        arrId,
                        depName: depStop ? depStop[1] : depId,
                        arrName: arrStop ? arrStop[1] : arrId
                    };
                }
            }
        });

        if (hasUrlParams) {
            setTrajets(prev => {
                const newTrajets = { ...prev };
                Object.keys(urlTrajets).forEach(t => {
                    if (!prev[t] || !prev[t].line) { // Only set from URL if not already configured in localStorage
                        newTrajets[t] = urlTrajets[t];
                    }
                });
                return newTrajets;
            });
        }
    }, [searchParams, stopsMap]);

    // Sauvegarder dans localStorage à chaque changement
    useEffect(() => {
        localStorage.setItem('tag-express-trajets', JSON.stringify(trajets));
    }, [trajets]);

    const findStop = (query) => {
        if (!query || !query.trim()) return null;
        const key = query.trim().toLowerCase();
        if (stopsMap[key]) return stopsMap[key];

        for (const [k, v] of Object.entries(stopsMap)) {
            if (k.includes(key) || key.includes(k)) return v;
        }

        return null;
    };

    const suggestionsFor = (value) => {
        if (!value.trim()) return [];
        const q = value.trim().toLowerCase();
        if (stopsMap[q]) return [];

        const matched = Object.keys(stopsMap)
            .filter((k) => k.includes(q))
            .slice(0, 10)
            .map((k) => stopsMap[k][1]);
        return matched;
    };

    useEffect(() => {
        setDepSuggestions(suggestionsFor(dep));
    }, [dep, stopsMap]);

    useEffect(() => {
        setArrSuggestions(suggestionsFor(arr));
    }, [arr, stopsMap]);

    // Supprimé : sauvegarde automatique

    // Sauvegarder le trajet actuel dans localStorage
    const saveCurrentTrajet = () => {
        const from = findStop(dep);
        const to = findStop(arr);

        const updatedTrajets = {
            ...trajets,
            [currentTrajet]: {
                line: line.toUpperCase(),
                depId: from ? from[0].split('::')[0].replace('SEM:', '') : '',
                arrId: to ? to[0].split('::')[0].replace('SEM:', '') : '',
                depName: dep.trim(),
                arrName: arr.trim()
            }
        };
        console.log('Sauvegarde trajet:', currentTrajet, updatedTrajets[currentTrajet]);
        setTrajets(updatedTrajets);

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('saved-idle'), 2000);
    };

    // Charger un trajet dans le formulaire de recherche
    const loadTrajet = (trajetKey) => {
        const trajet = trajets[trajetKey];
        const trajetData = trajetResultsMap[trajetKey] || trajetsCacheRef.current[trajetKey] || {};
        console.log(`📂 Chargement trajet ${trajetKey}:`, {
            trajet,
            resultCount: trajetData.results?.length || 0,
            error: trajetData.error || 'Aucune erreur',
            source: trajetResultsMap[trajetKey] ? 'state' : 'cache'
        });
        setCurrentTrajet(trajetKey);
        setDep(trajet.depName || '');
        setArr(trajet.arrName || '');
        setLine(trajet.line || '');
        setResults(trajetData.results || []);
        setError(trajetData.error || '');
        setTimeOffset(trajetData.timeOffset || 0);
        setSearchBaseDate(trajetData.searchBaseDate || new Date());
        setInputsOpen(false);

        // Sauvegarder le trajet actif
        localStorage.setItem('tag-express-active-trajet', trajetKey);
    };

    const search = async (offset = 0, params = {}) => {
        const depValue = params.dep !== undefined ? params.dep : dep;
        const arrValue = params.arr !== undefined ? params.arr : arr;
        const lineValue = params.line !== undefined ? params.line : line;
        const trajetKey = params.trajetKey || currentTrajet;
        const shouldSave = params.save !== false; // default true
        const shouldUpdateGlobal = !params.trajetKey || params.trajetKey === currentTrajet;

        if (shouldUpdateGlobal) {
            setDep(depValue);
            setArr(arrValue);
            setLine(lineValue);
            setError('');
            setLoading(true);
        }

        const from = findStop(depValue);
        const to = findStop(arrValue);

        if (!from) {
            if (shouldUpdateGlobal) {
                setError(`Arrêt de départ '${depValue}' non trouvé.`);
                setLoading(false);
            }
            return;
        }
        if (!to) {
            if (shouldUpdateGlobal) {
                setError(`Arrêt d'arrivée '${arrValue}' non trouvé.`);
                setLoading(false);
            }
            return;
        }

        if (shouldSave) {
            // Sauvegarder automatiquement le trajet dans localStorage
            const newTrajets = {
                ...trajets,
                [trajetKey]: {
                    line: lineValue.toUpperCase(),
                    depId: from[0].split('::')[0].replace('SEM:', ''),
                    arrId: to[0].split('::')[0].replace('SEM:', ''),
                    depName: from[1],
                    arrName: to[1]
                }
            };
            setTrajets(newTrajets);
        }

        const baseTime = searchBaseDate;
        const now = new Date();
        let adjustedBaseTime = baseTime;
        if (baseTime < now) {
            adjustedBaseTime = new Date(now.getTime() + offset * 60 * 60 * 1000);
        } else {
            adjustedBaseTime = new Date(baseTime.getTime() + offset * 60 * 60 * 1000);
        }

        const time = adjustedBaseTime;
        const urlParams = new URLSearchParams({
            fromPlace: from[0],
            toPlace: to[0],
            time: time.toTimeString().substr(0, 5),
            date: time.toISOString().substr(0, 10),
            mode: 'TRANSIT',
            maxWalkDistance: '100',
            walkSpeed: '1.5',
            waitReluctance: '0.8',
            locale: 'fr',
            numItineraries: '12',
        });

        try {
            const res = await fetch(`https://data.mobilites-m.fr/api/routers/default/plan?${urlParams.toString()}`);
            const json = await res.json();
            const itineraries = json.plan?.itineraries || [];

            if (DEBUG) {
                console.log(`\n🔍 === RECHERCHE ${trajetKey} ===`);
                console.log(`📍 De: ${depValue} → ${arrValue}`);
                console.log(`🚌 Ligne filtrée: ${lineValue || 'Toutes'}`);
                console.log(`⏰ Horaire: ${time.toTimeString().substr(0, 5)}`);
                console.log(`📊 Itinéraires reçus: ${itineraries.length}`);
            }

            const filtered = itineraries
                .filter((it) => it.duration / 60 <= 35)
                .map((it, idx) => {
                    const depTime = new Date(it.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const arrTime = new Date(it.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const duration = Math.round(it.duration / 60);
                    const legs = it.legs.filter((l) => l.mode !== 'WALK'); // Legs de transport uniquement

                    if (DEBUG) {
                        console.log(`\n  📋 Itinéraire ${idx + 1}: ${depTime}→${arrTime} (${duration}min)`);
                        console.log(`     Transport legs: ${legs.length}`);
                    }

                    const lineKeys = legs.map((leg) => {
                        const routeShortName = (leg.routeShortName || '').replace('SEM:', '').toUpperCase();
                        const route = (leg.route || '').replace('SEM:', '').toUpperCase();
                        const routeId = (leg.routeId || '').replace('SEM:', '').toUpperCase();
                        return routeShortName || route || routeId || '?';
                    });

                    if (DEBUG && legs.length === 0) {
                        console.log('  ❓ AUCUN TRANSPORT trouvé');
                    }

                    return {
                        dep: depTime,
                        arr: arrTime,
                        depName: from[1],
                        arrName: to[1],
                        dur: `${duration} min`,
                        direction: legs[0]?.headsign || legs[0]?.to?.name || '?',
                        line: lineValue ? lineValue.toUpperCase() : lineKeys[0] || '?',
                        lineKeys
                    };
                })
                .filter((item) => {
                    if (!lineValue.trim()) return true;
                    const target = lineValue.toUpperCase();
                    const targetPattern = LINE_NAME_MAP[target]?.toUpperCase() || target;
                    return item.lineKeys.some((lk) => lk === target || lk === targetPattern || lk.startsWith(target));
                });

            if (DEBUG) {
                console.log(`✅ Itinéraires filtrés: ${filtered.length} (max 35min)`);
                if (filtered.length === 0) {
                    console.log('⚠️ Aucun itinéraire trouvé');
                }
            }

            if (filtered.length === 0) {
                if (shouldUpdateGlobal) {
                    setError('Aucun itinéraire trouvé pour ce créneau.');
                }
            } else {
                if (shouldUpdateGlobal) {
                    setError('');
                }
            }

            // Sauvegarder les résultats pour ce trajet (state + cache mémoire)
            const trajetData = {
                results: filtered,
                error: filtered.length === 0 ? 'Aucun itinéraire trouvé pour ce créneau.' : '',
                timeOffset: offset,
                searchBaseDate: adjustedBaseTime
            };
            trajetsCacheRef.current[trajetKey] = trajetData;
            setTrajetResultsMap(prev => ({
                ...prev,
                [trajetKey]: trajetData
            }));

            if (shouldUpdateGlobal) {
                setResults(filtered);
                setTimeOffset(offset);
                setSearchBaseDate(baseTime);
                setInputsOpen(false);
            }
        } catch (err) {
            const errorMsg = 'Erreur réseau / API : ' + (err.message || err);
            if (shouldUpdateGlobal) {
                setError(errorMsg);
                setResults([]);
            }

            // Sauvegarder l'erreur pour ce trajet (state + cache mémoire)
            const trajetErrorData = {
                results: [],
                error: errorMsg,
                timeOffset: 0,
                searchBaseDate: adjustedBaseTime
            };
            trajetsCacheRef.current[trajetKey] = trajetErrorData;
            setTrajetResultsMap(prev => ({
                ...prev,
                [trajetKey]: trajetErrorData
            }));
        } finally {
            if (shouldUpdateGlobal) {
                setLoading(false);
            }
        }
    };

    const handleAddOneHour = async () => {
        await search(timeOffset + 1, { trajetKey: currentTrajet, save: false });
    };

    const handleSubtractOneHour = async () => {
        await search(timeOffset - 1);
    };

    const handleRefresh = async () => {
        await search(timeOffset, { trajetKey: currentTrajet, save: false });
    };

    const reset = () => {
        setDep('');
        setArr('');
        setLine('');
        setResults([]);
        setTimeOffset(0);
        setError('');
        setInputsOpen(true);
        setMenuOpen(false);
    };

    const selectSuggestion = (value, target) => {
        if (target === 'dep') {
            setDep(value);
            setDepSuggestions([]);
        } else {
            setArr(value);
            setArrSuggestions([]);
        }
    };

    const computedSuggestions = useMemo(() => depSuggestions, [depSuggestions]);

    const formatTimeUntil = (timeStr, now = new Date()) => {
        if (!timeStr) return '';
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return '';
        const hours = Number(match[1]);
        const mins = Number(match[2]);
        if (Number.isNaN(hours) || Number.isNaN(mins)) return '';

        const target = new Date(now);
        target.setHours(hours, mins, 0, 0);
        if (target < now) {
            target.setDate(target.getDate() + 1);
        }

        const diffMs = target - now;
        const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffMins = diffMinutes % 60;

        if (diffHours > 0 && diffMins > 0) {
            return `dans ${diffHours}h${diffMins}`;
        }
        if (diffHours > 0) {
            return `dans ${diffHours} h`;
        }
        return `dans ${diffMins} min`;
    };

    const origin = searchBaseDate || new Date();
    const afterDate = new Date(origin.getTime() + (timeOffset + 1) * 60 * 60 * 1000);
    const afterLabel = `après ${afterDate.toTimeString().slice(0, 5)}`;

    return (
        <>
            <Navbar title="Mes trajets" menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMenuOpen={() => setInputsOpen(false)} />
            <div className="min-h-screen relative bg-slate-50 pb-24">
                {/* Navbar des trajets */}
                <div className="bg-white border-b border-gray-200 p-4">
                    <div className="flex gap-3">
                        {['T1', 'T2', 'T3'].map((t) => (
                            <button
                                key={t}
                                onClick={() => loadTrajet(t)}
                                className={`flex-1 py-2 px-3 font-semibold transition-colors text-center rounded-lg ${currentTrajet === t
                                    ? 'bg-blue-600 text-white'
                                    : trajets[t].line
                                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <div>{t}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="m-4 p-4 rounded-lg border border-gray-300 bg-white shadow-lg">
                    <div className="flex justify-between items-center mb-3">
                        <h1 className="text-2xl font-bold">Trajet {currentTrajet}</h1>
                        <button
                            onClick={saveCurrentTrajet}
                            disabled={saveStatus !== ''}
                            className={`px-3 py-1 text-sm rounded-lg font-regular transition-all ${saveStatus === 'saved' ? 'bg-emerald-500 text-white cursor-default' :
                                saveStatus === 'saved-idle' ? 'bg-gray-200 text-gray-600 cursor-default' :
                                    'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {saveStatus === 'saved' ? 'Sauvegardé !' : 'Sauvegarder'}
                        </button>
                    </div>

                    {error && <div className="mt-3 p-2 bg-red-100 text-red-700 rounded">{error}</div>}

                    {results.length > 0 && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-center">
                            <span className="text-lg font-semibold text-black flex items-center justify-center gap-1">
                                {dep}
                                →
                                {arr}
                            </span>
                            <div className="text-xs text-gray-600 mt-1">{results[0].direction}</div>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="mt-4 mb-2 text-left flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                                Résultats pour {new Date(searchBaseDate.getTime() + timeOffset * 60 * 60 * 1000).toTimeString().slice(0, 5)}
                            </span>
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                className="ml-auto text-gray-600 hover:text-gray-900 transition-colors"
                                title="Rafraîchir les résultats"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-2 border">Ligne</th>
                                    <th className="p-2 border hidden sm:table-cell">Direction</th>
                                    <th className="p-2 border">
                                        <div>Départ</div>
                                        <div className="text-xs font-normal text-gray-600">{dep || '-'}</div>
                                    </th>
                                    <th className="p-2 border">
                                        <div>Arrivée</div>
                                        <div className="text-xs font-normal text-gray-600">{arr || '-'}</div>
                                    </th>
                                    <th className="p-2 border hidden sm:table-cell">Durée</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-3 text-center text-gray-500">Aucun résultat. Lancez la recherche.</td>
                                    </tr>
                                ) : (
                                    results.map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <tr className="even:bg-gray-50">
                                                <td className="p-2 border">{item.line}</td>
                                                <td className="p-2 border hidden sm:table-cell">{item.direction}</td>
                                                <td className="p-2 border">
                                                    <div>{item.dep}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{formatTimeUntil(item.dep, currentTime)}</div>
                                                </td>
                                                <td className="p-2 border">
                                                    <div>{item.arr}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{item.dur}</div>
                                                </td>
                                                <td className="p-2 border hidden sm:table-cell">{item.dur}</td>
                                            </tr>
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className={`mt-3 flex items-center gap-2 ${(results.length > 0 && timeOffset >= 0) ? 'justify-between' : 'justify-end'}`}>
                        {timeOffset >= 0 && results.length > 0 && (
                            <button
                                className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700 cursor-pointer"
                                onClick={handleSubtractOneHour}
                                disabled={loading}
                            >
                                &lt;
                            </button>
                        )}
                        {results.length > 0 && (
                            <button
                                className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700 cursor-pointer"
                                onClick={handleAddOneHour}
                                disabled={loading}
                            >
                                rechercher pour {afterLabel} &gt;
                            </button>
                        )}
                    </div>
                </div>

                {!inputsOpen && (
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-100 border-t border-gray-300 p-2 shadow-md">
                        <button
                            className="w-full py-3 bg-blue-600 text-white rounded-t-lg"
                            onClick={() => { setInputsOpen(true); setMenuOpen(false); }}
                        >
                            ^ Ouvrir la recherche
                        </button>
                    </div>
                )}

                <div className={`mt-4 ${inputsOpen ? 'translate-y-0' : 'translate-y-full'} fixed bottom-0 left-0 right-0 z-20 border-t border-gray-300 bg-white p-4 shadow-xl transition-transform duration-500 sm:relative sm:translate-y-0 sm:border-none sm:shadow-none sm:p-0`}>
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold">Configuration du trajet {currentTrajet}</span>
                        <button className="text-gray-600" onClick={() => { const newState = !inputsOpen; setInputsOpen(newState); if (newState) setMenuOpen(false); }}>
                            {inputsOpen ? 'v Cacher' : '^ Ouvrir'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1 relative">
                            <span>Départ</span>
                            <input
                                value={dep}
                                onChange={(e) => setDep(e.target.value)}
                                className="w-full border p-2 rounded"
                                placeholder="ex: Pont de Vence"
                            />
                            {dep && computedSuggestions.length > 0 && (
                                <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded bg-white max-h-40 overflow-y-auto shadow-lg">
                                    {computedSuggestions.map((s, i) => (
                                        <li
                                            key={i}
                                            className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => selectSuggestion(s, 'dep')}
                                        >
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </label>

                        <label className="space-y-1 relative">
                            <span>Arrivée</span>
                            <input
                                value={arr}
                                onChange={(e) => setArr(e.target.value)}
                                className="w-full border p-2 rounded"
                                placeholder="ex: Alsace Lorraine"
                            />
                            {arr && arrSuggestions.length > 0 && (
                                <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded bg-white max-h-40 overflow-y-auto shadow-lg">
                                    {arrSuggestions.map((s, i) => (
                                        <li
                                            key={i}
                                            className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => selectSuggestion(s, 'arr')}
                                        >
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </label>

                        <label className="space-y-1 sm:col-span-2">
                            <span>Ligne (optionnel)</span>
                            <input
                                value={line}
                                onChange={(e) => setLine(e.target.value)}
                                className="w-full border p-2 rounded"
                                placeholder="ex: E, A, C1..."
                            />
                        </label>
                    </div>

                    <div className="space-y-2 mt-4 flex flex-col items-stretch">
                        <button
                            onClick={() => search(0)}
                            disabled={loading}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg"
                        >
                            {loading ? 'Recherche...' : 'Rechercher'}
                        </button>
                        <button
                            onClick={reset}
                            className="w-full px-4 py-3 bg-gray-300 text-black rounded-lg"
                        >
                            Réinitialiser
                        </button>
                    </div>

                    <button onClick={() => setInputsOpen(false)} type="button" className="mt-4 w-full text-center text-gray-600">
                        fermer
                    </button>
                </div>
            </div>
        </>
    );
}
