import { useEffect, useMemo, useState } from "react";
import { getLineGeometries } from "../utils/lineShapes.js";
import { getRouteCandidates } from "../utils/routeRef.js";
import { useLightMode } from "./useLightMode.js";

const EMPTY_SHAPES = new Map();

/**
 * Tracés de référence des lignes empruntées par un itinéraire.
 *
 * Le chargement est asynchrone (réseau puis IndexedDB, voir utils/lineShapes.js)
 * alors que le dessin de la carte, lui, est synchrone : on renvoie donc une Map
 * vide au premier rendu. Les cartes affichent pendant ce temps la polyligne OTP
 * recalée, puis basculent sur le tracé exact au rendu suivant — c'est un
 * raffinement du tracé, jamais son apparition.
 *
 * @param {object[]} legs  Les `allLegs` de l'itinéraire.
 * @returns {Map<string, object>} Géométries indexées par code court ("C1", "A"…).
 */
export function useJourneyLineShapes(legs) {
  // On garde la signature à côté des tracés : elle dit à quel itinéraire ils
  // appartiennent. Sans elle, changer d'itinéraire laisserait les tracés du
  // précédent affichés jusqu'à l'arrivée des nouveaux.
  const [loaded, setLoaded] = useState(null);
  const lightMode = useLightMode();

  const lineKeys = useMemo(() => {
    const keys = (legs || [])
      .filter((leg) => leg?.mode !== "WALK")
      .map(
        (leg) =>
          getRouteCandidates(leg?.routeShortName, leg?.route, leg?.routeId)[0],
      )
      .filter(Boolean);
    return Array.from(new Set(keys)).sort();
  }, [legs]);

  // Les Map/tableaux changent d'identité à chaque rendu : c'est la liste des
  // codes, elle, qui décide s'il faut refaire le travail.
  const signature = lineKeys.join("|");

  useEffect(() => {
    if (!signature) return undefined;
    // Mode léger : on s'en tient à la polyligne fournie par OTP avec
    // l'itinéraire, déjà présente en mémoire. Récupérer le tracé publié coûte
    // plusieurs requêtes par ligne empruntée, pour un gain uniquement visuel —
    // c'est exactement le raffinement décrit plus haut, et son absence est un
    // cas déjà prévu : la carte reste correcte, le tracé est simplement moins
    // fidèle aux courbes réelles de la voie.
    if (lightMode) return undefined;

    let active = true;
    getLineGeometries(signature.split("|"))
      .then((geometries) => {
        if (active) setLoaded({ signature, shapes: geometries });
      })
      .catch(() => {
        if (active) setLoaded({ signature, shapes: EMPTY_SHAPES });
      });

    return () => {
      active = false;
    };
  }, [signature, lightMode]);

  if (lightMode) return EMPTY_SHAPES;
  return loaded?.signature === signature ? loaded.shapes : EMPTY_SHAPES;
}
