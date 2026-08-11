import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./index.css";
import App from "./App.jsx";
import { preloadLineRouteCache } from "./components/lines-icons.jsx";

const container = document.getElementById("root");

const renderApp = () => {
  if (container && container.hasChildNodes()) {
    hydrateRoot(
      container,
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } else {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
};

(async () => {
  try {
    await preloadLineRouteCache();
  } catch (error) {
    console.error("Préchargement des routes échoué:", error);
  }
  renderApp();
})();
