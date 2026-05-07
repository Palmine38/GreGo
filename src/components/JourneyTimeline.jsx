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
            <img
              src="/walk.svg"
              alt="marche"
              className="w-5 h-5 opacity-60 flex-shrink-0 my-3"
            />
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
