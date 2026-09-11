import React from 'react';
import { Star as StarIcon } from '../../icons';
import { cn } from '../../utils/cn';

const SLOTS = [0, 1, 2, 3, 4];

export interface RatingStarsProps {
  /** Note sur 5. Arrondie au demi-point. */
  value: number;
  /** Côté d'une étoile, en px. Défaut 14. */
  size?: number;
  className?: string;
}

/**
 * Note en lecture seule, 5 étoiles au pas de 0,5.
 *
 * <p>Deux calques superposés : le calque plein est rogné à la largeur
 * correspondant à la note — seule façon d'obtenir une demi-étoile sans glyphe
 * dédié.</p>
 *
 * <p>Surface UNIQUE : la liste des avis et la fiche d'une notification de
 * réputation montrent la même note. Deux implémentations auraient divergé au
 * premier ajustement — l'une pleine, l'autre en contour, pour la même donnée.</p>
 */
export default function RatingStars({ value, size = 14, className }: RatingStarsProps) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      role="img"
      aria-label={`${rounded} / 5`}
      className={cn('relative inline-flex shrink-0', className)}
    >
      <span className="inline-flex text-border">
        {SLOTS.map((slot) => (
          <StarIcon key={slot} size={size} strokeWidth={1.75} />
        ))}
      </span>
      {/* Le calque plein est APLAT, pas texte : une étoile remplie se lit d'un
          coup d'œil, là où un contour demandait de compter. */}
      <span
        className="absolute inset-0 inline-flex overflow-hidden text-warning"
        style={{ width: `${(rounded / 5) * 100}%` }}
        aria-hidden
      >
        {SLOTS.map((slot) => (
          <StarIcon key={slot} size={size} strokeWidth={1.75} fill="currentColor" />
        ))}
      </span>
    </span>
  );
}
