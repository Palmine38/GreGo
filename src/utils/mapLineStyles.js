// Styles MapLibre des tracés, alignés sur ceux de GreLines : une ligne est
// posée sur un liseré blanc, un trajet sur un halo de sa couleur, et la
// marche reste en pointillés discrets.

export const ROUND_LINE_LAYOUT = { "line-join": "round", "line-cap": "round" };

// Tracé complet d'une ligne (sélection d'une ligne sur la carte).
export const LINE_SHAPE_CASING_PAINT = {
  "line-color": "#ffffff",
  "line-width": 12,
  "line-opacity": 0.6,
};
export const lineShapePaint = (color) => ({
  "line-color": color,
  "line-width": 7,
  "line-opacity": 0.95,
});

// Tronçons d'un trajet.
export const WALK_LINE_LAYOUT = { "line-join": "round", "line-cap": "butt" };
export const WALK_LINE_PAINT = {
  "line-color": "#94a3b8",
  "line-width": 4,
  "line-dasharray": [3, 3],
  "line-opacity": 0.6,
};
export const transitCasingPaint = (color) => ({
  "line-color": color,
  "line-width": 10,
  "line-opacity": 0.3,
});
export const transitLinePaint = (color) => ({
  "line-color": color,
  "line-width": 5,
  "line-opacity": 0.95,
});

// Pastilles des arrêts du trajet (départ / arrivée, correspondances).
export const endpointDotStyle = {
  width: 15,
  height: 15,
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  border: "3.5px solid #0f172a",
  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
};
export const transferDotStyle = (color = "#334155") => ({
  width: 13,
  height: 13,
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  border: `3px solid ${color}`,
  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
});
