import React from 'react';
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { headerActionIcon, type HeaderActionKind } from './headerActionIcons';
import { cn } from '../utils/cn';

/**
 * Action d'en-tête Baitly — un bouton ICÔNE SEULE, expliqué par une infobulle.
 *
 * <p>C'est la seule forme admise dans le `PageHeader` : une barre de titre qui
 * aligne des boutons libellés se déforme d'un écran à l'autre (trois mots ici,
 * huit là) et pousse la recherche hors du pli. L'icône fixe la largeur, et
 * l'infobulle — qui porte AUSSI le nom accessible — dit ce que le bouton fait.</p>
 *
 * <p>L'icône n'est pas au choix de l'écran : elle vient du vocabulaire commun
 * (`headerActionIcons`) via `kind`. Passer `icon` explicitement reste possible
 * pour une action qui n'a pas d'équivalent dans ce vocabulaire.</p>
 *
 * @example
 * ```tsx
 * <HeaderAction kind="refresh" label={t('common.refresh')} onClick={reload} />
 * <HeaderAction kind="create" label={t('properties.add')} variant="default" onClick={open} />
 * ```
 */
export interface HeaderActionProps
  extends Omit<React.ComponentProps<typeof Button>, 'children' | 'size' | 'aria-label'> {
  /** Action du vocabulaire commun : décide de l'icône. */
  kind?: HeaderActionKind;
  /** Texte de l'infobulle ET nom accessible du bouton. Obligatoire. */
  label: string;
  /** Icône explicite, pour une action hors vocabulaire. */
  icon?: React.ReactNode;
  /** Remplace l'icône par un indicateur d'attente et désactive le bouton. */
  loading?: boolean;
  /** Densité du bouton. Défaut : `icon`, le gabarit de la barre de titre. */
  size?: 'icon-xs' | 'icon-sm' | 'icon' | 'icon-lg';
}

export default function HeaderAction({
  kind,
  label,
  icon,
  loading = false,
  variant = 'ghost',
  size = 'icon',
  disabled,
  className,
  ...props
}: HeaderActionProps) {
  const glyph = loading ? (
    <Spinner className="size-4" />
  ) : (
    icon ?? (kind ? headerActionIcon(kind) : null)
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Un bouton désactivé n'émet pas d'événement de survol : l'infobulle
            s'ancre donc sur l'enveloppe, sinon elle disparaîtrait au moment
            précis où l'utilisateur cherche à comprendre pourquoi c'est grisé. */}
        <span className="inline-flex">
          <Button
            {...props}
            variant={variant}
            size={size}
            disabled={disabled || loading}
            aria-label={label}
            className={cn(className)}
          >
            {glyph}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
