import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import LineIcon from "../lines-icons.jsx";
import { useDisruptionsFeed } from "../../hooks/useDisruptionsFeed.js";
import { PANELS, openDesktopPanel } from "./desktopPanels.js";

const PAGES = {
  "/mes-trajets": {
    lead: "Mes ",
    accent: "trajets",
    lede: "Vos itinéraires du quotidien, avec les prochains passages en temps réel.",
  },
  "/infotrafic": {
    lead: "Info",
    accent: "trafic",
    lede: "L’état du réseau M réso, ligne par ligne. Sélectionnez une ligne pour lire le détail des perturbations.",
    // La page détaille déjà l'état du réseau : le bandeau ferait doublon.
    hideTicker: true,
  },
  "/settings": {
    lead: "Vos ",
    accent: "réglages",
    lede: "Apparence, vitesse de marche, lignes affichées : ajustez GreGo à votre façon.",
    hideTicker: true,
  },
};

const MAX_TICKER_LINES = 9;

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function NetworkTicker() {
  const { lines, loaded } = useDisruptionsFeed();
  const disrupted = lines.filter((line) => line.network !== "AUTRES");
  const count = disrupted.length;

  return (
    <div className="gd-ticker" role="status">
      <span className="gd-live" data-tone={count ? "alert" : "ok"} />
      {!loaded ? (
        <span>Connexion au réseau M réso…</span>
      ) : count === 0 ? (
        <span>
          <strong>Réseau fluide</strong> · aucune perturbation signalée
        </span>
      ) : (
        <>
          <span className="whitespace-nowrap">
            <strong>
              {count} ligne{count > 1 ? "s" : ""} perturbée
              {count > 1 ? "s" : ""}
            </strong>
          </span>
          <span className="gd-ticker__lines" aria-hidden="true">
            {disrupted.slice(0, MAX_TICKER_LINES).map((line) => (
              <LineIcon key={line.name} lineKey={line.name} size="w-6 h-6" />
            ))}
            {count > MAX_TICKER_LINES && (
              <span className="gd-ticker__more">
                +{count - MAX_TICKER_LINES}
              </span>
            )}
          </span>
        </>
      )}
      <button
        type="button"
        className="gd-link ml-auto whitespace-nowrap"
        onClick={() => openDesktopPanel(PANELS.TRAFFIC)}
      >
        {count ? "Voir le détail" : "Infotrafic"}
      </button>
    </div>
  );
}

// En-tête des pages sur ordinateur, à la place de la barre mobile.
export default function DesktopHeader() {
  const { pathname } = useLocation();
  const now = useNow();
  const page = PAGES[pathname];
  if (!page) return null;

  return (
    <header className="gd-header">
      <div className="gd-header__top">
        <div>
          <h1 className="gd-title">
            {page.lead}
            <em>{page.accent}</em>
          </h1>
          <p className="gd-lede">{page.lede}</p>
        </div>
        <div className="gd-clock" aria-label="Heure actuelle">
          <div className="gd-clock__time">
            {now.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="gd-clock__date">
            {now.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </div>
      </div>
      {!page.hideTicker && <NetworkTicker />}
    </header>
  );
}
