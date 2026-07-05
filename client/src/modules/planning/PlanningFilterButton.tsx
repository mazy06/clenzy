import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Popover,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
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
  sigButtonSx,
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

/** Chip pilule togglable de la modale (langage Signature .pl-chip, même style
 *  que les chips Statuts) : icône optionnelle + libellé, actif = accent-soft. */
const ModalToggleChip: React.FC<{
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}> = ({ active, label, icon, onClick }) => (
  <Box component="button" type="button" aria-pressed={active} onClick={onClick} sx={sigButtonSx(active)}>
    {icon && (
      <Box component="span" sx={{ display: 'inline-flex', color: 'inherit' }}>
        {icon}
      </Box>
    )}
    {label}
  </Box>
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
  activeStatuses,
  onToggleStatus,
}) => {
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const filterOpen = Boolean(filterAnchor);

  // Badge de l'entonnoir : nombre de filtres actifs (toutes catégories).
  // Un canal/statut désélectionné = un filtre actif, où qu'il soit affiché.
  const activeFilterCount = useMemo(() => {
    let count =
      (CHANNEL_LEGEND.length - activeChannels.size)
      + (STATUS_OPTIONS.length - activeStatuses.size);
    if (!filters.showInterventions) count++; // masqué = filtre actif
    if (filters.showPrices) count++;          // tarifs affichés = filtre actif
    return count;
  }, [activeChannels.size, activeStatuses.size, filters.showInterventions, filters.showPrices]);

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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--ink)' }}>
            Filtres
          </Typography>
          <IconButton size="small" onClick={() => setFilterAnchor(null)} sx={{ p: 0.25, color: 'var(--faint)', '&:hover': { color: 'var(--ink)', backgroundColor: 'var(--hover)' } }}>
            <CloseIcon size={16} strokeWidth={1.75} />
          </IconButton>
        </Box>

        {/* Chips légende (canaux + statuts) — uniquement quand la toolbar ne les
            affiche pas (compact / constellation déployée), pour éviter le doublon. */}
        {showLegendChips && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="overline" sx={OVERLINE_SX}>
                Canaux
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <ChannelLegendChips
                  activeChannels={activeChannels}
                  onToggleChannel={onToggleChannel}
                  variant="toggle"
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 2, borderColor: 'var(--line)' }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="overline" sx={OVERLINE_SX}>
                Statuts
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <StatusLegendChips
                  activeStatuses={activeStatuses}
                  onToggleStatus={onToggleStatus}
                  variant="toggle"
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 2, borderColor: 'var(--line)' }} />
          </>
        )}

        {/* Affichage */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="overline" sx={OVERLINE_SX}>
            Affichage
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
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
          </Box>

          {/* Animation d'urgence (briques paiement en attente / info manquante) */}
          <Typography variant="overline" sx={{ ...OVERLINE_SX, mt: 1.5 }}>
            Animation d'urgence
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {URGENCY_ANIMATION_OPTIONS.map((opt) => (
              <ModalToggleChip
                key={opt.value}
                active={urgencyAnimation === opt.value}
                label={opt.label}
                onClick={() => onUrgencyAnimationChange(opt.value)}
              />
            ))}
          </Box>
        </Box>

        {/* Clear all filters */}
        {(hasActiveFilters || activeFilterCount > 0) && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid var(--line)' }}>
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
          </Box>
        )}
      </Popover>
    </>
  );
};

export default PlanningFilterButton;
