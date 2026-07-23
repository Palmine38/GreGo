import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "./hooks/useTheme.js";
import { InfotraficSheet } from "./components/InfotraficSheet.jsx";

const TABS = ["/mes-trajets", "/fastresearch", "/settings"];

function TripsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="19" r="2.25" />
      <circle cx="18" cy="5" r="2.25" />
      <path d="M8.25 19h9.25a3.25 3.25 0 0 0 0-6.5h-11a3.25 3.25 0 0 1 0-6.5h9.25" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
    </svg>
  );
}

function InfotraficIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 122.88 122.54"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M7.68,107.18h16.25l6.72-23.29H92.3l6.65,23.29h16.25c4.22,0,7.68,3.46,7.68,7.68v0c0,4.22-3.46,7.68-7.68,7.68H7.68c-4.22,0-7.68-3.46-7.68-7.68v0C0,110.64,3.46,107.18,7.68,107.18L7.68,107.18z M35.05,68.64l6.74-23.36h39.49l6.67,23.36H35.05L35.05,68.64z M46.04,30.55l7.45-25.81c2.5-6.31,13.92-6.33,16.23,0.05l7.35,25.76H46.04L46.04,30.55z"
      />
    </svg>
  );
}

export default function Navbar({
  menuOpen,
  setMenuOpen,
  onMenuOpen,
  shiftCompactBarForAction = false,
  actionBarFurtherLeft = false,
  onBeforeTabNavigate,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const [infotraficOpen, setInfotraficOpen] = useState(false);
  const preserveCompactOnArrival =
    location.state?.preserveBottomBarCompact === true;
  const [isCompact, setIsCompact] = useState(
    () => preserveCompactOnArrival || window.scrollY > 48,
  );
  const [pressedTab, setPressedTab] = useState(null);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const [dragTarget, setDragTarget] = useState(null);
  const theme = useTheme();
  const isDark = theme !== "light";
  const touchStart = useRef(null);
  const longPressTimer = useRef(null);
  const dragStart = useRef(null);
  const dragTargetRef = useRef(null);
  const draggingTabRef = useRef(false);
  const suppressTabClick = useRef(false);
  const headerRef = useRef(null);
  const hasScrolledSinceArrival = useRef(!preserveCompactOnArrival);
  const isMenuOpen = menuOpen ?? localMenuOpen;

  const setMenu = (next) => {
    if (next) onMenuOpen?.();
    setMenuOpen?.(next);
    setLocalMenuOpen(next);
  };

  useEffect(() => {
    const onScroll = () => {
      if (!hasScrolledSinceArrival.current && window.scrollY === 0) return;
      hasScrolledSinceArrival.current = true;
      setIsCompact(window.scrollY > 48);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMenuOpen]);

  useEffect(() => () => clearTimeout(longPressTimer.current), []);

  const selectTab = (path) => {
    setPressedTab(path);
    setTimeout(() => setPressedTab(null), 280);
    setMenu(false);
  };
  const setDragSelection = (path) => {
    dragTargetRef.current = path;
    setDragTarget(path);
  };
  const handleTabPointerDown = (event, path) => {
    if (event.pointerType === "mouse") return;
    dragStart.current = { x: event.clientX, y: event.clientY };
    setDragSelection(path);
    longPressTimer.current = setTimeout(() => {
      draggingTabRef.current = true;
      setIsDraggingTab(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }, 350);
  };
  const handleTabPointerMove = (event) => {
    if (!dragStart.current) return;
    if (!draggingTabRef.current) {
      const distance = Math.hypot(
        event.clientX - dragStart.current.x,
        event.clientY - dragStart.current.y,
      );
      if (distance > 8) clearTimeout(longPressTimer.current);
      return;
    }
    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-tab-path]");
    if (target?.dataset.tabPath) setDragSelection(target.dataset.tabPath);
  };
  const endTabDrag = () => {
    clearTimeout(longPressTimer.current);
    dragStart.current = null;
    if (!draggingTabRef.current) return;
    draggingTabRef.current = false;
    setIsDraggingTab(false);
    suppressTabClick.current = true;
    const target = dragTargetRef.current;
    if (target && target !== location.pathname) {
      selectTab(target);
      navigateToTab(target);
    } else {
      setDragTarget(null);
    }
    setTimeout(() => {
      suppressTabClick.current = false;
    }, 0);
  };
  const handleTabClick = (event, path) => {
    if (suppressTabClick.current) {
      event.preventDefault();
      return;
    }
    selectTab(path);
  };
  const handleRouteNavigation = (event, path) => {
    event.preventDefault();
    selectTab(path);
    navigateToTab(path);
  };
  const navigateToTab = (path) => {
    const preserveBottomBarCompact = isCompact;
    const completeNavigation = () => {
      window.scrollTo(0, 0);
      navigate(path, { state: { preserveBottomBarCompact } });
    };

    if (onBeforeTabNavigate?.(path)) {
      window.setTimeout(completeNavigation, 300);
      return;
    }

    completeNavigation();
  };
  const itemClass = (active) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-2xl py-1 text-[10px] font-medium transition-colors duration-[800ms] ease-[cubic-bezier(0.45,0,0.55,1)] ${active ? "bottom-bar-active text-blue-600" : "text-slate-500"}`;
  const iconClass = (active, path) =>
    `relative z-10 flex items-center justify-center ${isCompact ? "size-12" : "size-10"} transition-[transform,opacity] duration-[700ms] ease-[cubic-bezier(0.45,0,0.55,1)] ${active ? "scale-110 opacity-100 animate-tab-icon-select" : "scale-90 opacity-70"} ${pressedTab === path ? "scale-[1.15]" : ""}`;
  const labelClass = `grid overflow-hidden leading-4 transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isCompact ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`;
  const selectedPath = isDraggingTab ? dragTarget : location.pathname;
  const selectedIndex = Math.max(0, TABS.indexOf(selectedPath));

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-40 border-b-2 border-gray-200 bg-white px-4 py-2"
      >
        <div className="relative mx-auto flex min-h-16 max-w-md items-center justify-center">
          <div className="absolute left-0 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenu(!isMenuOpen)}
              className="flex flex-col items-center justify-center gap-1 w-8 h-8 p-1 rounded-md transition-colors duration-150"
              aria-label="Menu"
              aria-expanded={isMenuOpen}
            >
              <span
                className="block w-full h-0.5 bg-black origin-center transition-transform duration-300"
                style={{
                  transform: isMenuOpen
                    ? "translateY(6px) rotate(45deg)"
                    : "none",
                }}
              />
              <span
                className="block w-full h-0.5 bg-black transition-opacity duration-300"
                style={{ opacity: isMenuOpen ? 0 : 1 }}
              />
              <span
                className="block w-full h-0.5 bg-black origin-center transition-transform duration-300"
                style={{
                  transform: isMenuOpen
                    ? "translateY(-6px) rotate(-45deg)"
                    : "none",
                }}
              />
            </button>
          </div>
          <img
            src={
              isDark
                ? "/logos/dark_no_bg_banner.png"
                : "/logos/light_no_bg_banner.png"
            }
            alt="GreGo"
            className="h-8"
          />
          <div className="absolute right-0 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setInfotraficOpen(true)}
              className="flex items-center justify-center w-6 h-6 text-black"
              aria-label="Infotrafic"
            >
              <InfotraficIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div
          aria-hidden={!isMenuOpen}
          className="-mx-4 bg-white"
          style={{
            maxHeight: isMenuOpen ? "240px" : "0px",
            overflow: "hidden",
            pointerEvents: isMenuOpen ? "auto" : "none",
            transition: "max-height 300ms ease",
          }}
        >
          <ul className="flex flex-col">
            <li>
              <Link
                to="/infotrafic"
                onClick={() => setMenu(false)}
                className="block px-4 py-2 hover:bg-gray-100"
              >
                Infotrafic
              </Link>
            </li>
            <li>
              <a
                href="https://grelines-feedback-website.vercel.app/grego"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(false)}
                className="block px-4 py-2 hover:bg-gray-100"
              >
                Suggestions
              </a>
            </li>
            <li>
              <a
                href="https://github.com/Palmine38"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(false)}
                className="block px-4 py-2 hover:bg-gray-100"
              >
                À propos
              </a>
            </li>
            <li>
              <a
                href="https://grelines.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(false)}
                className="flex items-center py-2 pl-2.5 pr-4 hover:bg-gray-100"
              >
                <img
                  src={
                    isDark
                      ? "/grelines_dark_mode.png"
                      : "/grelines_light_mode.png"
                  }
                  alt="Logo Grelines"
                  className="h-6"
                />
              </a>
            </li>
          </ul>
        </div>
      </header>

      <nav
        aria-label="Navigation principale"
        className={`fixed bottom-4 z-50 ${shiftCompactBarForAction ? (actionBarFurtherLeft ? "left-[calc(50%-2rem)]" : "left-[calc(50%-1rem)]") : "left-1/2"} ${isCompact ? "w-[min(13rem,calc(100%-2rem))]" : shiftCompactBarForAction ? "w-[min(15rem,calc(100%-5.5rem))]" : "w-[min(18rem,calc(100%-2rem))]"} -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white px-2 shadow-[0_12px_32px_rgba(15,23,42,0.22)] transition-[left,width,height,padding] duration-300 ease-in-out ${isCompact ? "h-14 py-1" : "h-[4.75rem] py-2"}`}
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div
          className={`flex h-full items-center ${isCompact ? "gap-0" : "gap-1"} transition-[gap] duration-300 ease-in-out`}
        >
          <Link
            to="/mes-trajets"
            onClick={(event) => handleRouteNavigation(event, "/mes-trajets")}
            className={itemClass(location.pathname === "/mes-trajets")}
            aria-current={
              location.pathname === "/mes-trajets" ? "page" : undefined
            }
          >
            <span
              className={iconClass(
                location.pathname === "/mes-trajets",
                "/mes-trajets",
              )}
            >
              <TripsIcon className="size-7" />
            </span>
            <span className={labelClass}>
              <span className="min-h-0">Mes trajets</span>
            </span>
          </Link>
          <Link
            to="/fastresearch"
            onClick={(event) => handleRouteNavigation(event, "/fastresearch")}
            className={itemClass(location.pathname === "/fastresearch")}
            aria-current={
              location.pathname === "/fastresearch" ? "page" : undefined
            }
          >
            <span
              className={iconClass(
                location.pathname === "/fastresearch",
                "/fastresearch",
              )}
            >
              <SearchIcon className="size-7" />
            </span>
            <span className={labelClass}>
              <span className="min-h-0">Recherche</span>
            </span>
          </Link>
          <Link
            to="/settings"
            onClick={(event) => handleRouteNavigation(event, "/settings")}
            className={itemClass(location.pathname === "/settings")}
            aria-current={
              location.pathname === "/settings" ? "page" : undefined
            }
          >
            <span
              className={iconClass(
                location.pathname === "/settings",
                "/settings",
              )}
            >
              <SettingsIcon className="size-7" />
            </span>
            <span className={labelClass}>
              <span className="min-h-0">Réglages</span>
            </span>
          </Link>
        </div>
      </nav>

      <InfotraficSheet
        isOpen={infotraficOpen}
        onClose={() => setInfotraficOpen(false)}
      />
    </>
  );
}
