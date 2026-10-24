// Communication entre le shell desktop et les pages : n'importe quel élément
// (bandeau d'en-tête, page) peut ouvrir un panneau latéral sans dépendre du
// shell, qui reste le seul à en posséder l'état.
const PANEL_EVENT = "grego:desktop-panel";

export const PANELS = {
  TRAJETS: "trajets",
  TRAFFIC: "traffic",
  ABOUT: "about",
};

export function openDesktopPanel(panel) {
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: panel }));
}

export function onDesktopPanelRequest(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(PANEL_EVENT, listener);
  return () => window.removeEventListener(PANEL_EVENT, listener);
}

// Sélection d'un trajet enregistré depuis le panneau, quand la page
// « Mes trajets » est déjà affichée.
export const SELECT_TRAJET_EVENT = "grego:select-trajet";
// Émis par « Mes trajets » à chaque sauvegarde, pour rafraîchir le panneau.
export const TRAJETS_CHANGED_EVENT = "grego:trajets-changed";

const RAIL_STORAGE_KEY = "grego-desktop-rail";

export function readRailExpanded() {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) === "wide";
  } catch {
    return false;
  }
}

export function saveRailExpanded(expanded) {
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, expanded ? "wide" : "slim");
  } catch {
    // Stockage indisponible (navigation privée) : l'état reste en mémoire.
  }
}
