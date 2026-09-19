import React from 'react';
import { Business } from '../icons';
import { toApiMediaUrl } from '../utils/mediaUrl';
import { propertyGradientCss } from '../modules/properties/propertiesListConstants';
import { cn } from '../utils/cn';

interface PropertyThumbProps {
  /** Graine du dégradé de repli — l'id du logement, à défaut son nom. */
  seed: string;
  /** Photo de couverture. Chemin d'API RELATIF accepté (cf. `toApiMediaUrl`). */
  photo?: string | null;
  /** `sm` 66x44, `md` 84x56 — paysage 3:2 dans les deux cas. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Vignette d'un logement : sa photo de couverture, ou un dégradé déterministe
 * surmonté d'une icône quand elle manque.
 *
 * <p>Le dégradé est tiré de la graine, donc STABLE pour un logement donné : deux
 * écrans qui listent le même bien montrent la même vignette, et un logement sans
 * photo reste reconnaissable d'une liste à l'autre.</p>
 *
 * <p>Le chemin de photo que rend l'API est RELATIF. Posé tel quel dans un
 * {@code url()} il viserait le serveur du front et la vignette resterait muette,
 * seul le dégradé s'affichant — d'où {@link toApiMediaUrl}.</p>
 */
export default function PropertyThumb({ seed, photo, size = 'md', className }: PropertyThumbProps) {
  const src = toApiMediaUrl(photo ?? undefined);
  const gradient = propertyGradientCss(seed);

  return (
    <div
      aria-hidden
      className={cn(
        // Paysage 3:2, le cadrage des photos de logement. Un carre rognait la
        // piece sur ses deux bords et ne montrait qu'un pan de mur ; la largeur
        // est ce qui rend une chambre ou un salon reconnaissable en vignette.
        'shrink-0 flex items-center justify-center overflow-hidden text-white/80',
        size === 'sm' ? 'h-11 w-[66px] rounded-lg' : 'h-14 w-[84px] rounded-lg',
        className,
      )}
      style={{
        background: gradient,
        ...(src
          ? {
              // L'assombrissement garde l'icône lisible sur une photo claire.
              backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.30)), url(${src}), ${gradient}`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {}),
      }}
    >
      {!src && <Business size={size === 'sm' ? 16 : 20} strokeWidth={1.75} />}
    </div>
  );
}
