/* @refresh reset */
import React, { useEffect, useState } from "react";
import { getAllLines, buildLineLookup } from "../utils/allLines.js";

export const LINE_COLORS = {
  C11: "#EF7C00",
  D: "#FD8C06",
  C1: "#F5D24D",
  C2: "#F5D24D",
  C3: "#F5D24D",
  C4: "#F5D24D",
  C5: "#F5D24D",
  C6: "#F5D24D",
  C7: "#F5D24D",
  C8: "#F5D24D",
  C9: "#F5D24D",
  C10: "#EF7C00",
  C12: "#EF7C00",
  C13: "#EF7C00",
  C14: "#EF7C00",
};

const lineDataCache = new Map();

// La résolution "route -> couleur/nom" vient désormais d'un seul catalogue
// partagé (utils/allLines.js), qui désambiguïse les codes partagés entre
// réseaux (C1/C6/C11 existent à la fois côté SEM/SE2 et côté TER "SNC").
// L'ancien `routesCache.find(...)` d'ici prenait le premier match dans
// l'ordre de réponse de l'API, ce qui pouvait résoudre "C1" vers le mauvais
// réseau selon les jours.
let lineLookupPromise = null;
let lineLookupCache = null;

const makeLineData = (line, effectiveKey, cacheKey) => ({
  shortName: line?.shortName || effectiveKey,
  color: LINE_COLORS[cacheKey] || line?.color || "#94A3B8",
  type: line?.type || "",
});

const fetchLineLookup = async () => {
  if (lineLookupCache) return lineLookupCache;
  if (lineLookupPromise) return lineLookupPromise;
  lineLookupPromise = getAllLines()
    .then((lines) => {
      lineLookupCache = buildLineLookup(lines);
      return lineLookupCache;
    })
    .catch((err) => {
      console.error("Erreur chargement routes:", err);
      lineLookupCache = new Map();
      return lineLookupCache;
    });
  return lineLookupPromise;
};

const getLineDataFromRouteCache = (lineKeyRaw, effectiveKey, cacheKey) => {
  if (!lineLookupCache) return null;
  const line =
    lineLookupCache.get((lineKeyRaw || "").toUpperCase()) ||
    lineLookupCache.get(cacheKey);
  return line ? makeLineData(line, effectiveKey, cacheKey) : null;
};

const extractLineKey = (lineKey) => {
  const raw = String(lineKey || "").trim();
  const match = raw.match(/^[A-Z0-9]+[:_](.+)$/i);
  return match ? match[1] : raw;
};

const SIZE_MAP_PX = {
  "w-4 h-4": 16,
  "w-5 h-5": 20,
  "w-6 h-6": 24,
  "w-8 h-8": 32,
  "w-10 h-10": 40,
  "w-12 h-12": 48,
};

const FONT_MAP = {
  "w-4 h-4": 10,
  "w-5 h-5": 12,
  "w-6 h-6": 16,
  "w-8 h-8": 20,
  "w-10 h-10": 24,
  "w-12 h-12": 28,
};

const RelaisBadge = ({ badgeSize }) => (
  <svg
    viewBox="0 0 59.3 40.1"
    width={badgeSize}
    height={badgeSize}
    style={{
      position: "absolute",
      left: "50%",
      bottom: -badgeSize * 0.15,
      transform: "translateX(-50%)",
      display: "block",
    }}
  >
    <defs>
      <style>
        {
          ".relais-cls-1 { fill: #fff; stroke: #ea541e; stroke-miterlimit: 10; } .relais-cls-2 { fill: #ea541e; stroke-width: 0; }"
        }
      </style>
    </defs>
    <g transform="translate(0 16)">
      <rect
        x="3"
        y="7.9"
        width="53.8"
        height="31.5"
        rx="1.7"
        ry="1.7"
        transform="translate(-1.8 0) rotate(-5.5)"
        className="relais-cls-1"
      />
      <path
        d="M17.5,19.6c.9,0,1.7,0,2.5.2.8.2,1.3.6,1.8,1.2s.9,1.1,1.2,1.9.4,1.5.7,2.2c0,.8.1,1.5,0,2.1,0,.8-.3,1.4-.7,1.9s-1.1,1.3-1.8,1.8-1.4.7-2.4.8-1.7,0-2.5-.2-1.4-.8-2.1-1.5h-.2s0,.2,0,.3v.8c.1.3,0,.5,0,.8l-.4.5c-.3.2-.6,0-.9,0-.6,0-1.1-.4-1.4-.8-.3-.4-.5-.9-.7-1.3-.2-.4-.4-.9-.4-1.5s-.2-.9-.3-1l-.2-2.6c0-.8,0-1.7,0-2.4,0-.8,0-1.5.2-2.5s.3-1.7.4-2.6c0-.8.3-1.4.4-2,.2-.6.3-1.2.7-1.7.2-.6.7-1.1,1.1-1.6s.8-1,1.5-1.5c.6-.5,1.3-.7,2.1-.8s1.5,0,2.2.4c.6.2,1.3.8,1.7,1.4s.6,1.3.5,2.1c0,.6-.2,1.2-.4,1.7-.1.5-.4,1.1-.6,1.6s-.5,1-.8,1.4c-.3.2-.6.5-.8.8M20.8,26.7c.2-.8.3-1.4,0-2.1,0-.8-.3-1.3-.6-1.9s-.7-1-1.2-1.3c-.5-.3-1-.5-1.3-.5-.5-.1-1.1,0-1.4.1-.5,0-.7.2-1.2.4l-.9.5c-.1.2-.4.3-.4.6-.1.3-.2.8-.3,1.2s0,.9,0,1.5l.9-.5c.3-.2.6-.2.9-.4.3,0,.6-.2.9,0,.3,0,.5.1.5.1q.2.1,0,.3c-.1.2-.3.2-.6.4s-.6.4-.8.7c-.3.3-.5.7-.6,1.3-.1.5,0,.8.1,1.1s.4.6.8.8c.5.1.9.2,1.4.2s1-.3,1.5-.4c.4-.2.9-.5,1.3-.9.6-.4.8-.7,1-1.2M17.3,12.9c-.3-.1-.6,0-.9.2-.3.3-.7.7-1,1.2-.3.5-.5,1.1-.7,1.7-.2.6-.5,1.3-.6,1.7s-.2.9-.2,1.4,0,.5.2.4c.6,0,1.2-.4,1.6-.8.4-.3.8-.8,1.2-1.3.3-.5.5-1,.8-1.6.1-.5.2-1.1.3-1.5v-1.2c-.3,0-.4-.3-.7-.2"
        className="relais-cls-2"
      />
      <path
        d="M28.2,18.7v1.1c.1.5.2,1.1.3,1.7l.2,2c0,.6.3,1.2.3,1.8.2.6.4,1,.6,1.3.2.3.5.4.8.4.5,0,.9-.2,1.2-.6.3-.3.5-.8.8-1.4.2-.6.3-1.2.4-1.9,0-.6.2-1.4.1-2,0-.6,0-1.2,0-1.8s-.1-1.1,0-1.4c0-.3,0-.6.2-.8.1-.2.4-.3.7-.4s.6,0,.9,0l.9.4c.3.1.5.4.8.5.2.3.3.4.4.7v1.4c.2.6,0,1.2.2,2l.2,2.3c0,.8.1,1.5.4,2.1s.4,1.2.6,1.6c.3.4.7.7,1.1.8s.6.2.8.4.2.3,0,.5-.3.3-.6.4c-.3.2-.8,0-1.4.1-.9,0-1.7-.3-2.4-.8s-1-1-1.3-1.4c-.4-.6-.6-1.3-.7-2.1-.2.8-.5,1.6-.9,2.2-.2.6-.8,1.1-1.2,1.5-.6.5-1.3.6-2.1.7-.9,0-1.5-.3-2.2-.6-.6-.4-1.1-.8-1.5-1.4-.4-.6-.7-1.1-.9-1.9s-.4-1.3-.5-2.1-.3-1.2-.3-1.6l-.2-1.7c0-.5,0-.9,0-1.2.1-.3,0-.6.2-.8.1-.2.4-.2.7-.4.4-.2.7-.2,1.2-.3s.8,0,1.1,0c.6,0,.8.2.8.7"
        className="relais-cls-2"
      />
      <path
        d="M47.5,13.8c.2.1,0,.3,0,.5-.1.2-.3.2-.4.3s-.4.2-.6.4c-.3.2-.4.3-.7.7-.3.3-.4.6-.5,1-.1.3,0,.8,0,1.4s.3,1.2.6,1.6c.4.6.7,1,1.2,1.6.5.4,1,1,1.5,1.4.5.4,1,1,1.5,1.4.5.4.9,1,1.1,1.6.4.6.4,1,.5,1.6,0,.6-.4,1.1-.8,1.6-.6.5-1.1.9-1.9,1.1s-1.6.5-2.5.5-1.8.2-2.6,0c-.8,0-1.5-.3-2.2-.6s-1-.8-1.2-1.3c-.4-.9-.4-1.5-.4-2.1,0-.6.2-1.1.3-1.5.3-.5.4-.8.8-1,.3-.2.6-.5.7-.5.4-.3.7-.4.9,0s0,.8-.2,1.2c-.1.3,0,.6,0,.9.2.3.4.7.7,1s.8.5,1.3.6,1.1.2,1.7.1.8,0,1-.3c.4-.2.7-.4.9-.5.3-.2.4-.5.4-.8s0-.6-.4-.9-.8-.7-1.5-1.2-1.5-.9-2.1-1.6c-.8-.5-1.5-1.2-2-1.9s-.9-1.4-1-2.2c-.1-1.5,0-2.6.4-3.2.4-.8,1.3-1.2,2.4-1.6.6-.2,1-.3,1.3-.3s.6,0,.9,0c.2.1.3.1.5.3,0,.6.2.7.2.9"
        className="relais-cls-2"
      />
    </g>
  </svg>
);

const LineLabel = ({ text, fontSize, isCLine, sizePx }) => {
  const label = text || "";
  const textColor = isCLine ? "black" : "white";

  if (label.length <= 3) {
    return (
      <span
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: "bold",
          lineHeight: 1,
          color: textColor,
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: sizePx * 0.78,
        height: `${fontSize + 2}px`,
      }}
    >
      <style>{`
        @keyframes lineIconMarquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .line-icon-marquee-track { display: inline-block; white-space: nowrap; animation: lineIconMarquee 5s linear infinite; padding-right: 2em; }
        .line-icon-marquee-track-delayed { display: inline-block; white-space: nowrap; animation: lineIconMarquee 5s linear infinite; animation-delay: -2.5s; position: absolute; top: 0; left: 0; padding-right: 2em; }
      `}</style>
      <span
        className="line-icon-marquee-track"
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: "bold",
          color: textColor,
        }}
      >
        {label}
      </span>
      <span
        className="line-icon-marquee-track-delayed"
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: "bold",
          color: textColor,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default function LineIcon({ lineKey = "", size = "w-6 h-6" }) {
  const normalizedKey = extractLineKey(lineKey);
  const navMatch = /^NAV([A-E])$/i.exec(normalizedKey.toUpperCase());
  const effectiveKey = navMatch ? navMatch[1] : normalizedKey;
  const cacheKey = effectiveKey.toUpperCase();

  const [lineData, setLineData] = useState(() => {
    if (lineDataCache.has(cacheKey)) {
      return lineDataCache.get(cacheKey);
    }
    const routeData = getLineDataFromRouteCache(
      lineKey,
      effectiveKey,
      cacheKey,
    );
    if (routeData) {
      lineDataCache.set(cacheKey, routeData);
      return routeData;
    }
    return null;
  });

  const sizePx = SIZE_MAP_PX[size] || 24;
  const fontSize = FONT_MAP[size] || 16;

  useEffect(() => {
    const loadLineData = async () => {
      if (!effectiveKey) return;
      if (lineDataCache.has(cacheKey)) {
        setLineData(lineDataCache.get(cacheKey));
        return;
      }
      try {
        const lookup = await fetchLineLookup();
        const line =
          lookup.get((lineKey || "").toUpperCase()) || lookup.get(cacheKey);
        const data = line
          ? makeLineData(line, effectiveKey, cacheKey)
          : {
              shortName: effectiveKey,
              color: LINE_COLORS[cacheKey] || "#94A3B8",
              type: "",
            };
        lineDataCache.set(cacheKey, data);
        setLineData(data);
      } catch (error) {
        console.error("Erreur lors du chargement des données de ligne:", error);
        const data = {
          shortName: effectiveKey,
          color: LINE_COLORS[cacheKey] || "#94A3B8",
          type: "",
        };
        lineDataCache.set(cacheKey, data);
        setLineData(data);
      }
    };
    loadLineData();
  }, [cacheKey, effectiveKey, lineKey]);

  if (lineKey.toUpperCase() === "WALK") {
    return (
      <svg
        stroke="currentColor"
        fill="currentColor"
        strokeWidth="0"
        viewBox="0 0 320 512"
        width="38"
        height="38"
        style={{ opacity: 0.6 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M208 96c26.5 0 48-21.5 48-48S234.5 0 208 0s-48 21.5-48 48 21.5 48 48 48zm94.5 149.1l-23.3-11.8-9.7-29.4c-14.7-44.6-55.7-75.8-102.2-75.9-36-.1-55.9 10.1-93.3 25.2-21.6 8.7-39.3 25.2-49.7 46.2L17.6 213c-7.8 15.8-1.5 35 14.2 42.9 15.6 7.9 34.6 1.5 42.5-14.3L81 228c3.5-7 9.3-12.5 16.5-15.4l26.8-10.8-15.2 60.7c-5.2 20.8.4 42.9 14.9 58.8l59.9 65.4c7.2 7.9 12.3 17.4 14.9 27.7l18.3 73.3c4.3 17.1 21.7 27.6 38.8 23.3 17.1-4.3 27.6-21.7 23.3-38.8l-22.2-89c-2.6-10.3-7.7-19.9-14.9-27.7l-45.5-49.7 17.2-68.7 5.5 16.5c5.3 16.1 16.7 29.4 31.7 37l23.3 11.8c15.6 7.9 34.6 1.5 42.5-14.3 7.7-15.7 1.4-35.1-14.3-43zM73.6 385.8c-3.2 8.1-8 15.4-14.2 21.5l-50 50.1c-12.5 12.5-12.5 32.8 0 45.3s32.7 12.5 45.2 0l59.4-59.4c6.1-6.1 10.9-13.4 14.2-21.5l13.5-33.8c-55.3-60.3-38.7-41.8-47.4-53.7l-20.7 51.5z" />
      </svg>
    );
  }

  if (!lineData) {
    const fallbackColor = LINE_COLORS[cacheKey] || "#94A3B8";
    const isRound = ["TRAM", "CHRONO_PERI", "CHRONO"].includes(
      effectiveKey.toUpperCase(),
    );
    const isCLine = /^C[1-8]$/.test(effectiveKey.toUpperCase());
    return (
      <div
        style={{
          width: sizePx,
          height: sizePx,
          backgroundColor: fallbackColor,
          borderRadius: isRound ? "50%" : "20%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        title={lineKey}
      >
        <LineLabel
          text={effectiveKey || lineKey}
          fontSize={fontSize - 4}
          isCLine={isCLine}
          sizePx={sizePx}
        />
      </div>
    );
  }

  const isRound = ["TRAM", "CHRONO_PERI", "CHRONO"].includes(
    lineData.type?.toUpperCase(),
  );
  const isCLine = /^C[1-8]$/.test(lineData.shortName?.toUpperCase());

  const baseIcon = (
    <div
      style={{
        width: sizePx,
        height: sizePx,
        backgroundColor: lineData.color,
        borderRadius: isRound ? "50%" : "20%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      title={lineData.shortName}
    >
      <LineLabel
        text={lineData.shortName}
        fontSize={fontSize - 4}
        isCLine={isCLine}
        sizePx={sizePx}
      />
    </div>
  );

  if (navMatch) {
    const badgeSize = sizePx;
    return (
      <div
        style={{
          position: "relative",
          width: sizePx,
          height: sizePx,
          flexShrink: 0,
        }}
        title={`${lineData.shortName} - Navette relais`}
      >
        {baseIcon}
        <RelaisBadge badgeSize={badgeSize} />
      </div>
    );
  }

  return baseIcon;
}

export const preloadLineData = async (lineKeys) => {
  if (!lineKeys.length) return;
  const lookup = await fetchLineLookup();
  for (const lineKeyRaw of lineKeys) {
    const normalizedKey = extractLineKey(lineKeyRaw);
    const navMatch = /^NAV([A-E])$/i.exec(normalizedKey.toUpperCase());
    const effectiveKey = navMatch ? navMatch[1] : normalizedKey;
    const cacheKey = effectiveKey.toUpperCase();
    if (lineDataCache.has(cacheKey)) continue;
    const line =
      lookup.get((lineKeyRaw || "").toUpperCase()) || lookup.get(cacheKey);
    const data = line
      ? {
          shortName: line.shortName || effectiveKey,
          color: LINE_COLORS[cacheKey] || line.color || "#000000",
          type: line.type || "",
        }
      : {
          shortName: effectiveKey,
          color: LINE_COLORS[cacheKey] || "#000000",
          type: "",
        };
    lineDataCache.set(cacheKey, data);
  }
};

export const getLineDataFromCache = (lineKey) =>
  lineDataCache.get(extractLineKey(lineKey).toUpperCase()) ?? null;

export const preloadLineRouteCache = async () => {
  await fetchLineLookup();
};
