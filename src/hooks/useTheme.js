import { useEffect, useState } from "react";

export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
  GRAY: "gray",
};

export function normalizeTheme(theme) {
  return Object.values(THEMES).includes(theme) ? theme : THEMES.LIGHT;
}

export function applyTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", nextTheme === THEMES.DARK);
  root.classList.toggle("gray", nextTheme === THEMES.GRAY);
  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme === THEMES.LIGHT ? "light" : "dark";
  return nextTheme;
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
