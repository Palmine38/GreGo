import React, { useEffect, useState } from 'react';

// Cache global pour les données des lignes
const lineDataCache = new Map();
let routesPromise = null;

// Charger une seule fois toutes les routes
const fetchAllRoutes = async () => {
    if (routesPromise) return routesPromise;

    routesPromise = fetch('https://data.mobilites-m.fr/api/routers/default/index/routes')
        .then(res => res.json())
        .catch(err => {
            console.error('Erreur chargement routes:', err);
            return [];
        });

    return routesPromise;
};

export default function LineIcon({ lineKey = '', size = 'w-6 h-6' }) {
    const [lineData, setLineData] = useState(null);

    useEffect(() => {
        const loadLineData = async () => {
            if (!lineKey) return;

            // Vérifier le cache
            if (lineDataCache.has(lineKey)) {
                setLineData(lineDataCache.get(lineKey));
                return;
            }

            try {
                const routes = await fetchAllRoutes();
                const route = routes.find(r => {
                    const shortName = (r.shortName || '').toUpperCase();
                    return shortName === lineKey.toUpperCase();
                });

                const data = route ? {
                    shortName: route.shortName || lineKey,
                    color: route.color ? '#' + route.color : '#000000',
                    type: route.type || ''
                } : {
                    shortName: lineKey,
                    color: '#000000',
                    type: ''
                };

                lineDataCache.set(lineKey, data);
                setLineData(data);
            } catch (error) {
                console.error('Erreur lors du chargement des données de ligne:', error);
                const data = {
                    shortName: lineKey,
                    color: '#000000',
                    type: ''
                };
                lineDataCache.set(lineKey, data);
                setLineData(data);
            }
        };

        loadLineData();
    }, [lineKey]);

    if (!lineData) {
        return <div className={`${size} bg-gray-300 rounded-full`}></div>;
    }

    // Déterminer la taille en pixels pour le calcul du texte
    const sizeMap = {
        'w-4 h-4': 10,
        'w-5 h-5': 12,
        'w-6 h-6': 16,
        'w-8 h-8': 20,
        'w-10 h-10': 24,
        'w-12 h-12': 28
    };

    const fontSize = sizeMap[size] || 16;
    const isRound = ['TRAM', 'CHRONO_PERI', 'CHRONO'].includes(lineData.type?.toUpperCase());

    return (
        <div
            className={`${size} flex items-center justify-center flex-shrink-0`}
            style={{
                backgroundColor: lineData.color,
                borderRadius: isRound ? '50%' : '20%'
            }}
            title={lineData.shortName}
        >
            <span
                className="font-bold text-white leading-none"
                style={{ fontSize: `${fontSize - 4}px` }}
            >
                {lineData.shortName}
            </span>
        </div>
    );
}
