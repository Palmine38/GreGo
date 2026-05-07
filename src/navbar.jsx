import { useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Settings from "./settings.jsx";

export default function Navbar({
  title,
  menuOpen,
  setMenuOpen,
  onMenuOpen,
  settingsOpen,
  setSettingsOpen,
  onSettingsOpen,
  onSettingsChanged,
  showHamburger = true,
}) {
  const closeMenu = () => setMenuOpen(false);

  const toggleMenu = () => {
    const next = !menuOpen;
    if (next && onMenuOpen) {
      onMenuOpen();
    } else {
      setMenuOpen(false);
    }
  };

  const toggleSettings = () => {
    const next = !settingsOpen;
    if (next && onSettingsOpen) {
      onSettingsOpen();
    } else {
      setSettingsOpen(false);
    }
  };

  const location = useLocation();
  const isFastResearch = location.pathname === "/fastresearch";

  // Ferme le menu si on clique en dehors
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [menuOpen, setMenuOpen]);

  return (
    <>
      <nav
        ref={menuRef}
        className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-30"
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Hamburger */}
          {showHamburger && (
            <button
              onClick={toggleMenu}
              className="flex flex-col items-center justify-center gap-1 w-8 h-8 p-1 rounded-md transition-colors duration-150"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <span
                className="block w-full h-0.5 bg-black origin-center transition-transform duration-300"
                style={{
                  transform: menuOpen
                    ? "translateY(6px) rotate(45deg)"
                    : "none",
                }}
              />
              <span
                className="block w-full h-0.5 bg-black transition-opacity duration-300"
                style={{ opacity: menuOpen ? 0 : 1 }}
              />
              <span
                className="block w-full h-0.5 bg-black origin-center transition-transform duration-300"
                style={{
                  transform: menuOpen
                    ? "translateY(-6px) rotate(-45deg)"
                    : "none",
                }}
              />
            </button>
          )}

          {/* Titre / Logo */}
          <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
            <div className="pointer-events-auto text-lg font-bold text-center">
              {title && title.toLowerCase().includes("mes trajets") ? (
                <img
                  src="/logos/light_no_bg_banner.png"
                  alt="Logo"
                  className="h-8 mx-auto"
                />
              ) : (
                <h1>{title}</h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <Link
              to={isFastResearch ? "/mes-trajets" : "/fastresearch"}
              className="p-2 rounded-md transition-colors duration-150"
            >
              {isFastResearch ? (
                <img src="/journey.svg" alt="Mes trajets" className="size-6" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-7"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </Link>
          </div>

          {/* Bouton Settings */}
          <button
            onClick={toggleSettings}
            className="p-2 rounded-mdtransition-colors duration-150"
            aria-label="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
              />
            </svg>
          </button>
        </div>
        <div
          aria-hidden={!menuOpen}
          className="border-t border-gray-300 bg-white"
          style={{
            maxHeight: menuOpen ? "240px" : "0px",
            overflow: "hidden",
            pointerEvents: menuOpen ? "auto" : "none",
            transition: "max-height 300ms ease",
          }}
        >
          <ul className="flex flex-col">
            <li>
              <Link
                to="/mes-trajets"
                className="block px-4 py-2 hover:bg-gray-100 transition-colors duration-150"
                onClick={closeMenu}
              >
                Mes trajets
              </Link>
            </li>
            <li>
              <Link
                to="/fastresearch"
                className="block px-4 py-2 hover:bg-gray-100 transition-colors duration-150"
                onClick={closeMenu}
              >
                Recherche rapide
              </Link>
            </li>
            <li>
              <a
                href="https://github.com/Palmine38"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2 hover:bg-gray-100 transition-colors duration-150"
                onClick={closeMenu}
              >
                À propos
              </a>
            </li>
            <li>
              <a
                href="https://grelines.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center pl-2.5 pr-4 py-2 hover:bg-gray-100 transition-colors duration-150"
                onClick={closeMenu}
              >
                <img src="/grelines.png" alt="Logo Grelines" className="h-6" />
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <Settings
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        onSettingsChanged={onSettingsChanged}
      />
    </>
  );
}
