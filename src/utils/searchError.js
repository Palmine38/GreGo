export function getSearchErrorMessage(error) {
  const status = error?.status;

  if (status === 400) return "La recherche n'a pas pu être comprise par le service. Vérifiez les arrêts sélectionnés puis réessayez.";
  if (status === 404) return "Le service d'itinéraires est temporairement introuvable. Réessayez dans quelques instants.";
  if (status >= 500) return "Le service d'itinéraires rencontre un problème temporaire. Réessayez dans quelques instants.";
  if (error instanceof TypeError || /failed to fetch|network/i.test(error?.message || "")) return "Impossible de joindre le service d'itinéraires. Vérifiez votre connexion puis réessayez.";
  return "La recherche n'a pas pu aboutir. Réessayez dans quelques instants.";
}
