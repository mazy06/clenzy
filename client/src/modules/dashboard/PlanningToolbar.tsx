import React from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Select,
  MenuItem,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  TodayOutlined,
  Visibility,
  VisibilityOff,
  FilterList,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReservationStatus, PlanningInterventionType } from '../../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type ZoomLevel = 'compact' | 'standard' | 'detailed';

interface StatusFilterOption {
  value: ReservationStatus | 'all';
  label: string;
}

interface InterventionFilterOption {
  value: PlanningInterventionType | 'all';
  label: string;
}

interface PlanningToolbarProps {
  onGoPrev: () => void;
  onGoToday: () => void;
  onGoNext: () => void;
  titleText: string;
  showInterventions: boolean;
  onShowInterventionsChange: (show: boolean) => void;
  interventionTypeFilter: PlanningInterventionType | 'all';
  onInterventionTypeFilterChange: (type: PlanningInterventionType | 'all') => void;
  statusFilter: ReservationStatus | 'all';
  onStatusFilterChange: (status: ReservationStatus | 'all') => void;
  statusFilterOptions: StatusFilterOption[];
  interventionFilterOptions: InterventionFilterOption[];
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const TOOLBAR_WRAPPER_SX = {
  px: 0, py: 0.5, mb: 0.5, flexShrink: 0,
  border: 'none', boxShadow: 'none',
  backgroundColor: 'transparent',
} as const;

const TOOLBAR_CONTENT_SX = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75,
} as const;

const NAV_ICON_SX = {
  width: 26, height: 26,
  color: 'text.secondary',
  '&:hover': { backgroundColor: 'action.hover' },
} as const;

const COMPACT_SELECT_SX = {
  fontSize: '0.625rem',
  '& .MuiSelect-select': {
    py: 0.3,
    px: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'divider',
    borderRadius: '13px',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'text.secondary',
  },
  '& .MuiInputBase-input': {
    fontSize: '0.625rem',
    letterSpacing: '0.01em',
  },
  minHeight: 0,
  height: 26,
  borderRadius: '13px',
} as const;

const FILTER_MENUITEM_SX = { fontSize: '0.6875rem', py: 0.5, letterSpacing: '0.01em' } as const;

// ─── Component ──────────────────────────────────────────────────────────────

const PlanningToolbar: React.FC<PlanningToolbarProps> = React.memo(({
  onGoPrev,
  onGoToday,
  onGoNext,
  titleText,
  showInterventions,
  onShowInterventionsChange,
  interventionTypeFilter,
  onInterventionTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  statusFilterOptions,
  interventionFilterOptions,
}) => {
  const { t } = useTranslation();

  return (
    <Paper sx={TOOLBAR_WRAPPER_SX} elevation={0}>
      <Box sx={TOOLBAR_CONTENT_SX}>

        {/* ─── Navigation: prev / today / next ───────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <IconButton size="small" onClick={onGoPrev} sx={NAV_ICON_SX}>
            <ChevronLeft sx={{ fontSize: 16 }} />
          </IconButton>

          <Chip
            icon={<TodayOutlined sx={{ fontSize: 13 }} />}
            label={t('dashboard.planning.today') || "Aujourd'hui"}
            size="small"
            variant="outlined"
            onClick={onGoToday}
            sx={{
              fontSize: '0.625rem',
              fontWeight: 600,
              height: 26,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { backgroundColor: 'action.hover', borderColor: 'text.secondary' },
              '& .MuiChip-icon': { fontSize: 13, color: 'primary.main' },
            }}
          />

          <IconButton size="small" onClick={onGoNext} sx={NAV_ICON_SX}>
            <ChevronRight sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* ─── Month title ───────────────────────────────────────────── */}
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            textTransform: 'capitalize',
            color: 'text.primary',
            letterSpacing: '-0.02em',
          }}
        >
          {titleText}
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* ─── Filters group (right side) ────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>

          {/* Intervention toggle chip */}
          <Chip
            icon={showInterventions ? <Visibility sx={{ fontSize: 13 }} /> : <VisibilityOff sx={{ fontSize: 13 }} />}
            label={t('dashboard.planning.interventions') || 'Interventions'}
            size="small"
            variant={showInterventions ? 'filled' : 'outlined'}
            color={showInterventions ? 'primary' : 'default'}
            onClick={() => onShowInterventionsChange(!showInterventions)}
            sx={{
              fontSize: '0.625rem',
              fontWeight: 600,
              height: 26,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              '& .MuiChip-icon': { fontSize: 13 },
              ...(!showInterventions && {
                borderColor: 'divider',
                color: 'text.secondary',
              }),
            }}
          />

          {/* Intervention type filter */}
          {showInterventions && (
            <Tooltip title={t('dashboard.planning.interventionType') || 'Type'}>
              <Select
                value={interventionTypeFilter}
                onChange={(e) => onInterventionTypeFilterChange(e.target.value as PlanningInterventionType | 'all')}
                size="small"
                displayEmpty
                sx={COMPACT_SELECT_SX}
                renderValue={(val) => {
                  const opt = interventionFilterOptions.find((o) => o.value === val);
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <FilterList sx={{ fontSize: 12, color: 'text.secondary' }} />
                      <span>{opt?.label || 'Type'}</span>
                    </Box>
                  );
                }}
              >
                {interventionFilterOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value} sx={FILTER_MENUITEM_SX}>{opt.label}</MenuItem>
                ))}
              </Select>
            </Tooltip>
          )}

          {/* Status filter */}
          <Tooltip title={t('dashboard.planning.status') || 'Statut'}>
            <Select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as ReservationStatus | 'all')}
              size="small"
              displayEmpty
              sx={COMPACT_SELECT_SX}
              renderValue={(val) => {
                const opt = statusFilterOptions.find((o) => o.value === val);
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FilterList sx={{ fontSize: 12, color: 'text.secondary' }} />
                    <span>{opt?.label || 'Statut'}</span>
                  </Box>
                );
              }}
            >
              {statusFilterOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={FILTER_MENUITEM_SX}>{opt.label}</MenuItem>
              ))}
            </Select>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
});

PlanningToolbar.displayName = 'PlanningToolbar';

export default PlanningToolbar;
export type { ZoomLevel };
