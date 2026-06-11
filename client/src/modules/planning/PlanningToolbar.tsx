import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Menu,
  Popover,
  Divider,
  Badge,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  TodayOutlined,
  Visibility,
  VisibilityOff,
  AttachMoney,
  Fullscreen,
  FullscreenExit,
  ViewCompact,
  ViewComfy,
  FilterListOff,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  TuneOutlined,
  Lock,
  Public as GlobeIcon,
  CleaningServices,
} from '../../icons';
import type { ZoomLevel, DensityMode, PlanningFilters, UrgencyAnimationMode } from './types';
import type { ReservationStatus } from '../../services/api';
import { ZOOM_LABELS, RESERVATION_STATUS_TOKEN_COLORS, INTERVENTION_TYPE_TOKEN_COLORS } from './constants';
import type { PlanningChannelKey } from './constants';
import { RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import { getSourceLogo } from './utils/sourceLogos';
import { formatMonthYear } from './utils/dateUtils';

interface PlanningToolbarProps {
  currentDate: Date;
  zoom: ZoomLevel;
  density: DensityMode;
  isFullscreen: boolean;
  filters: PlanningFilters;
  hasActiveFilters: boolean;
  onGoPrev: () => void;
  onGoToday: () => void;
  onGoNext: () => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onDensityChange: (density: DensityMode) => void;
  onToggleFullscreen: () => void;
  onShowInterventionsChange: (show: boolean) => void;
  onShowPricesChange: (show: boolean) => void;
  onStatusFilter: (statuses: ReservationStatus[]) => void;
  onClearFilters: () => void;
  /** Canaux visibles (rangée Canaux) — tout sélectionné par défaut. */
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
  /** Statuts visibles (rangée Statuts) — tout sélectionné par défaut. */
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
  onBlockPeriod?: () => void;
  /** Decalage gauche (px) pour aligner les controles avec la grille de dates. */
  leftOffset?: number;
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

// ─── Styles partagés (langage Signature) ────────────────────────────────────

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

/**
 * Chip-bouton togglable des rangées légende (Canaux / Statuts).
 * Spec .pl-chip / .pl-chip.off : sélectionné = look hairline normal ;
 * désélectionné = chip entière à opacity .4 (fond, bordure, puce inchangés).
 */
const legendToggleSx = (selected: boolean) => ({
  ...sigChipSx(false),
  appearance: 'none' as const,
  fontFamily: 'inherit',
  // Hauteur uniforme : les chips canaux (logo 15px) et statuts (puce 9px)
  // doivent etre identiques — on fixe la hauteur du contenu le plus haut.
  boxSizing: 'border-box' as const,
  minHeight: '27px',
  opacity: selected ? 1 : 0.4,
  transition: 'opacity .12s, border-color .12s',
  '&:hover': { borderColor: 'var(--faint)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
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

/** Chips MUI des toggles (popover / menu compact), tokenisés. */
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

// ─── Canaux (maquette : chips avec LOGO de canal, togglables) ────────────────
//
// Les briques encodent le canal via la pastille logo ; cette rangée sert de
// légende ET de filtre : un canal désélectionné masque ses briques.
// « Direct » n'a pas de logo (vente en direct) → globe accent.
const CHANNEL_LEGEND: { key: PlanningChannelKey; label: string; logo: string | null }[] = [
  { key: 'airbnb', label: RESERVATION_SOURCE_LABELS.airbnb, logo: getSourceLogo('airbnb') },
  { key: 'booking', label: RESERVATION_SOURCE_LABELS.booking, logo: getSourceLogo('booking') },
  { key: 'direct', label: RESERVATION_SOURCE_LABELS.direct, logo: null },
];

// ─── Shared sub-components for desktop & menu ────────────────────────────────

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

/** Chips togglables de la rangée Statuts : un statut désélectionné masque
 *  les briques de ce statut (état local page, non persisté). */
const StatusToggleChips: React.FC<{
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
}> = ({ activeStatuses, onToggleStatus }) => (
  <>
    {STATUS_OPTIONS.map((opt) => {
      const selected = activeStatuses.has(opt.value);
      return (
        <Box
          key={opt.value}
          component="button"
          type="button"
          aria-pressed={selected}
          onClick={() => onToggleStatus(opt.value)}
          sx={legendToggleSx(selected)}
        >
          {/* Puce 9px radius 3 (spec .s-dot) = couleur exacte du statut,
              mêmes constantes que les briques */}
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

// ─── Main component ──────────────────────────────────────────────────────────

const PlanningToolbar: React.FC<PlanningToolbarProps> = React.memo(({
  currentDate,
  zoom,
  density,
  isFullscreen,
  filters,
  hasActiveFilters,
  onGoPrev,
  onGoToday,
  onGoNext,
  onZoomChange,
  onDensityChange,
  onToggleFullscreen,
  onShowInterventionsChange,
  onShowPricesChange,
  onStatusFilter,
  onClearFilters,
  activeChannels,
  onToggleChannel,
  activeStatuses,
  onToggleStatus,
  onBlockPeriod,
  leftOffset = 0,
  urgencyAnimation,
  onUrgencyAnimationChange,
}) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const filterOpen = Boolean(filterAnchor);

  const hasBadge = hasActiveFilters || filters.searchQuery.length > 0;

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = filters.statuses.length;
    if (!filters.showInterventions) count++;  // hidden = active filter
    if (filters.showPrices) count++;           // shown = active filter (off by default)
    return count;
  }, [filters.statuses, filters.showInterventions, filters.showPrices]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 0.875,
        px: 1.25,
        backgroundColor: 'transparent',
        flexShrink: 0,
      }}
    >
      {/* ── Rangée 1 : navigation + mois + segmented + recherche + actions ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.875 }}>
        {/* Spacer : aligne nav + mois + zoom sur la grille de dates (apres
            la colonne logements). Compensation = padding left du toolbar (px:1.25 = 10px).
            Disparait si leftOffset = 0. */}
        {leftOffset > 0 && (
          <Box sx={{ width: leftOffset - 10, flexShrink: 0 }} aria-hidden />
        )}

        {/* Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={onGoPrev}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '9px',
              border: '1px solid var(--line-2)',
              backgroundColor: 'var(--card)',
              color: 'var(--muted)',
              transition: 'color 160ms cubic-bezier(.16,1,.3,1), border-color 160ms cubic-bezier(.16,1,.3,1)',
              '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--card)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </IconButton>

          {/* Month title : info principale (display, encre) */}
          <Typography
            variant="subtitle2"
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
              minWidth: 110,
              textAlign: 'center',
            }}
          >
            {formatMonthYear(currentDate)}
          </Typography>

          <IconButton
            size="small"
            onClick={onGoNext}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '9px',
              border: '1px solid var(--line-2)',
              backgroundColor: 'var(--card)',
              color: 'var(--muted)',
              transition: 'color 160ms cubic-bezier(.16,1,.3,1), border-color 160ms cubic-bezier(.16,1,.3,1)',
              '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--card)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </IconButton>
        </Box>

        <Chip
          icon={<TodayOutlined size={13} strokeWidth={1.75} />}
          label="Aujourd'hui"
          size="small"
          variant="outlined"
          onClick={onGoToday}
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            height: 28,
            borderRadius: '9px',
            cursor: 'pointer',
            backgroundColor: 'var(--card)',
            borderColor: 'var(--line-2)',
            color: 'var(--body)',
            '&:hover': { backgroundColor: 'var(--hover)', borderColor: 'var(--faint)' },
            '& .MuiChip-icon': { fontSize: 13, color: 'var(--accent)' },
          }}
        />

        {/* Zoom selector — segmented control Signature (.s-seg) */}
        <ToggleButtonGroup
          value={zoom}
          exclusive
          onChange={(_, value) => value && onZoomChange(value)}
          size="small"
          sx={{
            backgroundColor: 'var(--field)',
            border: '1px solid var(--field-line)',
            borderRadius: '10px',
            p: '3px',
            gap: '2px',
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              m: 0,
              borderRadius: '7px !important',
            },
            '& .MuiToggleButton-root': {
              fontSize: '0.75rem',
              fontWeight: 600,
              lineHeight: 1,
              padding: '6px 13px',
              textTransform: 'none',
              letterSpacing: '0.01em',
              color: 'var(--muted)',
              transition: 'background-color 140ms, color 140ms',
              '&:hover': { backgroundColor: 'transparent', color: 'var(--body)' },
              '&.Mui-selected': {
                backgroundColor: 'var(--card)',
                color: 'var(--ink)',
                boxShadow: '0 1px 3px color-mix(in srgb, var(--ink) 10%, transparent)',
                '&:hover': { backgroundColor: 'var(--card)' },
              },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            },
          }}
        >
          {(Object.keys(ZOOM_LABELS) as ZoomLevel[]).map((level) => (
            <ToggleButton key={level} value={level}>
              {ZOOM_LABELS[level]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1, minWidth: 8 }} />

        {/* ════════════════════════════════════════════════════════════════
            DESKTOP: filter popover + action chips
            (recherche + Import iCal montés dans le PageHeader)
            ════════════════════════════════════════════════════════════════ */}
        {!isCompact && (
          <>
            {/* Filter button with badge */}
            <IconButton
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

            {/* Block period — action, stays in toolbar */}
            {onBlockPeriod && (
              <Tooltip title="Bloquer une periode (indisponible)" arrow>
                <Chip
                  icon={<Lock size={14} strokeWidth={1.75} />}
                  label="Bloquer"
                  size="small"
                  variant="outlined"
                  onClick={onBlockPeriod}
                  sx={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    height: 28,
                    borderRadius: '9px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--line-2)',
                    color: 'var(--body)',
                    '& .MuiChip-icon': { fontSize: 14, color: 'var(--muted)' },
                    '&:hover': {
                      backgroundColor: 'var(--hover)',
                      borderColor: 'var(--faint)',
                    },
                  }}
                />
              </Tooltip>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            COMPACT: burger menu button
            ════════════════════════════════════════════════════════════════ */}
        {isCompact && (
          <>
            <Tooltip title="Filtres et options">
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ width: 22, height: 22, color: 'var(--muted)', '&:hover': { color: 'var(--accent)' } }}
              >
                <Badge
                  variant="dot"
                  invisible={!hasBadge}
                  sx={{
                    '& .MuiBadge-dot': { width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)' },
                  }}
                >
                  <TuneOutlined size={14} strokeWidth={1.75} />
                </Badge>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    width: 320,
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--line-2)',
                    backgroundColor: 'var(--card)',
                    boxShadow: 'var(--shadow-pop)',
                    mt: 0.5,
                  },
                },
              }}
            >
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Canaux (toggle masque/affiche) */}
                <Box>
                  <Typography variant="overline" sx={OVERLINE_SX}>
                    Canaux
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <ChannelToggleChips activeChannels={activeChannels} onToggleChannel={onToggleChannel} />
                  </Box>
                </Box>

                <Divider sx={{ borderColor: 'var(--line)' }} />

                {/* Status filters */}
                <Box>
                  <Typography variant="overline" sx={OVERLINE_SX}>
                    Statuts
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <StatusChips filters={filters} onStatusFilter={onStatusFilter} />
                  </Box>
                </Box>

                <Divider sx={{ borderColor: 'var(--line)' }} />

                {/* Display toggles */}
                <Box>
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
                      sx={toggleChipSx(filters.showInterventions, 28)}
                    />

                    {/* Prices toggle */}
                    <Chip
                      icon={<AttachMoney size={13} strokeWidth={1.75} />}
                      label="Tarifs"
                      size="small"
                      variant="outlined"
                      onClick={() => onShowPricesChange(!filters.showPrices)}
                      sx={toggleChipSx(filters.showPrices, 28)}
                    />

                    {/* Density toggle */}
                    <Chip
                      icon={density === 'normal' ? <ViewCompact size={13} strokeWidth={1.75} /> : <ViewComfy size={13} strokeWidth={1.75} />}
                      label={density === 'normal' ? 'Compact' : 'Normal'}
                      size="small"
                      variant="outlined"
                      onClick={() => onDensityChange(density === 'normal' ? 'compact' : 'normal')}
                      sx={toggleChipSx(false, 28)}
                    />
                  </Box>

                  {/* Animation d'urgence */}
                  <Typography variant="overline" sx={{ ...OVERLINE_SX, mt: 1.5 }}>
                    Animation d'urgence
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <UrgencyAnimationChips
                      urgencyAnimation={urgencyAnimation}
                      onUrgencyAnimationChange={onUrgencyAnimationChange}
                      chipHeight={28}
                    />
                  </Box>
                </Box>

                <Divider sx={{ borderColor: 'var(--line)' }} />

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {/* Block period */}
                  {onBlockPeriod && (
                    <Chip
                      icon={<Lock size={13} strokeWidth={1.75} />}
                      label="Bloquer"
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setMenuAnchor(null);
                        onBlockPeriod();
                      }}
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        height: 28,
                        cursor: 'pointer',
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--line-2)',
                        color: 'var(--muted)',
                        '& .MuiChip-icon': { fontSize: 13, color: 'var(--muted)' },
                        '&:hover': {
                          backgroundColor: 'var(--hover)',
                          borderColor: 'var(--faint)',
                        },
                      }}
                    />
                  )}

                  {/* Clear filters */}
                  {hasActiveFilters && (
                    <Chip
                      icon={<FilterListOff size={13} strokeWidth={1.75} />}
                      label="Effacer filtres"
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        onClearFilters();
                      }}
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        height: 28,
                        cursor: 'pointer',
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--err)',
                        color: 'var(--err)',
                        '& .MuiChip-icon': { fontSize: 13, color: 'var(--err)' },
                        '&:hover': {
                          backgroundColor: 'var(--err-soft)',
                        },
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Menu>
          </>
        )}

        {/* Fullscreen toggle — always visible */}
        <Tooltip title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
          <IconButton
            size="small"
            onClick={onToggleFullscreen}
            sx={{
              width: 28,
              height: 28,
              flexShrink: 0,
              color: 'var(--muted)',
              '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--hover)' },
            }}
          >
            {isFullscreen ? <FullscreenExit size={18} strokeWidth={1.75} /> : <Fullscreen size={18} strokeWidth={1.75} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Rangée 2 (desktop) : filtres togglables fusionnés — canaux,
          statuts puis Interventions, sans libellés de rangée ─────────────── */}
      {!isCompact && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Canaux : LOGO de canal (la pastille des briques), toggle masque/affiche */}
          <ChannelToggleChips activeChannels={activeChannels} onToggleChannel={onToggleChannel} />
          {/* Statuts : puce colorée = couleur de brique, toggle masque/affiche */}
          <StatusToggleChips activeStatuses={activeStatuses} onToggleStatus={onToggleStatus} />
          {/* Ménage & maintenance sur la grille : même chip .pl-chip que les
              autres (icône balai 15px à la place du logo/dot), off = opacity .4 */}
          <Box
            component="button"
            type="button"
            aria-pressed={filters.showInterventions}
            onClick={() => onShowInterventionsChange(!filters.showInterventions)}
            sx={legendToggleSx(filters.showInterventions)}
          >
            {/* Icône balai à la couleur ménage (spec --menage) */}
            <Box component="span" sx={{ display: 'inline-flex', color: INTERVENTION_TYPE_TOKEN_COLORS.cleaning }}>
              <CleaningServices size={15} strokeWidth={1.75} />
            </Box>
            Interventions
          </Box>
        </Box>
      )}
    </Box>
  );
});

/** Chips togglables des canaux : logo + nom. Un canal désélectionné masque
 *  les briques de ce canal (état local page, non persisté). */
const ChannelToggleChips: React.FC<{
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
}> = ({ activeChannels, onToggleChannel }) => (
  <>
    {CHANNEL_LEGEND.map((ch) => {
      const selected = activeChannels.has(ch.key);
      return (
        <Tooltip key={ch.key} title={selected ? `Masquer le canal ${ch.label}` : `Afficher le canal ${ch.label}`} arrow>
          <Box
            component="button"
            type="button"
            aria-pressed={selected}
            onClick={() => onToggleChannel(ch.key)}
            sx={legendToggleSx(selected)}
          >
            {ch.logo ? (
              <Box
                component="img"
                src={ch.logo}
                alt=""
                sx={{
                  width: 15,
                  height: 15,
                  objectFit: 'contain',
                  display: 'block',
                  flexShrink: 0,
                }}
              />
            ) : (
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
                <GlobeIcon size={15} strokeWidth={1.75} />
              </Box>
            )}
            {ch.label}
          </Box>
        </Tooltip>
      );
    })}
  </>
);

PlanningToolbar.displayName = 'PlanningToolbar';
export default PlanningToolbar;
