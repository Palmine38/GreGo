import { useRef, useState, useCallback, useEffect } from "react";
import MapLibreMap, { Marker } from "react-map-gl/maplibre";
import { createPortal } from "react-dom";
import { MapSheet } from "./MapSheet.jsx";
import { Source, Layer } from "react-map-gl/maplibre";
import { Sheet } from "react-modal-sheet";
import LineIcon, { LINE_COLORS } from "./lines-icons.jsx";
import { NearestStopsSheet } from "./nearestStops.jsx";
import lineB from "./lineB.json";
import lineNAVBVerdunToPDS from "./lineNAVB_verdun_to_pds.json";
import lineNAVBPdsToVerdun from "./lineNAVB_pds_to_verdun.json";
import { useTheme } from "../hooks/useTheme.js";

const MAPTILER_STYLE_URL_LIGHT =
  "https://api.maptiler.com/maps/019d0d02-359b-7f4b-a797-bdeabca9dce3/style.json?key=7TQErbyvEqFlis3QMmSl";
const MAPTILER_STYLE_URL_DARK =
  "https://api.maptiler.com/maps/019f7c73-0431-726f-ae5d-598a16a06771/style.json?key=7TQErbyvEqFlis3QMmSl";

const GRENOBLE_CENTER = { longitude: 5.74892, latitude: 45.18501 };

const throttle = (fn, delay) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
};

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lon},${lat}.json?key=7TQErbyvEqFlis3QMmSl&language=fr`,
    );
    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return null;
    const parts = feature.place_name?.split(",") || [];
    return parts.slice(0, 2).join(",").trim() || feature.place_name || null;
  } catch {
    return null;
  }
}

async function forwardGeocode(query) {
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=7TQErbyvEqFlis3QMmSl&language=fr&bbox=5.5,45.0,6.0,45.4`,
    );
    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return null;
    const [lon, lat] = feature.center;
    const parts = feature.place_name?.split(",") || [];
    const name = parts.slice(0, 2).join(",").trim() || feature.place_name;
    return { name, lat, lon };
  } catch {
    return null;
  }
}

async function autocompleteGeocode(query) {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=7TQErbyvEqFlis3QMmSl&language=fr&bbox=5.08,44.70,6.40,45.50&proximity=5.74892,45.18501&limit=6`,
    );
    const json = await res.json();
    return (json.features || [])
      .filter((f) => {
        // Filtre département 38 (Isère) via le context
        const ctx = (f.context || []).map((c) => c.text || "").join(" ");
        return (
          ctx.includes("Isère") ||
          ctx.includes("38") ||
          f.place_name?.includes("Isère")
        );
      })
      .map((f) => {
        const [lon, lat] = f.center;
        const parts = (f.place_name || "").split(",");
        const name = parts.slice(0, 2).join(",").trim();
        return { name, lat, lon, full: f.place_name };
      });
  } catch {
    return [];
  }
}

// ─── Tracé personnalisé pour des lignes spécifiques ────────────────────────
// Permet de remplacer la géométrie OTP par un tracé fourni à la main pour
// une ligne donnée (ex: la ligne B). Le tracé est une liste de points
// [lon, lat] — tu peux fournir soit le tracé complet de la ligne, soit juste
// le tronçon qui t'intéresse : le code retrouve tout seul, pour chaque leg,
// la portion pertinente entre l'arrêt de départ et l'arrêt d'arrivée.
//
// Clé = nom de ligne tel qu'affiché (routeShortName / route / routeId, sans
// le préfixe "SEM:", en majuscules) — donc "B" pour la ligne B.
const CUSTOM_LINE_TRACES = {
  B: [
    [5.6993872, 45.2060992],
    [5.6999231, 45.2056853],
    [5.7005187, 45.2052331],
    [5.7007066, 45.2050677],
    [5.7008822, 45.2049137],
    [5.701463, 45.2044857],
    [5.7025582, 45.2036572],
    [5.7034658, 45.2029636],
    [5.7045001, 45.2021719],
    [5.7063421, 45.2007658],
    [5.7077711, 45.1996723],
    [5.7091602, 45.1986144],
    [5.7095462, 45.1983194],
    [5.7098753, 45.1980024],
    [5.7099856, 45.1978254],
    [5.7101935, 45.1974066],
    [5.7107714, 45.1961775],
    [5.7109544, 45.1958209],
    [5.7110376, 45.1957209],
    [5.711111, 45.1956485],
    [5.7111636, 45.195589],
    [5.7111957, 45.1955332],
    [5.7112507, 45.1954056],
    [5.711252, 45.1953005],
    [5.711233, 45.1951987],
    [5.7111785, 45.1949136],
    [5.7111292, 45.1946646],
    [5.7109013, 45.1939146],
    [5.7107854, 45.1935278],
    [5.7106994, 45.193227],
    [5.7104579, 45.1924498],
    [5.7104488, 45.1924237],
    [5.7104394, 45.1923805],
    [5.7104409, 45.1923316],
    [5.7104459, 45.1922813],
    [5.7104634, 45.1922232],
    [5.7105027, 45.1921484],
    [5.7105599, 45.1920792],
    [5.7106177, 45.1920222],
    [5.7106735, 45.1919773],
    [5.7114976, 45.1913415],
    [5.7119893, 45.1909591],
    [5.7126787, 45.1904442],
    [5.712884, 45.1902848],
    [5.7129605, 45.1902069],
    [5.7130022, 45.1901561],
    [5.7130377, 45.1900859],
    [5.7130482, 45.1900388],
    [5.7130573, 45.1899779],
    [5.7130472, 45.1898898],
    [5.7130212, 45.1897835],
    [5.7129511, 45.1894939],
    [5.7129193, 45.1893351],
    [5.7128934, 45.1891792],
    [5.7128605, 45.1889807],
    [5.7128396, 45.1888482],
    [5.7128396, 45.1887943],
    [5.7128633, 45.1886932],
    [5.712897, 45.1886358],
    [5.7129553, 45.1885822],
    [5.7130452, 45.1885107],
    [5.7131263, 45.1884631],
    [5.7132043, 45.188437],
    [5.7132611, 45.1884203],
    [5.7133848, 45.1883884],
    [5.714364, 45.1883317],
    [5.7144654, 45.1883379],
    [5.7145836, 45.1883627],
    [5.7146507, 45.1883825],
    [5.7147244, 45.188423],
    [5.7147793, 45.1884645],
    [5.7148321, 45.1885179],
    [5.7149196, 45.1886156],
    [5.7150893, 45.1887986],
    [5.7152861, 45.1889979],
    [5.715393, 45.1891031],
    [5.7154779, 45.189206],
    [5.7155079, 45.1892784],
    [5.7155154, 45.1893989],
    [5.7154779, 45.1894952],
    [5.7154265, 45.189601],
    [5.7153779, 45.1896963],
    [5.7153261, 45.1897697],
    [5.7152889, 45.1898021],
    [5.715252, 45.1898742],
    [5.715192, 45.1899751],
    [5.7151352, 45.1900814],
    [5.7150618, 45.1902188],
    [5.7149987, 45.1903474],
    [5.7149257, 45.1904879],
    [5.714899, 45.1905309],
    [5.7148679, 45.1906042],
    [5.7148667, 45.1906358],
    [5.7148836, 45.1906853],
    [5.7149079, 45.1907239],
    [5.7149505, 45.1907701],
    [5.7150052, 45.1908044],
    [5.7150796, 45.190832],
    [5.715158, 45.1908454],
    [5.715183, 45.1908468],
    [5.7152039, 45.1908468],
    [5.7152289, 45.1908454],
    [5.715258, 45.190842],
    [5.7153269, 45.1908301],
    [5.7153749, 45.1908144],
    [5.7154214, 45.1907927],
    [5.7154633, 45.1907656],
    [5.7154917, 45.1907375],
    [5.7155119, 45.1907075],
    [5.7155309, 45.1906741],
    [5.7155608, 45.1906131],
    [5.7155814, 45.1905678],
    [5.7156051, 45.1905119],
    [5.7157121, 45.1902749],
    [5.7157432, 45.1902082],
    [5.715791, 45.1901571],
    [5.7158406, 45.1901215],
    [5.7158893, 45.1900955],
    [5.7159532, 45.1900742],
    [5.7160349, 45.1900531],
    [5.7161485, 45.1900358],
    [5.717232, 45.1898717],
    [5.7186685, 45.1896438],
    [5.7203137, 45.1893916],
    [5.7223307, 45.1890779],
    [5.7224813, 45.1890542],
    [5.7225882, 45.1890399],
    [5.7227215, 45.1890266],
    [5.7229021, 45.1890259],
    [5.7231034, 45.1890248],
    [5.7232716, 45.1890261],
    [5.7234302, 45.189043],
    [5.7235801, 45.1890713],
    [5.7237128, 45.18911],
    [5.7238774, 45.189188],
    [5.7241491, 45.1893371],
    [5.7246135, 45.1895964],
    [5.7247919, 45.1896906],
    [5.7250532, 45.1898093],
    [5.7252749, 45.1898961],
    [5.7255099, 45.1899763],
    [5.725848, 45.1900707],
    [5.7261886, 45.1901453],
    [5.7264387, 45.1902001],
    [5.7266062, 45.1902659],
    [5.726777, 45.1903676],
    [5.7269587, 45.1904726],
    [5.7270488, 45.1904917],
    [5.7271532, 45.1904999],
    [5.7272516, 45.1904846],
    [5.7273403, 45.1904597],
    [5.7274162, 45.1904146],
    [5.727507, 45.1903441],
    [5.7276175, 45.1902656],
    [5.727678, 45.1902353],
    [5.727775, 45.190201],
    [5.7279864, 45.1901825],
    [5.7285272, 45.190147],
    [5.7287741, 45.1901285],
    [5.7296619, 45.1901009],
    [5.7300472, 45.1900865],
    [5.7301243, 45.1900859],
    [5.7302142, 45.190098],
    [5.7302868, 45.1901164],
    [5.7303574, 45.1901513],
    [5.7304165, 45.1901931],
    [5.7304599, 45.1902543],
    [5.7304795, 45.1903123],
    [5.7304834, 45.1903781],
    [5.7304789, 45.1904447],
    [5.7304692, 45.1905591],
    [5.7304542, 45.190663],
    [5.7304432, 45.1907912],
    [5.7304426, 45.1908676],
    [5.7304542, 45.1909428],
    [5.7304693, 45.1910197],
    [5.7305005, 45.1910707],
    [5.7305313, 45.1911315],
    [5.7305596, 45.1911947],
    [5.7308267, 45.191612],
    [5.7309285, 45.1917605],
    [5.7312123, 45.1922647],
    [5.7312864, 45.1924085],
    [5.7313588, 45.1925674],
    [5.7313978, 45.1926601],
    [5.7314554, 45.1928395],
    [5.7315412, 45.1929513],
    [5.731693, 45.1931085],
    [5.7318671, 45.1932879],
    [5.7320482, 45.1934789],
    [5.7323724, 45.1938124],
    [5.7326139, 45.1940557],
    [5.7327134, 45.1941593],
    [5.7328925, 45.1943018],
    [5.7332015, 45.1945362],
    [5.7335747, 45.1948286],
    [5.7338907, 45.1950666],
    [5.7341583, 45.1952682],
    [5.7346297, 45.1956319],
    [5.7350038, 45.1959241],
    [5.7352594, 45.1961187],
    [5.7355161, 45.1963162],
    [5.735812, 45.1965393],
    [5.736077, 45.1967435],
    [5.7364307, 45.1970138],
    [5.7366878, 45.1972121],
    [5.7370029, 45.1974459],
    [5.737423, 45.1977652],
    [5.738716, 45.1987504],
    [5.73981, 45.1995807],
    [5.7406453, 45.2001811],
    [5.7409652, 45.2004279],
    [5.7414659, 45.2008001],
    [5.7415365, 45.20086],
    [5.741623, 45.2009107],
    [5.741702, 45.2009521],
    [5.7418091, 45.2009829],
    [5.7419063, 45.2010056],
    [5.7420048, 45.2010146],
    [5.7421025, 45.2010193],
    [5.7421995, 45.20101],
    [5.7422923, 45.2009932],
    [5.7423936, 45.2009663],
    [5.7425035, 45.2009363],
    [5.7426576, 45.2008879],
    [5.7430245, 45.2007744],
    [5.7435726, 45.2006023],
    [5.7442132, 45.2003987],
    [5.7444709, 45.2003179],
    [5.7445747, 45.2002885],
    [5.7447114, 45.2002617],
    [5.7448481, 45.2002515],
    [5.7450056, 45.2002536],
    [5.7451781, 45.2002672],
    [5.7456461, 45.2003538],
    [5.7459068, 45.2003982],
    [5.7460712, 45.2004251],
    [5.7462367, 45.2004344],
    [5.7463592, 45.2004334],
    [5.7464776, 45.2004185],
    [5.7465958, 45.2003921],
    [5.7467217, 45.2003479],
    [5.746835, 45.2002929],
    [5.7469449, 45.2002334],
    [5.7470389, 45.2001668],
    [5.7471384, 45.2000957],
    [5.7472599, 45.2000087],
    [5.7474013, 45.1999104],
    [5.7475104, 45.1998363],
    [5.7477283, 45.1996905],
    [5.7478409, 45.1996323],
    [5.7479332, 45.1995914],
    [5.74806, 45.1995474],
    [5.7482517, 45.1994884],
    [5.7485233, 45.1994056],
    [5.7489076, 45.1992928],
    [5.7494657, 45.1991404],
    [5.749978, 45.1990022],
    [5.7506123, 45.1988349],
    [5.7507511, 45.1987964],
    [5.7508855, 45.1987637],
    [5.7509823, 45.198741],
    [5.751095, 45.1987067],
    [5.7511669, 45.1986769],
    [5.7512475, 45.1986419],
    [5.7513649, 45.1985807],
    [5.7514608, 45.1985247],
    [5.7515182, 45.1984818],
    [5.7521363, 45.198025],
    [5.7526222, 45.1976634],
    [5.7529283, 45.197431],
    [5.7532451, 45.1971969],
    [5.753591, 45.1969331],
    [5.7538123, 45.1967764],
    [5.7538934, 45.1967083],
    [5.7540969, 45.1965292],
    [5.754264, 45.1963728],
    [5.7544831, 45.1961642],
    [5.754611, 45.1960114],
    [5.7546467, 45.1959793],
    [5.7546836, 45.1959422],
    [5.7547326, 45.1958972],
    [5.7549152, 45.1956633],
    [5.7549703, 45.1955931],
    [5.7550607, 45.1954556],
    [5.7551531, 45.1953161],
    [5.7553135, 45.1950381],
    [5.7554326, 45.1948241],
    [5.7556441, 45.194431],
    [5.7558255, 45.1940854],
    [5.7559786, 45.1938087],
    [5.7561374, 45.1935383],
    [5.7562002, 45.1934545],
    [5.7562755, 45.1933556],
    [5.756383, 45.1932312],
    [5.7564656, 45.1931508],
    [5.756549, 45.1930674],
    [5.7566378, 45.1929856],
    [5.756784, 45.1928712],
    [5.7569082, 45.192777],
    [5.7570464, 45.1926919],
    [5.7571584, 45.1926205],
    [5.7572628, 45.1925593],
    [5.7573537, 45.1925183],
    [5.7574746, 45.1924559],
    [5.7576402, 45.1923854],
    [5.7580613, 45.1922285],
    [5.7584961, 45.1921097],
    [5.7588011, 45.1920652],
    [5.7590484, 45.1920381],
    [5.7593484, 45.1920146],
    [5.7595789, 45.1920098],
    [5.7600566, 45.1920263],
    [5.7611297, 45.1920923],
    [5.7633153, 45.1922245],
    [5.7661419, 45.1923979],
    [5.7664008, 45.192418],
    [5.7666423, 45.1924629],
    [5.7668731, 45.1925524],
    [5.7670382, 45.192661],
    [5.7672348, 45.1927814],
    [5.7674842, 45.1928892],
    [5.7677151, 45.1929464],
    [5.7682292, 45.1929861],
    [5.7704351, 45.1931119],
    [5.7705862, 45.1931192],
    [5.7707047, 45.1930875],
    [5.7708121, 45.1930222],
    [5.7708767, 45.1929598],
    [5.7709024, 45.1928848],
    [5.7709147, 45.1927381],
    [5.7710267, 45.1908006],
    [5.7710448, 45.1906902],
    [5.7711002, 45.1906187],
    [5.7711823, 45.1905476],
    [5.7712735, 45.1905019],
    [5.7713826, 45.1904772],
    [5.7715141, 45.1904552],
    [5.7718289, 45.1904173],
    [5.772059, 45.1903666],
    [5.7722447, 45.19031],
    [5.7723545, 45.1902665],
    [5.772568, 45.1901573],
    [5.7727642, 45.1900406],
    [5.7732623, 45.1897287],
    [5.7735576, 45.1895542],
    [5.7742646, 45.1891268],
    [5.7745622, 45.1889554],
    [5.7748544, 45.1887713],
    [5.7750854, 45.1886281],
    [5.7753028, 45.1884994],
    [5.7754593, 45.1883973],
    [5.775606, 45.1882963],
    [5.7757616, 45.1881823],
    [5.775909, 45.1880432],
    [5.7770774, 45.1868377],
    [5.7778214, 45.186081],
    [5.7784643, 45.1854242],
    [5.778745, 45.18507],
    [5.7789378, 45.1848495],
    [5.7795935, 45.184174],
    [5.7797039, 45.1840567],
    [5.7797828, 45.1839849],
    [5.7798783, 45.183947],
    [5.780001, 45.1839326],
    [5.7801083, 45.1839483],
    [5.7803521, 45.1839948],
    [5.7811001, 45.1841757],
    [5.7814778, 45.1842746],
    [5.7820758, 45.1844267],
    [5.7826434, 45.184594],
    [5.7835828, 45.1848822],
    [5.7838391, 45.1849613],
    [5.7844488, 45.1851444],
    [5.7847595, 45.1852353],
    [5.785118, 45.1853185],
    [5.785877, 45.1855005],
    [5.7862123, 45.1855835],
    [5.7864116, 45.1856611],
    [5.7864777, 45.185704],
    [5.7865351, 45.1857675],
    [5.7865814, 45.1858296],
    [5.7866047, 45.1859078],
    [5.7865945, 45.185982],
    [5.7865663, 45.1860675],
    [5.786496, 45.1861534],
    [5.7863606, 45.1862558],
    [5.7850776, 45.1872661],
    [5.7846012, 45.1876357],
  ],
};

const LINE_B_COORDINATES = lineB.features?.[0]?.geometry?.coordinates || [];

// Ligne NAVB : deux tracés distincts selon la direction (Verdun -> Plaine des
// Sports, et Plaine des Sports -> Verdun). On garde les deux et on laisse
// extractBestCustomShapeForLeg choisir automatiquement celui qui colle le
// mieux aux arrêts du leg, sans dépendre du headsign OTP.
const LINE_NAVB_VERDUN_TO_PDS_COORDINATES =
  lineNAVBVerdunToPDS.features?.[0]?.geometry?.coordinates || [];
const LINE_NAVB_PDS_TO_VERDUN_COORDINATES =
  lineNAVBPdsToVerdun.features?.[0]?.geometry?.coordinates || [];
const NAVB_TRACES = [
  LINE_NAVB_VERDUN_TO_PDS_COORDINATES,
  LINE_NAVB_PDS_TO_VERDUN_COORDINATES,
];

function nearestIndex(coords, point) {
  let bestIndex = -1,
    bestDist = Infinity;
  coords.forEach(([lon, lat], i) => {
    const d = (lon - point.lon) ** 2 + (lat - point.lat) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  });
  return { index: bestIndex, dist: Math.sqrt(bestDist) };
}

// Recale (magnétise) un tracé sur une liste d'arrêts réels : chaque arrêt
// "attire" le point le plus proche du tracé vers sa position exacte, tant
// qu'il est à moins de STOP_SNAP_DISTANCE.
const STOP_SNAP_DISTANCE = 0.0007; // environ 75 m
function magnetizeCoordsToStops(coords, stops) {
  if (!coords.length) return coords;
  const snapped = [...coords];
  const snapStop = (stop) => {
    if (!Number.isFinite(stop?.lon) || !Number.isFinite(stop?.lat)) return;
    const { index, dist } = nearestIndex(snapped, stop);
    if (index >= 0 && dist <= STOP_SNAP_DISTANCE) {
      snapped[index] = [stop.lon, stop.lat];
    }
  };
  (stops || []).forEach(snapStop);
  return snapped;
}

// Découpe un tracé personnalisé (potentiellement toute la ligne) entre les 2
// arrêts du leg, en cherchant les points les plus proches, puis magnétise
// les arrêts intermédiaires du leg sur ce tracé découpé.
function extractCustomShapeForLeg(customCoords, leg) {
  const from = leg.from;
  const to = leg.to;
  if (!from || !to || !customCoords || customCoords.length < 2) return null;
  const nf = nearestIndex(customCoords, from);
  const nt = nearestIndex(customCoords, to);
  // Seuil ~300m cumulés : au-delà, le tracé perso ne semble pas couvrir ce leg
  if (nf.dist + nt.dist > 0.003) return null;
  const start = Math.min(nf.index, nt.index);
  const end = Math.max(nf.index, nt.index);
  let slice = customCoords.slice(start, end + 1);
  if (nf.index > nt.index) slice = slice.reverse();
  if (slice.length) {
    slice[0] = [from.lon, from.lat];
    slice[slice.length - 1] = [to.lon, to.lat];
  }
  return magnetizeCoordsToStops(slice, leg.intermediateStops);
}

// Choisit, parmi plusieurs tracés personnalisés candidats pour une même
// ligne (ex: NAVB a deux tracés, un par direction), celui qui colle le mieux
// au leg — c'est-à-dire celui dont les arrêts de départ/arrivée du leg sont
// les plus proches du tracé. Évite d'avoir à déterminer la direction via le
// headsign, qui n'est pas toujours fiable.
function extractBestCustomShapeForLeg(candidateCoordsList, leg) {
  const from = leg.from;
  const to = leg.to;
  if (!from || !to) return null;
  let best = null;
  let bestScore = Infinity;
  for (const coords of candidateCoordsList) {
    if (!coords || coords.length < 2) continue;
    const nf = nearestIndex(coords, from);
    const nt = nearestIndex(coords, to);
    const score = nf.dist + nt.dist;
    if (score < bestScore) {
      bestScore = score;
      best = coords;
    }
  }
  if (!best || bestScore > 0.003) return null;
  return extractCustomShapeForLeg(best, leg);
}
// ─────────────────────────────────────────────────────────────────────────

export default function StopPickerMap({
  stops,
  onSelect,
  onClose,
  target,
  openSearchOnMount = false,
  depCoords,
  arrCoords,
  journey,
  lineColors,
  embedded = false,
  allowAddressSelection = true,
  userPosition,
}) {
  const mapRef = useRef(null);
  const theme = useTheme();
  const mapStyle =
    theme !== "light" ? MAPTILER_STYLE_URL_DARK : MAPTILER_STYLE_URL_LIGHT;
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(13);
  const [locLoading, setLocLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [visible, setVisible] = useState(false);
  const [pendingStop, setPendingStop] = useState(null);
  const [pendingClosing, setPendingClosing] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [isCentered, setIsCentered] = useState(false);
  const [nearestOpen, setNearestOpen] = useState(false);
  const [walkStop, setWalkStop] = useState(null);
  const [walkRoute, setWalkRoute] = useState(null);
  const [walkLoading, setWalkLoading] = useState(false);
  const [showMoreNearest, setShowMoreNearest] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const searchDebounceRef = useRef(null);
  const hasCenteredOnUserRef = useRef(false);

  const showLabels = zoom >= 14;
  const stopMarkerSize = zoom <= 11.5 ? 5 : zoom < 14 ? 7 : zoom >= 16 ? 8 : 13;
  const userMarkerSize = zoom <= 11.5 ? 7 : zoom < 14 ? 10 : 14;
  const SNAP_THRESHOLD_DEG = 0.00018;

  const nearestList = userLocation
    ? [...stops]
        .map((s) => ({
          ...s,
          dist: Math.hypot(s.lat - userLocation.lat, s.lon - userLocation.lon),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, showMoreNearest ? 10 : 5)
    : [];

  const formatNearestDist = (deg) => {
    const m = Math.round(deg * 111000);
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
  };

  async function fetchNearestStopLines(stopCode) {
    try {
      const res = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/index/clusters/${stopCode}/routes?allRoutes=true`,
      );
      const json = await res.json();
      return json.map((r) => r.shortName).filter(Boolean);
    } catch {
      return [];
    }
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (!embedded || !navigator.geolocation) return undefined;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setUserLocation({ lat: coords.latitude, lon: coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 6000 },
    );
    return undefined;
  }, [embedded]);

  useEffect(() => {
    if (userPosition) setUserLocation(userPosition);
  }, [userPosition]);

  useEffect(() => {
    if (openSearchOnMount) {
      const t = setTimeout(() => setSearchSheetOpen(true), 350);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = () => {
    if (embedded) return;
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const closePending = () => {
    setPendingClosing(true);
    setTimeout(() => {
      setPendingStop(null);
      setPendingClosing(false);
    }, 200);
  };

  const fetchWalkRoute = async (stop) => {
    setWalkLoading(true);
    setWalkRoute(null);
    try {
      const params = new URLSearchParams({
        fromPlace: `${userLocation.lat},${userLocation.lon}`,
        toPlace: `${stop.lat},${stop.lon}`,
        mode: "WALK",
        numItineraries: 1,
      });
      const res = await fetch(
        `https://data.mobilites-m.fr/api/routers/default/plan?${params}`,
      );
      const json = await res.json();
      const it = json.plan?.itineraries?.[0];
      if (!it) return;
      const durationMin = Math.round(it.duration / 60);
      const points = decodePolyline(it.legs[0].legGeometry.points);
      setWalkRoute({ durationMin, points });
    } catch {
    } finally {
      setWalkLoading(false);
    }
  };

  function decodePolyline(encoded) {
    let index = 0,
      lat = 0,
      lon = 0;
    const coords = [];
    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lon += result & 1 ? ~(result >> 1) : result >> 1;
      coords.push([lon / 1e5, lat / 1e5]);
    }
    return coords;
  }

  // Même recalage que la carte de détail : le tracé passe exactement par les
  // arrêts fournis par l'itinéraire, même si la géométrie OTP est légèrement décalée.
  const magnetizeLegGeometry = (leg) => {
    if (!leg.legGeometry?.points) return [];
    const coords = decodePolyline(leg.legGeometry.points);
    if (!coords.length) return coords;
    const snapStop = (stop) => {
      if (!Number.isFinite(stop?.lon) || !Number.isFinite(stop?.lat)) return;
      let closestIndex = 0;
      let closestDistance = Infinity;
      coords.forEach(([lon, lat], index) => {
        const distance = (lon - stop.lon) ** 2 + (lat - stop.lat) ** 2;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      if (closestDistance <= 0.0007 ** 2)
        coords[closestIndex] = [stop.lon, stop.lat];
    };
    (leg.intermediateStops || []).forEach(snapStop);
    if (Number.isFinite(leg.from?.lon) && Number.isFinite(leg.from?.lat))
      coords[0] = [leg.from.lon, leg.from.lat];
    if (Number.isFinite(leg.to?.lon) && Number.isFinite(leg.to?.lat))
      coords[coords.length - 1] = [leg.to.lon, leg.to.lat];
    return coords;
  };

  // Choix de la géométrie à afficher pour un leg : si une ligne a un tracé
  // personnalisé défini dans CUSTOM_LINE_TRACES (ex: "B"), on l'utilise en
  // priorité ; sinon on garde le comportement OTP habituel.
  const getLegGeometry = (leg) => {
    const routeName = (leg.routeShortName || leg.route || leg.routeId || "")
      .replace("SEM:", "")
      .toUpperCase();

    let coordinates;

    if (routeName === "B") {
      const extracted = extractCustomShapeForLeg(LINE_B_COORDINATES, leg);
      if (extracted) coordinates = extracted;
    } else if (routeName === "NAVB") {
      const extracted = extractBestCustomShapeForLeg(NAVB_TRACES, leg);
      if (extracted) coordinates = extracted;
    } else {
      const custom = CUSTOM_LINE_TRACES[routeName];
      if (custom && custom.length >= 2) {
        const extracted = extractCustomShapeForLeg(custom, leg);
        if (extracted) coordinates = extracted;
      }
    }

    coordinates ||= magnetizeLegGeometry(leg);
    if (!coordinates.length) return coordinates;

    // Dernière garantie : le tracé se termine exactement sur les coordonnées
    // de l'arrêt OTP, sans déplacer le marqueur de destination.
    const snapped = coordinates.map(([lon, lat]) => [lon, lat]);
    const fromLon = Number(leg.from?.lon);
    const fromLat = Number(leg.from?.lat);
    const isFinalLeg = leg === journeyLegs[journeyLegs.length - 1];
    const targetArrival = isFinalLeg && arrivalStop ? arrivalStop : leg.to;
    const toLon = Number(targetArrival?.lon);
    const toLat = Number(targetArrival?.lat);
    if (Number.isFinite(fromLon) && Number.isFinite(fromLat)) {
      snapped[0] = [fromLon, fromLat];
    }
    if (Number.isFinite(toLon) && Number.isFinite(toLat)) {
      snapped[snapped.length - 1] = [toLon, toLat];
    }
    return snapped;
  };

  const journeyLegs = journey?.allLegs || [];
  const journeyStops = journeyLegs.flatMap((leg) => [
    leg.from,
    ...(leg.intermediateStops || []),
    leg.to,
  ]);
  const journeyIntermediateStops = journeyLegs.flatMap((leg, legIndex) =>
    (leg.intermediateStops || [])
      .filter(
        (stop) => Number.isFinite(stop?.lat) && Number.isFinite(stop?.lon),
      )
      .map((stop, stopIndex) => {
        const lineName = (leg.routeShortName || leg.route || leg.routeId || "")
          .replace("SEM:", "")
          .toUpperCase();
        return {
          ...stop,
          legIndex,
          stopIndex,
          color: LINE_COLORS[lineName] || lineColors?.[lineName] || "#94A3B8",
        };
      }),
  );
  const journeyDeparture = journeyLegs[0]?.from;
  const journeyArrival = journeyLegs[journeyLegs.length - 1]?.to;
  const arrivalStop = journeyArrival
    ? stops.reduce(
        (nearest, stop) => {
          const distance = Math.hypot(
            Number(stop.lat) - Number(journeyArrival.lat),
            Number(stop.lon) - Number(journeyArrival.lon),
          );
          return distance < nearest.distance ? { stop, distance } : nearest;
        },
        { stop: null, distance: Infinity },
      )
    : null;
  const snappedArrivalStop =
    arrivalStop?.distance <= 0.0002 ? arrivalStop.stop : null;
  const routeCoordinates = journeyLegs.flatMap(getLegGeometry);
  const vectorEndpoints = journeyLegs.flatMap((leg, legIndex) => {
    const coords = getLegGeometry(leg);
    if (coords.length < 2) return [];
    return [
      { coords: coords[0], type: "start", legIndex },
      { coords: coords[coords.length - 1], type: "end", legIndex },
    ];
  });
  // Les repères restent à la position réelle des arrêts ; la géométrie est,
  // elle, recalée sur les extrémités dans getLegGeometry.
  const departureCoords = depCoords || journeyDeparture;
  const arrivalCoords = arrCoords || snappedArrivalStop || journeyArrival;
  const isOriginDeparture = /^origin$/i.test(departureCoords?.name?.trim());

  useEffect(() => {
    if (!embedded || !userLocation || hasCenteredOnUserRef.current) return;
    mapRef.current?.flyTo({
      center: [userLocation.lon, userLocation.lat],
      zoom: 14,
      duration: 700,
    });
    hasCenteredOnUserRef.current = true;
  }, [embedded, userLocation]);

  useEffect(() => {
    if (!routeCoordinates.length) return;
    const lons = routeCoordinates.map(([lon]) => lon);
    const lats = routeCoordinates.map(([, lat]) => lat);
    const timer = setTimeout(() => {
      mapRef.current?.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        {
          padding: { top: 150, bottom: 130, left: 40, right: 40 },
          duration: 850,
        },
      );
    }, 100);
    return () => clearTimeout(timer);
  }, [journey]);

  const visibleStops = stops.filter((s) => {
    const isUsedByJourney = journeyStops.some(
      (journeyStop) =>
        Number.isFinite(journeyStop?.lat) &&
        Number.isFinite(journeyStop?.lon) &&
        Math.abs(journeyStop.lat - s.lat) < 0.0001 &&
        Math.abs(journeyStop.lon - s.lon) < 0.0001,
    );
    if (journeyLegs.length > 0 && zoom <= 16 && !isUsedByJourney) return false;
    if (!bounds) return true;
    const pad = zoom > 14 ? 0.005 : zoom > 12 ? 0.01 : 0.02;
    return (
      s.lat >= bounds.south - pad &&
      s.lat <= bounds.north + pad &&
      s.lon >= bounds.west - pad &&
      s.lon <= bounds.east + pad
    );
  });

  const stopPointsGeoJson = {
    type: "FeatureCollection",
    features: visibleStops.map((stop) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
      properties: { id: stop.id },
    })),
  };

  const userPointGeoJson = userLocation
    ? {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [userLocation.lon, userLocation.lat],
        },
      }
    : null;

  const updateBounds = useCallback(() => {
    if (!mapRef.current) return;
    const b = mapRef.current.getBounds();
    setBounds({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
    setZoom(mapRef.current.getZoom());
    if (userLocation) {
      const center = mapRef.current.getCenter();
      const dist = Math.hypot(
        center.lat - userLocation.lat,
        center.lng - userLocation.lon,
      );
      setIsCentered(dist < 0.002);
    }
  }, [stops, userLocation]);

  const handleMove = useCallback(throttle(updateBounds, 250), [updateBounds]);

  useEffect(() => {
    const t = setTimeout(updateBounds, 300);
    return () => clearTimeout(t);
  }, []);

  const handleMapClick = useCallback(
    async (e) => {
      const { lat, lng } = e.lngLat;
      let closest = null,
        minDist = Infinity;
      stops.forEach((s) => {
        const d = Math.hypot(s.lat - lat, s.lon - lng);
        if (d < minDist) {
          minDist = d;
          closest = s;
        }
      });
      if (closest && minDist < SNAP_THRESHOLD_DEG) {
        setPendingStop({
          name: closest.name,
          lat: closest.lat,
          lon: closest.lon,
          isAddress: false,
          isNearest: false,
        });
      } else if (allowAddressSelection) {
        const address = await reverseGeocode(lat, lng);
        if (address)
          setPendingStop({
            name: address,
            lat,
            lon: lng,
            isAddress: true,
            isNearest: false,
          });
      }
    },
    [stops, allowAddressSelection],
  );

  const handleLocate = () => {
    if (userLocation) {
      mapRef.current?.flyTo({
        center: [userLocation.lon, userLocation.lat],
        zoom: 16,
        duration: 800,
      });
      setIsCentered(true);
      setNearestOpen(true);
      setNearestSelectedStop(null);
      setNearestPage(0);
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setUserLocation({ lat, lon });
        setIsCentered(true);
        mapRef.current?.flyTo({ center: [lon, lat], zoom: 16, duration: 800 });
        setLocLoading(false);
        setNearestOpen(true);
        setNearestPage(0);
      },
      () => setLocLoading(false),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const confirmSelection = () => {
    if (!pendingStop) return;
    if (pendingStop.isAddress) {
      onSelect(`${pendingStop.name}::${pendingStop.lat},${pendingStop.lon}`);
    } else {
      onSelect(`${pendingStop.name}::${pendingStop.lat},${pendingStop.lon}`);
    }
    handleClose();
  };

  const label = target === "dep" ? "départ" : "arrivée";

  return (
    <>
      {createPortal(
        <>
          <div
            className={`fixed inset-0 ${embedded ? "z-0" : "z-[9999]"} flex items-center justify-center`}
            style={{
              backgroundColor: embedded
                ? "transparent"
                : visible
                  ? "rgba(0,0,0,0.55)"
                  : "rgba(0,0,0,0)",
              transition: "background-color 0.3s ease",
            }}
            onClick={handleClose}
          >
            <div
              className="relative bg-white shadow-2xl overflow-hidden flex flex-col"
              style={{
                width: "100vw",
                height: "100dvh",
                opacity: embedded || visible ? 1 : 0,
                transform:
                  embedded || visible
                    ? "translateY(0) scale(1)"
                    : "translateY(30px) scale(0.97)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {!embedded && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      Choisir sur la carte
                    </p>
                    <p className="font-semibold text-gray-800 text-sm">
                      Arrêt de {label}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClose}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Map */}
              <div className="flex-1 relative">
                {zoom < 14 && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm text-xs text-gray-600 px-3 py-1.5 rounded-full shadow pointer-events-none">
                    Zoomez pour voir les arrêts
                  </div>
                )}
                {!embedded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchSheetOpen(true);
                    }}
                    className="absolute top-3 left-3 z-10 flex items-center justify-center w-10 h-10 rounded-full"
                    style={{ background: "#A1A1A1" }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-white"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
                {!embedded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLocate();
                    }}
                    disabled={locLoading}
                    className="absolute top-16 left-3 z-10 flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50"
                    style={{ background: "#A1A1A1" }}
                  >
                    {locLoading ? (
                      <svg
                        className="w-4 h-4 animate-spin text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 256 256"
                      >
                        <g transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)">
                          <path
                            d="M 26.731 55.583 L 1.142 45.289 c -1.682 -0.677 -1.459 -3.168 0.362 -4.041 L 87.116 0.205 c 1.71 -0.82 3.499 0.969 2.679 2.679 L 48.752 88.496 c -0.873 1.821 -3.364 2.044 -4.041 0.362 L 34.417 63.269 C 33.009 59.767 30.233 56.991 26.731 55.583 z"
                            style={{
                              fill: isCentered ? "white" : "none",
                              stroke: "white",
                              strokeWidth: 4,
                            }}
                          />
                        </g>
                      </svg>
                    )}
                  </button>
                )}
                <MapLibreMap
                  ref={mapRef}
                  mapStyle={mapStyle}
                  initialViewState={{
                    ...GRENOBLE_CENTER,
                    zoom: embedded ? 14 : 13,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  onMove={handleMove}
                  onClick={handleMapClick}
                  cursor={allowAddressSelection ? "crosshair" : "grab"}
                >
                  <Source
                    id="stop-points"
                    type="geojson"
                    data={stopPointsGeoJson}
                  >
                    <Layer
                      id="stop-points-circles"
                      type="circle"
                      beforeId="Road labels"
                      paint={{
                        "circle-radius": stopMarkerSize / 2,
                        "circle-color": "#facc15",
                        "circle-stroke-width":
                          zoom >= 16 ? 1.5 : zoom <= 11.5 ? 0 : 2,
                        "circle-stroke-color": "#ffffff",
                      }}
                    />
                  </Source>
                  {zoom >= 14 && userPointGeoJson && (
                    <Source
                      id="user-point"
                      type="geojson"
                      data={userPointGeoJson}
                    >
                      <Layer
                        id="user-point-circle"
                        type="circle"
                        beforeId="Road labels"
                        paint={{
                          "circle-radius": userMarkerSize / 2,
                          "circle-color": "#3B82F6",
                          "circle-stroke-width": 2,
                          "circle-stroke-color": "#ffffff",
                        }}
                      />
                    </Source>
                  )}
                  {visibleStops.map((stop, i) => (
                    <Marker
                      key={`${stop.id}-${stop.lat}-${stop.lon}`}
                      longitude={stop.lon}
                      latitude={stop.lat}
                      anchor="bottom"
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          cursor: "pointer",
                          transform: `translateY(-${stopMarkerSize / 2 + 4}px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingStop({
                            name: stop.name,
                            lat: stop.lat,
                            lon: stop.lon,
                            isAddress: false,
                            isNearest: false,
                          });
                          mapRef.current?.flyTo({
                            center: [stop.lon, stop.lat],
                            zoom: Math.max(zoom, 15),
                            duration: 600,
                          });
                        }}
                      >
                        {showLabels && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              color: "#1e293b",
                              backgroundColor: "rgba(255,255,255,0.85)",
                              padding: "1px 4px",
                              borderRadius: "4px",
                              marginTop: "2px",
                              whiteSpace: "nowrap",
                              pointerEvents: "none",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                            }}
                          >
                            {stop.name}
                          </span>
                        )}
                      </div>
                    </Marker>
                  ))}
                  {journeyIntermediateStops.map((stop) => (
                    <Marker
                      key={`journey-intermediate-${stop.legIndex}-${stop.stopIndex}`}
                      longitude={stop.lon}
                      latitude={stop.lat}
                    >
                      <div
                        title={stop.name}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "white",
                          border: `2px solid ${stop.color}`,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                        }}
                      />
                    </Marker>
                  ))}
                  {zoom < 14 && userLocation && (
                    <Marker
                      longitude={userLocation.lon}
                      latitude={userLocation.lat}
                    >
                      <div
                        style={{
                          width: `${userMarkerSize}px`,
                          height: `${userMarkerSize}px`,
                          borderRadius: "50%",
                          backgroundColor: "#3B82F6",
                          border: "2px solid white",
                          boxShadow: "none",
                        }}
                      />
                    </Marker>
                  )}
                  {walkRoute && (
                    <Source
                      id="walk-route"
                      type="geojson"
                      data={{
                        type: "Feature",
                        geometry: {
                          type: "LineString",
                          coordinates: walkRoute.points,
                        },
                      }}
                    >
                      <Layer
                        id="walk-route-line"
                        type="line"
                        paint={{
                          "line-color": "#94a3b8",
                          "line-width": 3,
                          "line-dasharray": [2, 2],
                        }}
                      />
                    </Source>
                  )}
                  {journeyLegs.map((leg, index) => {
                    const coordinates = getLegGeometry(leg);
                    if (coordinates.length < 2) return null;
                    const routeName = (
                      leg.routeShortName ||
                      leg.route ||
                      leg.routeId ||
                      ""
                    )
                      .replace("SEM:", "")
                      .toUpperCase();
                    const isWalk = leg.mode === "WALK";
                    const color =
                      LINE_COLORS[routeName] ||
                      lineColors?.[routeName] ||
                      "#94A3B8";
                    return (
                      <Source
                        key={`journey-leg-${index}`}
                        id={`journey-leg-${index}`}
                        type="geojson"
                        data={{
                          type: "Feature",
                          geometry: {
                            type: "LineString",
                            coordinates,
                          },
                        }}
                      >
                        <Layer
                          id={`journey-leg-line-${index}`}
                          type="line"
                          beforeId="Road labels"
                          paint={{
                            "line-color": isWalk ? "#94A3B8" : color,
                            "line-width": isWalk ? 3 : 5,
                            "line-dasharray": isWalk ? [2, 2] : [1],
                          }}
                          layout={{ "line-cap": "round", "line-join": "round" }}
                        />
                      </Source>
                    );
                  })}
                  {vectorEndpoints.map((endpoint) => {
                    const isFinalEndpoint =
                      endpoint.legIndex === journeyLegs.length - 1 &&
                      endpoint.type === "end";
                    return (
                      <Marker
                        key={`vector-endpoint-${endpoint.legIndex}-${endpoint.type}`}
                        longitude={endpoint.coords[0]}
                        latitude={endpoint.coords[1]}
                        anchor="center"
                      >
                        <div
                          style={{
                            position: "relative",
                            width: 10,
                            height: 10,
                            pointerEvents: "none",
                          }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              backgroundColor: "white",
                              border: "2px solid #64748B",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            }}
                          />
                          {isFinalEndpoint && arrivalCoords?.name && (
                            <span
                              style={{
                                position: "absolute",
                                top: 14,
                                left: "50%",
                                transform: "translateX(-50%)",
                                borderRadius: 4,
                                padding: "1px 5px",
                                backgroundColor: "rgba(255,255,255,0.92)",
                                color: "#1e293b",
                                fontSize: 10,
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                              }}
                            >
                              Arrivée · {arrivalCoords.name}
                            </span>
                          )}
                        </div>
                      </Marker>
                    );
                  })}
                  {departureCoords && !isOriginDeparture && (
                    <Marker
                      longitude={departureCoords.lon}
                      latitude={departureCoords.lat}
                      style={{ zIndex: 20 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <div
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            backgroundColor: "#3B82F6",
                            border: "2px solid white",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                          }}
                        />
                        {departureCoords.name && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#1e293b",
                              backgroundColor: "rgba(255,255,255,0.92)",
                              padding: "1px 5px",
                              borderRadius: 4,
                              marginTop: 2,
                              whiteSpace: "nowrap",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                opacity: 0.6,
                                letterSpacing: "0.05em",
                              }}
                            >
                              Départ
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                letterSpacing: "0.03em",
                                marginTop: -4,
                              }}
                            >
                              {departureCoords.name}
                            </span>
                          </span>
                        )}
                      </div>
                    </Marker>
                  )}
                </MapLibreMap>
              </div>

              {/* Popup de confirmation */}
              {pendingStop && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center px-4"
                  style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                  onClick={closePending}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                    style={{
                      animation: pendingClosing
                        ? "popOut 0.2s ease forwards"
                        : "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <style>{`
                      @keyframes popIn  { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                      @keyframes popOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.85); opacity: 0; } }
                    `}</style>
                    <div className="px-5 pt-5 pb-2 text-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${pendingStop.isAddress ? "bg-indigo-100" : "bg-blue-100"}`}
                      >
                        {pendingStop.isAddress ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5 text-indigo-600"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5 text-blue-600"
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
                        )}
                      </div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                        {pendingStop.isAddress
                          ? "Adresse sélectionnée"
                          : "Arrêt sélectionné"}
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {pendingStop.name}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Utiliser comme{" "}
                        {pendingStop.isAddress ? "adresse" : "arrêt"} de {label}{" "}
                        ?
                      </p>
                    </div>
                    <div className="flex border-t border-gray-100 mt-3">
                      <button
                        className="flex-1 py-3.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                        onClick={closePending}
                      >
                        Annuler
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button
                        className="flex-1 py-3.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                        onClick={confirmSelection}
                      >
                        Confirmer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer hint */}
              {!embedded && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-400 text-center">
                    Appuyez sur un arrêt ou n'importe où sur la carte
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sheet walk */}
          {walkStop && (
            <div className="fixed inset-x-0 bottom-0 z-[10002] bg-white rounded-t-3xl shadow-2xl border border-slate-200 px-4 pt-5 pb-10">
              <div className="flex items-center justify-between mb-3"></div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">
                    Itinéraire à pied
                  </p>
                  <h2 className="text-base font-bold text-slate-900">
                    {walkStop.name}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setWalkStop(null);
                    setWalkRoute(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                >
                  ×
                </button>
              </div>
              {walkLoading ? (
                <p className="text-sm text-slate-500 mb-3">
                  Calcul de l'itinéraire...
                </p>
              ) : walkRoute ? (
                <p className="text-sm text-slate-600 mb-3 flex items-center gap-2">
                  <img
                    src="/walk.svg"
                    alt="marche"
                    className="w-4 h-4 opacity-60"
                  />
                  {walkRoute.durationMin} min à pied
                </p>
              ) : (
                <p className="text-sm text-red-500 mb-3">
                  Itinéraire introuvable.
                </p>
              )}
              <p className="text-sm text-slate-600 mb-4">
                Sélectionner{" "}
                <span className="font-semibold">{walkStop.name}</span> comme
                point de {label} ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setWalkStop(null);
                    setWalkRoute(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    onSelect(
                      `${walkStop.name}::${walkStop.lat},${walkStop.lon}`,
                    );
                    handleClose();
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm"
                >
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}

      {/* MapSheet */}
      <MapSheet
        isOpen={searchSheetOpen}
        onClose={() => {
          setSearchSheetOpen(false);
          setSearchSuggestions([]);
        }}
        title="Rechercher une adresse"
      >
        <div className="space-y-2 pt-1">
          <input
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value;
              setSearchQuery(q);
              clearTimeout(searchDebounceRef.current);
              if (q.length < 2) {
                setSearchSuggestions([]);
                return;
              }
              searchDebounceRef.current = setTimeout(async () => {
                const results = await autocompleteGeocode(q);
                setSearchSuggestions(results);
              }, 300);
            }}
            className="w-full border p-2 rounded-lg"
            placeholder="ex: 12 rue Félix Viallet, Grenoble"
            autoFocus
          />
          {searchSuggestions.length > 0 && (
            <ul className="border rounded-xl overflow-hidden divide-y divide-gray-100 bg-white shadow">
              {searchSuggestions.map((s, i) => (
                <li key={i}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setPendingStop({
                        name: s.name,
                        lat: s.lat,
                        lon: s.lon,
                        isAddress: true,
                        isNearest: false,
                      });
                      setSearchSheetOpen(false);
                      setSearchQuery("");
                      setSearchSuggestions([]);
                      mapRef.current?.flyTo({
                        center: [s.lon, s.lat],
                        zoom: 16,
                        duration: 800,
                      });
                    }}
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
          {searchQuery.length >= 2 && searchSuggestions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">
              Aucun résultat trouvé pour "{searchQuery}"
            </p>
          )}
        </div>
      </MapSheet>

      {/* Sheet nearest — portal séparé */}
      <NearestStopsSheet
        isOpen={nearestOpen}
        onClose={() => setNearestOpen(false)}
        stops={stops}
        userLocation={userLocation}
        onSelectStop={(stop) => {
          onSelect(`${stop.name}::${stop.lat},${stop.lon}`);
          handleClose();
        }}
        onWalkTo={(stop) => {
          setWalkStop(stop);
          fetchWalkRoute(stop);
          mapRef.current?.fitBounds(
            [
              [
                Math.min(userLocation.lon, stop.lon),
                Math.min(userLocation.lat, stop.lat),
              ],
              [
                Math.max(userLocation.lon, stop.lon),
                Math.max(userLocation.lat, stop.lat),
              ],
            ],
            { padding: 60, duration: 800 },
          );
        }}
      />
    </>
  );
}
