import { useEffect, useState } from 'react';

/**
 * Charge les couleurs officielles des lignes depuis l'API Mobilités-M.
 * Retourne { lineColors } : { [shortName]: '#RRGGBB' }
 */
export function useLineColors() {
    const [lineColors, setLineColors] = useState({});

    useEffect(() => {
        const load = async () => {
            try {
                const response = await fetch('https://data.mobilites-m.fr/api/routers/default/index/routes');
                const routes = await response.json();
                const colors = {};
                routes.forEach((route) => {
                    const shortName = route.shortName?.toUpperCase();
                    if (shortName && route.color) colors[shortName] = '#' + route.color;
                });
                setLineColors(colors);
            } catch (e) {
                console.error('Erreur chargement couleurs:', e);
            }
        };
        load();
    }, []);

    return { lineColors };
}
