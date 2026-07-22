import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./navbar.jsx";
import LineIcon from "./components/lines-icons.jsx";
import { DisruptionItem } from "./components/DisruptionItem.jsx";
import { useDisruptions } from "./hooks/useDisruptions.js";

const API = "https://data.mobilites-m.fr/api/routers/default";
const TRAMS = new Set(["A", "B", "C", "D", "E"]);
const meters = (a, b) => {
  const lat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  return Math.hypot((a.lon - b.lon) * 111320 * Math.cos(lat), (a.lat - b.lat) * 110540);
};

export default function SuiviBeta() {
  const { getLineDisruptions } = useDisruptions();
  const [routes, setRoutes] = useState([]); const [line, setLine] = useState("");
  const [stops, setStops] = useState([]); const [direction, setDirection] = useState("");
  const [currentStop, setCurrentStop] = useState(null);
  const [status, setStatus] = useState(""); const [testMode, setTestMode] = useState(false);
  const watchId = useRef(null); const lastCoords = useRef(null);

  useEffect(() => { fetch(`${API}/index/routes`).then((r) => r.json()).then((data) => setRoutes(data.filter((r) => TRAMS.has((r.shortName || "").toUpperCase())))).catch(() => setStatus("Impossible de charger les lignes.")); }, []);
  useEffect(() => {
    if (!line) return;
    fetch(`${API}/index/routes/SEM:${line}/clusters`).then((r) => r.json()).then((data) => {
      const seen = new Set();
      setStops(data.filter((s) => { const key = `${s.name}-${Math.round(s.lat * 1e4)}-${Math.round(s.lon * 1e4)}`; if (seen.has(key)) return false; seen.add(key); return true; }).map((s) => ({ ...s, clusterId: s.id })));
    }).catch(() => setStatus("Impossible de charger les arrêts."));
  }, [line]);
  const selectedRoute = routes.find((route) => route.shortName?.toUpperCase() === line);
  const directions = (selectedRoute?.longName || "").split(/\s*\/\s*/).filter(Boolean);
  const detectStop = useCallback((coords) => {
    if (!stops.length) return;
    const result = stops.map((stop) => ({ stop, distance: meters(coords, stop) })).sort((a, b) => a.distance - b.distance)[0];
    if (result?.distance < 140) { setCurrentStop(result.stop); setStatus(`Arrêt détecté à ${Math.round(result.distance)} m`); }
    else setStatus("Aucun arrêt de cette ligne détecté à proximité.");
  }, [stops]);
  const startTracking = () => {
    if (!navigator.geolocation) return setStatus("La géolocalisation n’est pas disponible sur cet appareil.");
    setStatus("Recherche de votre tram…");
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition((p) => { const coords = { lat: p.coords.latitude, lon: p.coords.longitude }; lastCoords.current = coords; detectStop(coords); }, () => setStatus("Autorisez la position précise pour détecter les arrêts."), { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  };
  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);
  useEffect(() => { if (lastCoords.current) detectStop(lastCoords.current); }, [detectStop]);
  const disruptions = line ? getLineDisruptions(line) : [];
  const ready = line && direction;
  const chooseLine = (nextLine) => {
    setLine(nextLine); setStops([]); setDirection(""); setCurrentStop(null); setTestMode(false); setStatus("");
  };

  return <><Navbar /><main className="min-h-screen bg-[#f5f7fb] px-4 pb-32 pt-5"><div className="mx-auto max-w-md space-y-4">
    <header className="px-1"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bêta</p><h1 className="mt-1 text-xl font-bold text-slate-900">Suivi en direct</h1><p className="mt-1 text-sm text-slate-500">Suivez votre arrêt pendant le trajet.</p></header>
    {!ready ? <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-base font-bold">Lancer le suivi</h2><p className="mb-4 mt-1 text-sm text-slate-500">À bord de quel tram êtes-vous ?</p><div className="grid grid-cols-5 gap-2">{routes.map((r) => { const key = r.shortName.toUpperCase(); return <button key={r.id} onClick={() => chooseLine(key)} className={`flex aspect-square items-center justify-center rounded-xl border-2 ${line === key ? "border-blue-600 bg-blue-50" : "border-slate-100"}`}><LineIcon lineKey={key} size="w-10 h-10" /></button>; })}</div>
      {line && <div className="mt-5 border-t border-slate-100 pt-4"><p className="mb-2 text-sm font-semibold">Dans quelle direction ?</p>{directions.length ? <div className="grid gap-2">{directions.map((label) => <button key={label} onClick={() => setDirection(label)} className={`rounded-2xl border p-3 text-left text-sm font-semibold ${direction === label ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>Vers {label}</button>)}</div> : <p className="text-sm text-slate-500">Chargement des directions…</p>}</div>}
    </section> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><LineIcon lineKey={line} size="w-10 h-10" /><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Direction</p><h2 className="font-bold">Vers {direction}</h2></div><button onClick={() => setLine("")} className="ml-auto text-xs font-semibold text-blue-600">Modifier</button></div><button onClick={() => { setTestMode(false); startTracking(); }} className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Utiliser ma position</button><button onClick={() => setTestMode((value) => !value)} className="mt-2 w-full rounded-xl px-4 py-2 text-sm text-slate-600 underline underline-offset-2">{testMode ? "Fermer le mode test" : "Tester sans GPS"}</button><p className="mt-2 text-center text-xs text-slate-500">{status || "La position précise sert uniquement à détecter l’arrêt du tram."}</p>{testMode && <label className="mt-4 block border-t border-slate-100 pt-4 text-sm font-semibold">Simuler ma position à<select value={currentStop?.id || ""} onChange={(e) => { const stop = stops.find((s) => s.id === e.target.value) || null; setCurrentStop(stop); setStatus(stop ? `Position simulée : ${stop.name}` : ""); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal"><option value="">Choisir un arrêt</option>{stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Arrêt actuel</p><p className="mt-1 text-xl font-bold text-slate-900">{currentStop ? currentStop.name : "En attente de votre position"}</p><p className="mt-1 text-sm text-slate-500">{currentStop ? "Le suivi se mettra à jour au prochain arrêt." : "Utilisez le GPS ou le mode test."}</p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Infotrafic ligne {line}</h2><span className={`size-2 rounded-full ${disruptions.length ? "bg-amber-400" : "bg-emerald-500"}`} /></div>{disruptions.length ? <div className="space-y-2">{disruptions.map((evt, i) => <DisruptionItem key={i} evt={evt} />)}</div> : <p className="text-sm text-slate-500">Aucune perturbation en cours.</p>}</section>
    </>}</div></main></>;
}
