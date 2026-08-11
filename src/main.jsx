import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./index.css";
import App from "./App.jsx";
import { preloadLineRouteCache } from "./components/lines-icons.jsx";
import { Analytics } from "@vercel/analytics/next";

const container = document.getElementById("root");

const renderApp = () => {
  if (container && container.hasChildNodes()) {
    hydrateRoot(
      container,
      <StrictMode>
        <App />
        <Analytics />
      </StrictMode>,
    );
  } else {
    createRoot(container).render(
      <StrictMode>
        <App />
        <Analytics />
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
