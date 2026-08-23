// Mesure de diagnostic du premier chargement de l'écran « Mes trajets ».
// L'état vit hors de React pour que le DevOverlay ne rate pas un événement
// lorsque React StrictMode remonte les composants en développement.
let metric = { startedAt: null, completedAt: null };
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(metric));

export function startTripsLoadMetric() {
  metric = { startedAt: performance.now(), completedAt: null };
  notify();
}

export function completeTripsLoadMetric() {
  if (metric.startedAt === null || metric.completedAt !== null) return;
  metric = { ...metric, completedAt: performance.now() };
  notify();
}

export function getTripsLoadMetric() {
  return metric;
}

export function subscribeToTripsLoadMetric(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
