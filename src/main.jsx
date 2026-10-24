import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
// La feuille de style de maplibre est importée par les composants carte
// eux-mêmes (voir components/lazyMaps.jsx) : elle voyage ainsi dans le chunk
// chargé à la demande, au lieu d'alourdir le CSS du premier rendu.
import "./index.css";
import "./desktop.css";
import App from "./App.jsx";
import { applyTheme, normalizeTheme } from "./hooks/useTheme.js";
import { applyDesktopClass } from "./hooks/useIsDesktop.js";
import { readRailExpanded } from "./components/desktop/desktopPanels.js";

const container = document.getElementById("root");

// Appliqué avant le premier rendu (et non plus dans un effet d'App) : les
// classes de thème sont ainsi posées sur <html> dès la première peinture, ce
// qui évite un flash de thème clair et permet à l'écran de chargement des
// routes de s'afficher immédiatement dans la bonne couleur.
try {
  const saved = JSON.parse(localStorage.getItem("tag-express-settings"));
  applyTheme(normalizeTheme(saved?.theme));
} catch {
  applyTheme("light");
}

// Même logique pour le shell desktop : la largeur de la barre latérale est
// réservée dès la première peinture, sans décalage du contenu au montage.
if (applyDesktopClass()) {
  document.documentElement.dataset.gdRail = readRailExpanded() ? "wide" : "slim";
}

const renderApp = () => {
  if (container && container.hasChildNodes()) {
    hydrateRoot(
      container,
      <StrictMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </StrictMode>,
    );
  } else {
    createRoot(container).render(
      <StrictMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </StrictMode>,
    );
  }
};

// Le préchargement du catalogue de lignes qui se trouvait ici a été retiré :
// preloadStops() (appelé par App) demande déjà /index/routes via le cache
// partagé de utils/routesCache.js, si bien que les deux appels se déclenchaient
// au même instant au démarrage.
renderApp();
