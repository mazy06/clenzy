import React from 'react';
import { cn } from '../utils/cn';

interface IllustratedHeadingProps {
  /** Illustration générée de `public/images` (même série d'un écran à l'autre). */
  art: string;
  title: string;
  hint?: string;
  /** Action alignée à droite (bouton, lien). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * En-tête de section illustré : image générée, titre et aide d'une ligne.
 * Partagé par les Réservations (écran et modale) et les Logements (fiche et
 * édition), sur le modèle des en-têtes des espaces Finances et Documents.
 *
 * <p>Remplace les sur-titres en capitales `text-faint` (2,4:1 sur la carte,
 * sous le seuil de lecture) par un titre en `text-foreground` et une aide en
 * `text-muted-foreground`. Marges nulles explicites : l'application tourne sans le
 * preflight Tailwind, un `h3` garderait la marge du navigateur.</p>
 */
export default function IllustratedHeading({ art, title, hint, action, className }: IllustratedHeadingProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <img
        src={art}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        className="size-9 shrink-0 rounded-[10px] object-cover"
      />
      <div className="min-w-0 flex-1">
        <h3 className="m-0 text-sm font-semibold leading-5 text-foreground text-balance">{title}</h3>
        {hint && <p className="m-0 text-xs leading-4 text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
