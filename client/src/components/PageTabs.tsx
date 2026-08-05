import React from 'react';
import { Tabs, TabsList, TabsTrigger } from './ui';
import { useScreenTrailSegment } from './ScreenChrome';
import NavCountBadge from './NavCountBadge';
import { sizedIcon } from '../config/navigationIcons';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../hooks/use-media-query';
import { useScreenChrome } from './ScreenChrome';
import PageTabsMenu from './PageTabsMenu';
import { cn } from '../utils/cn';

/**
 * Description d'un onglet pour PageTabs.
 *
 * Si `value` est omis, l'index dans le tableau d'options est utilisé.
 * `hidden` permet de gérer le filtrage par permissions sans React.Fragment.
 */
export interface PageTabItem<T extends string | number = number> {
  value?: T;
  /**
   * Cle stable de l'onglet pour la navigation par URL (`?tab=<key>`), robuste aux onglets masques
   * par role : c'est l'index VISIBLE qui shifte selon le role, jamais la cle. Cf. `useTabKeyParam`
   * + `tabIndexFromKey` / `tabKeyFromIndex` (components/tabKeyParam.ts).
   */
  key?: string;
  label: string;
  icon?: React.ReactNode;
  /** Compteur affiché en badge à droite du label (notifications, demandes en attente, etc.). */
  badge?: number;
  badgeColor?: 'error' | 'warning' | 'primary' | 'info' | 'success';
  /** Hide la tab (permission gating). */
  hidden?: boolean;
  /** Désactiver la tab sans la masquer. */
  disabled?: boolean;
}

interface PageTabsProps<T extends string | number> {
  options: PageTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Slot rendu à droite des tabs (boutons d'action, filtres, etc.). */
  inlineActions?: React.ReactNode;
  /** Densité : 'comfortable' (défaut) ou 'compact' (sous-onglets de filtre). */
  size?: 'comfortable' | 'compact';
  /**
   * Conservé pour compatibilité d'API : les onglets Baitly sont toujours plats
   * (soulignement + hairline), il n'y a plus de carte englobante.
   */
  paper?: boolean;
  /** Marge basse, en unités de 8 px (défaut 1.5 = 12 px). */
  mb?: number;
  /** ARIA label pour Tabs. */
  ariaLabel?: string;
  /**
   * Publier l'onglet actif dans le fil d'Ariane du header. Défaut : true.
   * À passer à `false` pour une rangée d'onglets qui n'est PAS le niveau de
   * navigation de la page (onglets d'un panneau latéral, d'une fiche device…).
   */
  trail?: boolean;
  className?: string;
}

/**
 * Onglets standardisés du PMS Baitly (kit Baitly UI, variante `line`).
 *
 * Rendu : libellés discrets, onglet actif en encre pleine SOULIGNÉ, le tout posé
 * sur une hairline pleine largeur — la signature « Tabs / Line » de la galerie
 * (/admin/design-system). Un slot d'actions contextuelles reste disponible à
 * droite de la rangée.
 *
 * L'onglet actif est aussi publié dans le fil d'Ariane du header : le chemin
 * affiché devient « Hub › Écran › Onglet ».
 *
 * @example
 * ```tsx
 * <PageTabs
 *   options={[
 *     { value: 'properties', label: 'Propriétés', icon: <Home /> },
 *     { value: 'pricing',    label: 'Prix dynamique', icon: <TrendingUp /> },
 *   ]}
 *   value={activeTab}
 *   onChange={setActiveTab}
 *   inlineActions={<Button size="sm">Action</Button>}
 * />
 * ```
 */
export default function PageTabs<T extends string | number = number>({
  options,
  value,
  onChange,
  inlineActions,
  size = 'comfortable',
  paper: _paper,
  mb = 1.5,
  ariaLabel,
  trail = true,
  className,
}: PageTabsProps<T>) {
  const visibleOptions = options.filter((opt) => !opt.hidden);
  const valueOf = (opt: PageTabItem<T>, index: number) => (opt.value !== undefined ? opt.value : (index as T));
  const activeIndex = visibleOptions.findIndex((opt, index) => valueOf(opt, index) === value);
  const compact = size === 'compact';

  useScreenTrailSegment(
    trail && activeIndex >= 0 ? visibleOptions[activeIndex]?.label : undefined,
  );

  /**
   * Sous 1024 px, les onglets rejoignent la ligne du titre plutot que d'occuper
   * une bande a eux — deux fois, quand ils passent a la ligne. Un media query JS
   * et non une classe : ce n'est pas un masquage mais un changement de parent,
   * que le CSS seul ne sait pas faire sans dupliquer le tablist dans le DOM.
   */
  // Le seuil doit etre EXACTEMENT le `lg` de Tailwind (1024 px) : le slot
  // d'accueil est masque par `lg:hidden`. Les breakpoints MUI (lg = 1200)
  // ouvraient une zone morte 1024-1199 ou le JS portait les onglets dans un
  // slot que le CSS venait de cacher — la rangee disparaissait purement.
  const inHeader = useMediaQuery('(max-width: 1023.98px)');
  const { tabsSlot } = useScreenChrome();

  const tabsElement = (
      <Tabs
      className="min-w-0 flex-1"
      value={String(activeIndex >= 0 ? activeIndex : 0)}
      onValueChange={(next) => {
        const index = Number(next);
        const opt = visibleOptions[index];
        if (opt && !opt.disabled) onChange(valueOf(opt, index));
      }}
    >
      {/* `h-auto min-h-8` est INDISPENSABLE avec `flex-wrap` : la classe
          `cn-tabs-list` du kit fixe `h-8`, si bien qu'une rangee qui passe a
          deux lignes debordait de sa boite et se faisait recouvrir par le
          contenu suivant (constate sur Documents, 7 onglets : la ligne de
          filtres se dessinait par-dessus « Historique / Variables / Conformite »).
          `min-h-8` preserve la hauteur d'origine sur une seule ligne. */}
      <TabsList
        variant="line"
        aria-label={ariaLabel}
        className={cn('h-auto min-h-8 max-w-full flex-wrap', compact ? 'gap-0.5' : 'gap-1')}
      >
        {visibleOptions.map((opt, index) => (
          <TabsTrigger
            key={opt.key ?? String(valueOf(opt, index))}
            value={String(index)}
            disabled={opt.disabled}
            className={cn(
              'gap-1.5 font-medium [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-active:[&_svg]:text-foreground',
              compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
            )}
          >
            {opt.icon && sizedIcon(opt.icon, compact ? 14 : 16, 1.75)}
            {opt.label}
            {/* Même pastille que la sidebar (NavCountBadge) : une seule
                définition de la notification dans toute la navigation. */}
            <NavCountBadge count={opt.badge} tone={opt.badgeColor} />
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  // Porte dans le header : la ligne du titre porte deja bordure et marge. Et la
  // rangee devient un MENU — une bande qui defile ne dit ni combien d'onglets
  // existent, ni ou l'on se trouve dedans (cf. PageTabsMenu).
  // `trail` marque deja la rangee qui EST la navigation de la page — les autres
  // (sous-onglets, panneaux) passent trail={false}. Sans ce filtre, plusieurs
  // rangees se portaient dans le meme slot et s'y empilaient.
  if (inHeader && tabsSlot && trail) {
    return createPortal(
      <div className="flex min-w-0 items-center">
        <PageTabsMenu
          options={visibleOptions}
          activeIndex={activeIndex}
          onSelect={(index) => {
            const opt = visibleOptions[index];
            if (opt) onChange(valueOf(opt, index));
          }}
        />
      </div>,
      tabsSlot,
    );
  }

  return (
    <div
      className={cn('flex items-end justify-between gap-3 border-b border-border', className)}
      style={{ marginBottom: mb * 8 }}
    >
      {tabsElement}

      {inlineActions && <div className="mb-1 flex shrink-0 items-center gap-2">{inlineActions}</div>}
    </div>
  );
}
