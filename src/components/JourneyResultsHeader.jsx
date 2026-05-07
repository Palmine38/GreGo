import React from "react";
import LineIcon from "./lines-icons.jsx";

const DisruptedIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    className="size-3"
  >
    <path d="M8 3.5 3 12.5h10L8 3.5Z" fill="white" />
    <path
      fillRule="evenodd"
      d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      clipRule="evenodd"
    />
  </svg>
);

const ArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-5 inline mx-2 align-text-bottom"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
    />
  </svg>
);

/**
 * Carte récapitulative affichée en haut des résultats :
 * - trajet Départ → Arrivée
 * - icônes des lignes utilisées (avec badge perturbation si besoin)
 *
 * Props :
 *   dep, arr       — noms des arrêts
 *   results        — tableau des itinéraires (pour extraire les lignes uniques)
 *   searchBaseDate — Date de référence de la recherche
 *   timeOffset     — décalage en heures par rapport à maintenant
 *   loading        — bool
 *   showRefreshCheck — bool (affiche un check à la place de l'icône refresh)
 *   isLineDisrupted — fn(lineKey) → bool
 *   onLineClick    — fn(lineKey) — ouvre le panneau infotrafic
 *   onRefresh      — callback refresh
 */
export function JourneyResultsHeader({
  dep,
  arr,
  results,
  searchBaseDate,
  timeOffset,
  loading,
  showRefreshCheck,
  isLineDisrupted,
  onLineClick,
  onRefresh,
}) {
  const savedSettings = JSON.parse(
    localStorage.getItem("tag-express-settings") || "{}",
  );
  const headerLinesSetting = savedSettings.headerLines ?? "all";

  const allUniqueLines = Array.from(
    new Set(results.flatMap((r) => r.lineKeys || [])),
  ).filter((lk) => {
    if (headerLinesSetting === "hidden") return false;
    if (headerLinesSetting === "disrupted") return isLineDisrupted(lk);
    return true;
  });
  const displayTime = new Date(
    searchBaseDate.getTime() + timeOffset * 60 * 60 * 1000,
  )
    .toTimeString()
    .slice(0, 5);

  return (
    <>
      {/* Résumé itinéraire + icônes lignes */}
      <div className="mb-3 p-4 bg-white border border-gray-200 rounded-2xl shadow-md">
        <div className="font-bold text-gray-900 mt-1">
          <span>
            <span>{dep.includes("::") ? dep.split("::")[0] : dep}</span>
          </span>
          <ArrowIcon />
          <span>{arr.includes("::") ? arr.split("::")[0] : arr}</span>
        </div>
        {headerLinesSetting !== "hidden" && allUniqueLines.length > 0 && (
          <div className="flex items-center gap-[0.4rem] mt-3">
            <div className="flex items-center gap-[0.4rem] mt-3">
              {allUniqueLines.map((lk) =>
                isLineDisrupted(lk) ? (
                  <button
                    key={lk}
                    className="relative"
                    onClick={() => onLineClick(lk)}
                  >
                    <LineIcon lineKey={lk} size="w-6 h-6" />
                    <span
                      className="absolute -bottom-1 -right-1"
                      style={{ color: "#e61e1e" }}
                    >
                      <DisruptedIcon />
                    </span>
                  </button>
                ) : (
                  <div key={lk} className="relative">
                    <LineIcon lineKey={lk} size="w-6 h-6" />
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ligne horaire + bouton refresh */}
      <div className="mt-4 mb-4 text-left flex items-center gap-2">
        <span className="text-sm text-gray-600">
          Résultats pour {displayTime}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto text-gray-600 hover:text-gray-900 transition-colors"
          title="Rafraîchir"
        >
          {showRefreshCheck ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
