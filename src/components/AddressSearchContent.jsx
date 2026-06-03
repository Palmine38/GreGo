import React, { useRef, useState } from "react";

async function autocompleteGeocode(query) {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=7TQErbyvEqFlis3QMmSl&language=fr&bbox=5.08,44.70,6.40,45.50&proximity=5.74892,45.18501&limit=6`,
    );
    const json = await res.json();
    return (json.features || [])
      .filter((f) => {
        const ctx = (f.context || []).map((c) => c.text || "").join(" ");
        return (
          ctx.includes("Isère") ||
          ctx.includes("38") ||
          f.place_name?.includes("Isère")
        );
      })
      .map((f) => {
        const [lon, lat] = f.center;
        const name = (f.place_name || "")
          .split(",")
          .slice(0, 2)
          .join(",")
          .trim();
        return { name, lat, lon, full: f.place_name };
      });
  } catch {
    return [];
  }
}

export function AddressSearchContent({ onSelect }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);

  return (
    <div className="space-y-2 pt-1">
      <input
        value={query}
        onChange={(e) => {
          const q = e.target.value;
          setQuery(q);
          clearTimeout(debounceRef.current);
          if (q.length < 2) {
            setSuggestions([]);
            return;
          }
          debounceRef.current = setTimeout(async () => {
            setSuggestions(await autocompleteGeocode(q));
          }, 300);
        }}
        className="w-full border p-2 rounded-lg"
        placeholder="ex: 12 rue Félix Viallet, Grenoble"
        autoFocus
      />
      {suggestions.length > 0 && (
        <ul className="border rounded-xl overflow-hidden divide-y divide-gray-100 bg-white shadow">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                onClick={() => onSelect(s)}
              >
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {s.name}
                </p>
                <p className="text-xs text-gray-400 truncate">{s.full}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.length >= 2 && suggestions.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">
          Aucun résultat en Isère
        </p>
      )}
    </div>
  );
}
