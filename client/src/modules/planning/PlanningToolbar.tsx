import React, { useState } from 'react';
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
  CalendarToday as CalendarTodayIcon,
  TuneOutlined,
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
}) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);

  const hasBadge = hasActiveFilters || filters.searchQuery.length > 0;

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

      <Box sx={{ flex: 1 }} />

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP: all filter elements inline
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
                borderRadius: '14px',
              },
              '& .MuiOutlinedInput-input': {
                py: 0.25,
              },
            }}
          />

          {/* Status filter chips */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <StatusChips filters={filters} onStatusFilter={onStatusFilter} />
          </Box>

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

          {/* Import iCal */}
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

          {/* Clear filters */}
          {hasActiveFilters && (
            <Tooltip title="Effacer les filtres">
              <IconButton size="small" onClick={onClearFilters} sx={{ width: 28, height: 28 }}>
                <FilterListOff sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Density toggle */}
          <Tooltip title={density === 'normal' ? 'Mode compact' : 'Mode normal'}>
            <IconButton
              size="small"
              onClick={() => onDensityChange(density === 'normal' ? 'compact' : 'normal')}
              sx={{ width: 28, height: 28 }}
            >
              {density === 'normal' ? <ViewCompact sx={{ fontSize: 16 }} /> : <ViewComfy sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
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
          sx={{ width: 28, height: 28 }}
        >
          {isFullscreen ? <FullscreenExit sx={{ fontSize: 18 }} /> : <Fullscreen sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
});

PlanningToolbar.displayName = 'PlanningToolbar';
export default PlanningToolbar;
