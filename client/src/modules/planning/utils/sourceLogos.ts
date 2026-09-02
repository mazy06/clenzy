/**
 * Mapping source de reservation → logo small OTA.
 *
 * Retourne le chemin de l'asset logo pour une source donnee,
 * ou null si aucun logo n'est disponible (ex: "direct", "other").
 */

import airbnbLogoSmall from '../../../assets/logo/airbnb-logo-small.svg';
import bookingLogoSmall from '../../../assets/logo/booking-logo-small.svg';
import vrboLogoSmall from '../../../assets/logo/vrbo-logo-small.svg';
import abritelLogoSmall from '../../../assets/logo/abritel-logo-small.svg';
import agodaLogoSmall from '../../../assets/logo/agoda-logo-small.svg';
import hotelsComLogoSmall from '../../../assets/logo/hotels-com-logo-small.svg';
import mabeetLogoSmall from '../../../assets/logo/mabeet-logo-small.png';
import rentellyLogoSmall from '../../../assets/logo/rentelly-logo-small.svg';
import gathernLogoSmall from '../../../assets/logo/gathern-logo-small.webp';
import keaseLogoSmall from '../../../assets/logo/kease-logo-small.svg';
import hometogoLogoSmall from '../../../assets/logo/hometogo-logo-small.svg';
// Expedia n'a pas de declinaison « small » : le logo pleine taille est
// contraint a 15 px par la chip, comme les autres.
import expediaLogo from '../../../assets/logo/expedia-logo.png';

const SOURCE_LOGO_MAP: Record<string, string> = {
  airbnb: airbnbLogoSmall,
  booking: bookingLogoSmall,
  vrbo: vrboLogoSmall,
  abritel: abritelLogoSmall,
  agoda: agodaLogoSmall,
  'hotels-com': hotelsComLogoSmall,
  'hotels.com': hotelsComLogoSmall,
  mabeet: mabeetLogoSmall,
  rentelly: rentellyLogoSmall,
  gathern: gathernLogoSmall,
  kease: keaseLogoSmall,
  hometogo: hometogoLogoSmall,
  expedia: expediaLogo,
};

/**
 * Retourne le logo small pour une source de reservation.
 * @param source - identifiant de la source (ex: "airbnb", "booking", "direct")
 * @returns chemin du logo ou null si aucun logo disponible
 */
export function getSourceLogo(source?: string): string | null {
  if (!source) return null;
  const key = source.toLowerCase();
  // Les cles de canal du planning s'ecrivent avec un underscore (`hotels_com`)
  // la ou les assets et les sources de reservation utilisent un tiret. Sans
  // cette normalisation, le canal retombait sur le globe alors que son logo
  // etait bien present dans les assets.
  return SOURCE_LOGO_MAP[key] ?? SOURCE_LOGO_MAP[key.replace(/_/g, '-')] ?? null;
}
