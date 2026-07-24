import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./index.css";
import App from "./App.jsx";

const container = document.getElementById("root");

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
