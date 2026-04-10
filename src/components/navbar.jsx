import { useState } from 'react';
import { Link } from 'react-router-dom';
import Settings from './settings.jsx';

export default function Navbar({ title, menuOpen, setMenuOpen, onMenuOpen, settingsOpen, setSettingsOpen, onSettingsOpen, showHamburger = true }) {
    const closeMenu = () => setMenuOpen(false);

    const toggleMenu = () => {
        const newState = !menuOpen;
        if (newState && onMenuOpen) {
            onMenuOpen();
        } else {
            setMenuOpen(false);
        }
    };

    return (
        <>
            <nav className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-30">
                <div className="flex items-center justify-between px-4 py-3">
                    {/*menue hamburger */}
                    {showHamburger && (
                        <button
                            onClick={toggleMenu}
                            className="flex flex-col items-center justify-center gap-1 w-8 h-8 p-1 rounded-md hover:bg-gray-100 transition-colors duration-150"
                            aria-label="Menu"
                        >
                            <span
                                className={`block w-full h-0.5 bg-black transform transition-all duration-300 ${menuOpen ? 'translate-y-1.5 rotate-45' : ''}`}
                            />
                            <span
                                className={`block w-full h-0.5 bg-black transform transition-all duration-300 ${menuOpen ? 'opacity-0' : 'opacity-100'}`}
                            />
                            <span
                                className={`block w-full h-0.5 bg-black transform transition-all duration-300 ${menuOpen ? '-translate-y-1.5 -rotate-45' : ''}`}
                            />
                        </button>
                    )}

                    {/* tittre */}
                    <div className="text-lg font-bold text-center flex-1">
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

                    {/* Settings menu */}
                    <div>
                        <button
                            onClick={() => {
                                const newState = !settingsOpen;
                                if (newState && onSettingsOpen) {
                                    onSettingsOpen();
                                } else {
                                    setSettingsOpen(false);
                                }
                            }}
                            className="p-2 rounded-md hover:bg-gray-100 transition-colors duration-150"
                            aria-label="Settings"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* menu de la navbar */}
                <div className={`overflow-hidden transition-all duration-300 ${menuOpen ? 'max-h-60' : 'max-h-0'}`}>
                    <ul className="flex flex-col bg-white border-t border-gray-300">
                        <li>
                            <Link
                                to="/fastresearch"
                                className="block px-4 py-2 hover:bg-gray-100"
                                onClick={closeMenu}
                            >
                                Recherche rapide
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/mes-trajets"
                                className="block px-4 py-2 hover:bg-gray-100"
                                onClick={closeMenu}
                            >
                                Mes trajets
                            </Link>
                        </li>
                        <li>
                            <a href="https://grelines.vercel.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 hover:bg-gray-100"
                                onClick={closeMenu}>
                                Grelines
                            </a>
                        </li>
                        <li>
                            <a href="https://github.com/Palmine38"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 hover:bg-gray-100"
                                onClick={closeMenu}>
                                À propos
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            <Settings settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
        </>
    );
}
