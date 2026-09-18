import React, { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../config/api';
import { cn } from '../../utils/cn';

/**
 * Photo d'un professionnel, ou ses initiales.
 *
 * <h2>Pourquoi la boîte est toujours là</h2>
 * <p>La version précédente masquait l'image en erreur (`display: none`). La
 * boîte quittait alors la mise en page et tout le texte de la carte sautait de
 * quarante-quatre pixels vers la gauche, une fraction de seconde après le
 * chargement — l'impression qu'un élément avait existé devant puis disparu.</p>
 *
 * <p>Ici la boîte des initiales est TOUJOURS rendue et occupe sa place dès le
 * premier pixel. L'image se superpose en absolu : qu'elle arrive, tarde ou
 * échoue, elle ne déplace jamais rien. Une photo qui charge normalement recouvre
 * les initiales sans transition visible ; une photo qui échoue les laisse
 * simplement apparentes.</p>
 */
export interface ProviderAvatarProps {
  /** URL relative signée renvoyée par l'API, ou absolue pour une fiche sans compte. */
  url?: string | null;
  /** Nom affiché — sert à calculer les initiales. */
  name: string;
  /** Côté de la boîte, en classes Tailwind littérales (jamais calculées). */
  size?: 'sm' | 'lg';
  className?: string;
}

/** Deux initiales tirées du nom affiché, à défaut d'un logo déposé. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZE_CLASS = {
  sm: 'size-11 rounded-md text-sm',
  lg: 'size-16 rounded-lg text-lg',
} as const;

export default function ProviderAvatar({ url, name, size = 'sm', className }: ProviderAvatarProps) {
  const src = resolveMediaUrl(url);
  const [failed, setFailed] = useState(false);

  // Une carte réutilisée par la liste virtuelle peut changer de professionnel
  // sans être démontée : sans cette remise à zéro, l'échec du précédent
  // masquerait la photo du suivant.
  useEffect(() => { setFailed(false); }, [src]);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
        'bg-primary-soft font-semibold text-primary',
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
      {src && !failed && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
