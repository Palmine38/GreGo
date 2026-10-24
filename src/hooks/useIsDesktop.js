import { useSyncExternalStore } from "react";

// Un PC est reconnu à son appareil, pas à la largeur de la fenêtre : pointeur
// principal précis (souris, pavé tactile) et ni téléphone ni tablette. Une
// fenêtre de PC rétrécie garde donc l'interface ordinateur.
const FINE_POINTER_QUERY = "(pointer: fine)";
// Garde-fou : en dessous, la barre latérale ne laisse plus de place au contenu.
const MIN_WIDTH_QUERY = "(min-width: 640px)";

function isPhoneOrTablet() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    // iPadOS 13+ se présente comme un Mac mais reste tactile.
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

export function isDesktopViewport() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    !isPhoneOrTablet() &&
    window.matchMedia(FINE_POINTER_QUERY).matches &&
    window.matchMedia(MIN_WIDTH_QUERY).matches
  );
}

// Posée sur <html> avant le premier rendu (voir main.jsx) : les styles du
// shell desktop (desktop.css) s'appliquent ainsi dès la première peinture.
export function applyDesktopClass() {
  const desktop = isDesktopViewport();
  document.documentElement.classList.toggle("is-desktop", desktop);
  return desktop;
}

function subscribe(callback) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const queries = [FINE_POINTER_QUERY, MIN_WIDTH_QUERY].map((q) =>
    window.matchMedia(q),
  );
  const handler = () => {
    applyDesktopClass();
    callback();
  };
  queries.forEach((mql) => mql.addEventListener("change", handler));
  return () =>
    queries.forEach((mql) => mql.removeEventListener("change", handler));
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, isDesktopViewport, () => false);
}
