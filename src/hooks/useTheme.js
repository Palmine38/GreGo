import { useEffect, useState } from "react";

export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
  GRAY: "gray",
  AUTO: "auto",
};

export function normalizeTheme(theme) {
  return Object.values(THEMES).includes(theme) ? theme : THEMES.AUTO;
}

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return THEMES.LIGHT;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? THEMES.GRAY
    : THEMES.LIGHT;
}

// Résout un thème stocké (qui peut être "auto") vers un thème réellement
// applicable (light | dark | gray) en fonction des préférences système.
export function resolveTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  return nextTheme === THEMES.AUTO ? getSystemTheme() : nextTheme;
}

export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === THEMES.DARK);
  root.classList.toggle("gray", resolved === THEMES.GRAY);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved === THEMES.LIGHT ? "light" : "dark";
  return resolved;
}

// Permet de réagir en direct à un changement de thème système (utile quand
// le thème sélectionné est "auto").
export function watchSystemTheme(callback) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => callback();
  if (mql.addEventListener) mql.addEventListener("change", handler);
  else mql.addListener(handler);
  return () => {
    if (mql.removeEventListener) mql.removeEventListener("change", handler);
    else mql.removeListener(handler);
  };
}

export function getTheme() {
  if (typeof document === "undefined") return "light";
  if (document.documentElement.classList.contains("dark")) return THEMES.DARK;
  if (document.documentElement.classList.contains("gray")) return THEMES.GRAY;
  return THEMES.LIGHT;
}

export function useTheme() {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const update = () => setTheme(getTheme());
    update();
    window.addEventListener("tag-express-theme-change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      window.removeEventListener("tag-express-theme-change", update);
      observer.disconnect();
    };
  }, []);

  return theme;
}
