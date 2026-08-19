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
import { PageSeo } from "./components/PageSeo.jsx";
import { useInstallPrompt } from "./hooks/useInstallPrompt.js";
import { InstallGreGoSheet } from "./components/InstallGreGoSheet.jsx";
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

function SeoRoute({ page, children }) {
  return (
    <>
      <PageSeo page={page} />
      {children}
    </>
  );
}
function InstallPromptGate() {
  const { ready, shouldShow, platform, dismiss } = useInstallPrompt();
  if (!ready) return null;

  return (
    <InstallGreGoSheet
      isOpen={shouldShow}
      onClose={dismiss}
      platform={platform}
    />
  );
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
      <InstallPromptGate />
      <Routes>
        <Route path="/mobile" element={<NoMobile />} />
        <Route
          path="/fastresearch"
          element={
            <SeoRoute page="fastResearch">
              <DeviceGuard>
                <FastResearch />
              </DeviceGuard>
            </SeoRoute>
          }
        />
        <Route
          path="/mes-trajets"
          element={
            <SeoRoute page="trips">
              <DeviceGuard>
                <MesTrajets />
              </DeviceGuard>
            </SeoRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <SeoRoute page="settings">
              <DeviceGuard>
                <Settings />
              </DeviceGuard>
            </SeoRoute>
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
            <SeoRoute page="traffic">
              <DeviceGuard>
                <InfoTrafic />
              </DeviceGuard>
            </SeoRoute>
          }
        />
        <Route
          path="/"
          element={
            <SeoRoute page="home">
              <Navigate to="/mes-trajets" replace />
            </SeoRoute>
          }
        />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
