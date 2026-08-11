import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import FastResearch from "./fast-research.jsx";
import MesTrajets from "./mes-trajets.jsx";
import Settings from "./settings.jsx";
import NoMobile from "./nomobile.jsx";
import SuiviBeta from "./suivi-beta.jsx";
import InfoTrafic from "./infotrafic.jsx";
import { applyTheme, normalizeTheme } from "./hooks/useTheme.js";
import { preloadStops } from "./hooks/useStops.js";
import { DevOverlay } from "./components/devOverlay.jsx";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./App.css";

function DeviceGuard({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const bypass = sessionStorage.getItem("bypassDeviceGuard") === "true";
    if (bypass) return;

    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 768;
    if (!isMobile) {
      navigate("/mobile?false", { replace: true });
    }
  }, []);

  return children;
}

function App() {
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tag-express-settings"));
      applyTheme(normalizeTheme(saved?.theme));
    } catch {
      applyTheme("light");
    }

    preloadStops();
  }, []);

  return (
    <Router>
      <DevOverlay />
      <Routes>
        <Route path="/mobile" element={<NoMobile />} />
        <Route
          path="/fastresearch"
          element={
            <DeviceGuard>
              <FastResearch />
            </DeviceGuard>
          }
        />
        <Route
          path="/mes-trajets"
          element={
            <DeviceGuard>
              <MesTrajets />
            </DeviceGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <DeviceGuard>
              <Settings />
            </DeviceGuard>
          }
        />
        {/* PAS ENCORE DISPONIBLE SUR LE SITE PUBLIC
        <Route
          path="/suivi-beta/"
          element={
            <DeviceGuard>
              <SuiviBeta />
            </DeviceGuard>
          }
        /> */}
        <Route
          path="/infotrafic"
          element={
            <DeviceGuard>
              <InfoTrafic />
            </DeviceGuard>
          }
        />
        <Route path="/" element={<Navigate to="/mes-trajets" replace />} />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
