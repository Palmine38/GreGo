// ─── Formatage durée ────────────────────────────────────────────────────────
export const formatDuration = (temps) => {
  if (temps > 59) {
    const hours = Math.floor(temps / 60);
    const minutes = temps % 60;
    return minutes === 0
      ? `${hours}h`
      : `${hours}h ${String(minutes).padStart(2, "0")}`;
  }
  return `${temps} min`;
};

// ─── Temps restant avant départ ─────────────────────────────────────────────
export const getMinutesUntil = (timeStr, now = new Date()) => {
  if (!timeStr) return -Infinity;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -Infinity;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return -Infinity;
  const target = new Date(now);
  target.setHours(hours, mins, 0, 0);
  return (target - now) / 60000;
};

export const formatTimeUntil = (timeStr, now = new Date()) => {
  const diffMinutes = getMinutesUntil(timeStr, now);
  if (diffMinutes < 1) return `À l'approche`;
  const diffHours = Math.floor(diffMinutes / 60);
  const diffMins = Math.floor(diffMinutes % 60);
  if (diffHours > 0 && diffMins > 0) return `dans ${diffHours}h${diffMins}`;
  if (diffHours > 0) return `dans ${diffHours} h`;
  return `dans ${Math.floor(diffMinutes)} min`;
};

// ─── Normalisation texte ─────────────────────────────────────────────────────
export const removeAccents = (str) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ─── Construction des params API OTP ────────────────────────────────────────
export const buildOtpParams = ({
  fromCoords,
  toCoords,
  queryTime,
  settings,
}) => {
  return new URLSearchParams({
    fromPlace: fromCoords,
    toPlace: toCoords,
    arriveBy: "false",
    time: queryTime.toTimeString().substr(0, 5),
    date: queryTime.toISOString().substr(0, 10),
    routerId: "default",
    optimize: "QUICK",
    walkReluctance: "5",
    locale: "fr",
    mode: "WALK,TRANSIT",
    showIntermediateStops: "true",
    minTransferTime: "20",
    transferPenalty: "60",
    walkBoardCost: "300",
    bannedAgencies: "MCO:MC",
    walkSpeed: String(settings?.walkSpeed ?? 1.4),
    numItineraries: String(settings?.numItineraries ?? 5),
    wheelchair: settings?.wheelchair ?? false,
  });
};

// ─── Transformation d'un itinéraire OTP en objet UI ─────────────────────────
export const parseItinerary = (it, { depName, arrName, lineFilter }) => {
  const depTime = new Date(it.startTime).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const arrTime = new Date(it.endTime).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const duration = Math.round(it.duration / 60);
  const allLegs = it.legs;
  const transitLegs = it.legs.filter((l) => l.mode !== "WALK");

  const lineKeys = transitLegs.map((leg) => {
    const routeShortName = (leg.routeShortName || "")
      .replace("SEM:", "")
      .toUpperCase();
    const route = (leg.route || "").replace("SEM:", "").toUpperCase();
    const routeId = (leg.routeId || "").replace("SEM:", "").toUpperCase();
    return routeShortName || route || routeId || "?";
  });

  return {
    dep: depTime,
    arr: arrTime,
    depName,
    arrName,
    dur: formatDuration(duration),
    direction:
      transitLegs.length > 0
        ? transitLegs[transitLegs.length - 1]?.to?.name || "?"
        : "?",
    line: lineFilter ? lineFilter.toUpperCase() : lineKeys[0] || "?",
    lineKeys,
    legs: transitLegs,
    allLegs,
  };
};

export const filterByLine = (items, lineFilter) => {
  if (!lineFilter?.trim()) return items;
  const target = lineFilter.toUpperCase();
  return items.filter((item) =>
    item.lineKeys.some((lk) => lk === target || lk.startsWith(target)),
  );
};

// journey.js
export const filterByTimeWindow = (items, queryTime, windowMinutes = 30) => {
  const limit = new Date(queryTime.getTime() + windowMinutes * 60 * 1000);
  const limitStr = limit.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return items.filter((item) => item.dep <= limitStr);
};
