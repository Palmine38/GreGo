import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tag-express-settings';

const DEFAULT_SETTINGS = {
    wheelchair: false,
    walkSpeed: 1.4,
    numItineraries: 5,
};

/**
 * Charge les paramètres depuis le localStorage et expose une fonction de rechargement.
 * Retourne { settings, reloadSettings }.
 */
export function useSettings() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    const load = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setSettings({
                    wheelchair: parsed.wheelchair ?? false,
                    walkSpeed: parsed.walkSpeed ?? 1.4,
                    numItineraries: parsed.numItineraries ?? 5,
                });
            }
        } catch (e) {
            console.error('Erreur chargement settings:', e);
        }
    };

    useEffect(() => { load(); }, []);

    return { settings, reloadSettings: load };
}
