import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../hooks/use-media-query';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  buttonVariants,
} from './ui';
import NavCountBadge from './NavCountBadge';
import { sizedIcon } from '../config/navigationIcons';
import { cn } from '../utils/cn';
import type { PageTabItem } from './PageTabs';

interface PageTabsMenuProps<T extends string | number> {
  /** Onglets déjà filtrés (les `hidden` ont été retirés en amont). */
  options: PageTabItem<T>[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Sélecteur d'onglets pour les écrans sous 1024 px.
 *
 * La bande d'onglets qui défile horizontalement ne dit jamais combien d'onglets
 * existent ni où l'on se trouve : sur tablette, « Général » cachait cinq onglets
 * à droite du pli. On remplace donc le défilement par un menu qui affiche
 * l'onglet courant et déplie la liste entière — un seul geste au lieu d'un
 * balayage à l'aveugle.
 *
 * Deux surfaces selon la largeur, pas deux composants : `DropdownMenu` ancré au
 * déclencheur sur tablette (le pointeur est précis, la liste reste près de son
 * origine) et `Drawer` remontant du bas sur mobile (la liste arrive sous le
 * pouce plutôt qu'en haut de l'écran).
 */
export default function PageTabsMenu<T extends string | number>({
  options,
  activeIndex,
  onSelect,
}: PageTabsMenuProps<T>) {
  const { t } = useTranslation();
  // `sm` de Tailwind (640 px), le meme seuil que le `hidden sm:inline` qui
  // masque le libelle du declencheur.
  const isPhone = useMediaQuery('(max-width: 639.98px)');
  const [open, setOpen] = useState(false);

  const active = activeIndex >= 0 ? options[activeIndex] : undefined;
  const current = active ?? options[0];
  if (!current) return null;

  /**
   * Un onglet replié peut porter une notification : le déclencheur en montre un
   * point, sinon la pastille disparaîtrait avec la bande qu'elle habitait.
   */
  const hasHiddenBadge = options.some(
    (opt, index) => index !== activeIndex && typeof opt.badge === 'number' && opt.badge > 0,
  );

  const label = t('common.tabsMenu', 'Onglets');

  const trigger = (
    <button
      type="button"
      aria-label={`${label} — ${current.label}`}
      /* Le gabarit vient de `buttonVariants`, pas d'un style maison : hauteur,
         rayon, hairline et survol doivent etre EXACTEMENT ceux des boutons
         voisins de la barre. Une classe recopiee derive — le rayon avait fini a
         8 px la ou le kit en pose 10. */
      className={cn(buttonVariants({ variant: 'outline' }), 'min-w-0 cursor-pointer font-medium')}
    >
      {current.icon && sizedIcon(current.icon, 16, 1.75)}
      {/* Sous 640 px, le libelle cede la place : le titre de l'ecran occupe
          deja la barre et se tronquait a trois caracteres pour laisser passer
          un nom d'onglet souvent identique. L'icone et l'aria-label suffisent. */}
      <span className="hidden truncate sm:inline">{current.label}</span>
      <NavCountBadge count={current.badge} tone={current.badgeColor} />
      <span className="relative flex shrink-0 items-center">
        <ChevronDown className="size-4 text-muted-foreground" />
        {hasHiddenBadge && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary"
          />
        )}
      </span>
    </button>
  );

  const itemContent = (opt: PageTabItem<T>, index: number) => (
    <>
      {opt.icon ? (
        sizedIcon(opt.icon, 16, 1.75)
      ) : (
        <span aria-hidden className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
      <NavCountBadge count={opt.badge} tone={opt.badgeColor} />
      {index === activeIndex && <Check className="size-4 shrink-0 text-primary" />}
    </>
  );

  const select = (index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onSelect(index);
    setOpen(false);
  };

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="gap-0.5 pb-2 text-left">
            <DrawerTitle className="text-base">{label}</DrawerTitle>
            <DrawerDescription>
              {t('common.tabsMenuCount', '{{count}} onglets', { count: options.length })}
            </DrawerDescription>
          </DrawerHeader>
          <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {options.map((opt, index) => (
              <button
                key={opt.key ?? String(opt.value ?? index)}
                type="button"
                disabled={opt.disabled}
                aria-current={index === activeIndex ? 'page' : undefined}
                onClick={() => select(index)}
                className={cn(
                  'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-sm',
                  'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
                  index === activeIndex
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {itemContent(opt, index)}
              </button>
            ))}
          </nav>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      {/* Ancre a droite : le declencheur siege parmi les commandes de la barre,
          un menu aligne a gauche deborderait de l'ecran. */}
      <DropdownMenuContent align="end" className="min-w-56 max-w-[min(20rem,90vw)]">
        {options.map((opt, index) => (
          <DropdownMenuItem
            key={opt.key ?? String(opt.value ?? index)}
            disabled={opt.disabled}
            onSelect={() => select(index)}
            className={cn(
              'min-h-9 cursor-pointer gap-2.5',
              index === activeIndex && 'font-medium text-foreground',
            )}
          >
            {itemContent(opt, index)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
