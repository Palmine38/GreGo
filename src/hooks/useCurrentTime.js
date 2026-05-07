import { useEffect, useState } from "react";

/**
 * Retourne l'heure courante, mise à jour chaque seconde.
 */
export function useCurrentTime() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return currentTime;
}
