import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LineIcon from "../lines-icons.jsx";
import { DisruptionItem } from "../DisruptionItem.jsx";
import { useDisruptionsFeed } from "../../hooks/useDisruptionsFeed.js";
import { useTheme } from "../../hooks/useTheme.js";
import {
  NETWORKS,
  disruptionTitle,
  filterByNetwork,
} from "../../utils/disruptedLines.js";
import {
  SELECT_TRAJET_EVENT,
  TRAJETS_CHANGED_EVENT,
} from "./desktopPanels.js";

const formatTime = (date) =>
  date?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function ArrowIcon({ className = "gd-arrow" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.64L10.2 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.19-3.96H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Ouverture / fermeture en hauteur, animée dans les deux sens : le contenu
// reste monté pendant que la ligne se replie.
function Collapse({ open, children }) {
  return (
    <div className="gd-collapse" data-open={open} inert={!open}>
      <div>{children}</div>
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="gd-chevron"
      data-open={open}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Perturbations ─────────────────────────────────────────────────────────
export function TrafficPanel({ onClose }) {
  const navigate = useNavigate();
  const { lines, loaded, updatedAt } = useDisruptionsFeed();
  const [network, setNetwork] = useState("all");
  const [openLine, setOpenLine] = useState(null);
  const visible = filterByNetwork(lines, network);

  return (
    <>
      <div className="gd-chips" role="group" aria-label="Filtrer par réseau">
        {NETWORKS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="gd-chip"
            aria-pressed={network === item.id}
            onClick={() => setNetwork(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!loaded && <p className="gd-empty">Chargement des perturbations…</p>}

      {loaded && visible.length === 0 && (
        <p className="gd-empty">
          <strong>Tout roule.</strong>
          {lines.length
            ? "Aucune perturbation sur ce réseau pour le moment."
            : "Le réseau ne signale aucune perturbation actuellement."}
        </p>
      )}

      <ul className="grid gap-1">
        {visible.map((line) => {
          const expanded = openLine === line.name;
          return (
            <li key={line.name}>
              <button
                type="button"
                className="gd-row"
                aria-expanded={expanded}
                onClick={() => setOpenLine(expanded ? null : line.name)}
              >
                <LineIcon lineKey={line.name} size="w-8 h-8" />
                <span className="min-w-0 flex-1">
                  <span className="gd-row__title block">
                    Ligne {line.name}
                    <span className="gd-row__meta ml-2 font-semibold">
                      {line.events.length > 1
                        ? `${line.events.length} alertes`
                        : "1 alerte"}
                    </span>
                  </span>
                  <Collapse open={!expanded}>
                    <span className="gd-row__meta gd-clamp-2 block">
                      {disruptionTitle(line.events[0])}
                    </span>
                  </Collapse>
                </span>
                <ChevronIcon open={expanded} />
              </button>
              <Collapse open={expanded}>
                <div className="grid gap-2 px-2 pb-3 pt-2">
                  {line.events.map((evt, i) => (
                    <DisruptionItem key={evt.id || i} evt={evt} defaultOpen />
                  ))}
                </div>
              </Collapse>
            </li>
          );
        })}
      </ul>

      <PanelFoot>
        <span>
          {updatedAt ? `Mis à jour à ${formatTime(updatedAt)}` : "Mobilités M"}
        </span>
        <button
          type="button"
          className="gd-link"
          onClick={() => {
            onClose();
            navigate("/infotrafic");
          }}
        >
          Page Infotrafic
          <ArrowIcon className="size-4" />
        </button>
      </PanelFoot>
    </>
  );
}

// ── Trajets enregistrés ───────────────────────────────────────────────────
function readTrajets() {
  try {
    const trajets = JSON.parse(
      localStorage.getItem("tag-express-trajets") || "{}",
    );
    const order = JSON.parse(
      localStorage.getItem("tag-express-trajet-order") || "null",
    );
    const keys = Array.isArray(order) ? order : Object.keys(trajets);
    return {
      active: localStorage.getItem("tag-express-active-trajet"),
      list: keys
        .filter((key) => trajets[key]?.depName && trajets[key]?.arrName)
        .map((key) => ({ key, ...trajets[key] })),
    };
  } catch {
    return { active: null, list: [] };
  }
}

export function TrajetsPanel({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [{ active, list }, setData] = useState(readTrajets);

  useEffect(() => {
    const refresh = () => setData(readTrajets());
    window.addEventListener(TRAJETS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(TRAJETS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const open = (key) => {
    localStorage.setItem("tag-express-active-trajet", key);
    setData(readTrajets());
    if (location.pathname === "/mes-trajets") {
      window.dispatchEvent(
        new CustomEvent(SELECT_TRAJET_EVENT, { detail: key }),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      onClose();
      navigate("/mes-trajets");
    }
  };

  return (
    <>
      {list.length === 0 && (
        <p className="gd-empty">
          <strong>Aucun trajet.</strong>
          Enregistrez vos trajets du quotidien dans « Mes trajets » pour les
          retrouver ici en un clic.
        </p>
      )}

      <ul className="grid gap-1">
        {list.map((trajet) => (
          <li key={trajet.key}>
            <button
              type="button"
              className="gd-row flex-col !gap-2.5"
              aria-current={trajet.key === active}
              onClick={() => open(trajet.key)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="gd-row__title truncate">
                  {trajet.name || trajet.key}
                </span>
                {trajet.line ? (
                  <LineIcon lineKey={trajet.line} size="w-6 h-6" />
                ) : (
                  <span className="gd-tag">Toutes lignes</span>
                )}
              </span>
              <span className="gd-route w-full">
                <span>{trajet.depName}</span>
                <span>{trajet.arrName}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <PanelFoot>
        <span>
          {list.length} trajet{list.length > 1 ? "s" : ""} enregistré
          {list.length > 1 ? "s" : ""}
        </span>
        {location.pathname !== "/mes-trajets" && (
          <button
            type="button"
            className="gd-link"
            onClick={() => {
              onClose();
              navigate("/mes-trajets");
            }}
          >
            Gérer
            <ArrowIcon className="size-4" />
          </button>
        )}
      </PanelFoot>
    </>
  );
}

// ── À propos ──────────────────────────────────────────────────────────────
const LINKS = [
  {
    href: "https://grelines-feedback-website.vercel.app/grego",
    label: "Suggestions",
    hint: "Une idée, un bug ? Dites-le nous",
    icon: "M2.25 12.76c0 1.6 1.12 2.99 2.7 3.23 1.09.16 2.19.28 3.3.37V21l4.08-4.08a1.15 1.15 0 0 1 .78-.33 48.1 48.1 0 0 0 5.83-.5c1.58-.23 2.7-1.62 2.7-3.23V6.74c0-1.6-1.12-2.99-2.7-3.23A48.4 48.4 0 0 0 12 3c-2.39 0-4.73.17-7.02.51-1.58.24-2.7 1.63-2.7 3.23v6.02Z",
  },
  {
    href: "https://github.com/Palmine38",
    label: "À propos",
    hint: "Le projet et son auteur",
    icon: "M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5",
  },
  {
    href: "https://github.com/antquu",
    label: "Conception ordinateur",
    hint: "La version PC de GreGo",
    icon: "M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z",
  },
  {
    href: "https://paypal.me/palmine38",
    label: "Me soutenir",
    hint: "GreGo est gratuit et sans pub",
    icon: "M21 8.25c0-2.49-2.1-4.5-4.69-4.5-1.94 0-3.6 1.13-4.31 2.73-.71-1.6-2.37-2.73-4.31-2.73C5.1 3.75 3 5.76 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z",
  },
];

const SHORTCUTS = [
  ["Mes trajets", "Alt 1"],
  ["Carte", "Alt 2"],
  ["Infotrafic", "Alt 3"],
  ["Réglages", "Alt 4"],
  ["Agrandir la barre", "Ctrl B"],
  ["Fermer le panneau", "Échap"],
];

export function AboutPanel() {
  const theme = useTheme();

  return (
    <>
      <p className="gd-about-lede">
        Les horaires du réseau M réso en temps réel, pensés pour vos trajets du
        quotidien à Grenoble. Sans compte, sans pistage.
      </p>

      <ul className="grid gap-0.5">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="gd-about-link"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={link.icon} />
              </svg>
              <span>
                {link.label}
                <small>{link.hint}</small>
              </span>
              <ArrowIcon />
            </a>
          </li>
        ))}
      </ul>

      <a
        href="https://grelines.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="gd-promo"
      >
        <img
          src={
            theme === "light"
              ? "/grelines_light_mode.png"
              : "/grelines_dark_mode.png"
          }
          alt="GreLines"
        />
        <span className="block">
          Carte du réseau, suivi des véhicules et itinéraires : retrouvez
          l’expérience complète sur GreLines.
        </span>
      </a>

      <div className="gd-keys" aria-label="Raccourcis clavier">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label}>
            <span>{label}</span>
            <span className="flex gap-1">
              {keys.split(" ").map((key) => (
                <kbd key={key} className="gd-kbd">
                  {key}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// Pied de panneau collé en bas de la zone défilante.
function PanelFoot({ children }) {
  return <div className="gd-panel__foot">{children}</div>;
}
