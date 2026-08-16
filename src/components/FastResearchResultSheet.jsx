import React, { useEffect, useState } from "react";
import { Sheet } from "react-modal-sheet";
import { JourneyCard } from "./JourneyCard.jsx";
import { JourneyDetailsContent } from "./JourneyDetailsSheet.jsx";
import { useTheme } from "../hooks/useTheme.js";

const ArrowRightIcon = ({ className = "size-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
    />
  </svg>
);

/**
 * Sheet listant les résultats d'une recherche rapide (fast research).
 *
 * La liste de JourneyCard cliquables et le détail du trajet (contenu de
 * JourneyDetailsSheet) cohabitent dans une seule et même Sheet : cliquer
 * sur une carte ne fait pas apparaître de nouvelle sheet, ça glisse la vue
 * détail depuis la droite par-dessus la liste (même principe que la vue
 * liste → détail véhicule de GbfsSheet). Le bouton retour de la vue détail
 * fait le trajet inverse.
 *
 * Props :
 *   results          — liste d'itinéraires déjà filtrés/triés (visibleResults)
 *   isOpen           — bool
 *   onClose          — callback fermeture
 *   currentTime      — Date courante (pour "dans X min")
 *   isLineDisrupted  — fn(lineKey) → bool
 *   dep, arr         — libellés affichés en haut ("<dep> → <arr>")
 *   timeOffset, loading — utilisés pour la pagination temporelle
 *   onSelectJourney  — fn(item) appelée quand une carte est cliquée ; si elle
 *                       retourne un objet, celui-ci est utilisé comme trajet
 *                       affiché dans la vue détail (permet au parent de
 *                       l'enrichir : noms résolus, rawDep/rawArr, etc.) —
 *                       sinon l'item brut est utilisé tel quel
 *   onBackFromJourney — callback optionnelle, appelée quand on revient de la
 *                       vue détail à la liste (bouton retour)
 *   onSearchOffset   — fn(offset) pour naviguer avant/après dans le temps
 *   afterLabel       — libellé du bouton "rechercher pour après HH:MM"
 *   snapPoints, initialSnap — config react-modal-sheet
 *   lineColors, getLineDisruptions, onLineClick, hideMap — transmis tels
 *     quels à JourneyDetailsContent pour la vue détail
 */
export function FastResearchResultSheet({
  results = [],
  isOpen,
  onClose,
  currentTime,
  isLineDisrupted,
  dep,
  arr,
  timeOffset = 0,
  loading = false,
  onSelectJourney,
  onBackFromJourney,
  onSearchOffset,
  afterLabel,
  snapPoints = [0, 0.4, 0.85, 1],
  initialSnap = 2,
  lineColors,
  getLineDisruptions = () => [],
  onLineClick,
  hideMap = false,
}) {
  const [selectedJourney, setSelectedJourney] = useState(null);
  const theme = useTheme();
  // Le header "<dep> → <arr>" doit rester lisible en mode clair et sombre.
  const isDarkMode = theme !== "light";
  const textColor = isDarkMode ? "text-slate-100" : "text-slate-900";
  const arrowColor = isDarkMode ? "text-gray-500" : "text-slate-600";

  // Revenir à la liste quand la sheet se ferme ou qu'une nouvelle recherche démarre
  useEffect(() => {
    if (!isOpen) setSelectedJourney(null);
  }, [isOpen]);

  useEffect(() => {
    setSelectedJourney(null);
  }, [dep, arr]);

  const handleSelectJourney = (item) => {
    const enriched = onSelectJourney?.(item);
    setSelectedJourney(enriched ?? item);
  };

  const handleBack = () => {
    setSelectedJourney(null);
    onBackFromJourney?.();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.6, 1]}
      initialSnap={1}
    >
      <Sheet.Container
        style={{
          borderRadius: "24px 24px 0 0",
          backgroundColor: "var(--sheet-bg)",
          overflow: "hidden",
        }}
      >
        <Sheet.Header />
        <Sheet.Content disableDrag={(state) => state.scrollPosition !== "top"}>
          <div className="relative h-full overflow-hidden">
            {/* ── Vue liste des résultats ── */}
            <div
              className="flex h-full flex-col px-4 pb-4 overflow-y-auto transition-transform duration-300 ease-out"
              style={{
                transform: selectedJourney
                  ? "translateX(-100%)"
                  : "translateX(0)",
              }}
            >
              {/* En-tête minimal : "<dep> → <arr>", centré, sans bordure ni fond */}
              {(dep || arr) && (
                <div
                  className={`flex items-left justify-left gap-2 py-2 text-xl font-semibold ${textColor}`}
                >
                  <span>{dep}</span>
                  <ArrowRightIcon className={`size-6 ${arrowColor}`} />
                  <span>{arr}</span>
                </div>
              )}

              {/* Liste des résultats, cliquables → vue détail (swipe) */}
              <div className="space-y-2 mt-3">
                {results.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {loading
                      ? "Recherche en cours..."
                      : "Aucun itinéraire trouvé."}
                  </div>
                ) : (
                  results.map((item, idx) => (
                    <JourneyCard
                      key={idx}
                      item={item}
                      currentTime={currentTime}
                      isLineDisrupted={isLineDisrupted}
                      onClick={() => handleSelectJourney(item)}
                    />
                  ))
                )}
              </div>

              {/* Navigation temporelle */}
              <div
                className={`mt-4 flex items-center gap-2 ${
                  results.length > 0 && timeOffset >= 0
                    ? "justify-between"
                    : "justify-end"
                }`}
              >
                {timeOffset >= 0 && results.length > 0 && (
                  <button
                    className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700"
                    onClick={() => onSearchOffset?.(timeOffset - 0.5)}
                    disabled={loading}
                  >
                    <ArrowRightIcon className="size-4 scale-x-[-1]" />
                  </button>
                )}
                {results.length > 0 && (
                  <button
                    className="px-2 py-1 text-sm font-semibold text-black hover:text-gray-700"
                    onClick={() => onSearchOffset?.(timeOffset + 0.5)}
                    disabled={loading}
                  >
                    rechercher pour {afterLabel}
                    <ArrowRightIcon className="size-4 inline ml-1" />
                  </button>
                )}
              </div>

              <div style={{ height: "10vh" }} />
            </div>

            {/* ── Vue détail du trajet sélectionné ── */}
            <div
              className="absolute inset-0 flex h-full flex-col overflow-y-auto transition-transform duration-300 ease-out"
              style={{
                transform: selectedJourney
                  ? "translateX(0)"
                  : "translateX(100%)",
              }}
            >
              {selectedJourney && (
                <JourneyDetailsContent
                  journey={selectedJourney}
                  lineColors={lineColors}
                  getLineDisruptions={getLineDisruptions}
                  hideMap={hideMap}
                  onLineClick={onLineClick}
                  onBack={handleBack}
                />
              )}
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
