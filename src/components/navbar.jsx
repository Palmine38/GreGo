import { useState } from 'react';
import { Link } from 'react-router-dom';
import Settings from './settings.jsx';

export default function Navbar({ title, menuOpen, setMenuOpen, onMenuOpen, settingsOpen, setSettingsOpen, onSettingsOpen, onSettingsChanged, showHamburger = true }) {
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
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>

                        </button>
                    </div>
                </div>

                {/* menu de la navbar */}
                <div className={`overflow-hidden transition-all duration-300 ${menuOpen ? 'max-h-60' : 'max-h-0'}`}>
                    <ul className="flex flex-col bg-white border-t border-gray-300">
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
                            <Link
                                to="/fastresearch"
                                className="block px-4 py-2 hover:bg-gray-100"
                                onClick={closeMenu}
                            >
                                Recherche rapide
                            </Link>
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
                        <li>
                            <a href="https://grelines.vercel.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block pl-2.5 pr-4 py-2 hover:bg-gray-100 flex items-center"
                                onClick={closeMenu}>
                                <img src="/grelines.png" alt="Logo Grelines" className="h-6" />
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            <Settings settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} onSettingsChanged={onSettingsChanged} />
        </>
    );
}
