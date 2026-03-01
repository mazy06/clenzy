import React from 'react';
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
}

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: RESERVATION_STATUS_LABELS.confirmed },
  { value: 'pending', label: RESERVATION_STATUS_LABELS.pending },
  { value: 'checked_in', label: RESERVATION_STATUS_LABELS.checked_in },
  { value: 'checked_out', label: RESERVATION_STATUS_LABELS.checked_out },
  { value: 'cancelled', label: RESERVATION_STATUS_LABELS.cancelled },
];

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
}) => {
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

      {/* Fullscreen toggle */}
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
