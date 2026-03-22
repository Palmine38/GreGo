import { useEffect, useMemo, useState } from 'react';
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

export default function TestHome() {
    const [stopsMap, setStopsMap] = useState(FALLBACK_STOPS);
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

    useEffect(() => {
        // chargement initiale des arrets de toutes les lignes sem
        const fetchStops = async () => {
            try {
                const routesResp = await fetch('https://data.mobilites-m.fr/api/routers/default/index/routes');
                const routes = await routesResp.json();
                const semLines = routes
                    .map((route) => route.id)
                    .filter((id) => id?.startsWith('SEM:'))
                    .map((id) => id.replace('SEM:', ''))
                    .slice(0, 20);

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
                            // ignore une ligne échouer
                        }
                    })
                );

                setStopsMap(newMap);
            } catch {
                setStopsMap(FALLBACK_STOPS);
            }
        };

        fetchStops();
    }, []);

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

    const search = async (offset = 0) => {
        setError('');
        setLoading(true);

        const from = findStop(dep);
        const to = findStop(arr);

        if (!from) {
            setError(`Arrêt de départ '${dep}' non trouvé.`);
            setLoading(false);
            return;
        }
        if (!to) {
            setError(`Arrêt d'arrivée '${arr}' non trouvé.`);
            setLoading(false);
            return;
        }

        const baseTime = searchBaseDate;
        const time = new Date(baseTime.getTime() + offset * 60 * 60 * 1000);

        const params = new URLSearchParams({
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
            const res = await fetch(`https://data.mobilites-m.fr/api/routers/default/plan?${params.toString()}`);
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
                        dur: `${Math.round(it.duration / 60)} min`,
                        direct: legs.length <= 1,
                        direction: legs[0]?.headsign || legs[0]?.to?.name || '?',
                        line: line ? line.toUpperCase() : lineKeys[0] || '?',
                        lineKeys,
                    };
                })
                .filter((item) => {
                    if (!line.trim()) return true;
                    const target = line.toUpperCase();
                    const targetPattern = LINE_NAME_MAP[target]?.toUpperCase() || target;
                    return item.lineKeys.some((lk) => lk === target || lk === targetPattern || lk.startsWith(target));
                });

            if (filtered.length === 0) {
                setError('⚠️ Aucun itinéraire trouvé pour ce créneau.');
            }

            setResults(filtered);
            setTimeOffset(offset);
            setSearchBaseDate(baseTime);
            setInputsOpen(false);
        } catch (err) {
            setError('Erreur réseau / API : ' + (err.message || err));
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddOneHour = async () => {
        await search(timeOffset + 1);
    };

    const handleSubtractOneHour = async () => {
        if (timeOffset <= 0) return;
        await search(timeOffset - 1);
    };

    const [afterModeOpen, setAfterModeOpen] = useState(false);

    const reset = () => {
        setDep('');
        setArr('');
        setLine('');
        setResults([]);
        setTimeOffset(0);
        setError('');
        setInputsOpen(true);
        setAfterModeOpen(false);
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
    const beforeDate = new Date(origin.getTime() + (timeOffset - 1) * 60 * 60 * 1000);
    const afterLabel = `après ${afterDate.toTimeString().slice(0, 5)}`;
    const beforeLabel = `avant ${beforeDate.toTimeString().slice(0, 5)}`;

    return (
        <>
            <Navbar title="Recherche rapide" menuOpen={menuOpen} setMenuOpen={setMenuOpen} onMenuOpen={() => setInputsOpen(false)} showHamburger={true} />
            <div className="min-h-screen relative bg-slate-50 pb-24">
                <div className="m-4 p-4 rounded-lg border border-gray-300 bg-white shadow-lg">
                    <h1 className="text-2xl font-bold mb-3">Recherche rapide</h1>

                    {error && <div className="mt-3 p-2 bg-red-100 text-red-700 rounded">{error}</div>}

                    {results.length > 0 && (
                        <div className="mb-2 text-left">
                            <span className="text-sm text-gray-600">
                                Résultats pour {new Date(searchBaseDate.getTime() + timeOffset * 60 * 60 * 1000).toTimeString().slice(0, 5)}
                            </span>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-center">
                            <span className="text-lg font-semibold text-black">{dep} → {arr}</span>
                            <div className="text-xs text-gray-600 mt-1">{results[0].direction}</div>
                        </div>
                    )}

                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-2 border">Ligne</th>
                                    <th className="p-2 border hidden sm:table-cell">Direction</th>
                                    <th className="p-2 border">Départ</th>
                                    <th className="p-2 border">Arrivée</th>
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
                                            <td className="p-2 border">{item.arr}</td>
                                            <td className="p-2 border hidden sm:table-cell">{item.dur}</td>
                                            <td className="p-2 border hidden sm:table-cell">{item.direct ? 'DIRECT' : 'CORRESPONDANCE'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className={`mt-3 flex items-center gap-2 ${timeOffset > 0 ? 'justify-between' : 'justify-end'}`}>
                        {timeOffset > 0 && results.length > 0 && (
                            <button
                                className="text-sm font-semibold text-black hover:text-gray-700 cursor-pointer"
                                onClick={handleSubtractOneHour}
                                disabled={loading}
                            >
                                &lt;
                            </button>
                        )}
                        {results.length > 0 && (
                            <button
                                className="text-sm font-semibold text-black hover:text-gray-700 cursor-pointer"
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
                            onClick={() => setInputsOpen(true)}
                        >
                            ^ Ouvrir la recherche
                        </button>
                    </div>
                )}

                <div className={`${inputsOpen ? 'translate-y-0' : 'translate-y-full'} fixed bottom-0 left-0 right-0 z-20 border-t border-gray-300 bg-white p-4 shadow-xl transition-transform duration-500 sm:relative sm:translate-y-0 sm:border-none sm:shadow-none sm:p-0`}>
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold">Choix arrêts / ligne</span>
                        <button className="text-gray-600" onClick={() => setInputsOpen(!inputsOpen)}>
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
