import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme.js";
import { useDisruptionsFeed } from "../../hooks/useDisruptionsFeed.js";
import {
  InfotraficIcon,
  SearchIcon,
  SettingsIcon,
  TripsIcon,
} from "../NavIcons.jsx";
import { AboutPanel, TrafficPanel, TrajetsPanel } from "./PanelViews.jsx";
import {
  PANELS,
  onDesktopPanelRequest,
  readRailExpanded,
  saveRailExpanded,
} from "./desktopPanels.js";

const ROUTES = [
  { path: "/mes-trajets", label: "Mes trajets", Icon: TripsIcon },
  { path: "/fastresearch", label: "Carte", Icon: SearchIcon },
  { path: "/infotrafic", label: "Infotrafic", Icon: InfotraficIcon },
  { path: "/settings", label: "Réglages", Icon: SettingsIcon },
];

function Glyph({ d, strokeWidth = 1.7 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {[].concat(d).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

const PANEL_DEFS = {
  [PANELS.TRAJETS]: {
    label: "Trajets enregistrés",
    eyebrow: "Accès rapide",
    title: "Vos trajets",
    glyph: [
      "M17.6 3.3c1.1.1 1.9 1.1 1.9 2.2V21L12 17.25 4.5 21V5.5c0-1.1.8-2.1 1.9-2.2a48.5 48.5 0 0 1 11.2 0Z",
    ],
    View: TrajetsPanel,
  },
  [PANELS.TRAFFIC]: {
    label: "Perturbations",
    eyebrow: "En direct",
    title: "Perturbations",
    glyph: [
      "M12 9v3.75m-9.3 3.38c-.87 1.5.22 3.37 1.95 3.37h14.7c1.73 0 2.81-1.87 1.95-3.37L13.95 3.38c-.87-1.5-3.03-1.5-3.9 0L2.7 16.13Z",
      "M12 15.75h.01",
    ],
    View: TrafficPanel,
  },
  [PANELS.ABOUT]: {
    label: "À propos",
    eyebrow: "GreGo",
    title: "À propos",
    glyph: [
      "M11.25 11.25l.04-.02a.75.75 0 0 1 1.06.85l-.7 2.84a.75.75 0 0 0 1.06.85l.04-.02",
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
      "M12 8.25h.01",
    ],
    View: AboutPanel,
  },
};

const RAIL_GLYPH = [
  "M3.75 5.25A1.5 1.5 0 0 1 5.25 3.75h13.5a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V5.25Z",
  "M9 3.75v16.5",
];

function RailItem({ label, kbd, icon, badge, ...props }) {
  const Tag = props.to ? Link : "button";
  return (
    <Tag
      className="gd-item"
      aria-label={label}
      {...(Tag === "button" ? { type: "button" } : {})}
      {...props}
    >
      <span className="gd-item__icon">{icon}</span>
      <span className="gd-item__label">{label}</span>
      {kbd && <span className="gd-item__kbd">{kbd}</span>}
      {badge > 0 && (
        <span className="gd-badge">{badge > 99 ? "99+" : badge}</span>
      )}
      <span className="gd-tip" role="presentation">
        {label}
        {kbd && <kbd>{kbd}</kbd>}
      </span>
    </Tag>
  );
}

export default function DesktopShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { lines } = useDisruptionsFeed();
  // Même décompte que le bandeau d'en-tête : les lignes hors réseau principal
  // (« Autres ») ne sont pas signalées.
  const disruptedCount = lines.filter((l) => l.network !== "AUTRES").length;
  const [expanded, setExpanded] = useState(readRailExpanded);
  // `shown` survit à la fermeture : le contenu reste affiché pendant que le
  // panneau s'efface, au lieu de disparaître d'un coup.
  const [{ panel, shown }, setPanelState] = useState({
    panel: null,
    shown: null,
  });

  const setPanel = (name) =>
    setPanelState((cur) => ({ panel: name, shown: name || cur.shown }));
  const togglePanel = (name) => setPanel(panel === name ? null : name);
  const toggleRail = () =>
    setExpanded((cur) => {
      saveRailExpanded(!cur);
      return !cur;
    });

  // L'état du shell est reflété sur <html> : desktop.css en déduit la largeur
  // réservée à gauche du canevas.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.gdRail = expanded ? "wide" : "slim";
    root.dataset.gdPanel = panel || "";
  }, [expanded, panel]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.gdRail;
      delete document.documentElement.dataset.gdPanel;
    },
    [],
  );

  useEffect(() => onDesktopPanelRequest((name) => setPanel(name)), []);

  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (event.key === "Escape" && panel && !typing) {
        setPanel(null);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleRail();
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const index = Number(event.code.replace("Digit", "")) - 1;
        const route = ROUTES[index];
        if (route) {
          event.preventDefault();
          navigate(route.path);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, navigate]);

  const activePanel = shown ? PANEL_DEFS[shown] : null;
  const ActiveView = activePanel?.View;
  const isDark = theme !== "light";

  return (
    <>
      <div className="gd-frame" aria-hidden="true" />

      <aside className="gd-rail" aria-label="Navigation GreGo">
        <Link to="/mes-trajets" className="gd-brand" aria-label="GreGo, accueil">
          <img
            className="gd-brand__tile"
            src={
              isDark ? "/logos/apple-touch-icon-dark.png" : "/apple-touch-icon.png"
            }
            alt=""
          />
          <img
            className="gd-brand__word"
            src={
              isDark
                ? "/logos/dark_no_bg_banner.png"
                : "/logos/light_no_bg_banner.png"
            }
            alt=""
          />
        </Link>

        <nav className="grid gap-0.5" aria-label="Pages">
          {ROUTES.map((route, index) => (
            <RailItem
              key={route.path}
              to={route.path}
              label={route.label}
              kbd={`Alt ${index + 1}`}
              aria-current={
                location.pathname === route.path ? "page" : undefined
              }
              icon={<route.Icon />}
            />
          ))}
        </nav>

        <div className="gd-sep" />
        <div className="gd-section-label">Panneaux</div>

        <div className="grid gap-0.5">
          {Object.entries(PANEL_DEFS).map(([name, def]) => (
            <RailItem
              key={name}
              label={def.label}
              aria-pressed={panel === name}
              aria-controls="gd-panel"
              badge={name === PANELS.TRAFFIC ? disruptedCount : 0}
              onClick={() => togglePanel(name)}
              icon={<Glyph d={def.glyph} />}
            />
          ))}
        </div>

        <div className="gd-rail__spacer" />

        <RailItem
          label={expanded ? "Réduire" : "Agrandir la barre"}
          kbd="Ctrl B"
          aria-expanded={expanded}
          onClick={toggleRail}
          icon={<Glyph d={RAIL_GLYPH} />}
        />
      </aside>

      <section
        id="gd-panel"
        className="gd-panel"
        data-open={Boolean(panel)}
        aria-hidden={!panel}
        aria-label={activePanel?.label}
        inert={!panel}
      >
        {activePanel && (
          <>
            <header className="gd-panel__head">
              <div>
                <div className="gd-panel__eyebrow">{activePanel.eyebrow}</div>
                <h2 className="gd-panel__title">{activePanel.title}</h2>
              </div>
              <button
                type="button"
                className="gd-icon-btn"
                onClick={() => setPanel(null)}
                aria-label="Fermer le panneau"
                title="Fermer (Échap)"
              >
                <Glyph d="M6 18 18 6M6 6l12 12" strokeWidth={1.8} />
              </button>
            </header>
            <div className="gd-panel__body">
              <ActiveView onClose={() => setPanel(null)} />
            </div>
          </>
        )}
      </section>
    </>
  );
}
