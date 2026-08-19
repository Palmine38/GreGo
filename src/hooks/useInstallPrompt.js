import { useEffect, useState } from "react";

const DISMISS_KEY = "gregoInstallPromptDismissed";

export function detectPlatform() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";

  // iOS classique + iPadOS 13+ qui se fait passer pour macOS (Safari desktop UA)
  // mais qui garde le support tactile.
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);

  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
}

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (typeof window !== "undefined" && window.innerWidth < 768)
  );
}

export function isRunningStandalone() {
  if (typeof window === "undefined") return false;
  const mql =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches;
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(mql || iosStandalone);
}

/**
 * Décide si le prompt d'installation doit s'afficher au lancement.
 *
 * Règles :
 * - mobile uniquement (pas de desktop)
 * - PWA pas déjà installée (standalone)
 * - pas déjà fermé pendant cette session (sessionStorage)
 * - iOS et Android supportés (tutoriel manuel dans les deux cas)
 */
export function useInstallPrompt() {
  const [state, setState] = useState({
    ready: false,
    shouldShow: false,
    platform: null,
  });

  useEffect(() => {
    const platform = detectPlatform();
    const mobile = isMobileDevice();
    const standalone = isRunningStandalone();
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === "true";

    const shouldShow =
      mobile &&
      !standalone &&
      !dismissed &&
      (platform === "ios" || platform === "android");

    setState({ ready: true, shouldShow, platform });
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setState((s) => ({ ...s, shouldShow: false }));
  };

  return { ...state, dismiss };
}
