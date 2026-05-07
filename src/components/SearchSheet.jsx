import React from "react";

/**
 * Panneau de recherche partagé entre FastResearch et MesTrajets.
 * S'adapte légèrement selon le contexte via les props.
 *
 * En FastResearch  → rendu natif (translate-y)
 * En MesTrajets   → ce composant est rendu dans un <Sheet.Content> externe
 *
 * Props :
 *   title          — titre affiché en haut du panneau (ex: "Recherche" / "Configuration - T1")
 *   dep, arr, line — valeurs des champs
 *   setDep, setArr, setLine
 *   depSuggestions, arrSuggestions
 *   onSelectSuggestion — fn(value, 'dep'|'arr')
 *   onSearch       — fn() lance la recherche
 *   onReset        — fn() réinitialise
 *   onCancel       — fn() annule / ferme
 *   loading        — bool
 *   stopsLoaded    — bool
 *   // Pour le rendu natif (FastResearch) :
 *   isOpen         — bool (optionnel, si undefined → pas de logique de visibilité gérée ici)
 */
export function SearchForm({
  title = "Recherche",
  dep,
  arr,
  line,
  setDep,
  setArr,
  setLine,
  depSuggestions,
  arrSuggestions,
  onSelectSuggestion,
  onSearch,
  onReset,
  onCancel,
  loading,
  stopsLoaded,
  onDepBlur,
  onArrBlur,
  onOpenMapPicker,
}) {
  const [activeInput, setActiveInput] = React.useState(null);
  return (
    <div className="px-4 pt-4 pb-10">
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold text-lg">{title}</span>
        <button
          className="text-slate-400 hover:text-slate-700"
          onClick={onCancel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Départ */}
        <div className="space-y-1 relative">
          <span className="text-sm text-gray-600">Départ</span>
          <div className="flex items-center gap-1">
            <input
              value={dep.includes("::") ? dep.split("::")[0] : dep}
              onChange={(e) => setDep(e.target.value)}
              onClick={() => setActiveInput("dep")}
              onFocus={() => setActiveInput("dep")}
              className="flex-1 border p-2 rounded-lg"
              placeholder="ex: Victor Hugo"
            />
            {onOpenMapPicker && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onClick={() => onOpenMapPicker("dep")}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                  />
                </svg>
              </button>
            )}
          </div>
          {activeInput === "dep" && dep && depSuggestions.length > 0 && (
            <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white max-h-40 overflow-y-auto shadow-lg">
              {depSuggestions.map((s, i) => (
                <li
                  key={i}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => onSelectSuggestion(s, "dep")}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Arrivée */}
        <div className="space-y-1 relative">
          <span className="text-sm text-gray-600">Arrivée</span>
          <div className="flex items-center gap-1">
            <input
              value={arr.includes("::") ? arr.split("::")[0] : arr}
              onChange={(e) => setArr(e.target.value)}
              onClick={() => setActiveInput("arr")}
              onFocus={() => setActiveInput("arr")}
              className="flex-1 border p-2 rounded-lg"
              placeholder="ex: Alsace Lorraine"
            />
            {onOpenMapPicker && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onClick={() => onOpenMapPicker("arr")}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                  />
                </svg>
              </button>
            )}
          </div>
          {activeInput === "arr" && arr && arrSuggestions.length > 0 && (
            <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white max-h-40 overflow-y-auto shadow-lg">
              {arrSuggestions.map((s, i) => (
                <li
                  key={i}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => onSelectSuggestion(s, "arr")}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ligne (optionnel) */}
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-gray-600">Ligne (optionnel)</span>
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            className="w-full border p-2 rounded-lg"
            placeholder="ex: E, A, C1..."
          />
        </label>
      </div>
      <div className="space-y-2 mt-4 flex flex-col items-stretch">
        <button
          onClick={onSearch}
          disabled={loading || !stopsLoaded}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-60"
        >
          {!stopsLoaded
            ? "Chargement des arrêts..."
            : loading
              ? "Recherche..."
              : "Rechercher"}
        </button>
        <button
          onClick={onReset}
          className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
        >
          Réinitialiser
        </button>
      </div>

      <button
        onClick={onCancel}
        type="button"
        className="mt-4 w-full text-center text-gray-500 text-sm"
      >
        Annuler
      </button>
    </div>
  );
}

/**
 * Wrapper natif (translate-y) utilisé par FastResearch.
 * MesTrajets wrappera <SearchForm> directement dans son <Sheet>.
 */
export function SearchSheet({ isOpen, onClose, children }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`${isOpen ? "translate-y-0" : "translate-y-full"} fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-gray-300 bg-white shadow-xl transition-transform duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
