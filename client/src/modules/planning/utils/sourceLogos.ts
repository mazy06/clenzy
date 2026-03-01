/**
 * Mapping source de reservation → logo small OTA.
 *
 * Retourne le chemin de l'asset logo pour une source donnee,
 * ou null si aucun logo n'est disponible (ex: "direct", "other").
 */

import airbnbLogoSmall from '../../../assets/logo/airbnb-logo-small.png';
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
};

/**
 * Retourne le logo small pour une source de reservation.
 * @param source - identifiant de la source (ex: "airbnb", "booking", "direct")
 * @returns chemin du logo ou null si aucun logo disponible
 */
export function getSourceLogo(source?: string): string | null {
  if (!source) return null;
  return SOURCE_LOGO_MAP[source.toLowerCase()] ?? null;
}
