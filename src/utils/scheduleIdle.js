// Diffère un travail non urgent jusqu'à ce que le navigateur soit au repos.
//
// Utilisé pour tout ce qui prépare la suite sans être nécessaire au premier
// écran : préchargement du référentiel d'arrêts, du chunk cartographique, etc.
// L'enjeu est la connexion faible — lancées immédiatement, ces tâches se
// disputent la bande passante avec le code et le CSS dont dépend le premier
// rendu, et retardent celui-ci d'autant.
//
// `timeout` garantit l'exécution même si le navigateur ne devient jamais
// vraiment inactif ; le repli setTimeout couvre Safari, qui n'implémente pas
// requestIdleCallback.
export function scheduleIdle(task, { timeout = 4000 } = {}) {
  if (typeof window === "undefined") return;

  const run = () => {
    try {
      task();
    } catch {
      // Une préparation opportuniste ne doit jamais faire échouer l'appelant.
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout });
  } else {
    window.setTimeout(run, Math.min(timeout, 1500));
  }
}
