import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Popover,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AttachMoney,
  ViewCompact,
  ViewComfy,
  FilterList as FilterListIcon,
  Close as CloseIcon,
} from '../../icons';
import type { DensityMode, PlanningFilters, UrgencyAnimationMode } from './types';
import type { ReservationStatus } from '../../services/api';
import { RESERVATION_STATUS_TOKEN_COLORS } from './constants';
import { RESERVATION_STATUS_LABELS } from '../../services/api/reservationsApi';

interface PlanningFilterButtonProps {
  filters: PlanningFilters;
  density: DensityMode;
  hasActiveFilters: boolean;
  onDensityChange: (density: DensityMode) => void;
  onShowInterventionsChange: (show: boolean) => void;
  onShowPricesChange: (show: boolean) => void;
  onStatusFilter: (statuses: ReservationStatus[]) => void;
  onClearFilters: () => void;
  urgencyAnimation: UrgencyAnimationMode;
  onUrgencyAnimationChange: (mode: UrgencyAnimationMode) => void;
}

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: RESERVATION_STATUS_LABELS.confirmed },
  { value: 'pending', label: RESERVATION_STATUS_LABELS.pending },
  { value: 'checked_in', label: RESERVATION_STATUS_LABELS.checked_in },
  { value: 'checked_out', label: RESERVATION_STATUS_LABELS.checked_out },
  { value: 'cancelled', label: RESERVATION_STATUS_LABELS.cancelled },
];

// Variantes d'animation d'urgence des briques (galerie Signature 09b).
const URGENCY_ANIMATION_OPTIONS: { value: UrgencyAnimationMode; label: string }[] = [
  { value: 'shake', label: 'Shake' },
  { value: 'wobble', label: 'Wobble' },
  { value: 'pop', label: 'Pop' },
  { value: 'tada', label: 'Tada' },
  { value: 'none', label: 'Aucune' },
];

/** Chip pilule Signature (spec .pl-chip) : carte hairline, padding 5px 10px,
 *  11.5px fw600 var(--body) ; état actif accent-soft. */
const sigChipSx = (active: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  fontSize: '0.71875rem',
  fontWeight: 600,
  lineHeight: 1,
  color: active ? 'var(--accent)' : 'var(--body)',
  backgroundColor: active ? 'var(--accent-soft)' : 'var(--card)',
  border: '1px solid',
  borderColor: active ? 'var(--accent)' : 'var(--line-2)',
  borderRadius: '8px',
  padding: '5px 10px',
  cursor: 'pointer',
  userSelect: 'none' as const,
  whiteSpace: 'nowrap' as const,
  transition: 'border-color 160ms cubic-bezier(.16,1,.3,1), background-color 160ms cubic-bezier(.16,1,.3,1), color 160ms cubic-bezier(.16,1,.3,1)',
  '&:hover': { borderColor: active ? 'var(--accent)' : 'var(--faint)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

/** Overline des sections du popover de filtres. */
const OVERLINE_SX = {
  fontSize: '0.5625rem',
  fontWeight: 700,
  color: 'var(--faint)',
  letterSpacing: '0.08em',
  mb: 0.75,
  display: 'block',
};

/** Chips MUI des toggles (popover), tokenisés. */
const toggleChipSx = (active: boolean, height: number) => ({
  fontSize: height >= 28 ? '0.625rem' : '0.5625rem',
  fontWeight: 600,
  height,
  cursor: 'pointer',
  backgroundColor: active ? 'var(--accent-soft)' : 'var(--card)',
  color: active ? 'var(--accent)' : 'var(--muted)',
  borderColor: active ? 'var(--accent)' : 'var(--line-2)',
  '& .MuiChip-icon': { fontSize: 13, color: 'inherit' },
  '&:hover': { backgroundColor: active ? 'var(--accent-soft)' : 'var(--hover)' },
});

const StatusChips: React.FC<{
  filters: PlanningFilters;
  onStatusFilter: (statuses: ReservationStatus[]) => void;
}> = ({ filters, onStatusFilter }) => (
  <>
    {STATUS_OPTIONS.map((opt) => {
      const isActive = filters.statuses.includes(opt.value);
      return (
        <Box
          key={opt.value}
          component="span"
          onClick={() => {
            if (isActive) {
              onStatusFilter(filters.statuses.filter((s) => s !== opt.value));
            } else {
              onStatusFilter([...filters.statuses, opt.value]);
            }
          }}
          sx={sigChipSx(isActive)}
        >
          {/* Puce colorée = couleur du statut (mêmes tokens que les briques) */}
          <Box
            component="span"
            sx={{
              width: 9,
              height: 9,
              borderRadius: '3px',
              flexShrink: 0,
              backgroundColor: RESERVATION_STATUS_TOKEN_COLORS[opt.value] ?? 'var(--faint)',
            }}
          />
          {opt.label}
        </Box>
      );
    })}
  </>
);

const UrgencyAnimationChips: React.FC<{
  urgencyAnimation: UrgencyAnimationMode;
  onUrgencyAnimationChange: (mode: UrgencyAnimationMode) => void;
  chipHeight: number;
}> = ({ urgencyAnimation, onUrgencyAnimationChange, chipHeight }) => (
  <>
    {URGENCY_ANIMATION_OPTIONS.map((opt) => (
      <Chip
        key={opt.value}
        label={opt.label}
        size="small"
        variant="outlined"
        onClick={() => onUrgencyAnimationChange(opt.value)}
        sx={toggleChipSx(urgencyAnimation === opt.value, chipHeight)}
      />
    ))}
  </>
);

/**
 * Bouton filtre (entonnoir + badge) du planning, déplacé du PlanningToolbar
 * vers le slot `actions` du PageHeader. Encapsule l'IconButton et son Popover
 * (statuts, affichage interventions/tarifs/densité, animation d'urgence, clear).
 */
const PlanningFilterButton: React.FC<PlanningFilterButtonProps> = ({
  filters,
  density,
  hasActiveFilters,
  onDensityChange,
  onShowInterventionsChange,
  onShowPricesChange,
  onStatusFilter,
  onClearFilters,
  urgencyAnimation,
  onUrgencyAnimationChange,
}) => {
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const filterOpen = Boolean(filterAnchor);

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = filters.statuses.length;
    if (!filters.showInterventions) count++;  // hidden = active filter
    if (filters.showPrices) count++;           // shown = active filter (off by default)
    return count;
  }, [filters.statuses, filters.showInterventions, filters.showPrices]);

  return (
    <>
      <Tooltip title="Filtres" arrow>
        <IconButton
          aria-label="Filtres"
          size="small"
          onClick={(e) => setFilterAnchor(e.currentTarget)}
          sx={{
            width: 28,
            height: 28,
            p: 0.25,
            borderRadius: '9px',
            color: filterOpen || activeFilterCount > 0 ? 'var(--accent)' : 'var(--muted)',
            bgcolor: filterOpen || activeFilterCount > 0 ? 'var(--accent-soft)' : 'var(--card)',
            border: '1px solid',
            borderColor: filterOpen || activeFilterCount > 0 ? 'var(--accent)' : 'var(--line-2)',
            '&:hover': { borderColor: 'var(--accent)', bgcolor: 'var(--accent-soft)' },
          }}
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
            <FilterListIcon size={14} strokeWidth={1.75} />
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

        {/* Status filters */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" sx={OVERLINE_SX}>
            Statuts
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <StatusChips filters={filters} onStatusFilter={onStatusFilter} />
          </Box>
        </Box>

        <Divider sx={{ mb: 2, borderColor: 'var(--line)' }} />

        {/* Display toggles */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="overline" sx={OVERLINE_SX}>
            Affichage
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {/* Interventions toggle */}
            <Chip
              icon={filters.showInterventions ? <Visibility size={13} strokeWidth={1.75} /> : <VisibilityOff size={13} strokeWidth={1.75} />}
              label="Interventions"
              size="small"
              variant="outlined"
              onClick={() => onShowInterventionsChange(!filters.showInterventions)}
              sx={toggleChipSx(filters.showInterventions, 22)}
            />

            {/* Prices toggle */}
            <Chip
              icon={<AttachMoney size={13} strokeWidth={1.75} />}
              label="Tarifs"
              size="small"
              variant="outlined"
              onClick={() => onShowPricesChange(!filters.showPrices)}
              sx={toggleChipSx(filters.showPrices, 22)}
            />

            {/* Density toggle */}
            <Chip
              icon={density === 'normal' ? <ViewCompact size={13} strokeWidth={1.75} /> : <ViewComfy size={13} strokeWidth={1.75} />}
              label={density === 'normal' ? 'Compact' : 'Normal'}
              size="small"
              variant="outlined"
              onClick={() => onDensityChange(density === 'normal' ? 'compact' : 'normal')}
              sx={toggleChipSx(false, 22)}
            />
          </Box>

          {/* Animation d'urgence (briques paiement en attente / info manquante) */}
          <Typography variant="overline" sx={{ ...OVERLINE_SX, mt: 1.5 }}>
            Animation d'urgence
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <UrgencyAnimationChips
              urgencyAnimation={urgencyAnimation}
              onUrgencyAnimationChange={onUrgencyAnimationChange}
              chipHeight={22}
            />
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
