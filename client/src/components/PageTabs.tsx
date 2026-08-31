import React from 'react';
import { Tabs, TabsList, TabsTrigger } from './ui';
import { useScreenTrailSegment } from './ScreenChrome';
import NavCountBadge from './NavCountBadge';
import { sizedIcon } from '../config/navigationIcons';
import { createPortal } from 'react-dom';
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
   * Cette rangée EST la navigation de la page : elle se rend alors en SÉLECTEUR
   * dans la ligne du titre, et non en bande d'onglets. Défaut : true.
   * À passer à `false` pour une rangée qui n'est pas ce niveau-là (onglets d'un
   * panneau latéral, d'une fiche device…) : elle garde la bande soulignée.
   */
  trail?: boolean;
  className?: string;
}

/**
 * Onglets standardisés du PMS Baitly (kit Baitly UI).
 *
 * Deux rendus, selon ce que la rangée navigue (cf. `trail`) :
 *
 *  - **la navigation de l'écran** (défaut) : pas de bande. Le titre porte le
 *    sélecteur — « Paramètres │ Général ⌄ » —, qui déplie la liste entière des
 *    onglets. Une ligne de moins, et l'on voit enfin combien d'onglets existent
 *    et lequel est actif, ce qu'une bande qui défile ne disait jamais.
 *  - **une rangée interne** (`trail={false}` : sous-onglets d'un panneau, d'une
 *    fiche device) : la bande soulignée « Tabs / Line » de la galerie
 *    (/admin/design-system), avec son slot d'actions à droite.
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

  const { tabsSlot } = useScreenChrome();

  /**
   * La rangee d'onglets d'un ecran n'occupe plus une bande a elle : elle est
   * rendue DANS la ligne du titre, sous forme de selecteur (« Parametres │
   * General ⌄ »). Une bande de sept onglets coutait une ligne pleine pour dire
   * une seule chose — lequel est actif —, et se derobait des que la largeur
   * manquait.
   *
   * `trail` marque la rangee qui EST la navigation de la page ; les autres
   * (sous-onglets d'un panneau, d'une fiche device) n'ont pas de titre ou se
   * poser et gardent la bande soulignee.
   */
  const asSelect = trail && Boolean(tabsSlot);

  // Le libelle de l'onglet actif n'est publie au titre QUE si le selecteur ne
  // le porte pas deja : sinon il s'afficherait deux fois, en texte puis en menu.
  useScreenTrailSegment(
    trail && !asSelect && activeIndex >= 0 ? visibleOptions[activeIndex]?.label : undefined,
  );

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

  if (asSelect && tabsSlot) {
    return (
      <>
        {createPortal(
          <>
            {/* Meme filet que celui des segments du titre (cf. PageTitle) : le
                selecteur doit se lire comme la suite du titre, pas comme un
                controle pose a cote. */}
            <span aria-hidden className="h-[1.1em] w-px shrink-0 bg-border" />
            <PageTabsMenu
              options={visibleOptions}
              activeIndex={activeIndex}
              onSelect={(index) => {
                const opt = visibleOptions[index];
                if (opt) onChange(valueOf(opt, index));
              }}
            />
          </>,
          tabsSlot,
        )}
        {/* Les actions contextuelles de la rangee survivent a sa disparition :
            certains ecrans y portent leur barre d'outils (cf. DynamicPricing). */}
        {inlineActions && (
          <div
            className={cn('flex flex-wrap items-center justify-end gap-2', className)}
            style={{ marginBottom: mb * 8 }}
          >
            {inlineActions}
          </div>
        )}
      </>
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
