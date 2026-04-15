import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './navbar.jsx';
import LineIcon, { LINE_COLORS } from './lines-icons.jsx';

const formatDuration = (temps) => {
    if (temps > 59) {
        const hours = Math.floor(temps / 60);
        const minutes = temps % 60;
        return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}`;
    }
    return `${temps} min`;
};

export default function FastResearch() {
    const [stopsMap, setStopsMap] = useState({});
    const [stopsLoaded, setStopsLoaded] = useState(false);

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
    const [inputsOpen, setInputsOpen] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedJourney, setSelectedJourney] = useState(null);
    const [journeyDetailsOpen, setJourneyDetailsOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [lineColors, setLineColors] = useState({});
    const [settings, setSettings] = useState({ wheelchair: false, walkSpeed: 1.4, numItineraries: 5 });
    const settingsOpenRef = useRef(false);
    const initialValuesRef = useRef({ dep: '', arr: '', line: '' });
    const inputsOpenRef = useRef(inputsOpen);

    const DEBUG = false;

    const CACHE_KEY = 'tag-express-fast-research-cache';
    const CACHE_DURATION = 60000; // 1 min

    useEffect(() => {
        try {
            const saved = sessionStorage.getItem(CACHE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                const age = Date.now() - parsed.timestamp;
                if (age < CACHE_DURATION) {
                    setDep(parsed.dep);
                    setArr(parsed.arr);
                    setLine(parsed.line);
                    setResults(parsed.results);
                    setTimeOffset(parsed.timeOffset);
                    setSearchBaseDate(new Date(parsed.searchBaseDate));
                    setInputsOpen(false);
                } else {
                    sessionStorage.removeItem(CACHE_KEY);
                }
            }
        } catch (e) {
            console.error('Erreur chargement cache fast-research:', e);
        }
    }, []);

    // Sauvegarder les valeurs initiales quand on ouvre le panneau
    useEffect(() => {
        if (inputsOpen && !inputsOpenRef.current) {
            // On vient d'ouvrir le panneau
            initialValuesRef.current = { dep, arr, line };
        }
        inputsOpenRef.current = inputsOpen;
    }, [inputsOpen, dep, arr, line]);

    // Charger les settings depuis localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('tag-express-settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                setSettings({
                    wheelchair: parsed.wheelchair ?? false,
                    walkSpeed: parsed.walkSpeed ?? 1.4,
                    numItineraries: parsed.numItineraries ?? 5
                });
            }
        } catch (e) {
            console.error('Erreur chargement settings:', e);
        }
    }, []);

    useEffect(() => {
        if (selectedJourney) {
            requestAnimationFrame(() => setJourneyDetailsOpen(true));
        }
    }, [selectedJourney]);

    // Vider les résultats quand les settings sont fermés (forcer la re-recherche)
    useEffect(() => {
        if (settingsOpenRef.current && !settingsOpen && results.length > 0) {
            setResults([]);
        }
        settingsOpenRef.current = settingsOpen;
    }, [settingsOpen]);

    useEffect(() => {
        const fetchStops = async () => {
            try {
                const routesResp = await fetch('https://data.mobilites-m.fr/api/routers/default/index/routes');
                const routes = await routesResp.json();
                const semLines = routes
                    .map((route) => route.id)
                    .filter((id) => id?.startsWith('SEM:'))
                    .map((id) => id.replace('SEM:', ''));

                const newMap = {};

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
                setStopsMap({});
                setStopsLoaded(true);
            }
        };

        fetchStops();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

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
            } catch (error) {
                console.error('Erreur chargement couleurs des lignes:', error);
            }
        };
        loadLineColors();
    }, []);

    const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const findStop = (query) => {
        if (!query || !query.trim()) return null;
        const key = removeAccents(query.trim().toLowerCase());
        for (const [k, v] of Object.entries(stopsMap)) {
            if (removeAccents(k) === key) return v;
        }
        for (const [k, v] of Object.entries(stopsMap)) {
            const normalizedK = removeAccents(k);
            if (normalizedK.includes(key) || key.includes(normalizedK)) return v;
        }
        return null;
    };

    const suggestionsFor = (value) => {
        if (!value.trim()) return [];
        const q = removeAccents(value.trim().toLowerCase());

        // Si c'est une correspondance EXACTE ET pas d'espace à la fin, pas de suggestions
        if (value === value.trim()) {
            for (const [k, v] of Object.entries(stopsMap)) {
                if (removeAccents(k) === q) {
                    return [];
                }
            }
        }

        return Object.keys(stopsMap)
            .filter((k) => removeAccents(k).includes(q))
            .filter((k) => removeAccents(stopsMap[k][1].toLowerCase()) !== q)
            .slice(0, 10)
            .map((k) => stopsMap[k][1]);
    };

    useEffect(() => { setDepSuggestions(suggestionsFor(dep)); }, [dep, stopsMap]);
    useEffect(() => { setArrSuggestions(suggestionsFor(arr)); }, [arr, stopsMap]);

    const search = async (offset = 0) => {
        setError('');
        setLoading(true);

        const from = findStop(dep);
        const to = findStop(arr);

        if (!from) { setError(`Arrêt de départ '${dep}' non trouvé.`); setLoading(false); return; }
        if (!to) { setError(`Arrêt d'arrivée '${arr}' non trouvé.`); setLoading(false); return; }

        const baseTime = searchBaseDate || new Date();
        const now = new Date();
        const anchorTime = baseTime < now ? now : baseTime;
        const queryTime = new Date(anchorTime.getTime() + offset * 60 * 60 * 1000);

        const urlParams = new URLSearchParams({
            fromPlace: from[0],
            toPlace: to[0],
            arriveBy: 'false',
            time: queryTime.toTimeString().substr(0, 5),
            date: queryTime.toISOString().substr(0, 10),
            routerId: 'default',
            optimize: 'QUICK',
            walkSpeed: String(settings.walkSpeed || 1.4),
            walkReluctance: '10',
            locale: 'fr',
            mode: 'WALK,TRANSIT',
            showIntermediateStops: 'true',
            minTransferTime: '20',
            transferPenalty: '60',
            numItineraries: String(settings.numItineraries || 5),
            walkBoardCost: '300',
            bannedAgencies: 'MCO:MC',
            wheelchair: settings.wheelchair,
        });

        try {
            const res = await fetch(`https://data.mobilites-m.fr/api/routers/default/plan?${urlParams.toString()}`);
            const json = await res.json();
            const itineraries = json.plan?.itineraries || [];

            const filtered = itineraries.map((it) => {
                const depTime = new Date(it.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const arrTime = new Date(it.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const duration = Math.round(it.duration / 60);
                const allLegs = it.legs;
                const legs = it.legs.filter((l) => l.mode !== 'WALK');

                const lineKeys = legs.map((leg) => {
                    const routeShortName = (leg.routeShortName || '').replace('SEM:', '').toUpperCase();
                    const route = (leg.route || '').replace('SEM:', '').toUpperCase();
                    const routeId = (leg.routeId || '').replace('SEM:', '').toUpperCase();
                    return routeShortName || route || routeId || '?';
                });

                return {
                    dep: depTime,
                    arr: arrTime,
                    depName: from[1],
                    arrName: to[1],
                    dur: formatDuration(duration),
                    direction: legs.length > 0 ? legs[legs.length - 1]?.to?.name || '?' : '?',
                    line: line ? line.toUpperCase() : lineKeys[0] || '?',
                    lineKeys,
                    legs,
                    allLegs,
                };
            }).filter((item) => {
                if (!line.trim()) return true;
                const target = line.toUpperCase();
                return item.lineKeys.some((lk) => lk === target || lk.startsWith(target));
            });

            if (filtered.length === 0) {
                setError('Aucun itinéraire trouvé pour ce créneau.');
            } else {
                setError('');
            }

            setResults(filtered);
            setTimeOffset(offset);
            setSearchBaseDate(anchorTime);
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                dep, arr, line,
                results: filtered,
                timeOffset: offset,
                searchBaseDate: anchorTime.toISOString(),
                timestamp: Date.now()
            }));
            setInputsOpen(false);
        } catch (err) {
            setError('Erreur réseau / API : ' + (err.message || err));
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddOneHour = () => search(timeOffset + 0.5);
    const handleSubtractOneHour = () => search(timeOffset - 0.5);
    const handleRefresh = () => search(timeOffset);

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
        sessionStorage.removeItem(CACHE_KEY);
    };

    const selectSuggestion = (value, target) => {
        if (target === 'dep') { setDep(value); setDepSuggestions([]); }
        else { setArr(value); setArrSuggestions([]); }
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
    const afterDate = new Date(origin.getTime() + 30 * 60 * 1000);
    const afterLabel = `après ${afterDate.toTimeString().slice(0, 5)}`;


    const cancel = () => {
        setDep(initialValuesRef.current.dep);
        setArr(initialValuesRef.current.arr);
        setLine(initialValuesRef.current.line);
        setInputsOpen(false);
    };

    const openMenu = () => { setInputsOpen(false); setSettingsOpen(false); setMenuOpen(true); };
    const openSettings = () => { setMenuOpen(false); setInputsOpen(false); setSettingsOpen(true); };
    const openInputs = () => { setMenuOpen(false); setSettingsOpen(false); setInputsOpen(true); };

    return (
        <>
            <Navbar title="mes trajets" menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMenuOpen={openMenu} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} onSettingsOpen={openSettings} />
            <div className="min-h-screen relative bg-[#F8FAFC] pb-24">

                <div className="m-4 p-4 rounded-lg border border-gray-300 bg-white shadow-xl">
                    <div className="flex justify-between items-center mb-3">
                        <h1 className="text-2xl font-bold">Recherche rapide</h1>
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
                                </div>
                            </div>
                            <div className="bottom-4 right-4 flex items-center gap-[0.4rem] mt-2">
                                {Array.from(new Set(results.flatMap(r => r.lineKeys || []))).map((lk) => (
                                    <LineIcon key={lk} lineKey={lk} size="w-6 h-6" />
                                ))}
                            </div>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="mt-4 mb-4 text-left flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                                Résultats pour {new Date(searchBaseDate.getTime() + timeOffset * 60 * 60 * 1000).toTimeString().slice(0, 5)}
                            </span>
                            <button onClick={handleRefresh} disabled={loading} className="ml-auto text-gray-600 hover:text-gray-900 transition-colors" title="Rafraîchir">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                        </div>
                    )}

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
                                    <div className="w-14 h-14 relative flex-shrink-0">
                                        {item.lineKeys && item.lineKeys.length > 1 ? (
                                            item.lineKeys.slice(0, 2).map((lk, i) => (
                                                <div key={`${lk}-${i}`} className={`absolute ${i === 0 ? 'top-0 left-0' : 'bottom-0 right-0'}`} style={{ transform: i === 0 ? 'translate(-10%, -10%)' : 'translate(10%, 10%)' }}>
                                                    <LineIcon lineKey={lk} size="w-8 h-8" />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="w-14 h-14 flex items-center justify-center">
                                                <LineIcon lineKey={item.line} size="w-12 h-12" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-px h-14 bg-gray-300"></div>
                                    <div className="flex-1 text-left">
                                        <div className="text-xl font-bold text-gray-900">{item.dep}</div>
                                        <div className="text-sm text-gray-500">{formatTimeUntil(item.dep, currentTime)}</div>
                                    </div>
                                    <div className="flex-1 text-right pr-3">
                                        <div className="text-xl font-bold text-gray-900">{item.arr}</div>
                                        <div className="text-sm text-gray-500">{item.dur}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className={`mt-4 flex items-center gap-2 ${(results.length > 0 && timeOffset >= 0) ? 'justify-between' : 'justify-end'}`}>
                        {timeOffset >= 0 && results.length > 0 && (
                            <button className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700 cursor-pointer" onClick={handleSubtractOneHour} disabled={loading}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 transform scale-x-[-1]">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                            </button>
                        )}
                        {results.length > 0 && (
                            <button className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700 cursor-pointer" onClick={handleAddOneHour} disabled={loading}>
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
                        <button className="w-full py-3 bg-blue-600 text-white rounded-t-lg" onClick={openInputs}>
                            ^ Ouvrir la recherche
                        </button>
                    </div>
                )}

                {selectedJourney && (
                    <>
                        <div className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${journeyDetailsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={closeJourneyDetails} />
                        <div className={`${journeyDetailsOpen ? 'translate-y-0' : 'translate-y-full'} fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl transition-transform duration-300`}>
                            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-200" />
                            <button
                                type="button"
                                onClick={closeJourneyDetails}
                                className="text-black font-semibold text-lg absolute top-4 right-4 transition-opacity hover:opacity-70"
                            >
                                ×
                            </button>

                            {/* Header départ → arrivée */}
                            <div className="mb-2">
                                <p className="text-xs uppercase tracking-widest text-slate-400">Détails du trajet</p>
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>{selectedJourney.depName}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                    </svg>
                                    <span>{selectedJourney.arrName}</span>
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">{selectedJourney.direction}</p>
                            </div>

                            {/* Résumé horaires */}
                            <div className="flex items-center gap-4 mb-5 p-3 rounded-2xl bg-slate">
                                <div>
                                    <p className="text-xl font-bold">{selectedJourney.dep}</p>
                                    <p className="text-xs text-slate-600">{formatTimeUntil(selectedJourney.dep, currentTime)}</p>
                                </div>
                                <div className="flex-1 border-t border-dashed border-slate-500" />
                                <p className="text-sm text-slate-600">{selectedJourney.dur}</p>
                                <div className="flex-1 border-t border-dashed border-slate-500" />
                                <div className="text-right">
                                    <p className="text-xl font-bold">{selectedJourney.arr}</p>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="relative">
                                {(() => {
                                    // Par :
                                    const allLegs = (selectedJourney.allLegs || []).filter((leg, i, arr) => {
                                        if (leg.mode !== 'WALK') return true;
                                        const isFirst = arr.slice(0, i).every(l => l.mode === 'WALK');
                                        return !isFirst;
                                    });
                                    const items = [];
                                    let prevWasTransit = false;

                                    allLegs.forEach((leg, i) => {
                                        const isWalk = leg.mode === 'WALK';
                                        const isTransit = !isWalk;
                                        const lineName = (leg.routeShortName || leg.route || leg.routeId || '').replace('SEM:', '').toUpperCase();
                                        if (DEBUG) {
                                            console.log('lineName:', lineName, '→ color:', lineColors[lineName]);
                                        }
                                        const color = LINE_COLORS[lineName] || lineColors[lineName] || '#6B7280';
                                        const durationMin = Math.round(leg.duration / 60);

                                        if (isTransit) {
                                            // Arrêt de départ du leg (= correspondance si pas le premier)
                                            items.push(
                                                <div key={`transit-start-${i}`} className="flex gap-3 items-start mb-0">
                                                    <div className="flex flex-col items-center w-8 flex-shrink-0">
                                                        <LineIcon lineKey={lineName} size="w-8 h-8" />
                                                        <div className="w-1 flex-1 min-h-[2rem]" style={{ backgroundColor: color }} />
                                                    </div>
                                                    <div className="flex items-start gap-2 flex-1">
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-sm text-slate-900 leading-tight">{leg.from?.name?.replace(/^[^,]+,\s*/, '')}</p>
                                                            <p className="text-[12.5px] text-slate-600">{new Date(leg.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );

                                            // Barre de ligne avec durée + nb arrêts
                                            const stopCount = (leg.intermediateStops?.length || 0) + 1;
                                            items.push(
                                                <div key={`transit-bar-${i}`} className="flex gap-3 mb-0" style={{ minHeight: '3rem' }}>
                                                    <div className="flex flex-col items-center w-8 flex-shrink-0">
                                                        <div className="w-1 flex-1" style={{ backgroundColor: color }} />
                                                    </div>
                                                    <div className="flex items-center mb-7">
                                                        <p className="text-[12.5px] text-slate-600">{formatDuration(durationMin)} · {stopCount} arrêt{stopCount > 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                            );

                                            // Arrêt d'arrivée du leg
                                            items.push(
                                                <div key={`transit-end-${i}`} className="flex gap-3 items-start mb-0">
                                                    <div className="flex flex-col items-center w-8 flex-shrink-0">
                                                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-sm text-slate-900 leading-tight">{leg.to?.name?.replace(/^[^,]+,\s*/, '')}</p>
                                                        <p className="text-[12.5px] text-slate-600">{new Date(leg.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                            );

                                            prevWasTransit = true;
                                        }

                                        if (isWalk && durationMin >= 1) {
                                            // Marche entre deux transits = correspondance
                                            items.push(
                                                <div key={`walk-${i}`} className="flex gap-3 items-center">
                                                    <div className="flex flex-col items-center w-8 flex-shrink-0">
                                                        <div className="border-l-2 border-dashed border-slate-300" style={{ height: '28px', marginTop: '-10px' }} />
                                                        <img src="/walk.svg" alt="marche" className="w-5 h-5 opacity-60 flex-shrink-0 my-3" />
                                                        {i !== allLegs.length - 1 && (
                                                            <div className="border-l-2 border-dashed border-slate-300" style={{ height: '28px', marginBottom: '12px' }} />
                                                        )}
                                                    </div>
                                                    <p className="text-[13px] text-slate-600 mb-5">À pied · {formatDuration(durationMin)}</p>
                                                </div>
                                            );
                                        }
                                    });

                                    return items;
                                })()}
                            </div>
                        </div>
                    </>
                )}

                <div className={`mt-4 ${inputsOpen ? 'translate-y-0' : 'translate-y-full'} fixed bottom-0 left-0 right-0 z-20 border-t border-gray-300 bg-white p-4 shadow-xl transition-transform duration-300`}>
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold">Recherche</span>
                        <button className="text-gray-600" onClick={() => inputsOpen ? cancel() : openInputs()}>
                            {inputsOpen ? 'v Cacher' : '^ Ouvrir'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1 relative">
                            <span>Départ</span>
                            <input value={dep} onChange={(e) => setDep(e.target.value)} className="w-full border p-2 rounded" placeholder="ex: Victor Hugo" />
                            {dep && computedSuggestions.length > 0 && (
                                <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded bg-white max-h-40 overflow-y-auto shadow-lg">
                                    {computedSuggestions.map((s, i) => (
                                        <li key={i} className="px-2 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => selectSuggestion(s, 'dep')}>{s}</li>
                                    ))}
                                </ul>
                            )}
                        </label>

                        <label className="space-y-1 relative">
                            <span>Arrivée</span>
                            <input value={arr} onChange={(e) => setArr(e.target.value)} className="w-full border p-2 rounded" placeholder="ex: Alsace Lorraine" />
                            {arr && arrSuggestions.length > 0 && (
                                <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded bg-white max-h-40 overflow-y-auto shadow-lg">
                                    {arrSuggestions.map((s, i) => (
                                        <li key={i} className="px-2 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => selectSuggestion(s, 'arr')}>{s}</li>
                                    ))}
                                </ul>
                            )}
                        </label>

                        <label className="space-y-1 sm:col-span-2">
                            <span>Ligne (optionnel)</span>
                            <input value={line} onChange={(e) => setLine(e.target.value)} className="w-full border p-2 rounded" placeholder="ex: E, A, C1..." />
                        </label>
                    </div>

                    <div className="space-y-2 mt-4 flex flex-col items-stretch">
                        <button onClick={() => search(0)} disabled={loading} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg">
                            {loading ? 'Recherche...' : 'Rechercher'}
                        </button>
                        <button onClick={reset} className="w-full px-4 py-3 bg-gray-300 text-black rounded-lg">
                            Réinitialiser
                        </button>
                    </div>

                    <button onClick={cancel} type="button" className="mt-4 w-full text-center text-gray-600">
                        Annuler
                    </button>
                </div>
            </div>
        </>
    );
}