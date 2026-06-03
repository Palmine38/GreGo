import React from "react";
import LineIcon, { LINE_COLORS } from "./lines-icons.jsx";
import { DisruptionItem } from "./DisruptionItem.jsx";
import { formatDuration } from "../utils/journey.js";

/**
 * Affiche la timeline pas-à-pas d'un itinéraire (transit + marche).
 *
 * Props :
 *   journey            — objet itinéraire (allLegs, …)
 *   lineColors         — map { shortName: '#color' } depuis l'API
 *   getLineDisruptions — fn(lineName) → tableau d'évènements
 *   onOpenMap          — callback pour ouvrir la carte (géré par le parent)
 */
export function JourneyTimeline({
  journey,
  lineColors,
  getLineDisruptions,
  onOpenMap,
}) {
  if (!journey) return null;

  const depIsAddress = (journey.rawDep || "").includes("::");
  const arrIsAddress = (journey.rawArr || "").includes("::");

  const allLegs = (journey.allLegs || []).filter((leg, i, arr) => {
    if (leg.mode !== "WALK") return true;
    const isFirst = arr.slice(0, i).every((l) => l.mode === "WALK");
    if (isFirst && !depIsAddress) return false;
    const isLast = arr.slice(i + 1).every((l) => l.mode === "WALK");
    if (isLast && !arrIsAddress) return false;
    return true;
  });

  const items = [];

  allLegs.forEach((leg, i) => {
    const isWalk = leg.mode === "WALK";
    const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
      .replace("SEM:", "")
      .toUpperCase();
    const color = LINE_COLORS[lineName] || lineColors[lineName] || "#6B7280";
    const durationMin = Math.round(leg.duration / 60);

    if (!isWalk) {
      const disruptions = getLineDisruptions(lineName);
      if (disruptions.length > 0) {
        items.push(
          <div key={`disruption-${i}`} className="flex flex-col gap-2 mb-3">
            {disruptions.map((evt, di) => (
              <DisruptionItem key={di} evt={evt} />
            ))}
          </div>,
        );
      }

      items.push(
        <div key={`transit-start-${i}`} className="flex gap-3 items-start mb-0">
          <div className="flex flex-col items-center w-8 flex-shrink-0">
            <LineIcon lineKey={lineName} size="w-8 h-8" />
            <div
              className="w-1 flex-1 min-h-[2rem]"
              style={{ backgroundColor: color }}
            />
          </div>
          <div className="flex items-start gap-2 flex-1">
            <div className="flex-1">
              <p className="font-semibold text-sm text-slate-900 leading-tight">
                {leg.from?.name?.replace(/^[^,]+,\s*/, "")}
              </p>
              <p className="text-[12.5px] text-slate-600">
                {new Date(leg.startTime).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>,
      );

      const stopCount = (leg.intermediateStops?.length || 0) + 1;
      items.push(
        <div
          key={`transit-bar-${i}`}
          className="flex gap-3 mb-0"
          style={{ minHeight: "3rem" }}
        >
          <div className="flex flex-col items-center w-8 flex-shrink-0">
            <div className="w-1 flex-1" style={{ backgroundColor: color }} />
          </div>
          <div className="flex items-center mb-7">
            <p className="text-[12.5px] text-slate-600">
              {formatDuration(durationMin)} · {stopCount} arrêt
              {stopCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>,
      );

      const nextLeg = allLegs[i + 1];
      const nextIsTransit = nextLeg && nextLeg.mode !== "WALK";

      items.push(
        <div key={`transit-end-${i}`} className="flex gap-3 items-start mb-0">
          <div className="flex flex-col items-center w-8 flex-shrink-0">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {nextIsTransit && (
              <div
                className="w-0 border-l-2 border-dashed border-slate-300"
                style={{ height: "24px" }}
              />
            )}
          </div>
          <div className={`flex-1 ${nextIsTransit ? "mb-0" : ""}`}>
            <p className="font-semibold text-sm text-slate-900 leading-tight">
              {leg.to?.name?.replace(/^[^,]+,\s*/, "")}
            </p>
            <p className="text-[12.5px] text-slate-600">
              {new Date(leg.endTime).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>,
      );

      if (nextIsTransit) {
        items.push(
          <div
            key={`transfer-gap-${i}`}
            className="flex gap-3 items-center"
            style={{ minHeight: "8px" }}
          />,
        );
      }
    }

    if (isWalk && durationMin >= 1) {
      items.push(
        <div key={`walk-${i}`} className="flex gap-3 items-center">
          <div className="flex flex-col items-center w-8 flex-shrink-0">
            {i !== 0 && (
              <div
                className="border-l-2 border-dashed border-slate-300"
                style={{ height: "28px", marginTop: "-10px" }}
              />
            )}
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 320 512"
              className="w-5 h-5 opacity-60 flex-shrink-0 my-3"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M208 96c26.5 0 48-21.5 48-48S234.5 0 208 0s-48 21.5-48 48 21.5 48 48 48zm94.5 149.1l-23.3-11.8-9.7-29.4c-14.7-44.6-55.7-75.8-102.2-75.9-36-.1-55.9 10.1-93.3 25.2-21.6 8.7-39.3 25.2-49.7 46.2L17.6 213c-7.8 15.8-1.5 35 14.2 42.9 15.6 7.9 34.6 1.5 42.5-14.3L81 228c3.5-7 9.3-12.5 16.5-15.4l26.8-10.8-15.2 60.7c-5.2 20.8.4 42.9 14.9 58.8l59.9 65.4c7.2 7.9 12.3 17.4 14.9 27.7l18.3 73.3c4.3 17.1 21.7 27.6 38.8 23.3 17.1-4.3 27.6-21.7 23.3-38.8l-22.2-89c-2.6-10.3-7.7-19.9-14.9-27.7l-45.5-49.7 17.2-68.7 5.5 16.5c5.3 16.1 16.7 29.4 31.7 37l23.3 11.8c15.6 7.9 34.6 1.5 42.5-14.3 7.7-15.7 1.4-35.1-14.3-43zM73.6 385.8c-3.2 8.1-8 15.4-14.2 21.5l-50 50.1c-12.5 12.5-12.5 32.8 0 45.3s32.7 12.5 45.2 0l59.4-59.4c6.1-6.1 10.9-13.4 14.2-21.5l13.5-33.8c-55.3-60.3-38.7-41.8-47.4-53.7l-20.7 51.5z" />
            </svg>
            {i !== allLegs.length - 1 && (
              <div
                className="border-l-2 border-dashed border-slate-300"
                style={{ height: "28px", marginBottom: "12px" }}
              />
            )}
          </div>
          <p className="text-[13px] text-slate-600 mb-5">
            À pied · {formatDuration(durationMin)}
          </p>
        </div>,
      );
    }
  });

  return <div className="relative">{items}</div>;
}
