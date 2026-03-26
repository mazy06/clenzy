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
} from '@mui/icons-material';
import type { ZoomLevel, DensityMode, PlanningFilters } from './types';
import type { ReservationStatus } from '../../services/api';
import { ZOOM_LABELS } from './constants';
import { RESERVATION_STATUS_LABELS } from '../../services/api/reservationsApi';
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
}

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: RESERVATION_STATUS_LABELS.confirmed },
  { value: 'pending', label: RESERVATION_STATUS_LABELS.pending },
  { value: 'checked_in', label: RESERVATION_STATUS_LABELS.checked_in },
  { value: 'checked_out', label: RESERVATION_STATUS_LABELS.checked_out },
  { value: 'cancelled', label: RESERVATION_STATUS_LABELS.cancelled },
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
        <Chip
          key={opt.value}
          label={opt.label}
          size="small"
          variant={isActive ? 'filled' : 'outlined'}
          color={isActive ? 'primary' : 'default'}
          onClick={() => {
            if (isActive) {
              onStatusFilter(filters.statuses.filter((s) => s !== opt.value));
            } else {
              onStatusFilter([...filters.statuses, opt.value]);
            }
          }}
          sx={{
            fontSize: '0.5625rem',
            height: 24,
            cursor: 'pointer',
            ...(!isActive && { borderColor: 'divider', color: 'text.secondary' }),
          }}
        />
      );
    })}
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
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        py: 1,
        px: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        flexShrink: 0,
      }}
    >
      {/* Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <IconButton size="small" onClick={onGoPrev} sx={{ width: 28, height: 28 }}>
          <ChevronLeft sx={{ fontSize: 18 }} />
        </IconButton>

        <Chip
          icon={<TodayOutlined sx={{ fontSize: 14 }} />}
          label="Aujourd'hui"
          size="small"
          variant="outlined"
          onClick={onGoToday}
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            height: 28,
            cursor: 'pointer',
            borderColor: 'divider',
            '&:hover': { backgroundColor: 'action.hover', borderColor: 'text.secondary' },
            '& .MuiChip-icon': { fontSize: 14, color: 'primary.main' },
          }}
        />

        <IconButton size="small" onClick={onGoNext} sx={{ width: 28, height: 28 }}>
          <ChevronRight sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Month title */}
      <Typography
        variant="subtitle2"
        sx={{
          fontSize: '0.875rem',
          fontWeight: 700,
          textTransform: 'capitalize',
          color: 'text.primary',
          letterSpacing: '-0.02em',
          minWidth: 120,
        }}
      >
        {formatMonthYear(currentDate)}
      </Typography>

      {/* Zoom selector */}
      <ToggleButtonGroup
        value={zoom}
        exclusive
        onChange={(_, value) => value && onZoomChange(value)}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            fontSize: '0.625rem',
            fontWeight: 600,
            py: 0.25,
            px: 1,
            height: 28,
            textTransform: 'none',
            letterSpacing: '0.01em',
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

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP: search + filter popover + action chips
          ══════════════════════════════════════════════════════════════════════ */}
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
                  <Search sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 160,
              '& .MuiOutlinedInput-root': {
                height: 28,
                fontSize: '0.6875rem',
                borderRadius: 1,
              },
              '& .MuiOutlinedInput-input': {
                py: 0.25,
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
              p: 0.5,
              borderRadius: 1,
              color: filterOpen || activeFilterCount > 0 ? 'primary.main' : 'text.secondary',
              bgcolor: filterOpen || activeFilterCount > 0 ? 'rgba(107,138,154,0.08)' : 'transparent',
              border: '1px solid',
              borderColor: filterOpen || activeFilterCount > 0 ? 'primary.main' : 'divider',
            }}
          >
            <Badge
              badgeContent={activeFilterCount}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.5625rem',
                  height: 14,
                  minWidth: 14,
                },
              }}
            >
              <FilterListIcon sx={{ fontSize: 16 }} />
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
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                },
              },
            }}
          >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                Filtres
              </Typography>
              <IconButton size="small" onClick={() => setFilterAnchor(null)} sx={{ p: 0.25 }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            {/* Status filters */}
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="overline"
                sx={{
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  color: 'text.secondary',
                  letterSpacing: '0.08em',
                  mb: 0.75,
                  display: 'block',
                }}
              >
                Statuts
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <StatusChips filters={filters} onStatusFilter={onStatusFilter} />
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Display toggles */}
            <Box sx={{ mb: 1 }}>
              <Typography
                variant="overline"
                sx={{
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  color: 'text.secondary',
                  letterSpacing: '0.08em',
                  mb: 0.75,
                  display: 'block',
                }}
              >
                Affichage
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {/* Interventions toggle */}
                <Chip
                  icon={filters.showInterventions ? <Visibility sx={{ fontSize: 13 }} /> : <VisibilityOff sx={{ fontSize: 13 }} />}
                  label="Interventions"
                  size="small"
                  variant={filters.showInterventions ? 'filled' : 'outlined'}
                  color={filters.showInterventions ? 'primary' : 'default'}
                  onClick={() => onShowInterventionsChange(!filters.showInterventions)}
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    height: 28,
                    cursor: 'pointer',
                    '& .MuiChip-icon': { fontSize: 13 },
                    ...(!filters.showInterventions && { borderColor: 'divider', color: 'text.secondary' }),
                  }}
                />

                {/* Prices toggle */}
                <Chip
                  icon={<AttachMoney sx={{ fontSize: 13 }} />}
                  label="Tarifs"
                  size="small"
                  variant={filters.showPrices ? 'filled' : 'outlined'}
                  color={filters.showPrices ? 'primary' : 'default'}
                  onClick={() => onShowPricesChange(!filters.showPrices)}
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    height: 28,
                    cursor: 'pointer',
                    '& .MuiChip-icon': { fontSize: 13 },
                    ...(!filters.showPrices && { borderColor: 'divider', color: 'text.secondary' }),
                  }}
                />

                {/* Density toggle */}
                <Chip
                  icon={density === 'normal' ? <ViewCompact sx={{ fontSize: 13 }} /> : <ViewComfy sx={{ fontSize: 13 }} />}
                  label={density === 'normal' ? 'Compact' : 'Normal'}
                  size="small"
                  variant="outlined"
                  onClick={() => onDensityChange(density === 'normal' ? 'compact' : 'normal')}
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    height: 28,
                    cursor: 'pointer',
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '& .MuiChip-icon': { fontSize: 13 },
                  }}
                />
              </Box>
            </Box>

            {/* Clear all filters */}
            {(hasActiveFilters || activeFilterCount > 0) && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'error.main',
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
                icon={<CalendarTodayIcon sx={{ fontSize: 13 }} />}
                label="Import iCal"
                size="small"
                variant="outlined"
                onClick={onImportICal}
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  height: 28,
                  borderRadius: 1,
                  cursor: 'pointer',
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '& .MuiChip-icon': { fontSize: 13, color: 'primary.main' },
                  '&:hover': {
                    backgroundColor: 'rgba(107, 138, 154, 0.08)',
                    borderColor: 'primary.dark',
                  },
                }}
              />
            </Tooltip>
          )}

          {/* Block period — action, stays in toolbar */}
          {onBlockPeriod && (
            <Tooltip title="Bloquer une periode (indisponible)" arrow>
              <Chip
                icon={<Lock sx={{ fontSize: 13 }} />}
                label="Bloquer"
                size="small"
                variant="outlined"
                onClick={onBlockPeriod}
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  height: 28,
                  borderRadius: 1,
                  cursor: 'pointer',
                  borderColor: 'text.secondary',
                  color: 'text.secondary',
                  '& .MuiChip-icon': { fontSize: 13, color: 'text.secondary' },
                  '&:hover': {
                    backgroundColor: 'rgba(97, 97, 97, 0.08)',
                    borderColor: 'text.primary',
                  },
                }}
              />
            </Tooltip>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          COMPACT: burger menu button
          ══════════════════════════════════════════════════════════════════════ */}
      {isCompact && (
        <>
          <Tooltip title="Filtres et options">
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ width: 28, height: 28 }}
            >
              <Badge
                variant="dot"
                color="primary"
                invisible={!hasBadge}
                sx={{
                  '& .MuiBadge-dot': { width: 8, height: 8, borderRadius: '50%' },
                }}
              >
                <TuneOutlined sx={{ fontSize: 18 }} />
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
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
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
                      <Search sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 32,
                    fontSize: '0.75rem',
                    borderRadius: '10px',
                  },
                  '& .MuiOutlinedInput-input': {
                    py: 0.5,
                  },
                }}
              />

              <Divider />

              {/* Status filters */}
              <Box>
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                    letterSpacing: '0.08em',
                    mb: 0.75,
                    display: 'block',
                  }}
                >
                  Statuts
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <StatusChips filters={filters} onStatusFilter={onStatusFilter} />
                </Box>
              </Box>

              <Divider />

              {/* Display toggles */}
              <Box>
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                    letterSpacing: '0.08em',
                    mb: 0.75,
                    display: 'block',
                  }}
                >
                  Affichage
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {/* Interventions toggle */}
                  <Chip
                    icon={filters.showInterventions ? <Visibility sx={{ fontSize: 13 }} /> : <VisibilityOff sx={{ fontSize: 13 }} />}
                    label="Interventions"
                    size="small"
                    variant={filters.showInterventions ? 'filled' : 'outlined'}
                    color={filters.showInterventions ? 'primary' : 'default'}
                    onClick={() => onShowInterventionsChange(!filters.showInterventions)}
                    sx={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      height: 28,
                      cursor: 'pointer',
                      '& .MuiChip-icon': { fontSize: 13 },
                      ...(!filters.showInterventions && { borderColor: 'divider', color: 'text.secondary' }),
                    }}
                  />

                  {/* Prices toggle */}
                  <Chip
                    icon={<AttachMoney sx={{ fontSize: 13 }} />}
                    label="Tarifs"
                    size="small"
                    variant={filters.showPrices ? 'filled' : 'outlined'}
                    color={filters.showPrices ? 'primary' : 'default'}
                    onClick={() => onShowPricesChange(!filters.showPrices)}
                    sx={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      height: 28,
                      cursor: 'pointer',
                      '& .MuiChip-icon': { fontSize: 13 },
                      ...(!filters.showPrices && { borderColor: 'divider', color: 'text.secondary' }),
                    }}
                  />

                  {/* Density toggle */}
                  <Chip
                    icon={density === 'normal' ? <ViewCompact sx={{ fontSize: 13 }} /> : <ViewComfy sx={{ fontSize: 13 }} />}
                    label={density === 'normal' ? 'Compact' : 'Normal'}
                    size="small"
                    variant="outlined"
                    onClick={() => onDensityChange(density === 'normal' ? 'compact' : 'normal')}
                    sx={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      height: 28,
                      cursor: 'pointer',
                      borderColor: 'divider',
                      color: 'text.secondary',
                      '& .MuiChip-icon': { fontSize: 13 },
                    }}
                  />
                </Box>
              </Box>

              <Divider />

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {/* Import iCal */}
                {onImportICal && (
                  <Chip
                    icon={<CalendarTodayIcon sx={{ fontSize: 13 }} />}
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
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      '& .MuiChip-icon': { fontSize: 13, color: 'primary.main' },
                      '&:hover': {
                        backgroundColor: 'rgba(107, 138, 154, 0.08)',
                        borderColor: 'primary.dark',
                      },
                    }}
                  />
                )}

                {/* Block period */}
                {onBlockPeriod && (
                  <Chip
                    icon={<Lock sx={{ fontSize: 13 }} />}
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
                      borderColor: 'text.secondary',
                      color: 'text.secondary',
                      '& .MuiChip-icon': { fontSize: 13, color: 'text.secondary' },
                      '&:hover': {
                        backgroundColor: 'rgba(97, 97, 97, 0.08)',
                        borderColor: 'text.primary',
                      },
                    }}
                  />
                )}

                {/* Clear filters */}
                {hasActiveFilters && (
                  <Chip
                    icon={<FilterListOff sx={{ fontSize: 13 }} />}
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
                      borderColor: 'error.main',
                      color: 'error.main',
                      '& .MuiChip-icon': { fontSize: 13, color: 'error.main' },
                      '&:hover': {
                        backgroundColor: 'rgba(211, 47, 47, 0.06)',
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
          sx={{ width: 28, height: 28, flexShrink: 0 }}
        >
          {isFullscreen ? <FullscreenExit sx={{ fontSize: 18 }} /> : <Fullscreen sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
});

PlanningToolbar.displayName = 'PlanningToolbar';
export default PlanningToolbar;
