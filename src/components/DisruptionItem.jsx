import React, { useEffect, useRef, useState } from 'react';

/**
 * Carte d'alerte pour une perturbation TC, avec expand/collapse animé.
 */
export function DisruptionItem({ evt }) {
    const [expanded, setExpanded] = useState(false);
    const contentRef = useRef(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (contentRef.current) {
            setHeight(expanded ? contentRef.current.scrollHeight : 0);
        }
    }, [expanded]);

    const parts = (evt.texte || '').split('|');
    const titre = parts[0].trim();
    const corps = parts.slice(1).join('\n').replace(/<[^>]+>/g, '').trim();
    const lines = corps.split('\n');
    const jusquauLine = lines.find((l) => /jusqu['']au/i.test(l))?.trim();
    const reste = lines.filter((l) => !/jusqu['']au/i.test(l)).join('\n').trim();

    return (
        <div className="flex gap-2 items-start p-3 rounded-xl bg-amber-50 border border-amber-200">
            {/* Icône triangle */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="size-4 flex-shrink-0 mt-0.5" style={{ color: '#fcbe03' }}>
                <path d="M8 3.5 3 12.5h10L8 3.5Z" fill="white" />
                <path fillRule="evenodd" fill="currentColor" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>

            <div className="flex-1 min-w-0">
                <button
                    onClick={() => setExpanded((prev) => !prev)}
                    className="flex items-center justify-between w-full gap-1"
                >
                    <p className="text-xs font-semibold text-amber-800 text-left">{titre}</p>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className={`size-3 flex-shrink-0 text-amber-700 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                    >
                        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                </button>
                <div style={{ height, overflow: 'hidden', transition: 'height 0.2s ease' }}>
                    <div ref={contentRef} className="mt-1 space-y-0.5">
                        {jusquauLine && <p className="text-xs font-medium text-amber-700">{jusquauLine}</p>}
                        {reste && <p className="text-xs text-amber-600 whitespace-pre-line">{reste}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
