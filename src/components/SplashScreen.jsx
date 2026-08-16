import { useEffect, useRef, useState } from "react";

// ── Écran de chargement affiché au lancement de la PWA ──────────────────────
const SPLASH_BG = {
  light: "#F8FAFC",
  dark: "#0F172A",
  gray: "#1E1E1E",
};
const SPLASH_LOGO = {
  light: "/logos/light_no_bg_banner.png",
  dark: "/logos/dark_no_bg_banner.png",
  gray: "/logos/dark_no_bg_banner.png",
};
const SPLASH_SAFETY_TIMEOUT_MS = 8000;

// Variable de module : reste "true" tant que le JS de la page n'est pas
// rechargé (donc pendant toute la session de navigation dans la PWA), mais
// repart à "false" à chaque vrai lancement/relancement de l'app. Ça permet
// de ne jouer le splash qu'une seule fois par lancement, même si on
// démonte/remonte l'écran "Mes trajets" en naviguant (ex. via Réglages).
let hasShownSplash = false;

// Pilote l'affichage du splash : à utiliser dans l'écran qui doit attendre
// une donnée (ex. le premier résultat d'itinéraires) avant de se montrer.
export function useSplashScreen(safetyTimeoutMs = SPLASH_SAFETY_TIMEOUT_MS) {
  const [visible, setVisible] = useState(!hasShownSplash);
  const doneRef = useRef(hasShownSplash);

  const markSplashDone = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    hasShownSplash = true;
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(markSplashDone, safetyTimeoutMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { splashVisible: visible, markSplashDone };
}

export default function SplashScreen({ theme }) {
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: SPLASH_BG[theme] || SPLASH_BG.light }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes tagExpressSplashHeartbeat {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.92); opacity: 0.6; }
        }
      `}</style>
      <img
        src={SPLASH_LOGO[theme] || SPLASH_LOGO.light}
        alt=""
        className="w-48 max-w-[55vw] select-none"
        draggable="false"
        style={{
          animation: "tagExpressSplashHeartbeat 1.1s ease-in-out infinite",
        }}
      />
    </div>
  );
}
