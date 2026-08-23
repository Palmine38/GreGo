import { useEffect, useState } from 'react';
import { getRoutes } from "../utils/routesCache.js";

/**
 * Charge les couleurs officielles des lignes depuis l'API Mobilités-M.
 * Retourne { lineColors } : { [shortName]: '#RRGGBB' }
 */
export function useLineColors() {
    const [lineColors, setLineColors] = useState({});

    useEffect(() => {
        const load = async () => {
            try {
                const routes = await getRoutes();
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
