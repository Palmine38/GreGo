import { useEffect, useRef } from "react";

// Pile des couches ouvertes (sheets, carte d'un trajet…) : Échap ferme la
// plus récente.
const openSheets = [];
function onEscape(event) {
  if (event.key !== "Escape" || !openSheets.length) return;
  event.stopPropagation();
  openSheets[openSheets.length - 1].current?.();
}

export function useEscapeLayer(active, onClose) {
  // Référence stable pendant toute l'ouverture : onClose est souvent une
  // fonction recréée à chaque rendu, ce qui ne doit pas réordonner la pile.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return undefined;
    const entry = closeRef;
    openSheets.push(entry);
    if (openSheets.length === 1) {
      window.addEventListener("keydown", onEscape, true);
    }
    return () => {
      openSheets.splice(openSheets.indexOf(entry), 1);
      if (!openSheets.length) {
        window.removeEventListener("keydown", onEscape, true);
      }
    };
  }, [active]);
}
