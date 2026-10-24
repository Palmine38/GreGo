import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Sheet as ModalSheet } from "react-modal-sheet";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useEscapeLayer } from "../hooks/useEscapeLayer.js";

// Remplaçant de `Sheet` (react-modal-sheet) avec la même API.
//
// Sur mobile, c'est la sheet d'origine. Sur ordinateur, une feuille qui monte
// du bas d'un grand écran n'a pas de sens : le même contenu s'ouvre dans une
// barre latérale, entre la navigation et le canevas, que desktop.css réserve
// automatiquement tant qu'une sheet est ouverte. Snap points, glisser et
// voile n'existent pas dans ce mode.

const SheetContext = createContext(null);
const CLOSE_MS = 320;


function SidebarSheet({ isOpen, onClose, children }) {
  const [rendered, setRendered] = useState(isOpen);
  if (isOpen && !rendered) setRendered(true);

  // La barre est d'abord montée fermée, son style est calculé, puis elle
  // passe à l'état ouvert : l'ouverture emprunte ainsi la même transition CSS
  // que la fermeture, au lieu d'apparaître d'un coup.
  // (Attribut posé directement sur le nœud : React ne le gère pas.)
  const nodeRef = useRef(null);
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    node.getBoundingClientRect();
    node.dataset.open = String(isOpen);
    if (isOpen) return undefined;
    // Démontage une fois la transition de fermeture (300 ms) terminée.
    const timer = setTimeout(() => setRendered(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [isOpen, rendered]);

  useEscapeLayer(isOpen, onClose);

  if (!rendered) return null;

  return createPortal(
    <SheetContext.Provider value={{ onClose }}>
      <div
        ref={nodeRef}
        className="gd-sheet"
        inert={!isOpen}
      >
        {children}
      </div>
    </SheetContext.Provider>,
    document.body,
  );
}

function SidebarContainer({ style, className = "", children }) {
  // L'arrondi « haut seulement » des sheets mobiles n'a pas cours ici.
  // eslint-disable-next-line no-unused-vars
  const { borderRadius, ...rest } = style || {};
  return (
    <div className={`gd-sheet__card ${className}`} style={rest}>
      {children}
    </div>
  );
}

function SidebarHeader() {
  const { onClose } = useContext(SheetContext);
  return (
    <div className="gd-sheet__head">
      <button
        type="button"
        className="gd-icon-btn"
        onClick={onClose}
        aria-label="Fermer"
        title="Fermer (Échap)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function SidebarContent({ className = "", children }) {
  return (
    <div className={`gd-sheet__content ${className}`}>
      <div className="gd-sheet__scroll">{children}</div>
    </div>
  );
}

function AdaptiveSheet(props) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <SidebarSheet {...props} /> : <ModalSheet {...props} />;
}

function adaptive(mobile, desktop) {
  return function AdaptivePart(props) {
    const Part = useIsDesktop() ? desktop : mobile;
    return <Part {...props} />;
  };
}

AdaptiveSheet.Container = adaptive(ModalSheet.Container, SidebarContainer);
AdaptiveSheet.Header = adaptive(ModalSheet.Header, SidebarHeader);
AdaptiveSheet.Content = adaptive(ModalSheet.Content, SidebarContent);
// Pas de voile sur ordinateur : la barre latérale ne bloque pas la page.
AdaptiveSheet.Backdrop = adaptive(ModalSheet.Backdrop, () => null);

export { AdaptiveSheet as Sheet };
