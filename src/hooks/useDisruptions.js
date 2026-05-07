import { useEffect, useState } from 'react';

/**
 * Charge les perturbations TC depuis l'API Mobilités-M.
 * Retourne { disruptedLines, disruptionsRaw, isLineDisrupted }.
 */
export function useDisruptions() {
    const [disruptedLines, setDisruptedLines] = useState(new Set());
    const [disruptionsRaw, setDisruptionsRaw] = useState({});

    useEffect(() => {
        const fetchDisruptions = async () => {
            try {
                const res = await fetch('https://data.mobilites-m.fr/api/dyn/evtTC/json');
                const data = await res.json();
                setDisruptionsRaw(data);

                const lines = new Set();
                Object.values(data).forEach((evt) => {
                    if (!evt.visibleTC) return;
                    const raw = evt.listeLigne || '';
                    const match = raw.match(/(?:SEM:|[A-Z0-9]+_)(.+)$/);
                    const lineName = match ? match[1].toUpperCase() : raw.toUpperCase();
                    lines.add(lineName);
                    lines.add(raw.toUpperCase());
                });
                setDisruptedLines(lines);
            } catch (e) {
                console.error('Erreur chargement perturbations:', e);
            }
        };
        fetchDisruptions();
    }, []);

    const isLineDisrupted = (lineKey) => {
        if (!lineKey) return false;
        return disruptedLines.has(lineKey.toUpperCase());
    };

    /**
     * Retourne les perturbations actives pour une ligne donnée.
     */
    const getLineDisruptions = (lineName) => {
        return Object.values(disruptionsRaw).filter((evt) => {
            if (!evt.visibleTC) return false;
            const raw = (evt.listeLigne || '').toUpperCase();
            const match = raw.match(/(?:SEM:|[A-Z0-9]+_)(.+)$/);
            const evtLine = match ? match[1] : raw;
            return evtLine === lineName?.toUpperCase();
        });
    };

    return { disruptedLines, disruptionsRaw, isLineDisrupted, getLineDisruptions };
}
