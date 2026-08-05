import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  Switch,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';

interface SettingsToggleRowProps {
  icon?: LucideIcon;
  iconColor?: string;
  /** Libelle, ou noeud libre (label + pastilles de statut inline). */
  title: React.ReactNode;
  /** Texte d'aide, ou noeud libre. */
  description?: React.ReactNode;
  /** Controle a droite : Switch par defaut, ou tout autre noeud. */
  control?: React.ReactNode;
  /** Raccourci interrupteur : construit un Switch a partir de ces props. */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Filet de separation sous la ligne (false pour la derniere). */
  divider?: boolean;
  disabled?: boolean;
}

/**
 * Ligne de reglage des Parametres (kit Baitly UI, primitive `Item`).
 *
 * La ligne entiere porte le `<label>` quand le controle est un interrupteur :
 * le titre et la description deviennent alors des cibles de clic, ce qui fait
 * passer la zone active de 34 x 20 px (la pastille seule) a toute la largeur
 * de la carte. Quand le controle est libre (un champ, un bouton), la ligne
 * redevient une simple `div` — un label engloberait un champ de saisie et
 * chaque clic sur le titre volerait le focus.
 */
const SettingsToggleRow: React.FC<SettingsToggleRowProps> = ({
  icon: Icon,
  iconColor = 'var(--bui-muted-foreground)',
  title,
  description,
  control,
  checked,
  onChange,
  divider = true,
  disabled,
}) => {
  const isSwitch = control === undefined && typeof checked === 'boolean';
  const renderedControl =
    control ??
    (isSwitch ? (
      <Switch checked={checked} onCheckedChange={(value) => onChange?.(value)} disabled={disabled} />
    ) : null);

  const body = (
    <>
      {Icon && (
        <ItemMedia
          aria-hidden
          className="size-[30px] shrink-0 rounded-[7px] border"
          style={{
            color: iconColor,
            backgroundColor: `color-mix(in srgb, ${iconColor} 7%, transparent)`,
            borderColor: `color-mix(in srgb, ${iconColor} 15%, transparent)`,
          }}
        >
          <Icon size={14} strokeWidth={1.75} />
        </ItemMedia>
      )}

      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle
          className={cn(
            'text-[0.8125rem] font-semibold leading-[1.3]',
            disabled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {title}
        </ItemTitle>
        {description && (
          <ItemDescription className="text-[0.72rem] leading-[1.4] text-muted-foreground">
            {description}
          </ItemDescription>
        )}
      </ItemContent>

      {renderedControl && <ItemActions className="shrink-0">{renderedControl}</ItemActions>}
    </>
  );

  const className = cn(
    'items-center gap-3 rounded-none border-0 px-0 py-2.5',
    divider && 'border-b border-border last-of-type:border-b-0',
    isSwitch && !disabled && 'cursor-pointer hover:bg-muted/60',
    disabled && 'opacity-60',
  );

  // `asChild` demande un element hote : le <label> le fournit quand la ligne
  // pilote un interrupteur ; sinon `Item` rend sa propre div.
  return isSwitch ? (
    <Item asChild size="sm" className={className}>
      <label>{body}</label>
    </Item>
  ) : (
    <Item size="sm" className={className}>
      {body}
    </Item>
  );
};

export default SettingsToggleRow;
