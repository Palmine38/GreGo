import React, { useEffect, useState } from "react";
import LineIcon from "./lines-icons.jsx";
import { DisruptionItem } from "./DisruptionItem.jsx";
import { Sheet } from "react-modal-sheet";

export function LineInfoSheet({
  lineKey,
  isOpen,
  onClose,
  getLineDisruptions,
}) {
  const [height, setHeight] = useState(60);

  useEffect(() => {
    if (lineKey) setHeight(60);
  }, [lineKey]);

  if (!lineKey) return null;

  const disruptions = getLineDisruptions(lineKey);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container style={{ borderRadius: "24px 24px 0 0" }}>
        <Sheet.Header />
        <Sheet.Content>
          <div className="overflow-y-auto flex-1 px-4 pb-8">
            <div className="flex items-center gap-3 mb-4">
              <LineIcon lineKey={lineKey} size="w-10 h-10" />
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  Infotrafic
                </p>
                <h2 className="text-lg font-bold text-slate-900">
                  Ligne {lineKey}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="ml-auto text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ×
              </button>
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
