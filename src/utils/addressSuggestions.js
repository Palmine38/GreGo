export const normalizeSearchText = (value) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export async function findAddressSuggestions(query) {
  if (query.trim().length < 2) return [];

  try {
    const response = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=7TQErbyvEqFlis3QMmSl&language=fr&bbox=5.08,44.70,6.40,45.50&proximity=5.74892,45.18501&limit=6`,
    );
    const data = await response.json();
    return (data.features || []).map((feature) => {
      const [lon, lat] = feature.center;
      const label = (feature.place_name || "")
        .split(",")
        .slice(0, 2)
        .join(",")
        .trim();
      return {
        label,
        value: `${label}::${lat},${lon}`,
        detail: feature.place_name,
      };
    });
  } catch {
    return [];
  }
}
