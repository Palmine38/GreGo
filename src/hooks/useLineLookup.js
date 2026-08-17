import { useEffect, useState } from "react";
import { getAllLines, buildLineLookup } from "../utils/allLines.js";

// Partagé entre tous les composants qui appellent le hook : un seul calcul
// de lookup pour toute l'appli (getAllLines() a déjà son propre cache
// mémoire/localStorage côté fetch, ceci évite en plus de reconstruire la
// Map à chaque montage).
let cachedLookup = null;

/**
 * Charge le catalogue des lignes et renvoie la Map de résolution
 * (id complet + code nu -> ligne), pour utils/routeLineResolver.js.
 * Renvoie `null` tant que le chargement initial n'est pas terminé —
 * resolveRouteLine gère très bien un lookup absent (fallback LINE_COLORS).
 */
export function useLineLookup() {
  const [lineLookup, setLineLookup] = useState(cachedLookup);

  useEffect(() => {
    if (cachedLookup) return;
    let active = true;
    getAllLines().then((lines) => {
      if (!active) return;
      cachedLookup = buildLineLookup(lines);
      setLineLookup(cachedLookup);
    });
    return () => {
      active = false;
    };
  }, []);

  return lineLookup;
}
