import React, { useState, useMemo } from 'react';
import {
  Typography,
  IconButton,
  Popover,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
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
  STATUS_OPTIONS,
  CHANNEL_LEGEND,
} from './LegendChips';

interface PlanningFilterButtonProps {
  filters: PlanningFilters;
  density: DensityMode;
  hasActiveFilters: boolean;
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
}

// Variantes d'animation d'urgence des briques (galerie Signature 09b).
const URGENCY_ANIMATION_OPTIONS: { value: UrgencyAnimationMode; label: string }[] = [
  { value: 'shake', label: 'Shake' },
  { value: 'wobble', label: 'Wobble' },
  { value: 'pop', label: 'Pop' },
  { value: 'tada', label: 'Tada' },
  { value: 'none', label: 'Aucune' },
];

/** Overline des sections du popover de filtres. */
const OVERLINE_SX = {
  fontSize: '0.5625rem',
  fontWeight: 700,
  color: 'var(--faint)',
  letterSpacing: '0.08em',
  mb: 0.75,
  display: 'block',
};

/** Equivalent en classes de `sigButtonSx` (= sigChipSx + BUTTON_RESET de
 *  LegendChips), hors couleurs. `chipClsFor` n'est pas exporte la-bas, d'ou la
 *  transcription ici. gap: 0.75 = 4.5px (theme.spacing vaut 6, pas 8). */
const MODAL_CHIP_CLS =
  'inline-flex items-center gap-[4.5px] min-h-[27px] px-2.5 py-[5px] rounded-[8px] border border-solid text-[0.71875rem] font-semibold leading-none font-[inherit] appearance-none box-border cursor-pointer select-none whitespace-nowrap transition-[border-color,background-color,color] duration-[160ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';

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
    className={cn(
      MODAL_CHIP_CLS,
      active
        ? 'text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent)]'
        : 'text-[var(--body)] bg-[var(--card)] border-[var(--line-2)] hover:border-[var(--faint)]',
    )}
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
}) => {
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const filterOpen = Boolean(filterAnchor);

  // Badge de l'entonnoir : nombre de filtres actifs (toutes catégories).
  // Un canal/statut désélectionné = un filtre actif, où qu'il soit affiché.
  //
  // Les canaux sont comptés parmi ceux qui ont un chip VISIBLE : un canal
  // désélectionné puis disparu des données (changement de plage) laisserait
  // sinon le badge annoncer un filtre que l'utilisateur ne voit nulle part.
  const activeFilterCount = useMemo(() => {
    const shownChannels = CHANNEL_LEGEND.filter(
      (ch) => !presentChannels || presentChannels.has(ch.key),
    );
    let count =
      shownChannels.filter((ch) => !activeChannels.has(ch.key)).length
      + (STATUS_OPTIONS.length - activeStatuses.size);
    if (!filters.showInterventions) count++; // masqué = filtre actif
    if (filters.showPrices) count++;          // tarifs affichés = filtre actif
    return count;
  }, [activeChannels, presentChannels, activeStatuses.size, filters.showInterventions, filters.showPrices]);

  const isCompactDensity = density === 'compact';

  return (
    <>
      <Tooltip title="Filtres" arrow>
        <IconButton
          aria-label="Filtres"
          onClick={(e) => setFilterAnchor(e.currentTarget)}
          sx={{ color: filterOpen || activeFilterCount > 0 ? 'var(--accent)' : undefined }}
        >
          <Badge
            badgeContent={activeFilterCount}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.5rem',
                height: 12,
                minWidth: 12,
                backgroundColor: 'var(--accent)',
                color: 'var(--on-accent)',
              },
            }}
          >
            <FilterListIcon size={18} strokeWidth={1.85} />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Filter popover */}
      <Popover
        open={filterOpen}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 2,
              minWidth: 300,
              maxWidth: 360,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--line-2)',
              backgroundColor: 'var(--card)',
              boxShadow: 'var(--shadow-pop)',
            },
          },
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h6 className="cn-text-subtitle2 font-[var(--font-display)] font-semibold text-[0.8125rem] text-[var(--ink)]">
            Filtres
          </h6>
          <IconButton size="small" onClick={() => setFilterAnchor(null)} sx={{ p: 0.25, color: 'var(--faint)', '&:hover': { color: 'var(--ink)', backgroundColor: 'var(--hover)' } }}>
            <CloseIcon size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        {/* Chips légende (canaux + statuts) — uniquement quand la toolbar ne les
            affiche pas (compact / constellation déployée), pour éviter le doublon. */}
        {showLegendChips && (
          <>
            <div className="mb-3">
              <Typography variant="overline" sx={OVERLINE_SX}>
                Canaux
              </Typography>
              <div className="flex gap-0.5 flex-wrap">
                <ChannelLegendChips
                  activeChannels={activeChannels}
                  onToggleChannel={onToggleChannel}
                  presentChannels={presentChannels}
                  variant="toggle"
                />
              </div>
            </div>

            <Divider sx={{ mb: 2, borderColor: 'var(--line)' }} />

            <div className="mb-3">
              <Typography variant="overline" sx={OVERLINE_SX}>
                Statuts
              </Typography>
              <div className="flex gap-0.5 flex-wrap">
                <StatusLegendChips
                  activeStatuses={activeStatuses}
                  onToggleStatus={onToggleStatus}
                  variant="toggle"
                />
              </div>
            </div>

            <Divider sx={{ mb: 2, borderColor: 'var(--line)' }} />
          </>
        )}

        {/* Affichage */}
        <div className="mb-1.5">
          <Typography variant="overline" sx={OVERLINE_SX}>
            Affichage
          </Typography>
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
              label="Tarifs"
              icon={<AttachMoney size={13} strokeWidth={1.75} />}
              onClick={() => onShowPricesChange(!filters.showPrices)}
            />

            {/* Densité (compact / normal) */}
            <ModalToggleChip
              active={isCompactDensity}
              label="Compact"
              icon={<ViewCompact size={13} strokeWidth={1.75} />}
              onClick={() => onDensityChange(isCompactDensity ? 'normal' : 'compact')}
            />
          </div>

          {/* Animation d'urgence (briques paiement en attente / info manquante) */}
          <Typography variant="overline" sx={{ ...OVERLINE_SX, mt: 1.5 }}>
            Animation d'urgence
          </Typography>
          <div className="flex gap-0.5 flex-wrap">
            {URGENCY_ANIMATION_OPTIONS.map((opt) => (
              <ModalToggleChip
                key={opt.value}
                active={urgencyAnimation === opt.value}
                label={opt.label}
                onClick={() => onUrgencyAnimationChange(opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Clear all filters */}
        {(hasActiveFilters || activeFilterCount > 0) && (
          <div className="mt-2 pt-2 border-t border-[var(--line)]">
            <Typography
              variant="caption"
              sx={{
                color: 'var(--err)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem',
                '&:hover': { textDecoration: 'underline' },
              }}
              onClick={() => {
                onClearFilters();
                setFilterAnchor(null);
              }}
            >
              Effacer tous les filtres
            </Typography>
          </div>
        )}
      </Popover>
    </>
  );
};

export default PlanningFilterButton;
