import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { getTheme } from "./hooks/useTheme.js";
import { preloadStops } from "./hooks/useStops.js";
import { DevOverlay } from "./components/devOverlay.jsx";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { PageSeo } from "./components/PageSeo.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import { prefetchMapChunk } from "./components/mapChunkLoaders.js";
import { scheduleIdle } from "./utils/scheduleIdle.js";
import { useLightMode } from "./hooks/useLightMode.js";
import { useInstallPrompt } from "./hooks/useInstallPrompt.js";
import { InstallGreGoSheet } from "./components/InstallGreGoSheet.jsx";
import {
  notifyInstallPromptResolved,
} from "./utils/installPromptGate.js";
import "./App.css";

// Chaque page est chargée à la demande : sans cela, ouvrir /mes-trajets
// téléchargeait aussi Settings, InfoTrafic et FastResearch (plus de 170 ko de
// source) avant le premier rendu, alors qu'une seule page n'est jamais affichée
// à la fois.
const FastResearch = lazy(() => import("./fast-research.jsx"));
const MesTrajets = lazy(() => import("./mes-trajets.jsx"));
const Settings = lazy(() => import("./settings.jsx"));
const NoMobile = lazy(() => import("./nomobile.jsx"));
const InfoTrafic = lazy(() => import("./infotrafic.jsx"));

// Affiché le temps qu'arrive le module de la page. Volontairement identique au
// pré-splash de index.html : le relais entre les deux est invisible, là où un
// fallback vide aurait provoqué un flash de page blanche. Le thème est déjà
// posé sur <html> par main.jsx avant le premier rendu, donc getTheme() renvoie
// ici la bonne valeur dès le départ.
function RouteFallback() {
  return <SplashScreen theme={getTheme()} />;
}

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

  useEffect(() => {
    if (ready && !shouldShow) notifyInstallPromptResolved();
  }, [ready, shouldShow]);

  const close = () => {
    dismiss();
    notifyInstallPromptResolved();
  };

  if (!ready) return null;

  return (
    <InstallGreGoSheet
      isOpen={shouldShow}
      onClose={close}
      platform={platform}
    />
  );
}

function App() {
  const lightMode = useLightMode();

  useEffect(() => {
    // Le thème est désormais appliqué par main.jsx avant le premier rendu, pour
    // que le fallback de route s'affiche d'emblée dans la bonne couleur.

    // Ces deux préparations sont utiles mais non urgentes : les déclencher
    // immédiatement les ferait concurrencer le téléchargement du code de la
    // page, qui lui conditionne le premier rendu. On attend donc que le
    // navigateur ait fini l'essentiel.
    //
    // (La page appelle de toute façon useStops() en montant : ce préchargement
    // n'est qu'une avance, jamais une condition.)
    // Les arrêts d'abord (ils conditionnent la recherche), la carte ensuite :
    // prefetchMapChunk planifie sa propre période d'inactivité, ce qui laisse
    // naturellement passer le référentiel en premier.
    scheduleIdle(() => preloadStops());
    prefetchMapChunk();
  }, []);

  return (
    <Router>
      <DevOverlay />
      <InstallPromptGate />
      <Suspense fallback={<RouteFallback />}>
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
        {/* PAS ENCORE DISPONIBLE SUR LE SITE PUBLIC : la route /suivi-beta est
            désactivée. Son import a été retiré pour que suivi-beta.jsx ne soit
            plus embarqué dans le bundle ; le rétablir suppose de réintroduire
            un `lazy(() => import("./suivi-beta.jsx"))` avec les autres pages. */}
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
      </Suspense>
      {/* Mode léger : les deux scripts de mesure d'audience sont chargés depuis
          le réseau et n'apportent rien à l'utilisateur. Ils sautent en premier. */}
      {!lightMode && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
    </Router>
  );
}

export default App;
