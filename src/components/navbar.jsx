import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ title, menuOpen, setMenuOpen, onMenuOpen, showHamburger = true }) {

    const closeMenu = () => setMenuOpen(false);

    const toggleMenu = () => {
        const newState = !menuOpen;
        setMenuOpen(newState);
        if (newState && onMenuOpen) {
            onMenuOpen();
        }
    };

    return (
        <nav className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-30">
            <div className="flex items-center justify-between px-4 py-3">
                {/* Hamburger Menu */}
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

                {/* Title */}
                <h1 className="text-lg font-bold text-center flex-1">{title}</h1>

                {/* Spacer for alignment */}
                <div className="w-10"></div>
            </div>

            {/* Dropdown Menu */}
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
    );
}
