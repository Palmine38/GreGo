import React from 'react';
import LineIcon from './lines-icons.jsx';
import { formatTimeUntil } from '../utils/journey.js';

const DisruptedIcon = ({ size = 'size-3' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={size}>
        <path d="M8 3.5 3 12.5h10L8 3.5Z" fill="white" />
        <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
    </svg>
);

/**
 * Miniature ligne avec indicateur de perturbation optionnel.
 */
function LineWithBadge({ lineKey, size, badgeSize, isDisrupted }) {
    return (
        <div className="relative">
            <LineIcon lineKey={lineKey} size={size} />
            {isDisrupted && (
                <span className="absolute -bottom-1 -right-1" style={{ color: '#e61e1e' }}>
                    <DisruptedIcon size={badgeSize} />
                </span>
            )}
        </div>
    );
}

/**
 * Affiche les icônes de lignes dans la carte de résultat (1, 2, ou 3+ lignes).
 */
function LineIconsDisplay({ item, isLineDisrupted }) {
    const { lineKeys, line } = item;

    // 3 lignes ou plus → grille 2×2
    if (lineKeys && lineKeys.length > 2) {
        const displayKeys = lineKeys.slice(0, lineKeys.length > 4 ? 3 : 4);
        const positions = ['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'];
        return (
            <div className="w-14 h-14 relative">
                {displayKeys.map((lk, i) => (
                    <div key={`${lk}-${i}`} className={`absolute ${positions[i]}`}>
                        <LineWithBadge lineKey={lk} size="w-6 h-6" badgeSize="size-3" isDisrupted={isLineDisrupted(lk)} />
                    </div>
                ))}
                {lineKeys.length > 4 && (
                    <div className="absolute bottom-0 right-0 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-[9px] font-bold text-gray-600">
                        +{lineKeys.length - 3}
                    </div>
                )}
            </div>
        );
    }

    // 2 lignes → superposées en diagonale
    if (lineKeys && lineKeys.length === 2) {
        return (
            <>
                {lineKeys.map((lk, i) => (
                    <div
                        key={`${lk}-${i}`}
                        className={`absolute ${i === 0 ? 'top-0 left-0' : 'bottom-0 right-0'}`}
                        style={{ transform: i === 0 ? 'translate(-10%, -10%)' : 'translate(10%, 10%)' }}
                    >
                        <LineWithBadge lineKey={lk} size="w-8 h-8" badgeSize="size-4" isDisrupted={isLineDisrupted(lk)} />
                    </div>
                ))}
            </>
        );
    }

    // 1 ligne
    return (
        <div className="w-14 h-14 flex items-center justify-center relative">
            <LineIcon lineKey={line} size="w-12 h-12" />
            {isLineDisrupted(line) && (
                <span className="absolute bottom-0 right-0" style={{ color: '#e61e1e' }}>
                    <DisruptedIcon size="size-5" />
                </span>
            )}
        </div>
    );
}

/**
 * Carte d'un résultat de trajet (bouton cliquable).
 *
 * Props :
 *   item           — objet itinéraire (dep, arr, dur, line, lineKeys, …)
 *   currentTime    — Date courante (pour afficher "dans X min")
 *   isLineDisrupted — fn(lineKey) → bool
 *   onClick        — callback quand l'utilisateur clique
 */
export function JourneyCard({ item, currentTime, isLineDisrupted, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-3xl shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
            {/* Icônes de ligne(s) */}
            <div className="w-14 h-14 relative flex-shrink-0">
                <LineIconsDisplay item={item} isLineDisrupted={isLineDisrupted} />
            </div>

            <div className="w-px h-14 bg-gray-300" />

            {/* Heure de départ */}
            <div className="flex-1 text-left">
                <div className="text-xl font-bold text-gray-900">{item.dep}</div>
                <div className="text-sm text-gray-500">{formatTimeUntil(item.dep, currentTime)}</div>
            </div>

            {/* Heure d'arrivée + durée */}
            <div className="flex-1 text-right pr-3">
                <div className="text-xl font-bold text-gray-900">{item.arr}</div>
                <div className="text-sm text-gray-500">{item.dur}</div>
            </div>
        </button>
    );
}
