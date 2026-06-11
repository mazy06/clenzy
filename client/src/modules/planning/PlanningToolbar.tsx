import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
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
  Search,
  FilterListOff,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  CalendarToday as CalendarTodayIcon,
  TuneOutlined,
  Lock,
  Public as GlobeIcon,
  CleaningServices,
} from '../../icons';
import type { ZoomLevel, DensityMode, PlanningFilters, UrgencyAnimationMode } from './types';
import type { ReservationStatus } from '../../services/api';
import { ZOOM_LABELS, RESERVATION_STATUS_TOKEN_COLORS } from './constants';
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
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
  onImportICal?: () => void;
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

/** Chip pilule Signature : carte hairline, état actif accent-soft. */
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
  px: 1.25,
  py: 0.6875,
  cursor: 'pointer',
  userSelect: 'none' as const,
  whiteSpace: 'nowrap' as const,
  transition: 'border-color 160ms cubic-bezier(.16,1,.3,1), background-color 160ms cubic-bezier(.16,1,.3,1), color 160ms cubic-bezier(.16,1,.3,1)',
  '&:hover': { borderColor: active ? 'var(--accent)' : 'var(--faint)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

/** Label overline d'une rangée de filtres (CANAUX / STATUTS). */
const ROW_LABEL_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--faint)',
  width: 64,
  flexShrink: 0,
};

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

// ─── Légende des canaux (maquette : chips avec LOGO de canal) ───────────────
//
// Les briques encodent le canal via la pastille logo ; cette rangée sert de
// légende. « Direct » n'a pas de logo (vente en direct) → globe accent.
const CHANNEL_LEGEND: { key: string; label: string; logo: string | null }[] = [
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
  onSearchChange,
  onClearFilters,
  onImportICal,
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
              fontSize: '0.6875rem',
              fontWeight: 600,
              py: 0.25,
              px: 1.25,
              height: 22,
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
            DESKTOP: search + filter popover + action chips
            ════════════════════════════════════════════════════════════════ */}
        {!isCompact && (
          <>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Rechercher..."
              value={filters.searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}><Search size={14} strokeWidth={1.75} /></Box>
                  </InputAdornment>
                ),
              }}
              sx={{
                width: 180,
                '& .MuiOutlinedInput-root': {
                  height: 28,
                  fontSize: '0.6875rem',
                  borderRadius: '9px',
                  backgroundColor: 'var(--field)',
                  color: 'var(--body)',
                  '& fieldset': { borderColor: 'var(--field-line)' },
                  '&:hover fieldset': { borderColor: 'var(--faint)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: 1 },
                  '&.Mui-focused': { boxShadow: '0 0 0 3px var(--accent-soft)' },
                },
                '& .MuiOutlinedInput-input': {
                  py: 0.25,
                  '&::placeholder': { color: 'var(--faint)', opacity: 1 },
                },
              }}
            />

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

            {/* Import iCal — action, stays in toolbar */}
            {onImportICal && (
              <Tooltip title="Importer les réservations via un lien iCal (.ics)" arrow>
                <Chip
                  icon={<CalendarTodayIcon size={14} strokeWidth={1.75} />}
                  label="Import iCal"
                  size="small"
                  variant="outlined"
                  onClick={onImportICal}
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
                {/* Search */}
                <TextField
                  size="small"
                  placeholder="Rechercher..."
                  value={filters.searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}><Search size={16} strokeWidth={1.75} /></Box>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 32,
                      fontSize: '0.75rem',
                      borderRadius: '10px',
                      backgroundColor: 'var(--field)',
                      color: 'var(--body)',
                      '& fieldset': { borderColor: 'var(--field-line)' },
                      '&:hover fieldset': { borderColor: 'var(--faint)' },
                      '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: 1 },
                      '&.Mui-focused': { boxShadow: '0 0 0 3px var(--accent-soft)' },
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 0.5,
                      '&::placeholder': { color: 'var(--faint)', opacity: 1 },
                    },
                  }}
                />

                <Divider sx={{ borderColor: 'var(--line)' }} />

                {/* Canaux (légende) */}
                <Box>
                  <Typography variant="overline" sx={OVERLINE_SX}>
                    Canaux
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <ChannelLegendChips />
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
                  {/* Import iCal */}
                  {onImportICal && (
                    <Chip
                      icon={<CalendarTodayIcon size={13} strokeWidth={1.75} />}
                      label="Import iCal"
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setMenuAnchor(null);
                        onImportICal();
                      }}
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        height: 28,
                        cursor: 'pointer',
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                        '& .MuiChip-icon': { fontSize: 13, color: 'var(--accent)' },
                        '&:hover': {
                          backgroundColor: 'var(--accent-soft)',
                        },
                      }}
                    />
                  )}

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

      {/* ── Rangées 2-3 (desktop) : légende CANAUX + filtres STATUTS ──────── */}
      {!isCompact && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {/* Canaux : légende avec LOGO de canal (la pastille des briques) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box component="span" sx={ROW_LABEL_SX}>Canaux</Box>
            <ChannelLegendChips />
          </Box>

          {/* Statuts : puce colorée = couleur de brique + chip Interventions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box component="span" sx={ROW_LABEL_SX}>Statuts</Box>
            <StatusChips filters={filters} onStatusFilter={onStatusFilter} />
            {/* Ménage & maintenance sur la grille (maquette : chip Ménage) */}
            <Box
              component="span"
              onClick={() => onShowInterventionsChange(!filters.showInterventions)}
              sx={sigChipSx(filters.showInterventions)}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--info)' }}>
                <CleaningServices size={13} strokeWidth={1.75} />
              </Box>
              Interventions
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
});

/** Chips de légende des canaux : logo + nom (non filtrant — le canal est
 *  porté par la pastille logo de chaque brique). */
const ChannelLegendChips: React.FC = () => (
  <>
    {CHANNEL_LEGEND.map((ch) => (
      <Tooltip key={ch.key} title={`Canal ${ch.label}`} arrow>
        <Box component="span" sx={{ ...sigChipSx(false), cursor: 'default' }}>
          {ch.logo ? (
            <Box
              component="img"
              src={ch.logo}
              alt={ch.label}
              sx={{ width: 14, height: 14, objectFit: 'contain', display: 'block', flexShrink: 0 }}
            />
          ) : (
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
              <GlobeIcon size={14} strokeWidth={1.75} />
            </Box>
          )}
          {ch.label}
        </Box>
      </Tooltip>
    ))}
  </>
);

PlanningToolbar.displayName = 'PlanningToolbar';
export default PlanningToolbar;
