export const CURRENT_LOCATION_LABEL = "Votre position";
export const CURRENT_LOCATION_VALUE = "__CURRENT_LOCATION__";

export const isCurrentLocationValue = (value) =>
  value === CURRENT_LOCATION_VALUE;

export const getCurrentLocationCoords = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "L'accès à votre position est refusé. Autorisez la géolocalisation dans votre navigateur puis réessayez."
            : "Votre position n'a pas pu être déterminée. Vérifiez le signal GPS puis réessayez.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
