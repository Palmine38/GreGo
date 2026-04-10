import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from './navbar.jsx';
import LineIcon from './lines-icons.jsx';

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

const DEFAULT_TRAJET = { line: '', depId: '', arrId: '', depName: '', arrName: '' };

export default function MesTrajetsTest() {
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

    const hasLoadedRef = useRef(false);
    const loadedTrajetsRef = useRef(null);
    const trajetsRef = useRef(trajets);

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
    const [saveStatus, setSaveStatus] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedJourney, setSelectedJourney] = useState(null);
    const [journeyDetailsOpen, setJourneyDetailsOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const DEBUG = true;

    // État pour les icones des lignes chargées depuis linesicons.txt
    const [lineIcons, setLineIcons] = useState({});
    const [lineColors, setLineColors] = useState({});

    const [trajetResultsMap, setTrajetResultsMap] = useState({
        T1: { results: [], error: '', timeOffset: 0, searchBaseDate: new Date() },
        T2: { results: [], error: '', timeOffset: 0, searchBaseDate: new Date() },
        T3: { results: [], error: '', timeOffset: 0, searchBaseDate: new Date() }
    });

    const trajetsCacheRef = useRef({});
    const trajetsCacheTimestampRef = useRef({});

    useEffect(() => {
        if (selectedJourney) {
            requestAnimationFrame(() => setJourneyDetailsOpen(true));
        }
    }, [selectedJourney]);

    useEffect(() => { trajetsRef.current = trajets; }, [trajets]);

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
                            // ignore
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

    useEffect(() => {
        if (hasLoadedRef.current) {
            return;
        }
        hasLoadedRef.current = true;

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

                loadedTrajetsRef.current = parsed;
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

                }
            } catch (e) {
                console.error('Erreur chargement localStorage trajets:', e);
            }
        }

        setLoadedFromStorage(true);
        localStorage.setItem('tag-express-active-trajet', activeKey);
    }, []);

    useEffect(() => {
        if (stopsLoaded && loadedFromStorage) {
            console.log('🔄 Pré-chargement de tous les trajets...');

            const activeTrajets = loadedTrajetsRef.current;
            if (!activeTrajets) return;

            ['T1', 'T2', 'T3'].forEach(t => {
                const trajet = activeTrajets[t];
                const hasConfig = trajet && trajet.depName && trajet.arrName;
                console.log(`  T${t.slice(1)}: ${hasConfig ? '✓ Configuré - Recherche...' : '✗ Pas configuré'}`);

                if (hasConfig) {
                    // Vérifier si le cache est valide (< 1 min)
                    const cacheTimestamp = trajetsCacheTimestampRef.current[t];
                    const now = Date.now();
                    const isCacheValid = cacheTimestamp && (now - cacheTimestamp) < 60000;

                    if (isCacheValid) {
                        console.log(`  T${t.slice(1)}: Cache valide, pas de recherche`);
                    } else {
                        console.log(`  T${t.slice(1)}: Cache expiré ou inexistant, recherche...`);
                        search(0, { dep: trajet.depName, arr: trajet.arrName, line: trajet.line, trajetKey: t, save: false });
                    }
                }
            });
        }
    }, [stopsLoaded, loadedFromStorage]);

    useEffect(() => {
        if (!stopsLoaded || !loadedFromStorage) return;

        const interval = setInterval(() => {
            console.log('🔄 Re-recherche automatique toutes les 1 min...');
            const activeTrajets = loadedTrajetsRef.current || trajetsRef.current;
            ['T1', 'T2', 'T3'].forEach(t => {
                const trajet = activeTrajets[t];
                if (trajet?.depName && trajet?.arrName) {
                    search(0, { dep: trajet.depName, arr: trajet.arrName, line: trajet.line, trajetKey: t, save: false });
                }
            });
        }, 60000);

        return () => clearInterval(interval);
    }, [stopsLoaded, loadedFromStorage]);

    useEffect(() => {
        return () => {
            trajetsCacheRef.current = {};
        };
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Charger les icones des lignes depuis le fichier txt
    useEffect(() => {
        const loadLineIcons = async () => {
            try {
                const response = await fetch('/linesicons.txt');
                const text = await response.text();
                const icons = {};

                text.split('\n').forEach(line => {
                    const match = line.match(/^([^:]+):"([^"]+)"/);
                    if (match) {
                        icons[match[1]] = match[2];
                    }
                });

                setLineIcons(icons);
                console.log('Icones chargées:', Object.keys(icons).length);
            } catch (error) {
                console.error('Erreur chargement icones:', error);
            }
        };

        loadLineIcons();
    }, []);

    // Charger les couleurs des lignes depuis l'API
    useEffect(() => {
        const loadLineColors = async () => {
            try {
                const response = await fetch('https://data.mobilites-m.fr/api/routers/default/index/routes');
                const routes = await response.json();
                const colors = {};

                routes.forEach(route => {
                    const shortName = route.shortName?.toUpperCase();
                    if (shortName && route.color) {
                        colors[shortName] = '#' + route.color;
                    }
                });

                setLineColors(colors);
                console.log('Couleurs des lignes chargées:', Object.keys(colors).length);
            } catch (error) {
                console.error('Erreur chargement couleurs des lignes:', error);
            }
        };

        loadLineColors();
    }, []);

    useEffect(() => {
        const urlTrajets = {};
        let hasUrlParams = false;

        ['T1', 'T2', 'T3'].forEach(t => {
            const param = searchParams.get(t);
            if (param) {
                hasUrlParams = true;
                const [line, depId, arrId] = param.split(':');
                if (line && depId && arrId) {
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
                    if (!prev[t] || !prev[t].line) {
                        newTrajets[t] = urlTrajets[t];
                    }
                });
                return newTrajets;
            });
        }
    }, [searchParams, stopsMap]);

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
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

        localStorage.setItem('tag-express-active-trajet', trajetKey);
    };

    const search = async (offset = 0, params = {}) => {
        const depValue = params.dep !== undefined ? params.dep : dep;
        const arrValue = params.arr !== undefined ? params.arr : arr;
        const lineValue = params.line !== undefined ? params.line : line;
        const trajetKey = params.trajetKey || currentTrajet;
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

        const baseTime = searchBaseDate || new Date();
        const now = new Date();
        const anchorTime = baseTime < now ? now : baseTime;
        const queryTime = new Date(anchorTime.getTime() + offset * 60 * 60 * 1000);

        const time = queryTime;
        const urlParams = new URLSearchParams({
            fromPlace: from[0],
            toPlace: to[0],
            arriveBy: 'false',
            time: time.toTimeString().substr(0, 5),
            date: time.toISOString().substr(0, 10),
            routerId: 'default',
            optimize: 'QUICK',
            walkSpeed: '1.1112',
            walkReluctance: '10',
            locale: 'fr',
            mode: 'WALK,TRANSIT',
            showIntermediateStops: 'true',
            minTransferTime: '20',
            transferPenalty: '60',
            numItineraries: '2',
            walkBoardCost: '300',
            bannedAgencies: 'MCO:MC',
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
                .map((it, idx) => {
                    const depTime = new Date(it.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const arrTime = new Date(it.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const duration = Math.round(it.duration / 60);
                    const allLegs = it.legs;
                    const legs = it.legs.filter((l) => l.mode !== 'WALK');

                    if (DEBUG) {
                        console.log(`\n  📋 Itinéraire ${idx + 1}: ${depTime}→${arrTime} (${duration}min)`);
                        console.log(`     Transport legs: ${legs.length}`);

                        allLegs.forEach((leg, legIdx) => {
                            const legDuration = Math.round(leg.duration / 60);

                            if (leg.mode === 'WALK') {
                                if (legDuration > 1) {
                                    console.log(`       🚶 Leg ${legIdx + 1} (MARCHE ${legDuration}min): ${leg.from?.name || '?'} → ${leg.to?.name || '?'}`);
                                }
                            } else {
                                const legLine = leg.routeShortName?.replace('SEM:', '') || leg.route?.replace('SEM:', '') || '?';
                                const fromStop = leg.from?.name || '?';
                                const toStop = leg.to?.name || '?';
                                console.log(`       🚌 Leg ${legIdx + 1} (${legLine}): ${fromStop} → ${toStop}`);

                                if (leg.intermediateStops && leg.intermediateStops.length > 0) {
                                    const intermediateNames = leg.intermediateStops.map(stop => stop.name).join(' → ');
                                    console.log(`          Arrêts intermédiaires: ${intermediateNames}`);
                                }
                            }
                        });
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
                        direction: legs.length > 0 ? legs[legs.length - 1]?.to?.name || '?' : '?',
                        line: lineValue ? lineValue.toUpperCase() : lineKeys[0] || '?',
                        lineKeys,
                        legs: legs,
                        allLegs: allLegs
                    };
                })
                .filter((item) => {
                    if (!lineValue.trim()) return true;
                    const target = lineValue.toUpperCase();
                    const targetPattern = LINE_NAME_MAP[target]?.toUpperCase() || target;
                    return item.lineKeys.some((lk) => lk === target || lk === targetPattern || lk.startsWith(target));
                });

            if (DEBUG) {
                console.log(`✅ Itinéraires filtrés: ${filtered.length}`);
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

            const trajetData = {
                results: filtered,
                error: filtered.length === 0 ? 'Aucun itinéraire trouvé pour ce créneau.' : '',
                timeOffset: offset,
                searchBaseDate: anchorTime
            };
            trajetsCacheRef.current[trajetKey] = trajetData;
            trajetsCacheTimestampRef.current[trajetKey] = Date.now();
            setTrajetResultsMap(prev => ({
                ...prev,
                [trajetKey]: trajetData
            }));

            if (shouldUpdateGlobal) {
                setResults(filtered);
                setTimeOffset(offset);
                setSearchBaseDate(anchorTime);
                setInputsOpen(false);
            }
        } catch (err) {
            const errorMsg = 'Erreur réseau / API : ' + (err.message || err);
            if (shouldUpdateGlobal) {
                setError(errorMsg);
                setResults([]);
            }

            const trajetErrorData = {
                results: [],
                error: errorMsg,
                timeOffset: 0,
                searchBaseDate: anchorTime
            };
            trajetsCacheRef.current[trajetKey] = trajetErrorData;
            trajetsCacheTimestampRef.current[trajetKey] = Date.now();
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

    const openJourneyDetails = (item) => {
        setSelectedJourney(item);
        setJourneyDetailsOpen(false);
        setMenuOpen(false);
        setInputsOpen(false);
    };

    const closeJourneyDetails = () => {
        setJourneyDetailsOpen(false);
        setTimeout(() => setSelectedJourney(null), 300);
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
        setSelectedJourney(null);
        setJourneyDetailsOpen(false);
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

    const getMinutesUntil = (timeStr, now = new Date()) => {
        if (!timeStr) return -Infinity;
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return -Infinity;
        const hours = Number(match[1]);
        const mins = Number(match[2]);
        if (Number.isNaN(hours) || Number.isNaN(mins)) return -Infinity;

        const target = new Date(now);
        target.setHours(hours, mins, 0, 0);
        return (target - now) / 60000;
    };

    const formatTimeUntil = (timeStr, now = new Date()) => {
        const diffMinutes = getMinutesUntil(timeStr, now);

        if (diffMinutes < 1) return `À l'approche`;

        const diffHours = Math.floor(diffMinutes / 60);
        const diffMins = Math.floor(diffMinutes % 60);

        if (diffHours > 0 && diffMins > 0) return `dans ${diffHours}h${diffMins}`;
        if (diffHours > 0) return `dans ${diffHours} h`;
        return `dans ${Math.floor(diffMinutes)} min`;
    };

    const origin = new Date((searchBaseDate || new Date()).getTime() + timeOffset * 60 * 60 * 1000);
    const afterDate = new Date(origin.getTime() + 60 * 60 * 1000);
    const afterLabel = `après ${afterDate.toTimeString().slice(0, 5)}`;

    const selectedFirstLine = selectedJourney ? ((selectedJourney.legs?.[0]?.routeShortName || selectedJourney.legs?.[0]?.route || selectedJourney.legs?.[0]?.routeId || selectedJourney.line || '?').replace('SEM:', '').toUpperCase()) : '';
    const selectedLastLine = selectedJourney ? ((selectedJourney.legs?.[selectedJourney.legs.length - 1]?.routeShortName || selectedJourney.legs?.[selectedJourney.legs.length - 1]?.route || selectedJourney.legs?.[selectedJourney.legs.length - 1]?.routeId || selectedJourney.line || '?').replace('SEM:', '').toUpperCase()) : '';
    const selectedTransferStop = selectedJourney?.legs?.length > 1 ? selectedJourney.legs[0]?.to?.name : '';
    const selectedConnectionLine = selectedJourney?.legs?.[1] ? ((selectedJourney.legs[1]?.routeShortName || selectedJourney.legs[1]?.route || selectedJourney.legs[1]?.routeId || '').replace('SEM:', '').toUpperCase()) : '';
    const selectedWalkLeg = selectedJourney?.allLegs?.find((l) => l.mode === 'WALK');
    const selectedConnectionDuration = selectedWalkLeg ? `${Math.max(1, Math.round(selectedWalkLeg.duration / 60))} min` : '1 min';

    return (
        <>
            <Navbar title="Mes trajets (Test)" menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMenuOpen={() => setInputsOpen(false)} />
            <div className="min-h-screen relative bg-[#F8FAFC] pb-24">
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

                <div className="m-4 p-4 rounded-lg border border-gray-300 bg-white shadow-xl">
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
                        <div className="mb-3 p-4 bg-white border border-gray-200 rounded-2xl shadow-md relative">
                            <div className="flex items-start justify-between gap-3 mb-5">
                                <div>
                                    <div className="text-lFg font-bold text-gray-900 mt-1">
                                        <span>{dep}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5 inline mx-2 align-text-bottom">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                        </svg>
                                        <span>{arr}</span>
                                    </div>
                                    <div className="mt-1 text-sm text-gray-600">{results[0]?.direction}</div>
                                </div>
                            </div>
                            <div className="absolute bottom-4 right-4 flex items-center gap-1">
                                {(() => {
                                    // Récupérer toutes les lignes uniques de tous les résultats
                                    const allUniqueLines = Array.from(new Set(results.flatMap(r => r.lineKeys || [])));
                                    return allUniqueLines.map((lk) => (
                                        <LineIcon key={lk} lineKey={lk} size="w-6 h-6" />
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="mt-4 mb-4 text-left flex items-center gap-2">
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

                    {/* Affichage des résultats sous forme de bulles compactes */}
                    <div className="space-y-2">
                        {results.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                {loading ? 'Recherche en cours...' : 'Aucun résultat. Lancez la recherche.'}
                            </div>
                        ) : (
                            results.filter(item => getMinutesUntil(item.dep, currentTime) >= 0).map((item, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => openJourneyDetails(item)}
                                    className="w-full text-left flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-3xl shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    {/* Icone de ligne - correspondance en diagonale si plusieurs lignes */}
                                    <div className="w-14 h-14 relative flex-shrink-0">
                                        {item.lineKeys && item.lineKeys.length > 1 ? (
                                            item.lineKeys.slice(0, 2).map((lk, i) => {
                                                const positionClass = i === 0 ? 'top-0 left-0' : 'bottom-0 right-0';
                                                return (
                                                    <div
                                                        key={`${lk}-${i}`}
                                                        className={`absolute ${positionClass}`}
                                                        style={{ transform: i === 0 ? 'translate(-10%, -10%)' : 'translate(10%, 10%)' }}
                                                    >
                                                        <LineIcon lineKey={lk} size="w-8 h-8" />
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="w-14 h-14 flex items-center justify-center">
                                                <LineIcon lineKey={item.line} size="w-12 h-12" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Séparateur */}
                                    <div className="w-px h-14 bg-gray-300"></div>

                                    {/* Arrivée - à gauche */}
                                    <div className="flex-1 text-left">
                                        <div className="text-xl font-bold text-gray-900">{item.arr}</div>
                                        <div className="text-sm text-gray-500">{formatTimeUntil(item.dep, currentTime)}</div>
                                    </div>

                                    {/* Départ - à droite */}
                                    <div className="flex-1 text-right pr-3">
                                        <div className="text-xl font-bold text-gray-900">{item.dep}</div>
                                        <div className="text-sm text-gray-500">{item.dur}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className={`mt-4 flex items-center gap-2 ${(results.length > 0 && timeOffset >= 0) ? 'justify-between' : 'justify-end'}`}>
                        {timeOffset >= 0 && results.length > 0 && (
                            <button
                                className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700 cursor-pointer"
                                onClick={handleSubtractOneHour}
                                disabled={loading}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 transform scale-x-[-1]">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                            </button>
                        )}
                        {results.length > 0 && (
                            <button
                                className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700 cursor-pointer"
                                onClick={handleAddOneHour}
                                disabled={loading}
                            >
                                rechercher pour {afterLabel}
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 inline ml-1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {!inputsOpen && !selectedJourney && (
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-100 border-t border-gray-300 p-2 shadow-md">
                        <button
                            className="w-full py-3 bg-blue-600 text-white rounded-t-lg"
                            onClick={() => { setInputsOpen(true); setMenuOpen(false); }}
                        >
                            ^ Ouvrir la recherche
                        </button>
                    </div>
                )}

                {selectedJourney && (
                    <>
                        <div className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${journeyDetailsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={closeJourneyDetails} />
                        <div className={`${journeyDetailsOpen ? 'translate-y-0' : 'translate-y-full'} fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl transition-transform duration-300`}>
                            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-300" />
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Détails du trajet</p>
                                    <h2 className="text-xl font-bold text-slate-900">{selectedJourney.depName} → {selectedJourney.arrName}</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeJourneyDetails}
                                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="mt-4 flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4">
                                {/* Arrivée - à gauche */}
                                <div className="flex-1 text-left">
                                    <p className="text-xl font-bold text-slate-900">{selectedJourney.arr}</p>
                                    <p className="text-sm text-slate-500">{formatTimeUntil(selectedJourney.dep, currentTime)}</p>
                                </div>

                                {/* Séparateur */}
                                <div className="w-px h-12 bg-slate-300"></div>

                                {/* Départ - à droite */}
                                <div className="flex-1 text-right pr-3">
                                    <p className="text-xl font-bold text-slate-900">{selectedJourney.dep}</p>
                                    <p className="text-sm text-slate-500">{selectedJourney.dur}</p>
                                </div>
                            </div>

                            <div className="mt-5 rounded-[2rem] bg-white p-6 shadow-sm">
                                <div className="relative">
                                    {/* Ligne verticale partant de la première icone jusqu'à la prochaine étape */}
                                    {selectedJourney.legs?.length > 1 && (
                                        <div className="absolute w-1 flex-shrink-0" style={{
                                            left: '19px',
                                            top: '20px',
                                            height: 'calc(100% - 40px)',
                                            backgroundColor: lineColors[selectedFirstLine] || '#8B5CF6'
                                        }} />
                                    )}

                                    {/* Départ */}
                                    <div className="relative mb-8 flex gap-4">
                                        <div className="flex flex-col items-center justify-center w-10">
                                            {selectedFirstLine && lineIcons[selectedFirstLine] ? (
                                                <img
                                                    src={lineIcons[selectedFirstLine]}
                                                    alt={selectedFirstLine}
                                                    className="h-10 w-10 object-contain flex-shrink-0"
                                                />
                                            ) : (
                                                <span className="text-2xl font-bold flex-shrink-0" style={{ color: lineColors[selectedFirstLine] || '#8B5CF6' }}>{selectedFirstLine}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 py-2">
                                            <p className="text-base font-bold text-slate-900">{selectedJourney.depName}</p>
                                            <p className="text-sm text-slate-500">Départ</p>
                                            <p className="text-xs text-slate-400 mt-1">{selectedJourney.dep}</p>
                                        </div>
                                    </div>

                                    {/* Étape intermédiaire */}
                                    {selectedJourney.legs?.length > 1 && (
                                        <div className="relative mb-8 flex gap-4">
                                            <div className="flex flex-col items-center justify-center w-10">
                                                <div className="h-6 w-6 rounded-full flex-shrink-0" style={{ backgroundColor: lineColors[selectedConnectionLine] || lineColors[selectedFirstLine] || '#8B5CF6' }} />
                                            </div>
                                            <div className="flex-1 py-2">
                                                <p className="text-sm font-bold text-slate-900">{selectedTransferStop}</p>
                                                <p className="text-xs text-slate-500">Correspondance</p>
                                                <p className="text-xs text-slate-400 mt-1">{selectedConnectionDuration}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Icône marche */}
                                    {selectedJourney.legs?.length > 1 && (
                                        <div className="relative mb-8 flex gap-4">
                                            <div className="flex flex-col items-center justify-center w-10">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-slate-400 flex-shrink-0">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 12c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 18c-.5-1-1-3-1-4 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1-1 3-1 4" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 py-2">
                                                <p className="text-xs text-slate-400">{selectedConnectionDuration}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Arrivée */}
                                    <div className="relative flex gap-4">
                                        <div className="flex flex-col items-center justify-center w-10">
                                            {selectedLastLine && lineIcons[selectedLastLine] ? (
                                                <img
                                                    src={lineIcons[selectedLastLine]}
                                                    alt={selectedLastLine}
                                                    className="h-10 w-10 object-contain flex-shrink-0"
                                                />
                                            ) : (
                                                <span className="text-2xl font-bold flex-shrink-0" style={{ color: lineColors[selectedLastLine] || '#10B981' }}>{selectedLastLine}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 py-2">
                                            <p className="text-base font-bold text-slate-900">{selectedJourney.arrName}</p>
                                            <p className="text-sm text-slate-500">Arrivée</p>
                                            <p className="text-xs text-slate-400 mt-1">{selectedJourney.arr}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div className={`mt-4 ${inputsOpen ? 'translate-y-0' : 'translate-y-full'} fixed bottom-0 left-0 right-0 z-20 border-t border-gray-300 bg-white p-4 shadow-xl transition-transform duration-300 sm:relative sm:translate-y-0 sm:border-none sm:shadow-none sm:p-0`}>
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
