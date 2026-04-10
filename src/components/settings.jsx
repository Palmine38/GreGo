import { useState, useEffect } from 'react';

const DEFAULTS = {
    wheelchair: false,
    walkSpeed: 1.4,
};

export default function Settings({ settingsOpen, setSettingsOpen }) {
    const [wheelchair, setWheelchair] = useState(DEFAULTS.wheelchair);
    const [walkSpeed, setWalkSpeed] = useState(DEFAULTS.walkSpeed);

    // Charger depuis localStorage au montage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('tag-express-settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.wheelchair !== undefined) setWheelchair(parsed.wheelchair);
                if (parsed.walkSpeed !== undefined) setWalkSpeed(parsed.walkSpeed);
            }
        } catch (e) {
            console.error('Erreur chargement settings:', e);
        }
    }, []);

    // Sauvegarder dans localStorage à chaque changement
    useEffect(() => {
        localStorage.setItem('tag-express-settings', JSON.stringify({ wheelchair, walkSpeed }));
    }, [wheelchair, walkSpeed]);

    const closeSettings = () => setSettingsOpen(false);

    const speedInKmh = (walkSpeed * 3.6).toFixed(1);
    const handleSpeedChange = (kmh) => setWalkSpeed(kmh / 3.6);

    return (
        <>

            {/* Settings Panel - slide up animation */}
            <div className={`${settingsOpen ? 'translate-y-0' : 'translate-y-full'} fixed bottom-0 left-0 right-0 border-t border-gray-300 bg-white p-4 shadow-xl transition-transform duration-300 sm:relative sm:translate-y-0 sm:border-none sm:shadow-none sm:p-0`} style={{ zIndex: 60 }}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Paramètres</h2>
                    <button
                        className="text-gray-600 hover:text-gray-900 text-lg"
                        onClick={() => setSettingsOpen(!settingsOpen)}
                    >
                        {settingsOpen ? 'v Cacher' : '^ Ouvrir'}
                    </button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {/* Theme Setting 
                    <div className="border-b border-gray-200 pb-4">
                        <label className="block text-sm font-semibold mb-2">Thème</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-full border border-gray-300 p-2 rounded bg-white"
                        >
                            <option value="light">Clair</option>
                            <option value="dark">Foncé</option>
                        </select>
                    </div> */}

                    {/* Accessibility PMR Setting */}
                    <div className="border-b border-gray-200 pb-4">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-semibold">Accessibilité PMR</span>
                            <input
                                type="checkbox"
                                checked={wheelchair}
                                onChange={(e) => setWheelchair(e.target.checked)}
                                className="w-4 h-4 cursor-pointer"
                            />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Ce paramètre oblige le système à inclure seulement les trajets accessibles aux personnes en fauteuil roulant</p>
                    </div>

                    {/* Walking Speed Setting */}
                    <div className="pb-4">
                        <label className="block text-sm font-semibold mb-2">Vitesse de marche</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={speedInKmh}
                                onChange={(e) => handleSpeedChange(parseFloat(e.target.value) || 0)}
                                step="0.5"
                                min="2"
                                max="20"
                                className="flex-1 border border-gray-300 p-2 rounded"
                            />
                            <span className="text-sm font-semibold">km/h</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Ce paramètre permet de modifier la vitesse de marche prise en compte dans les calculs.</p>
                    </div>
                </div>

                {/* Close button for mobile */}
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={closeSettings}
                        className="flex-1 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </>
    );
}
