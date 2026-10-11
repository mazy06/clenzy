/**
 * Liens de guidage vers les applications GPS de l'utilisateur.
 *
 * <p>Baitly affiche la carte ; le guidage pas à pas, lui, reste le métier des
 * applications de navigation. Plutôt qu'imposer Google Maps, on propose les
 * trois usuelles et l'utilisateur choisit la sienne. Les coordonnées priment
 * sur l'adresse (une adresse mal géocodée envoie au mauvais endroit).</p>
 */
export interface DirectionsTarget {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

export interface DirectionsLinks {
  appleMaps: string;
  googleMaps: string;
  waze: string;
}

const hasCoords = (target: DirectionsTarget): target is DirectionsTarget & { lat: number; lng: number } =>
  typeof target.lat === 'number' && typeof target.lng === 'number' && Number.isFinite(target.lat) && Number.isFinite(target.lng);

/** `null` quand il n'y a ni coordonnées ni adresse : aucun lien utile à proposer. */
export function directionsLinks(target: DirectionsTarget): DirectionsLinks | null {
  if (hasCoords(target)) {
    const point = `${target.lat},${target.lng}`;
    return {
      appleMaps: `https://maps.apple.com/?daddr=${point}`,
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${point}`,
      waze: `https://waze.com/ul?ll=${point}&navigate=yes`,
    };
  }
  const address = target.address?.trim();
  if (!address) return null;
  const query = encodeURIComponent(address);
  return {
    appleMaps: `https://maps.apple.com/?daddr=${query}`,
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
  };
}
