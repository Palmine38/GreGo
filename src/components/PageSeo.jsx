import { Helmet } from "react-helmet-async";

const SITE_URL = "https://gre-go.app";

export const PAGE_SEO = {
  home: {
    title: "GreGo | Horaires Tram & Bus à Grenoble en Temps Réel",
    description:
      "Suivez les horaires en temps réel des lignes de tram et de bus à Grenoble. Sauvegardez vos trajets favoris.",
    path: "/",
  },
  trips: {
    title: "Mes trajets à Grenoble | GreGo",
    description:
      "Suivez les horaires en temps réel des lignes de tram et de bus à Grenoble. Sauvegardez vos trajets favoris.",
    path: "/mes-trajets",
  },
  fastResearch: {
    title: "Recherche rapide d’itinéraires à Grenoble | GreGo",
    description:
      "Trouvez rapidement un arrêt, une ligne ou un itinéraire à Grenobleavec la carte interactive.",
    path: "/fastresearch",
  },
  settings: {
    title: "Paramètres de GreGo | Personnalisez votre application",
    description:
      "Personnalisez GreGo, vos favoris et vos préférences pour suivre les transports Grenoblois comme vous le souhaitez.",
    path: "/settings",
  },
  traffic: {
    title: "Info trafic Grenoble en temps réel | GreGo",
    description:
      "Consultez les perturbations et l’état du trafic des lignes de tram et bus à Grenoble en temps réel.",
    path: "/infotrafic",
  },
};

export function PageSeo({ page }) {
  const { title, description, path } = PAGE_SEO[page];
  const canonicalUrl = new URL(path, SITE_URL).href;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
    </Helmet>
  );
}
