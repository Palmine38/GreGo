import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
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

(async () => {
  try {
    await preloadLineRouteCache();
  } catch (error) {
    console.error("Préchargement des routes échoué:", error);
  }
  renderApp();
})();
