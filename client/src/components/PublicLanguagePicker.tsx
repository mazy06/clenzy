import React from 'react';
import { cn } from '../utils/cn';
import type { AppLanguage } from '../utils/localeDate';

/**
 * Choix de langue des pages PUBLIQUES (connexion, inscription, CGU…).
 *
 * <p>Ces pages posent leur langue par geolocalisation IP : un arabophone qui se
 * connecte depuis la France recevait un ecran francais, sans aucun moyen d'en
 * sortir — la bascule de langue vit dans la barre laterale, donc derriere
 * l'authentification. Ce selecteur est la porte manquante.</p>
 *
 * <p><b>Les libelles ne se traduisent pas</b>, et c'est la regle et non un
 * oubli : chaque langue s'affiche dans sa propre graphie. Traduire « العربية »
 * en « Arabe » le rendrait illisible a la seule personne qui le cherche.</p>
 *
 * <p>Trois options tiennent en un segment : un menu deroulant cacherait le mot
 * qu'on vient chercher derriere un clic.</p>
 */
export const PUBLIC_LANGUAGES: ReadonlyArray<{ code: AppLanguage; endonym: string }> = [
  { code: 'fr', endonym: 'Français' },
  { code: 'en', endonym: 'English' },
  { code: 'ar', endonym: 'العربية' },
];

export interface PublicLanguagePickerProps {
  value: AppLanguage;
  onChange: (language: AppLanguage) => void;
  /** Libelle accessible du groupe — traduit, lui (`common.language`). */
  label: string;
  /** Pose sur un fond sombre : encre claire et filet translucide. */
  onDark?: boolean;
  className?: string;
}

export default function PublicLanguagePicker({
  value,
  onChange,
  label,
  onDark = false,
  className,
}: PublicLanguagePickerProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-px rounded-full border border-solid p-px',
        onDark ? 'border-white/25 bg-white/10' : 'border-border bg-muted/50',
        className,
      )}
    >
      {PUBLIC_LANGUAGES.map(({ code, endonym }) => {
        const selected = value === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            // `aria-pressed` et non `aria-current` : c'est un choix qu'on
            // bascule, pas une position dans une navigation.
            aria-pressed={selected}
            onClick={() => onChange(code)}
            className={cn(
              'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium',
              'transition-colors duration-200 ease-out-quart motion-reduce:transition-none',
              'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
              selected
                ? onDark
                  ? 'bg-white text-[#0F1E28]'
                  : 'bg-card text-foreground shadow-xs'
                : onDark
                  ? 'text-white/75 hover:text-white'
                  : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {endonym}
          </button>
        );
      })}
    </div>
  );
}
