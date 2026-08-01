import React from 'react';
import { X } from 'lucide-react';
import { Badge } from './ui';
import { cn } from '../utils/cn';
import { STATUS_TONES, softBackground, statusChipClasses, type StatusTone, type ToneTokens } from './StatusChip';

/**
 * Puce d'un champ a saisie multiple (`<Autocomplete multiple>`) : un element
 * qu'on ajoute, qu'on parcourt au clavier et qu'on retire.
 *
 * <h3>Pourquoi ce n'est pas un {@link StatusChip}</h3>
 * Un statut se lit ; un tag se manipule. La difference n'est pas visuelle — les
 * deux partagent la meme recette `-soft` via {@link statusChipClasses} — mais
 * comportementale : un tag porte un contrat clavier que MUI attend au mot pres.
 *
 * <h3>Le contrat, tel que MUI l'applique</h3>
 * <ul>
 *   <li>`getTagProps({index})` fournit `data-tag-index` et `tabIndex={-1}`. Les
 *       deux doivent atterrir sur le MEME element racine : `useAutocomplete`
 *       donne le focus par
 *       `anchorEl.querySelector('[data-tag-index="N"]').focus()`, ce qui exige
 *       un element programmatiquement focalisable. D'ou le spread des props
 *       residuelles sur la racine, plutot qu'une liste de props nommees.</li>
 *   <li>Retour arriere et Suppr retirent le tag focalise — mais ce n'est PAS a
 *       nous de le faire. `useAutocomplete` traite deja ces touches sur sa
 *       racine, ou l'evenement remonte, et retire l'entree `focusedTag`. Le
 *       `Chip` de MUI porte bien un second chemin de suppression, mais il sert
 *       aux puces AUTONOMES ; le reprendre ici supprimerait deux entrees d'un
 *       coup. Verifie par test.</li>
 *   <li>On garde le `preventDefault` a l'appui : c'est la seule part du role du
 *       Chip qui nous revient (empecher la navigation arriere du navigateur).</li>
 *   <li>Echap rend le focus au champ.</li>
 *   <li>Le garde `currentTarget === target` empeche une frappe faite dans un
 *       enfant d'agir sur le tag.</li>
 * </ul>
 */

const estToucheSuppression = (e: React.KeyboardEvent) => e.key === 'Backspace' || e.key === 'Delete';

type Props = Omit<React.ComponentProps<'span'>, 'color'> & {
  label: React.ReactNode;
  /** Ton semantique. Ignore si `tokens` ou `color` est fourni. */
  tone?: StatusTone;
  /** Tokens {color,bg} explicites. */
  tokens?: ToneTokens;
  /** Couleur arbitraire (hex/var) -> fond color-mix. */
  color?: string;
  size?: 'sm' | 'md';
  pill?: boolean;
  /** Fourni par `getTagProps`. Sans lui, la croix n'apparait pas. */
  onDelete?: (event: React.SyntheticEvent) => void;
  deleteLabel?: string;
};

export default function TagChip({
  label,
  tone = 'neutral',
  tokens,
  color,
  size = 'md',
  pill,
  onDelete,
  deleteLabel = 'Retirer',
  className,
  onKeyDown,
  onKeyUp,
  ...rest
}: Props) {
  const resolved: ToneTokens = color
    ? { color, bg: softBackground(color) }
    : tokens ?? STATUS_TONES[tone];
  const gabarit = statusChipClasses(resolved, size, pill);

  const auAppui = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    // Sur Retour arriere, le navigateur navigue en arriere : on l'en empeche
    // des l'appui, alors que la suppression, elle, se joue au relachement.
    if (e.currentTarget === e.target && estToucheSuppression(e)) e.preventDefault();
    onKeyDown?.(e);
  };

  const auRelachement = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    // Pas de suppression ici : la racine de l'Autocomplete l'a deja faite a
    // l'appui. Voir l'en-tete du fichier.
    if (e.currentTarget === e.target && e.key === 'Escape') e.currentTarget.blur();
    onKeyUp?.(e);
  };

  return (
    <Badge
      variant="secondary"
      className={cn(gabarit.className, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      style={gabarit.style}
      onKeyDown={auAppui}
      onKeyUp={auRelachement}
      {...rest}
    >
      {label}
      {onDelete && (
        <button
          type="button"
          // Hors de l'ordre de tabulation, comme la croix de MUI : sans cela on
          // traverserait une croix par tag avant d'atteindre le champ suivant.
          // Au clavier, la suppression passe par Retour arriere.
          tabIndex={-1}
          aria-label={deleteLabel}
          onClick={onDelete}
          className="-me-0.5 inline-flex cursor-pointer items-center rounded-full text-current opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </Badge>
  );
}
