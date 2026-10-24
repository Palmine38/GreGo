import { useEffect, useRef, useState } from "react";
import { THEMES } from "../../hooks/useTheme.js";

// Page Réglages sur ordinateur : sommaire à gauche, sections en cartes à
// droite, un réglage par ligne. Même état et mêmes actions que la version
// mobile (settings.jsx), seule la présentation change.

const SECTIONS = [
  {
    id: "apparence",
    label: "Apparence",
    icon: "M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42",
  },
  {
    id: "itineraires",
    label: "Itinéraires",
    icon: "M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z",
  },
  {
    id: "affichage",
    label: "Affichage",
    icon: "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  {
    id: "performances",
    label: "Performances",
    icon: "m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z",
  },
  {
    id: "donnees",
    label: "Données",
    icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
  },
];

// Couleurs des miniatures : celles du shell desktop pour chaque thème.
const PREVIEWS = {
  [THEMES.LIGHT]: {
    chrome: "#e7eaf0",
    canvas: "#f8fafc",
    card: "#ffffff",
    ink: "#cbd5e1",
    accent: "#2563eb",
  },
  [THEMES.DARK]: {
    chrome: "#070c18",
    canvas: "#0f172a",
    card: "#1b2539",
    ink: "#334155",
    accent: "#60a5fa",
  },
  [THEMES.GRAY]: {
    chrome: "#131313",
    canvas: "#1e1e1e",
    card: "#2a2a2b",
    ink: "#454547",
    accent: "#5b9bff",
  },
};

const THEME_CHOICES = [
  { id: THEMES.AUTO, label: "Système", hint: "Suit votre ordinateur" },
  { id: THEMES.LIGHT, label: "Clair" },
  { id: THEMES.DARK, label: "Bleu nuit" },
  { id: THEMES.GRAY, label: "Sombre" },
];

const HEADER_LINES = [
  { value: "all", label: "Toutes" },
  { value: "disrupted", label: "Perturbées" },
  { value: "hidden", label: "Masquées" },
];

function Icon({ d, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function ThemePreview({ palette }) {
  return (
    <svg viewBox="0 0 160 100" className="gd-theme__art" aria-hidden="true">
      <rect width="160" height="100" fill={palette.chrome} />
      <circle cx="11" cy="14" r="4" fill={palette.accent} />
      <rect x="7" y="26" width="8" height="3" rx="1.5" fill={palette.ink} />
      <rect x="7" y="34" width="8" height="3" rx="1.5" fill={palette.ink} />
      <rect x="7" y="42" width="8" height="3" rx="1.5" fill={palette.ink} />
      <rect x="22" y="5" width="133" height="90" rx="7" fill={palette.canvas} />
      <rect x="34" y="16" width="34" height="7" rx="2" fill={palette.ink} />
      <rect x="70" y="16" width="26" height="7" rx="2" fill={palette.accent} />
      <rect x="34" y="32" width="109" height="14" rx="4" fill={palette.card} />
      <rect x="34" y="52" width="109" height="34" rx="4" fill={palette.card} />
      <circle cx="44" cy="62" r="4" fill={palette.accent} />
      <rect x="53" y="59" width="40" height="4" rx="2" fill={palette.ink} />
      <rect x="53" y="73" width="60" height="4" rx="2" fill={palette.ink} />
    </svg>
  );
}

function AutoPreview() {
  return (
    <div className="gd-theme__split">
      <ThemePreview palette={PREVIEWS[THEMES.LIGHT]} />
      <div className="gd-theme__split-dark">
        <ThemePreview palette={PREVIEWS[THEMES.GRAY]} />
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="gd-switch"
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function Row({ title, hint, children, htmlFor }) {
  return (
    <div className="gd-set-row">
      <div className="gd-set-row__text">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="gd-set-row__title">
            {title}
          </label>
        ) : (
          <div className="gd-set-row__title">{title}</div>
        )}
        {hint && <p className="gd-set-row__hint">{hint}</p>}
      </div>
      <div className="gd-set-row__control">{children}</div>
    </div>
  );
}

function Range({ id, value, min, max, step = 1, onChange, display }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="gd-range">
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        style={{ "--gd-range-pct": `${pct}%` }}
      />
      <output htmlFor={id}>{display}</output>
    </div>
  );
}

function Section({ id, title, description, children }) {
  return (
    <section id={`reglages-${id}`} className="gd-set-section">
      <h2 className="gd-set-section__title">{title}</h2>
      {description && (
        <p className="gd-set-section__desc">{description}</p>
      )}
      <div className="gd-set-card">{children}</div>
    </section>
  );
}

// Sommaire : la section visible est mise en avant pendant le défilement.
// Après un clic, la section choisie reste active le temps du défilement
// animé ; en bas de page, c'est la dernière (elle ne peut pas remonter
// jusqu'à la zone observée).
function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const lockedUntil = useRef(0);

  useEffect(() => {
    const nodes = SECTIONS.map((s) =>
      document.getElementById(`reglages-${s.id}`),
    ).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockedUntil.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActive(visible[0].target.id.replace("reglages-", ""));
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));

    const onScroll = () => {
      if (Date.now() < lockedUntil.current) return;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) setActive(SECTIONS[SECTIONS.length - 1].id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const select = (id) => {
    lockedUntil.current = Date.now() + 900;
    setActive(id);
  };
  return [active, select];
}

export default function SettingsView({
  theme,
  setTheme,
  systemPrefersDark,
  wheelchair,
  setWheelchair,
  speedInKmh,
  onSpeedChange,
  sliderVal,
  sliderMax,
  isMax,
  numItineraries,
  onItinerariesChange,
  headerLines,
  setHeaderLines,
  showJourneyDisruptions,
  setShowJourneyDisruptions,
  showIntermediateStops,
  setShowIntermediateStops,
  lightMode,
  setLightMode,
  statsVisible,
  setStatsVisible,
  onExport,
  onImport,
  onReset,
}) {
  const [active, setActive] = useActiveSection();

  const goTo = (id) => {
    setActive(id);
    document
      .getElementById(`reglages-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="gd-settings">
      <nav className="gd-set-nav" aria-label="Sections des réglages">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className="gd-set-nav__item"
            aria-current={active === section.id ? "true" : undefined}
            onClick={() => goTo(section.id)}
          >
            <Icon d={section.icon} className="gd-set-nav__icon" />
            {section.label}
          </button>
        ))}
      </nav>

      <div className="gd-set-content">
        <Section
          id="apparence"
          title="Apparence"
          description="Le thème s'applique à toute l'application, sur cet appareil."
        >
          <div className="gd-themes" role="radiogroup" aria-label="Thème">
            {THEME_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={theme === choice.id}
                className="gd-theme"
                onClick={() => setTheme(choice.id)}
              >
                <span className="gd-theme__frame">
                  {choice.id === THEMES.AUTO ? (
                    <AutoPreview />
                  ) : (
                    <ThemePreview palette={PREVIEWS[choice.id]} />
                  )}
                </span>
                <span className="gd-theme__label">
                  {choice.label}
                  {choice.id === THEMES.AUTO && (
                    <small>
                      {systemPrefersDark ? "Sombre en ce moment" : choice.hint}
                    </small>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section
          id="itineraires"
          title="Itinéraires"
          description="Ces réglages s'appliquent à chaque recherche de trajet."
        >
          <Row
            title="Accessibilité PMR"
            hint="Ne propose que des trajets accessibles aux personnes en fauteuil roulant."
          >
            <Switch
              checked={wheelchair}
              onChange={setWheelchair}
              label="Accessibilité PMR"
            />
          </Row>
          <Row
            title="Vitesse de marche"
            hint="Prise en compte pour les trajets à pied. Par défaut : 5 km/h."
            htmlFor="gd-walk-speed"
          >
            <Range
              id="gd-walk-speed"
              value={parseFloat(speedInKmh)}
              min={2}
              max={20}
              step={0.5}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value) || 0)}
              display={`${speedInKmh} km/h`}
            />
          </Row>
          <Row
            title="Nombre d'itinéraires"
            hint="Nombre maximum de propositions renvoyées par une recherche."
            htmlFor="gd-itineraries"
          >
            <Range
              id="gd-itineraries"
              value={sliderVal}
              min={0}
              max={sliderMax}
              onChange={onItinerariesChange}
              display={isMax ? "Max" : numItineraries}
            />
          </Row>
        </Section>

        <Section id="affichage" title="Affichage">
          <Row
            title="Lignes dans le résumé de recherche"
            hint="Les lignes affichées sous le départ et l'arrivée d'un trajet."
          >
            <div
              className="gd-seg"
              role="radiogroup"
              aria-label="Lignes dans le résumé de recherche"
            >
              {HEADER_LINES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={headerLines === opt.value}
                  onClick={() => setHeaderLines(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Row>
          <Row
            title="Infotrafic dans les détails du trajet"
            hint="Affiche les perturbations au-dessus des lignes concernées."
          >
            <Switch
              checked={showJourneyDisruptions}
              onChange={setShowJourneyDisruptions}
              label="Infotrafic dans les détails du trajet"
            />
          </Row>
          <Row
            title="Arrêts intermédiaires"
            hint="Affiche les arrêts desservis entre le départ et l'arrivée."
          >
            <Switch
              checked={showIntermediateStops}
              onChange={setShowIntermediateStops}
              label="Arrêts intermédiaires"
            />
          </Row>
        </Section>

        <Section id="performances" title="Performances">
          <Row
            title="Mode léger"
            hint="Accélère le démarrage et réduit les données consommées, utile pour regarder uniquement les trajets."
          >
            <Switch
              checked={lightMode}
              onChange={setLightMode}
              label="Mode léger"
            />
          </Row>
          <Row
            title="Statistiques"
            hint="Affiche un encart avec les indicateurs de performance (images par seconde, mémoire, requêtes réseau…)."
          >
            <Switch
              checked={statsVisible}
              onChange={setStatsVisible}
              label="Statistiques"
            />
          </Row>
        </Section>

        <Section
          id="donnees"
          title="Données"
          description="Vos trajets et réglages sont enregistrés uniquement dans ce navigateur."
        >
          <Row
            title="Exporter"
            hint="Télécharge une sauvegarde de vos trajets et réglages (fichier JSON)."
          >
            <button type="button" className="gd-btn" onClick={onExport}>
              Télécharger
            </button>
          </Row>
          <Row
            title="Importer"
            hint="Restaure une sauvegarde. La page se recharge ensuite."
          >
            <button type="button" className="gd-btn" onClick={onImport}>
              Choisir un fichier
            </button>
          </Row>
          <Row
            title="Réinitialiser"
            hint="Supprime tous vos trajets et réglages sur cet appareil. Action irréversible."
          >
            <button
              type="button"
              className="gd-btn gd-btn--danger"
              onClick={onReset}
            >
              Réinitialiser
            </button>
          </Row>
        </Section>
      </div>
    </div>
  );
}
