import airbnbLogo from '../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../assets/logo/booking-logo-small.svg';
import vrboLogo from '../assets/logo/vrbo-logo-small.svg';
import expediaLogo from '../assets/logo/expedia-logo.png';
import abritelLogo from '../assets/logo/abritel-logo-small.svg';
import agodaLogo from '../assets/logo/agoda-logo-small.svg';
import hometogoLogo from '../assets/logo/hometogo-logo-small.svg';
import hotelsComLogo from '../assets/logo/hotels-com-logo-small.svg';
import baitlyMark from '../assets/logo/baitly-mark.svg';

/**
 * Logos de canaux, indexes par canal NORMALISE (la sortie de
 * `ChannelCommissionResolver.normalize` cote serveur : `airbnb`, `booking`,
 * `vrbo`, `expedia`, `direct`…).
 *
 * <p>Registre partage plutot qu'une serie d'`import` par ecran : les memes
 * logos etaient deja reimportes dans sept fichiers, avec des cles differentes
 * a chaque fois. Un canal ajoute ici apparait partout.</p>
 */
export const CHANNEL_LOGOS: Record<string, string> = {
  airbnb: airbnbLogo,
  booking: bookingLogo,
  vrbo: vrboLogo,
  expedia: expediaLogo,
  abritel: abritelLogo,
  agoda: agodaLogo,
  hometogo: hometogoLogo,
  hotels_com: hotelsComLogo,
  // Reservations directes / booking engine : la marque Baitly fait office de
  // logo de canal, c'est nous qui portons la distribution.
  direct: baitlyMark,
};

/** Logo d'un canal normalise, ou `undefined` si aucun visuel n'est disponible. */
export function channelLogo(channel: string): string | undefined {
  return CHANNEL_LOGOS[channel];
}
