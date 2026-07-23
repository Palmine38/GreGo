import React from "react";
import {
  CURRENT_LOCATION_LABEL,
  CURRENT_LOCATION_VALUE,
  isCurrentLocationValue,
} from "../utils/currentLocation.js";

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
  depDisplay,
  arrDisplay,
  line,
  searchDate,
  searchTime,
  setDep,
  setArr,
  setLine,
  setSearchDate,
  setSearchTime,
  depSuggestions,
  arrSuggestions,
  depAddressSuggestions = [],
  arrAddressSuggestions = [],
  onSelectSuggestion,
  onSearch,
  onReset,
  onCancel,
  loading,
  error: _error,
  stopsLoaded,
  onDepBlur,
  onArrBlur,
  onOpenMapPicker,
}) {
  const [activeInput, setActiveInput] = React.useState(null);
  const formatInputValue = (value, displayValue) => {
    if (isCurrentLocationValue(value)) return CURRENT_LOCATION_LABEL;
    if (displayValue && displayValue !== value) return displayValue;
    return value.includes("::") ? value.split("::")[0] : value;
  };
  const depUsesCurrentLocation = isCurrentLocationValue(dep);
  const formatDateInputValue = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (value) => {
    if (!value || !setSearchDate) return;
    const [year, month, day] = value.split("-").map(Number);
    const nextDate = new Date(searchDate || new Date());
    nextDate.setFullYear(year, month - 1, day);
    setSearchDate(nextDate);
  };
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
          <div className="flex items-center">
            <div className="relative flex-1">
              <input
                value={formatInputValue(dep, depDisplay)}
                onChange={(e) => setDep(e.target.value)}
                onClick={() => setActiveInput("dep")}
                onFocus={() => setActiveInput("dep")}
                className={`w-full border p-2 rounded-lg ${depUsesCurrentLocation ? "pr-8" : ""}`}
                placeholder="ex: Victor Hugo"
              />
              {depUsesCurrentLocation && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-black pointer-events-none"
                  aria-hidden="true"
                >
                  <path d="M4 11a9 9 0 0 1 9 9" />
                  <path d="M4 4a16 16 0 0 1 16 16" />
                  <circle cx="5" cy="19" r="1" />
                </svg>
              )}
            </div>
            {onOpenMapPicker && (
              <button
                type="button"
                title="Utiliser ma position en temps reel"
                aria-label="Utiliser ma position en temps reel"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onClick={() => {
                  setDep(CURRENT_LOCATION_VALUE);
                  setActiveInput(null);
                }}
                className={`ml-1 p-1.5 transition-colors ${
                  depUsesCurrentLocation
                    ? "text-slate-400 hover:text-slate-700"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 256 256"
                  className="size-4"
                >
                  <g transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)">
                    <path
                      d="M 26.731 55.583 L 1.142 45.289 c -1.682 -0.677 -1.459 -3.168 0.362 -4.041 L 87.116 0.205 c 1.71 -0.82 3.499 0.969 2.679 2.679 L 48.752 88.496 c -0.873 1.821 -3.364 2.044 -4.041 0.362 L 34.417 63.269 C 33.009 59.767 30.233 56.991 26.731 55.583 z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                </svg>
              </button>
            )}
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
                className="-ml-1 p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
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
          {activeInput === "dep" &&
            dep &&
            (depSuggestions.length > 0 || depAddressSuggestions.length > 0) && (
              <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white max-h-40 overflow-y-auto shadow-lg">
                {depSuggestions.length > 0 && (
                  <li className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-widest text-slate-400">
                    ARRÊTS
                  </li>
                )}
                {depSuggestions.map((s, i) => (
                  <li
                    key={i}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => onSelectSuggestion(s, "dep")}
                  >
                    {s}
                  </li>
                ))}
                {depAddressSuggestions.length > 0 && (
                  <li className="border-t border-slate-100 px-3 pt-3 pb-1 text-[11px] font-bold tracking-widest text-slate-400">
                    ADRESSES
                  </li>
                )}
                {depAddressSuggestions.map((address) => (
                  <li
                    key={address.value}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => onSelectSuggestion(address.value, "dep")}
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {address.label}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {address.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
        </div>

        {/* Arrivée */}
        <div className="space-y-1 relative">
          <span className="text-sm text-gray-600">Arrivée</span>
          <div className="flex items-center">
            <input
              value={formatInputValue(arr, arrDisplay)}
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
                className="-ml-1 p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
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
          {activeInput === "arr" &&
            arr &&
            (arrSuggestions.length > 0 || arrAddressSuggestions.length > 0) && (
              <ul className="absolute z-40 left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white max-h-40 overflow-y-auto shadow-lg">
                {arrSuggestions.length > 0 && (
                  <li className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-widest text-slate-400">
                    ARRÊTS
                  </li>
                )}
                {arrSuggestions.map((s, i) => (
                  <li
                    key={i}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => onSelectSuggestion(s, "arr")}
                  >
                    {s}
                  </li>
                ))}
                {arrAddressSuggestions.length > 0 && (
                  <li className="border-t border-slate-100 px-3 pt-3 pb-1 text-[11px] font-bold tracking-widest text-slate-400">
                    ADRESSES
                  </li>
                )}
                {arrAddressSuggestions.map((address) => (
                  <li
                    key={address.value}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => onSelectSuggestion(address.value, "arr")}
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {address.label}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {address.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
        </div>

        {/* Ligne (optionnel) */}
        <label className={`space-y-1 ${setSearchTime ? "" : "sm:col-span-2"}`}>
          <span className="text-sm text-gray-600">Ligne (optionnel)</span>
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            className="w-full border p-2 rounded-lg"
            placeholder="ex: A, B, C1..."
          />
        </label>

        {setSearchTime && (
          <div className="space-y-1">
            <span className="text-sm text-gray-600">Chercher pour</span>
            <div className="flex gap-2">
              {setSearchDate && (
                <input
                  type="date"
                  value={formatDateInputValue(searchDate)}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="min-w-0 flex-1 border p-2 rounded-lg"
                  aria-label="Date de recherche"
                />
              )}
              <input
                type="time"
                value={searchTime || ""}
                onChange={(e) => {
                  setSearchTime(e.target.value);
                }}
                className="min-w-0 flex-1 border p-2 rounded-lg"
                aria-label="Heure de recherche"
              />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-1.5 mt-3 flex flex-col items-stretch">
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
        className="mt-3 w-full text-center text-gray-500 text-sm"
      >
        Annuler
      </button>
    </div>
  );
}

export function SearchSheet({
  isOpen,
  onClose,
  children,
  showBackdrop = true,
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 ${showBackdrop ? "bg-black/40" : "bg-transparent"} transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
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
