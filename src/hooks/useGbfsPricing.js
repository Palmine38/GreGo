import { useEffect, useState } from "react";

const VOI_PRICING_URL =
  "https://data.mobilites-m.fr/api/gbfs/voi_grenoble/system_pricing_plans";
const CITIZ_PRICING_URL =
  "https://data.mobilites-m.fr/api/gbfs/citiz_grenoble/system_pricing_plans";

export function useGbfsPricing(kind, enabled) {
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !kind) return;
    let cancelled = false;
    const url = kind === "voi" ? VOI_PRICING_URL : CITIZ_PRICING_URL;

    setLoading(true);
    setError(false);

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setPlans(json.data?.plans || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, enabled]);

  return { plans, loading, error };
}
