import { useEffect, useRef, useState } from "react";
import { usePerfSettings } from "../hooks/usePerfSettings";

/**
 * Overlay de performance (mode développeur).
 *
 * Rectangle gris translucide en haut à droite : images par seconde, pire image
 * de la dernière seconde, saccades détectées, mémoire JS, nœuds DOM, marqueurs
 * dessinés, requêtes réseau et volume transféré.
 *
 * Toute la mesure passe par `requestAnimationFrame` et des refs : l'overlay ne
 * provoque qu'un seul rendu React par seconde, sinon l'outil de mesure fausserait
 * lui-même la mesure.
 */

/** En dessous de ce seuil, une image est comptée comme une saccade. */
const JANK_FRAME_MS = 50;

/**
 * @typedef {Object} Stats
 * @property {number} fps
 * @property {number} minFps
 * @property {number} worstFrameMs
 * @property {number} jankPerSec
 * @property {number|null} memoryMb
 * @property {number|null} memoryLimitMb
 * @property {number} domNodes
 * @property {number} markers
 * @property {number} requests
 * @property {number} transferredKb
 * @property {number} longTasks
 */

/** @type {Stats} */
const EMPTY_STATS = {
  fps: 0,
  minFps: 0,
  worstFrameMs: 0,
  jankPerSec: 0,
  memoryMb: null,
  memoryLimitMb: null,
  domNodes: 0,
  markers: 0,
  requests: 0,
  transferredKb: 0,
  longTasks: 0,
};

export function DevOverlay() {
  const { settings } = usePerfSettings();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [history, setHistory] = useState([]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef(null);
  const longTasksRef = useRef(0);
  const draggingRef = useRef(false);
  const dragOriginRef = useRef({
    pointerX: 0,
    pointerY: 0,
    startX: 0,
    startY: 0,
  });

  const enabled = settings.devMode && settings.devOverlay;

  // Repartir de zéro à chaque activation : l'historique d'une session
  // précédente n'a plus de sens. Ajusté pendant le rendu plutôt que dans un
  // effet, pour ne pas déclencher un rendu en cascade.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (enabled) {
      setStats(EMPTY_STATS);
      setHistory([]);
      setPosition({ x: 0, y: 0 });
    }
  }

  useEffect(() => {
    if (!enabled || !overlayRef.current) return;
    const width = overlayRef.current.offsetWidth;
    setPosition({
      x: Math.max(12, window.innerWidth - width - 12),
      y: 12,
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onPointerMove = (event) => {
      if (!draggingRef.current) return;
      event.preventDefault();

      const deltaX = event.clientX - dragOriginRef.current.pointerX;
      const deltaY = event.clientY - dragOriginRef.current.pointerY;
      const startX = dragOriginRef.current.startX;
      const startY = dragOriginRef.current.startY;
      const width = overlayRef.current?.offsetWidth ?? 0;
      const height = overlayRef.current?.offsetHeight ?? 0;

      const nextX = Math.min(
        Math.max(startX + deltaX, 0),
        Math.max(window.innerWidth - width, 0),
      );
      const nextY = Math.min(
        Math.max(startY + deltaY, 0),
        Math.max(window.innerHeight - height, 0),
      );

      setPosition({ x: nextX, y: nextY });
    };

    const onPointerUp = (event) => {
      draggingRef.current = false;
      document.body.style.userSelect = "";
      if (overlayRef.current?.hasPointerCapture?.(event.pointerId)) {
        overlayRef.current.releasePointerCapture(event.pointerId);
      }
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [enabled]);

  const startDrag = (event) => {
    if (
      !overlayRef.current ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    draggingRef.current = true;
    dragOriginRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: position.x,
      startY: position.y,
    };
    event.preventDefault();
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  // Les tâches longues (> 50 ms sur le thread principal) sont la cause la plus
  // fréquente des à-coups : PerformanceObserver les signale directement.
  useEffect(() => {
    if (!enabled || typeof PerformanceObserver === "undefined") return;
    // Le compteur repart de zéro à chaque activation de l'overlay.
    longTasksRef.current = 0;
    let observer = null;
    try {
      observer = new PerformanceObserver((list) => {
        longTasksRef.current += list.getEntries().length;
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Type d'entrée non supporté (Safari) : le compteur reste à zéro.
    }
    return () => observer?.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;
    let frames = 0;
    let jank = 0;
    let worstFrame = 0;
    let lastFrameTime = performance.now();
    let windowStart = lastFrameTime;

    const tick = (now) => {
      const frameMs = now - lastFrameTime;
      lastFrameTime = now;
      frames += 1;
      if (frameMs > worstFrame) worstFrame = frameMs;
      if (frameMs > JANK_FRAME_MS) jank += 1;

      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        const fps = Math.round((frames * 1000) / elapsed);
        const resources = performance.getEntriesByType("resource");
        const transferred = resources.reduce(
          (total, entry) => total + (entry.transferSize || 0),
          0,
        );
        const memory = performance.memory;

        /** @type {Stats} */
        const nextStats = {
          fps,
          minFps: worstFrame > 0 ? Math.round(1000 / worstFrame) : fps,
          worstFrameMs: Math.round(worstFrame),
          jankPerSec: jank,
          memoryMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
          memoryLimitMb: memory
            ? Math.round(memory.jsHeapSizeLimit / 1048576)
            : null,
          domNodes: document.getElementsByTagName("*").length,
          markers: document.querySelectorAll(".maplibregl-marker").length,
          requests: resources.length,
          transferredKb: Math.round(transferred / 1024),
          longTasks: longTasksRef.current,
        };

        setStats(nextStats);
        setHistory((previous) => [...previous.slice(-59), fps]);

        frames = 0;
        jank = 0;
        worstFrame = 0;
        windowStart = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  if (!enabled) return null;

  const fpsColor =
    stats.fps >= 50 ? "#4ade80" : stats.fps >= 30 ? "#facc15" : "#f87171";
  const peak = Math.max(60, ...history);

  return (
    <div
      ref={overlayRef}
      onPointerDown={startDrag}
      className="fixed z-[10001] w-56 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-200 shadow-lg backdrop-blur-sm"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: "none",
      }}
      aria-hidden="true"
    >
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          Perfs
        </span>
        <span className="text-lg font-bold" style={{ color: fpsColor }}>
          {stats.fps}{" "}
          <span className="text-[10px] font-normal text-slate-400">fps</span>
        </span>
      </div>

      {/* Historique des 60 dernières secondes : une barre par seconde. */}
      <div className="mb-2 flex h-8 items-end gap-[1px]">
        {history.map((value, index) => (
          <div
            key={index}
            className="flex-1 rounded-sm"
            style={{
              height: `${Math.max(4, (value / peak) * 100)}%`,
              backgroundColor:
                value >= 50 ? "#4ade80" : value >= 30 ? "#facc15" : "#f87171",
              opacity: 0.75,
            }}
          />
        ))}
      </div>

      <Line
        label="image la pire"
        value={`${stats.worstFrameMs} ms`}
        warn={stats.worstFrameMs > JANK_FRAME_MS}
      />
      <Line
        label="saccades /s"
        value={String(stats.jankPerSec)}
        warn={stats.jankPerSec > 0}
      />
      <Line
        label="tâches longues"
        value={String(stats.longTasks)}
        warn={stats.longTasks > 0}
      />
      {stats.memoryMb !== null && (
        <Line
          label="mémoire JS"
          value={`${stats.memoryMb} / ${stats.memoryLimitMb} Mo`}
        />
      )}
      {/* Les arrêts sont dessinés par le GPU : ce compteur ne suit que les
          marqueurs HTML restants (étiquettes, position, itinéraire). */}
      <Line
        label="marqueurs DOM"
        value={String(stats.markers)}
        warn={stats.markers > 120}
      />
      <Line
        label="nœuds DOM"
        value={String(stats.domNodes)}
        warn={stats.domNodes > 5000}
      />
      <Line label="requêtes" value={String(stats.requests)} />
      <Line label="transféré" value={`${stats.transferredKb} ko`} />
    </div>
  );
}

/**
 * @param {{ label: string, value: string, warn?: boolean }} props
 */
function Line({ label, value, warn = false }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className={warn ? "text-amber-300" : "text-slate-100"}>
        {value}
      </span>
    </div>
  );
}
