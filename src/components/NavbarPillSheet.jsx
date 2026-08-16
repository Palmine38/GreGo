import { useEffect, useMemo, useRef, useState } from "react";
import {
  interpolate,
  motion,
  useMotionTemplate,
  useTransform,
} from "framer-motion";
import { Sheet } from "react-modal-sheet";

/**
 * Comportement partagé par les feuilles qui vivent au-dessus de la barre de
 * navigation — la pilule flottante de `navbar.jsx`. Quand on les tire vers le
 * bas jusqu'à son palier, elles prennent sa forme exacte (largeur, hauteur,
 * rayon, décollement du bord de l'écran), puis se referment pour lui laisser
 * la place : le relais ne se voit pas.
 *
 * Les constantes ci-dessous sont copiées de `navbar.jsx`, état ouvert / non
 * compact / non décalé (`shiftCompactBarForAction` false) :
 * `w-[min(18rem,calc(100%-2rem))]`, `h-[4.75rem]`, `rounded-[1.75rem]`,
 * `border-slate-200`, `bottom: calc(1rem + safe-area-inset-bottom)`. Si la
 * géométrie de la pilule change là-bas, ces valeurs doivent suivre ici — on
 * ne vise que l'état par défaut ; en mode compact ou décalé (barre d'action
 * de recherche active) le relais reste correct en position/taille mais perd
 * un peu de son exactitude au pixel près.
 */
const NAVBAR_PILL_MAX_WIDTH = 288; // 18rem
const NAVBAR_HORIZONTAL_MARGIN = 32; // calc(100% - 2rem)
const NAVBAR_PILL_HEIGHT = 76; // h-[4.75rem]
const NAVBAR_PILL_RADIUS = 28; // rounded-[1.75rem]
const NAVBAR_BOTTOM_GAP = 16; // bottom-4

/** Marge latérale de la feuille aux paliers intermédiaires (avant repli). */
const SHEET_PADDING = 8;
/** Rayon des angles de la feuille en position normale (non repliée). */
const SHEET_RADIUS = 24;

/** Index du palier bas — celui qui a la forme de la pilule de navigation. */
export const NAVBAR_SNAP = 1;

/** Mesure `env(safe-area-inset-bottom)`, illisible directement depuis le CSS-in-JS. */
export function readSafeAreaBottom() {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden";
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.round(height);
}

/** Hauteur totale réservée au palier bas : la pilule, plus son décollement du bord. */
export function navbarSnapPx(safeBottom) {
  return NAVBAR_PILL_HEIGHT + NAVBAR_BOTTOM_GAP + safeBottom;
}

/** Marge latérale qui donne à la feuille repliée la largeur de la pilule. */
export function collapsedPillPadding(viewportWidth) {
  const width = Math.min(
    NAVBAR_PILL_MAX_WIDTH,
    viewportWidth - NAVBAR_HORIZONTAL_MARGIN,
  );
  return Math.max(SHEET_PADDING, Math.round((viewportWidth - width) / 2));
}

/**
 * Suit la largeur du viewport et calcule la marge latérale au palier bas —
 * un seul hook, pour éviter à chaque feuille de réécouter le resize.
 */
export function useNavbarPillMetrics() {
  const safeBottom = useMemo(readSafeAreaBottom, []);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 375 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    safeBottom,
    collapsedPadding: collapsedPillPadding(viewportWidth),
  };
}

/**
 * Interpole une valeur sur les paliers de la feuille : `collapsed` s'applique
 * au palier fermé (0) et au palier pilule (`NAVBAR_SNAP`), `revealed` à tous
 * les paliers intermédiaires, `expanded` au tout dernier. Le nombre de
 * paliers n'a donc pas besoin d'être connu à l'avance : seul compte l'ordre
 * — fermé, pilule, ..., grand ouvert.
 */
function useCollapseValue(collapsed, revealed, expanded) {
  const { snapPoints, y } = Sheet.useContext();

  return useTransform(y, (value) => {
    const n = snapPoints.length;
    if (n < 3) return revealed;
    const output = [
      collapsed,
      collapsed,
      ...Array(n - 3).fill(revealed),
      expanded,
    ];
    const mix = interpolate(
      [...snapPoints].reverse().map((point) => point.snapValueY),
      [...output].reverse(),
    );
    return mix(value);
  });
}

/**
 * La feuille, montée sur `react-modal-sheet`, avec le relais navbar déjà
 * câblé : descendre jusqu'au palier pilule puis continuer referme la feuille
 * au lieu de la faire disparaître sous l'écran.
 *
 * `snapPoints` doit toujours placer le palier pilule en position 1, juste
 * après 0 : `[0, navbarSnapPx(safeBottom), ...paliers de contenu]`.
 */
export function NavbarPillSheetRoot({
  isOpen,
  onClose,
  snapPoints,
  initialSnap,
  zIndex = 60,
  onSnap,
  children,
}) {
  // La bibliothèque annonce les paliers traversés pendant l'ouverture : sans
  // ce garde-fou, la feuille se refermerait avant d'avoir fini d'apparaître.
  const hasSettledRef = useRef(false);
  useEffect(() => {
    hasSettledRef.current = false;
  }, [isOpen]);

  return (
    <Sheet
      style={{ zIndex }}
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnap={initialSnap}
      onSnap={(index) => {
        if (index > NAVBAR_SNAP) {
          hasSettledRef.current = true;
        } else if (hasSettledRef.current) {
          onClose();
        }
        // Passthrough : permet à l'appelant de suivre le palier courant
        // (ex. pour transmettre `currentSnap` à un callback) sans casser
        // le relais navbar géré ci-dessus.
        onSnap?.(index);
      }}
    >
      {children}
    </Sheet>
  );
}

/**
 * Le conteneur de la feuille : au palier pilule, il prend exactement la
 * forme de la barre de navigation (largeur, rayon, décollement du bord).
 * Ailleurs, il se comporte comme une feuille normale, plaquée au bord bas.
 */
export function NavbarPillShell({
  bottomInset,
  collapsedPadding,
  backgroundColor,
  // Marge latérale aux paliers intermédiaires (ni pilule, ni tout dernier
  // palier). Défaut = SHEET_PADDING (8px), comme avant. Passer 0 pour une
  // feuille qui doit rester bord-à-bord partout sauf sur la pilule.
  revealedPadding = SHEET_PADDING,
  // Décollement du bord bas aux paliers intermédiaires, symétrique à
  // `revealedPadding`. Défaut = comportement historique (gap de la pilule,
  // NAVBAR_BOTTOM_GAP + bottomInset). Passer 0 pour une feuille flush avec
  // le bas de l'écran dès le palier révélé, comme InfotraficSheet.
  revealedBottomGap = NAVBAR_BOTTOM_GAP + bottomInset,
  // Rayon des coins bas aux paliers intermédiaires. Défaut = SHEET_RADIUS
  // (comportement historique : coins arrondis tant qu'on n'est pas au tout
  // dernier palier). Passer 0 pour des coins bas carrés dès le palier
  // révélé — cohérent avec un `revealedBottomGap` à 0 (feuille flush avec
  // le bas de l'écran : pas de raison de garder des coins arrondis dans
  // le vide).
  revealedBottomRadius = SHEET_RADIUS,
  children,
}) {
  const paddingHorizontal = useCollapseValue(
    collapsedPadding,
    revealedPadding,
    0,
  );
  const bottomGap = useCollapseValue(
    NAVBAR_BOTTOM_GAP + bottomInset,
    revealedBottomGap,
    0,
  );
  const topRadius = useCollapseValue(
    NAVBAR_PILL_RADIUS,
    SHEET_RADIUS,
    SHEET_RADIUS,
  );
  const bottomRadius = useCollapseValue(
    NAVBAR_PILL_RADIUS,
    revealedBottomRadius,
    0,
  );
  const borderAlpha = useCollapseValue(1, 0, 0);

  const { y } = Sheet.useContext();
  // Sans ce découpage, la feuille est une colonne qui continue sous l'écran :
  // c'est cette découpe qui en fait une pastille posée sur la carte, à la
  // largeur et au décollement du bord voulus.
  const clipPath = useMotionTemplate`inset(0px 0px calc(${y}px + ${bottomGap}px) 0px round 0 0 ${bottomRadius}px ${bottomRadius}px)`;
  const borderColor = useMotionTemplate`rgba(226, 232, 240, ${borderAlpha})`;
  const borderRadius = useMotionTemplate`${topRadius}px ${topRadius}px 0 0`;

  return (
    <Sheet.Container
      style={{
        ["--gl-sheet-padding"]: paddingHorizontal,
        width: "calc(100% - var(--gl-sheet-padding) * 2px)",
        margin: "0 calc(var(--gl-sheet-padding) * 1px)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderBottom: "none",
        borderColor,
        borderRadius,
        // Non défini par défaut : on garde le fond posé par la lib pour ne
        // pas changer le rendu des feuilles qui n'en ont pas besoin. Les
        // feuilles avec fond thémé (dark mode, etc.) passent la leur.
        backgroundColor,
        clipPath,
        overflow: "hidden",
        // La lib pose un box-shadow par défaut sur Sheet.Container, pensé
        // pour une feuille classique bord-à-bord. Avec notre clipPath (qui
        // découpe la feuille en pastille/carte flottante), ce shadow dépasse
        // de la zone visible et laisse un liseré disgracieux en haut : on le
        // désactive et on le remplace par notre propre bordure fine.
        boxShadow: "none !important",
      }}
    >
      {children}
    </Sheet.Container>
  );
}

/**
 * Contenu de la feuille : effacé au palier pilule, pour ne pas transparaître
 * sous la pastille pendant qu'on la tire.
 */
export function NavbarPillBody({ children }) {
  const opacity = useCollapseValue(0, 1, 1);
  return (
    <motion.div className="flex min-h-0 flex-1 flex-col" style={{ opacity }}>
      {children}
    </motion.div>
  );
}
