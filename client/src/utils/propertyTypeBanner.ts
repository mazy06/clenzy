/**
 * Utilitaire de mapping des types de propriété vers les images bannières.
 * Les images sont dans client/src/assets/images/.
 * Vite résout les imports statiques en URLs build-time.
 */

import appartementImg from '../assets/images/appartement.png';
import maisonImg from '../assets/images/maison.png';
import studioImg from '../assets/images/studio.png';
import villaImg from '../assets/images/villa.png';
import loftImg from '../assets/images/loft.png';
import chambrehoteImg from '../assets/images/chambrehote.png';
import giteruralImg from '../assets/images/giterural.png';
import chaletImg from '../assets/images/chalet.png';
import bateauImg from '../assets/images/bateau.png';
import autresImg from '../assets/images/autres.png';

/**
 * Mapping des types de propriété (backend enum lowercase + variantes françaises)
 * vers les URLs des images bannières.
 *
 * Backend PropertyType enum values (lowercase) :
 *   apartment, house, studio, villa, loft, guest_room, cottage, chalet, boat, other
 *
 * Frontend peut aussi utiliser les noms français :
 *   appartement, maison, chambrehote, giterural, bateau, etc.
 */
const bannerMap: Record<string, string> = {
  // Anglais (backend enum .name().toLowerCase())
  apartment: appartementImg,
  house: maisonImg,
  studio: studioImg,
  villa: villaImg,
  loft: loftImg,
  guest_room: chambrehoteImg,
  cottage: giteruralImg,
  chalet: chaletImg,
  boat: bateauImg,
  other: autresImg,

  // Français (variantes frontend)
  appartement: appartementImg,
  maison: maisonImg,
  chambrehote: chambrehoteImg,
  giterural: giteruralImg,
  bateau: bateauImg,
  autres: autresImg,
};

/**
 * Retourne l'URL de l'image bannière correspondant au type de propriété.
 * Fallback sur l'image "autres" si le type n'est pas reconnu.
 */
export function getPropertyTypeBannerUrl(propertyType: string): string {
  return bannerMap[propertyType.toLowerCase()] || autresImg;
}
