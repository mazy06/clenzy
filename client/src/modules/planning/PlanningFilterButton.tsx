import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverTrigger,
  PopoverContent,
  Separator,
  Tooltip,
  TooltipTrigger,
} from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  AttachMoney,
  ViewCompact,
  FilterList as FilterListIcon,
  Close as CloseIcon,
} from '../../icons';
import type { DensityMode, PlanningFilters, UrgencyAnimationMode } from './types';
import type { ReservationStatus } from '../../services/api';
import type { PlanningChannelKey } from './constants';
import {
  ChannelLegendChips,
  StatusLegendChips,
  InterventionLegendChip,
  baitlyPlanningChipClass,
} from './LegendChips';
import { PlanningTooltipContent } from './PlanningTooltip';

interface PlanningFilterButtonProps {
  filters: PlanningFilters;
  density: DensityMode;
  hasActiveFilters: boolean;
  activeFilterCount?: number;
  onDensityChange: (density: DensityMode) => void;
  onShowInterventionsChange: (show: boolean) => void;
  onShowPricesChange: (show: boolean) => void;
  onClearFilters: () => void;
  urgencyAnimation: UrgencyAnimationMode;
  onUrgencyAnimationChange: (mode: UrgencyAnimationMode) => void;
  // ── Chips légende (canaux / statuts / interventions) ──────────────────────
  // Source unique avec la toolbar : la modale les héberge SEULEMENT quand la
  // rangée légende de la toolbar est masquée (`showLegendChips` = viewport
  // compact OU constellation d'agents déployée), pour ne jamais dupliquer.
  showLegendChips: boolean;
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
  /** Canaux presents dans les donnees — la legende ne montre que ceux-la. */
  presentChannels?: ReadonlySet<PlanningChannelKey>;
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
  // ── Contrôle externe (menu « ⋯ » regroupé du header) ──────────────────────
  // Quand `anchorEl` est fourni, le composant ne rend PAS son entonnoir : le
  // popover s'ancre sur cet élément (le bouton du menu) et l'ouverture est
  // pilotée par `open`/`onOpenChange`. Absents = trigger interne historique.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchorEl?: HTMLElement | null;
  /**
   * Rendu EN LIGNE, comme une section du menu ⋯ du PageHeader, au lieu d'un
   * popover. Sous `lg` les actions vivent deja dans ce menu : y ouvrir une
   * couche de plus pour regler un filtre en ferait deux pour une seule intention.
   */
  inline?: boolean;
}

// Variantes d'animation d'urgence des briques (galerie Signature 09b). Les
// libelles se lisent dans `planning.filters.urgency.<mode>` au rendu : figes a
// l'import, ils resteraient francais apres un changement de langue.
const URGENCY_ANIMATION_MODES: readonly UrgencyAnimationMode[] = [
  'shake', 'wobble', 'pop', 'tada', 'none',
];

const OVERLINE_CLASS = 'text-xs font-medium text-[var(--bui-muted-foreground)] tracking-[0.05em] mb-1 block';

/** Chip pilule togglable de la modale (langage Signature .pl-chip, même style
 *  que les chips Statuts) : icône optionnelle + libellé, actif = accent-soft. */
const ModalToggleChip: React.FC<{
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}> = ({ active, label, icon, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={baitlyPlanningChipClass('toggle', active)}
  >
    {icon && (
      <span className="inline-flex text-inherit">
        {icon}
      </span>
    )}
    {label}
  </button>
);

/**
 * Bouton filtre (entonnoir + badge) du planning, placé dans le slot `actions`
 * du PageHeader. Encapsule l'IconButton et son Popover. La modale est
 * adaptative : elle absorbe la rangée légende (canaux/statuts/interventions)
 * quand la toolbar ne peut pas l'afficher (compact / constellation).
 */
const PlanningFilterButton: React.FC<PlanningFilterButtonProps> = ({
  filters,
  density,
  hasActiveFilters,
  activeFilterCount = 0,
  onDensityChange,
  onShowInterventionsChange,
  onShowPricesChange,
  onClearFilters,
  urgencyAnimation,
  onUrgencyAnimationChange,
  showLegendChips,
  activeChannels,
  onToggleChannel,
  presentChannels,
  activeStatuses,
  onToggleStatus,
  open,
  onOpenChange,
  anchorEl,
  inline = false,
}) => {
  const { t } = useTranslation();
  // Le popover du kit s'ancre sur son trigger : un booleen suffit, l'element
  // anchor n'a plus a etre porte par l'etat. En mode contrôlé (menu regroupé),
  // l'état vit chez le parent.
  const [internalOpen, setInternalOpen] = useState(false);
  const filterOpen = open ?? internalOpen;
  const setFilterOpen = (next: boolean) =>
    onOpenChange ? onOpenChange(next) : setInternalOpen(next);

  const isCompactDensity = density === 'compact';

  // Corps du panneau — un seul balisage pour les DEUX rendus : dans un
  // popover quand la barre a la place de son propre bouton, en section du
  // menu ⋯ du header quand elle est repliee. Le dupliquer aurait garanti
  // que les deux versions divergent.
  const panelBody = (
        <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h6 className="cn-text-subtitle2 font-[family-name:var(--font-display)] font-semibold text-[0.8125rem] text-[var(--ink)]">
            {t('planning.filters.title', 'Filtres')}
          </h6>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('planning.filters.close', 'Fermer')}
            onClick={() => setFilterOpen(false)}
            className="text-[var(--faint)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
          >
            <CloseIcon size={16} strokeWidth={1.75} />
          </Button>
        </div>

        {/* Chips légende (canaux + statuts) — uniquement quand la toolbar ne les
            affiche pas (compact / constellation déployée), pour éviter le doublon. */}
        {showLegendChips && (
          <>
            <div className="mb-3">
              <span className={cn(OVERLINE_CLASS, 'cn-text-overline')}>
                {t('planning.filters.channels', 'Canaux')}
              </span>
              <div className="flex gap-0.5 flex-wrap">
                <ChannelLegendChips
                  activeChannels={activeChannels}
                  onToggleChannel={onToggleChannel}
                  presentChannels={presentChannels}
                  variant="toggle"
                />
              </div>
            </div>

            <Separator className="mb-3 bg-[var(--bui-border)]" />

            <div className="mb-3">
              <span className={cn(OVERLINE_CLASS, 'cn-text-overline')}>
                {t('planning.filters.statuses', 'Statuts')}
              </span>
              <div className="flex gap-0.5 flex-wrap">
                <StatusLegendChips
                  activeStatuses={activeStatuses}
                  onToggleStatus={onToggleStatus}
                  variant="toggle"
                />
              </div>
            </div>

            <Separator className="mb-3 bg-[var(--bui-border)]" />
          </>
        )}

        {/* Affichage */}
        <div className="mb-1.5">
          <span className={cn(OVERLINE_CLASS, 'cn-text-overline')}>
            {t('planning.filters.display', 'Affichage')}
          </span>
          <div className="flex gap-0.5 flex-wrap">
            {/* Interventions : chip légende (grille) — hébergée ici seulement
                quand la toolbar ne l'affiche pas. */}
            {showLegendChips && (
              <InterventionLegendChip
                active={filters.showInterventions}
                onToggle={() => onShowInterventionsChange(!filters.showInterventions)}
                variant="toggle"
              />
            )}

            {/* Tarifs (affiche les prix par nuit sur la grille) */}
            <ModalToggleChip
              active={filters.showPrices}
              label={t('planning.filters.prices', 'Tarifs')}
              icon={<AttachMoney size={13} strokeWidth={1.75} />}
              onClick={() => onShowPricesChange(!filters.showPrices)}
            />

            {/* Densité (compact / normal) */}
            <ModalToggleChip
              active={isCompactDensity}
              label={t('planning.filters.compact', 'Compact')}
              icon={<ViewCompact size={13} strokeWidth={1.75} />}
              onClick={() => onDensityChange(isCompactDensity ? 'normal' : 'compact')}
            />
          </div>

          {/* Animation d'urgence (briques paiement en attente / info manquante) */}
          <span className={cn(OVERLINE_CLASS, 'cn-text-overline mt-[9px]')}>
            {t('planning.filters.urgencyAnimation', "Animation d'urgence")}
          </span>
          <div className="flex gap-0.5 flex-wrap">
            {URGENCY_ANIMATION_MODES.map((mode) => (
              <ModalToggleChip
                key={mode}
                active={urgencyAnimation === mode}
                label={t(`planning.filters.urgency.${mode}`)}
                onClick={() => onUrgencyAnimationChange(mode)}
              />
            ))}
          </div>
        </div>

        {/* Clear all filters */}
        {(hasActiveFilters || activeFilterCount > 0) && (
          <div className="mt-2 pt-2 border-t border-[var(--bui-border)]">
            <button type="button" className="cn-text-caption text-[var(--bui-destructive)] cursor-pointer font-semibold text-[0.75rem] hover:decoration-[underline]" onClick={() => {
                onClearFilters();
                setFilterOpen(false);
              }}>
              {t('planning.filters.clearAll', 'Effacer tous les filtres')}
            </button>
          </div>
        )}
        </div>
  );

  // Rendu DANS le menu ⋯ : le panneau s'affiche en ligne. Il y ouvrait
  // auparavant un popover PAR-DESSUS le menu — deux couches empilees pour un
  // seul reglage. `data-inline-panel` dit au menu de ne pas se fermer quand
  // on manipule ces controles.
  if (inline) {
    return <div data-inline-panel className="w-full">{panelBody}</div>;
  }

  return (
    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
      {anchorEl ? (
        // Mode contrôlé : le popover s'ancre sur le bouton du menu regroupé,
        // aucun trigger propre.
        <PopoverAnchor virtualRef={{ current: anchorEl }} />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {/* Le kit ne transmet pas de ref (React 18) : le span porte celle
                  que Radix pose pour l'ancrage et le declencheur d'infobulle. */}
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('planning.filters.title', 'Filtres')}
                  className={cn(
                    'relative',
                    (filterOpen || activeFilterCount > 0) && 'text-[var(--accent)]',
                  )}
                >
                  <FilterListIcon size={18} strokeWidth={1.85} />
                  {activeFilterCount > 0 && (
                    <span className="absolute top-1 end-1 inline-flex items-center justify-center min-w-3 h-3 px-[3px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[0.5rem] font-semibold leading-none tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </span>
            </PopoverTrigger>
          </TooltipTrigger>
          <PlanningTooltipContent>{t('planning.filters.title', 'Filtres')}</PlanningTooltipContent>
        </Tooltip>
      )}

      {/* Filter popover */}
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-auto min-w-[300px] max-w-[360px] p-3 rounded-[var(--radius-lg)] border border-solid border-[var(--line-2)] bg-[var(--bui-card)] shadow-[var(--shadow-pop)]"
      >
        {/* Un seul enfant : le `gap` en colonne du primitif ne s'applique alors
            a rien, et les marges d'origine des sections restent la reference. */}
        {panelBody}
      </PopoverContent>
    </Popover>
  );
};

export default PlanningFilterButton;
