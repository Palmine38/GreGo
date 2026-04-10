import { useState } from 'react';

export default function Settings({ settingsOpen, setSettingsOpen }) {
    const [theme, setTheme] = useState('light');
    const [wheelchair, setWheelchair] = useState(false);
    const [walkSpeed, setWalkSpeed] = useState(1.4); // en m/s (convertir de km/h)

    const closeSettings = () => setSettingsOpen(false);

    // Convertir m/s en km/h pour l'affichage
    const speedInKmh = (walkSpeed * 3.6).toFixed(1);

    // Convertir km/h en m/s
    const handleSpeedChange = (kmh) => {
        const ms = kmh / 3.6;
        setWalkSpeed(ms);
    };

    return (
        <>
            {/* Button pour afficher les settings si fermé */}
            {!settingsOpen && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-100 border-t border-gray-300 p-2 shadow-md">
                    <button
                        className="w-full py-3 bg-blue-600 text-white rounded-t-lg"
                        onClick={() => setSettingsOpen(true)}
                    >
                        ^ Ouvrir les paramètres
                    </button>
                </div>
            )}

            {/* Settings Panel - slide up animation */}
            <div className={`${settingsOpen ? 'translate-y-0' : 'translate-y-full'} fixed bottom-0 left-0 right-0 z-20 border-t border-gray-300 bg-white p-4 shadow-xl transition-transform duration-500 sm:relative sm:translate-y-0 sm:border-none sm:shadow-none sm:p-0`}>
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
