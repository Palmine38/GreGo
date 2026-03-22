import { useEffect, useMemo, useRef, useState } from 'react';
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
    const [currentTrajet, setCurrentTrajet] = useState('T1');
    const [trajets, setTrajets] = useState({
        T1: { ...DEFAULT_TRAJET },
        T2: { ...DEFAULT_TRAJET },
        T3: { ...DEFAULT_TRAJET }
    });

    // Permet d'éviter d'exécuter le chargement deux fois en mode strict
    const hasLoadedRef = useRef(false);

    // Cache des résultats de recherche par trajet
    const [searchCache, setSearchCache] = useState({
        T1: { results: [], timeOffset: 0, searchBaseDate: new Date(), error: '' },
        T2: { results: [], timeOffset: 0, searchBaseDate: new Date(), error: '' },
        T3: { results: [], timeOffset: 0, searchBaseDate: new Date(), error: '' }
    });

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
    const [inputsOpen, setInputsOpen] = useState(true);
    const [saveStatus, setSaveStatus] = useState(''); // '', 'saved', 'saved-idle'
    const [menuOpen, setMenuOpen] = useState(false);

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
        const savedCache = localStorage.getItem('tag-express-cache');

        console.log('Chargement localStorage:', { savedTrajets, savedCache });

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

        if (savedCache) {
            try {
                const parsed = JSON.parse(savedCache);
                // Restaurer les dates depuis les strings JSON
                const restoredCache = {};
                Object.keys(parsed).forEach(key => {
                    restoredCache[key] = {
                        ...parsed[key],
                        searchBaseDate: parsed[key].searchBaseDate ? new Date(parsed[key].searchBaseDate) : new Date()
                    };
                });
                console.log('Cache chargé:', restoredCache);
                setSearchCache(restoredCache);

                if (restoredCache[activeKey]) {
                    setResults(restoredCache[activeKey].results || []);
                    setTimeOffset(restoredCache[activeKey].timeOffset || 0);
                    setSearchBaseDate(restoredCache[activeKey].searchBaseDate || new Date());
                    setError(restoredCache[activeKey].error || '');
                }
            } catch (e) {
                console.error('Erreur chargement localStorage cache:', e);
            }
        }

        localStorage.setItem('tag-express-active-trajet', activeKey);
    }, []);

    // Pre-search for all configured trajets once stops and trajets are loaded
    useEffect(() => {
        if (stopsLoaded && hasLoadedRef.current) {
            ['T1', 'T2', 'T3'].forEach(t => {
                if (trajets[t] && trajets[t].depName && trajets[t].arrName) {
                    search(0, { dep: trajets[t].depName, arr: trajets[t].arrName, line: trajets[t].line, trajetKey: t, save: false });
                }
            });
        }
    }, [stopsLoaded, trajets]);

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
            setTrajets(prev => ({ ...prev, ...urlTrajets }));
        }
    }, [searchParams, stopsMap]);

    // Sauvegarder dans localStorage à chaque changement
    useEffect(() => {
        localStorage.setItem('tag-express-trajets', JSON.stringify(trajets));
    }, [trajets]);

    // (effect supprimé) on gère le trajet actif dans le premier useEffect de chargement

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
        const cache = searchCache[trajetKey];
        const isCacheValid = cache?.searchBaseDate && new Date().toDateString() === cache.searchBaseDate.toDateString();
        setCurrentTrajet(trajetKey);
        setDep(trajet.depName || '');
        setArr(trajet.arrName || '');
        setLine(trajet.line || '');
        setResults(isCacheValid ? cache?.results || [] : []);
        setError(isCacheValid ? cache?.error || '' : '');
        setTimeOffset(isCacheValid ? cache?.timeOffset || 0 : 0);
        setSearchBaseDate(isCacheValid ? cache?.searchBaseDate || new Date() : new Date());
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
        const time = new Date(baseTime.getTime() + offset * 60 * 60 * 1000);

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

            const filtered = itineraries
                .filter((it) => it.duration / 60 <= 35)
                .map((it) => {
                    const depTime = new Date(it.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const arrTime = new Date(it.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
                        dur: `${Math.round(it.duration / 60)} min`,
                        direct: legs.length <= 1,
                        direction: legs[0]?.headsign || legs[0]?.to?.name || '?',
                        line: lineValue ? lineValue.toUpperCase() : lineKeys[0] || '?',
                        lineKeys,
                    };
                })
                .filter((item) => {
                    if (!lineValue.trim()) return true;
                    const target = lineValue.toUpperCase();
                    const targetPattern = LINE_NAME_MAP[target]?.toUpperCase() || target;
                    return item.lineKeys.some((lk) => lk === target || lk === targetPattern || lk.startsWith(target));
                });

            if (filtered.length === 0) {
                if (shouldUpdateGlobal) {
                    setError('⚠️ Aucun itinéraire trouvé pour ce créneau.');
                }
            } else {
                if (shouldUpdateGlobal) {
                    setError('');
                }
            }

            if (shouldUpdateGlobal) {
                setResults(filtered);
                setTimeOffset(offset);
                setSearchBaseDate(baseTime);
                setInputsOpen(false);
            }

            // Sauvegarder dans le cache
            setSearchCache(prev => ({
                ...prev,
                [trajetKey]: {
                    results: filtered,
                    timeOffset: offset,
                    searchBaseDate: baseTime,
                    error: filtered.length === 0 ? '⚠️ Aucun itinéraire trouvé pour ce créneau.' : ''
                }
            }));
        } catch (err) {
            const errorMsg = 'Erreur réseau / API : ' + (err.message || err);
            if (shouldUpdateGlobal) {
                setError(errorMsg);
                setResults([]);
            }

            // Sauvegarder erreur dans le cache
            setSearchCache(prev => ({
                ...prev,
                [trajetKey]: {
                    results: [],
                    timeOffset: 0,
                    searchBaseDate: new Date(),
                    error: errorMsg
                }
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

    const reset = () => {
        setDep('');
        setArr('');
        setLine('');
        setResults([]);
        setTimeOffset(0);
        setError('');
        setInputsOpen(true);
        setMenuOpen(false);

        // Effacer le cache du trajet courant
        setSearchCache(prev => ({
            ...prev,
            [currentTrajet]: {
                results: [],
                timeOffset: 0,
                searchBaseDate: new Date(),
                error: ''
            }
        }));
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
                            <span className="text-lg font-semibold text-black">{dep} → {arr}</span>
                            <div className="text-xs text-gray-600 mt-1">{results[0].direction}</div>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="mt-4 mb-2 text-left">
                            <span className="text-sm text-gray-600">
                                Résultats pour {new Date(searchBaseDate.getTime() + timeOffset * 60 * 60 * 1000).toTimeString().slice(0, 5)}
                            </span>
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
                                    <th className="p-2 border hidden sm:table-cell">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-3 text-center text-gray-500">Aucun résultat. Lancez la recherche.</td>
                                    </tr>
                                ) : (
                                    results.map((item, idx) => (
                                        <tr key={idx} className="even:bg-gray-50">
                                            <td className="p-2 border">{item.line}</td>
                                            <td className="p-2 border hidden sm:table-cell">{item.direction}</td>
                                            <td className="p-2 border">{item.dep}</td>
                                            <td className="p-2 border">
                                                <div>{item.arr}</div>
                                                <div className="text-xs text-gray-500 mt-1">{item.dur}</div>
                                            </td>
                                            <td className="p-2 border hidden sm:table-cell">{item.dur}</td>
                                            <td className="p-2 border hidden sm:table-cell">{item.direct ? 'DIRECT' : 'CORRESPONDANCE'}</td>
                                        </tr>
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
