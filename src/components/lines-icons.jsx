/* @refresh reset */
import React, { useEffect, useState } from "react";

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
let routesPromise = null;

const fetchAllRoutes = async () => {
  if (routesPromise) return routesPromise;
  routesPromise = fetch(
    "https://data.mobilites-m.fr/api/routers/default/index/routes",
  )
    .then((res) => res.json())
    .catch((err) => {
      console.error("Erreur chargement routes:", err);
      return [];
    });
  return routesPromise;
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

export default function LineIcon({ lineKey = "", size = "w-6 h-6" }) {
  const [lineData, setLineData] = useState(null);

  const sizePx = SIZE_MAP_PX[size] || 24;
  const fontSize = FONT_MAP[size] || 16;

  useEffect(() => {
    const loadLineData = async () => {
      if (!lineKey) return;
      if (lineDataCache.has(lineKey)) {
        setLineData(lineDataCache.get(lineKey));
        return;
      }
      try {
        const routes = await fetchAllRoutes();
        const route = routes.find(
          (r) => (r.shortName || "").toUpperCase() === lineKey.toUpperCase(),
        );
        const data = route
          ? {
              shortName: route.shortName || lineKey,
              color:
                LINE_COLORS[lineKey] ||
                (route.color ? "#" + route.color : "#000000"),
              type: route.type || "",
            }
          : {
              shortName: lineKey,
              color: LINE_COLORS[lineKey] || "#000000",
              type: "",
            };
        lineDataCache.set(lineKey, data);
        setLineData(data);
      } catch (error) {
        console.error("Erreur lors du chargement des données de ligne:", error);
        const data = { shortName: lineKey, color: "#000000", type: "" };
        lineDataCache.set(lineKey, data);
        setLineData(data);
      }
    };
    loadLineData();
  }, [lineKey]);

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

  // Lignes navette relais NAVA / NAVB / NAVC / NAVD / NAVE
  if (/^NAV[A-E]$/.test(lineKey.toUpperCase())) {
    return (
      <img
        src="/bus_relai.svg"
        alt={lineKey.toUpperCase()}
        width={sizePx}
        height={sizePx}
        style={{ display: "block", objectFit: "contain" }}
      />
    );
  }

  if (!lineData) {
    return (
      <div
        style={{
          width: sizePx,
          height: sizePx,
          backgroundColor: "#D1D5DB",
          borderRadius: "50%",
        }}
      />
    );
  }

  const isRound = ["TRAM", "CHRONO_PERI", "CHRONO"].includes(
    lineData.type?.toUpperCase(),
  );
  const isCLine = /^C[1-8]$/.test(lineData.shortName?.toUpperCase());

  return (
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
      <span
        style={{
          fontSize: `${fontSize - 4}px`,
          fontWeight: "bold",
          lineHeight: 1,
          color: isCLine ? "black" : "white",
        }}
      >
        {lineData.shortName}
      </span>
    </div>
  );
}

export const preloadLineData = async (lineKeys) => {
  if (!lineKeys.length) return;
  const routes = await fetchAllRoutes();
  for (const lineKey of lineKeys) {
    if (lineDataCache.has(lineKey)) continue;
    const route = routes.find(
      (r) => (r.shortName || "").toUpperCase() === lineKey.toUpperCase(),
    );
    const data = route
      ? {
          shortName: route.shortName || lineKey,
          color:
            LINE_COLORS[lineKey] ||
            (route.color ? "#" + route.color : "#000000"),
          type: route.type || "",
        }
      : {
          shortName: lineKey,
          color: LINE_COLORS[lineKey] || "#000000",
          type: "",
        };
    lineDataCache.set(lineKey, data);
  }
};

export const getLineDataFromCache = (lineKey) =>
  lineDataCache.get(lineKey) ?? null;
