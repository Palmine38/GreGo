import { useState, useEffect, useRef } from 'react';
const DEBUG = true;

const DEFAULTS = {
    wheelchair: false,
    walkSpeed: 1.4,
    numItineraries: 5,
};

export default function Settings({ settingsOpen, setSettingsOpen, onSettingsChanged }) {
    const fileInputRef = useRef(null);
    const snapshotOnOpen = useRef(null);
    const isFirstRender = useRef(true);

    const getInitialSettings = () => {
        try {
            const saved = localStorage.getItem('tag-express-settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    wheelchair: parsed.wheelchair ?? DEFAULTS.wheelchair,
                    walkSpeed: parsed.walkSpeed ?? DEFAULTS.walkSpeed,
                    numItineraries: parsed.numItineraries ?? DEFAULTS.numItineraries,
                };
            }
        } catch (e) {
            console.error('Erreur chargement settings:', e);
        }
        return DEFAULTS;
    };

    const initial = getInitialSettings();
    const [wheelchair, setWheelchair] = useState(initial.wheelchair);
    const [walkSpeed, setWalkSpeed] = useState(initial.walkSpeed);
    const [numItineraries, setNumItineraries] = useState(initial.numItineraries);

    // 👇 À l'ouverture : snapshot brut du localStorage
    useEffect(() => {
        if (settingsOpen) {
            snapshotOnOpen.current = localStorage.getItem('tag-express-settings');
            if (DEBUG) console.log('⚙️ Snapshot ouverture:', snapshotOnOpen.current);
        }
    }, [settingsOpen]);

    const closeSettings = () => {
        const current = localStorage.getItem('tag-express-settings');

        if (snapshotOnOpen.current !== current) {
            if (DEBUG) console.log('⚙️ Settings modifiés → reset cache + re-recherche');
            localStorage.removeItem('tag-express-cache');
            onSettingsChanged?.();
        } else {
            if (DEBUG) console.log('⚙️ Aucun changement détecté');
        }

        setSettingsOpen(false);
    };

    const downloadLocalStorage = () => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            data[key] = localStorage.getItem(key);
        }
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `localStorage-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const uploadLocalStorage = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result || '{}');
                for (const key in data) {
                    localStorage.setItem(key, data[key]);
                }
                alert('localStorage importé avec succès!');
                window.location.reload();
            } catch (err) {
                alert('Erreur lors de l\'import du fichier. Assurez-vous que c\'est un JSON valide.');
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        localStorage.setItem('tag-express-settings', JSON.stringify({ wheelchair, walkSpeed, numItineraries }));
        if (DEBUG) console.log('⚙️ Settings sauvegardés:', { wheelchair, walkSpeed, numItineraries });
    }, [wheelchair, walkSpeed, numItineraries]);

    const speedInKmh = (walkSpeed * 3.6).toFixed(1);
    const handleSpeedChange = (kmh) => setWalkSpeed(kmh / 3.6);

    return (
        <>
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

                    <div className="pb-4">
                        <label className="block text-sm font-semibold mb-2">Vitesse de marche</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                value={speedInKmh}
                                onChange={(e) => handleSpeedChange(parseFloat(e.target.value) || 0)}
                                step="0.5" min="2" max="20"
                                className="flex-1 cursor-pointer"
                            />
                            <span className="text-sm font-semibold w-12 text-right">{speedInKmh} km/h</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Ce paramètre permet de modifier la vitesse de marche prise en compte dans les calculs. (Défaut : 5 km/h)</p>
                    </div>

                    <div className="pb-4">
                        <label className="block text-sm font-semibold mb-2">Nombre d'itineraires retournés</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                value={numItineraries}
                                onChange={(e) => setNumItineraries(parseInt(e.target.value) || 1)}
                                min="2" max="10"
                                className="flex-1 cursor-pointer"
                            />
                            <span className="text-sm font-semibold w-8 text-right">{numItineraries}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Ce paramètre permet de modifier le nombre d'itineraires retournés par la recherche. (Défaut : 5)</p>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                        <label className="block text-sm font-semibold mb-3">Paramètres avancés</label>
                        <div className="space-y-2">
                            <button onClick={downloadLocalStorage} className="w-full py-2 px-3 border border-gray-500 text-gray-800 rounded hover:bg-gray-200 transition-colors text-sm font-semibold">
                                Télécharger localStorage
                            </button>
                            <button onClick={triggerFileUpload} className="w-full py-2 px-3 border border-gray-500 text-gray-800 rounded hover:bg-gray-200 transition-colors text-sm font-semibold">
                                Importer localStorage
                            </button>
                            <input ref={fileInputRef} type="file" accept=".json" onChange={uploadLocalStorage} style={{ display: 'none' }} />
                        </div>
                    </div>
                </div>

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