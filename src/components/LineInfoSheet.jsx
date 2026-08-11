import React, { useEffect, useState } from "react";
import LineIcon from "./lines-icons.jsx";
import { DisruptionItem } from "./DisruptionItem.jsx";
import { Sheet } from "react-modal-sheet";

export function LineInfoSheet({
  lineKey,
  isOpen,
  onClose,
  getLineDisruptions,
  initialSnap = 1,
  onBack,
}) {
  const [height, setHeight] = useState(60);
  // On garde la dernière ligne affichée pour que le contenu (et le Sheet
  // lui-même) restent montés pendant l'animation de fermeture, même si le
  // parent a déjà remis `lineKey` à null.
  const [displayedLine, setDisplayedLine] = useState(lineKey);

  useEffect(() => {
    if (lineKey) {
      setDisplayedLine(lineKey);
      setHeight(60);
    }
  }, [lineKey]);

  if (!displayedLine) return null;

  const disruptions = getLineDisruptions(displayedLine);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.6, 1]}
      initialSnap={initialSnap}
      dragVelocityThreshold={200}
      dragCloseThreshold={0.3}
    >
      <Sheet.Container
        style={{ borderRadius: "24px 24px 0 0", overflow: "hidden" }}
      >
        <Sheet.Header />
        <Sheet.Content>
          <div className="overflow-y-auto flex-1 px-4 pb-8">
            <div className="flex items-center gap-3 mb-4">
              {onBack && (
                <button type="button" onClick={onBack} aria-label="Retour à l'arrêt" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">‹</button>
              )}
              <LineIcon lineKey={displayedLine} size="w-10 h-10" />
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  Infotrafic
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  Ligne {displayedLine}
                </h2>
              </div>
            </div>

            {disruptions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Aucune perturbation en cours.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {disruptions.map((evt, i) => (
                  <DisruptionItem key={i} evt={evt} />
                ))}
              </div>
            )}
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
