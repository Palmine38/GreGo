import { useEffect, useState } from "react";
import {
  LIGHT_MODE_CHANGE_EVENT,
  isLightMode,
  refreshLightMode,
} from "../utils/lightMode.js";

/**
 * Suit l'état du mode léger et provoque un rendu quand il change.
 *
 * L'état initial vient de la lecture synchrone : un composant monté alors que
 * le mode est déjà actif n'affiche donc jamais, même brièvement, la version
 * complète. Les composants qui n'ont pas besoin de réagir au changement
 * peuvent se contenter de `isLightMode()` sans passer par ce hook.
 */
export function useLightMode() {
  const [light, setLight] = useState(isLightMode);

  useEffect(() => {
    const sync = () => setLight(refreshLightMode());
    // Resynchronisation à l'entrée : le réglage a pu changer pendant que ce
    // composant était démonté (aller-retour vers la page Réglages).
    sync();
    window.addEventListener(LIGHT_MODE_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LIGHT_MODE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return light;
}
