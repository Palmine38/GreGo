import { useEffect, useState } from "react";

const STORAGE_KEY = "tag-express-perf-settings";
const CHANGE_EVENT = "tag-express-perf-change";

const DEFAULT_SETTINGS = {
  devMode: false,
  devOverlay: false,
};

/**
 * Charge les paramètres de performance (overlay de stats) depuis le
 * localStorage et expose des fonctions pour les modifier.
 *
 * Deux façons de l'activer :
 * - Raccourci clavier Ctrl/Cmd + Maj + P (desktop)
 * - Toggle "Afficher les statistiques" dans la page Réglages (mobile)
 *
 * Comme le hook peut être monté à plusieurs endroits en même temps (l'overlay
 * dans App.jsx, le toggle dans Settings.jsx), un événement custom est
 * déclenché à chaque changement pour que toutes les instances se
 * resynchronisent, y compris entre onglets via l'événement 'storage'.
 *
 * Retourne { settings, setDevMode, setDevOverlay, setOverlayVisible, toggleDevOverlay, reloadSettings }.
 */
export function usePerfSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const load = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({
          devMode: parsed.devMode ?? false,
          devOverlay: parsed.devOverlay ?? false,
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (e) {
      console.error("Erreur chargement perf settings:", e);
    }
  };

  const persist = (next) => {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch (e) {
      console.error("Erreur sauvegarde perf settings:", e);
    }
  };

  const setDevMode = (value) => {
    persist({ ...settings, devMode: value });
  };

  const setDevOverlay = (value) => {
    persist({ ...settings, devOverlay: value });
  };

  // Setter unique pour un toggle simple "on/off" (utilisé dans les Réglages) :
  // active devMode et devOverlay ensemble, pas besoin de gérer les deux séparément.
  const setOverlayVisible = (value) => {
    persist({ ...settings, devMode: value, devOverlay: value });
  };

  const toggleDevOverlay = () => {
    setSettings((prev) => {
      const next = {
        ...prev,
        devMode: true,
        devOverlay: !prev.devOverlay,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(CHANGE_EVENT));
      } catch (e) {
        console.error("Erreur sauvegarde perf settings:", e);
      }
      return next;
    });
  };

  useEffect(() => {
    load();
  }, []);

  // Resynchronisation quand le réglage change ailleurs (autre composant
  // monté, autre onglet).
  useEffect(() => {
    const handleChange = () => load();
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  // Raccourci clavier global : Ctrl/Cmd + Maj + P
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isShortcut =
        (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p";
      if (isShortcut) {
        e.preventDefault();
        toggleDevOverlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    settings,
    setDevMode,
    setDevOverlay,
    setOverlayVisible,
    toggleDevOverlay,
    reloadSettings: load,
  };
}
