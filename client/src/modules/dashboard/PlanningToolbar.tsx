import React from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  CleaningServices,
  Build,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReservationStatus, PlanningInterventionType } from '../../services/api';
import {
  RESERVATION_STATUS_COLORS,
  INTERVENTION_TYPE_COLORS,
  INTERVENTION_TYPE_LABELS,
} from '../../services/api/reservationsApi';

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
  zoomLevel: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  onGoPrev: () => void;
  onGoToday: () => void;
  onGoNext: () => void;
  titleText: string;
  visibleReservationCount: number;
  visibleInterventionCount: number;
  propertyCount: number;
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

const TOOLBAR_WRAPPER_SX = { p: 1, mb: 1, flexShrink: 0 } as const;
const TOOLBAR_CONTENT_SX = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 } as const;
const TOGGLE_GROUP_SX = { '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: '0.6875rem', textTransform: 'none' } } as const;
const TOGGLE_LABEL_SX = { fontSize: '0.6875rem', fontWeight: 600 } as const;
const NAV_BOX_SX = { display: 'flex', alignItems: 'center', gap: 0.25 } as const;
const TODAY_BTN_SX = { textTransform: 'none', fontSize: '0.75rem', px: 1, py: 0.25, minWidth: 'auto' } as const;
const TITLE_SX = { fontSize: '0.8125rem', textTransform: 'capitalize' } as const;
const STATS_SX = { fontSize: '0.6875rem' } as const;
const LEGEND_WRAPPER_SX = { display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' } as const;
const LEGEND_LABEL_SX = { fontSize: '0.625rem', color: 'text.secondary' } as const;
const LEGEND_ITEM_SX = { display: 'flex', alignItems: 'center', gap: 0.25 } as const;
const LEGEND_DOT_BASE_SX = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 } as const;
const LEGEND_TEXT_SX = { fontSize: '0.5625rem', fontWeight: 600 } as const;
const DIVIDER_SX = { width: '1px', height: 12, backgroundColor: 'divider', mx: 0.25 } as const;
const SWITCH_LABEL_SX = { fontSize: '0.6875rem' } as const;
const FILTER_CONTROL_SX = { minWidth: 100 } as const;
const FILTER_CONTROL_WIDE_SX = { minWidth: 110 } as const;
const FILTER_LABEL_SX = { fontSize: '0.75rem' } as const;
const FILTER_SELECT_SX = { fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } } as const;
const FILTER_MENUITEM_SX = { fontSize: '0.75rem' } as const;

// ─── Component ──────────────────────────────────────────────────────────────

const PlanningToolbar: React.FC<PlanningToolbarProps> = React.memo(({
  zoomLevel,
  onZoomChange,
  onGoPrev,
  onGoToday,
  onGoNext,
  titleText,
  visibleReservationCount,
  visibleInterventionCount,
  propertyCount,
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
    <Paper sx={TOOLBAR_WRAPPER_SX}>
      <Box sx={TOOLBAR_CONTENT_SX}>

        {/* Zoom toggle */}
        <ToggleButtonGroup
          value={zoomLevel}
          exclusive
          onChange={(_, v) => v && onZoomChange(v as ZoomLevel)}
          size="small"
          sx={TOGGLE_GROUP_SX}
        >
          <ToggleButton value="compact">
            <Tooltip title={t('dashboard.planning.zoomDays') || 'Jours'}>
              <Typography sx={TOGGLE_LABEL_SX}>J</Typography>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="standard">
            <Tooltip title={t('dashboard.planning.zoomHour') || '1 heure'}>
              <Typography sx={TOGGLE_LABEL_SX}>1H</Typography>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="detailed">
            <Tooltip title={t('dashboard.planning.zoomHalfHour') || '30 minutes'}>
              <Typography sx={TOGGLE_LABEL_SX}>30m</Typography>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Navigation */}
        <Box sx={NAV_BOX_SX}>
          <IconButton size="small" onClick={onGoPrev}>
            <ChevronLeft sx={{ fontSize: 20 }} />
          </IconButton>
          <Button
            size="small"
            variant="outlined"
            startIcon={<TodayIcon sx={{ fontSize: 14 }} />}
            onClick={onGoToday}
            sx={TODAY_BTN_SX}
          >
            {t('dashboard.planning.today') || "Aujourd'hui"}
          </Button>
          <IconButton size="small" onClick={onGoNext}>
            <ChevronRight sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Title */}
        <Typography variant="subtitle2" fontWeight={600} sx={TITLE_SX}>
          {titleText}
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* Stats */}
        <Typography variant="caption" color="text.secondary" sx={STATS_SX}>
          {visibleReservationCount} {t('dashboard.planning.reservations') || 'resa'}
          {showInterventions && <> &middot; {visibleInterventionCount} {t('dashboard.planning.interventionCount') || 'inter.'}</>}
          {' \u00B7 '}
          {propertyCount} {t('dashboard.planning.properties') || 'logement'}{propertyCount > 1 ? 's' : ''}
        </Typography>

        {/* Legend */}
        <Box sx={LEGEND_WRAPPER_SX}>
          <Typography variant="caption" fontWeight={700} sx={LEGEND_LABEL_SX}>
            {t('dashboard.planning.legendReservations') || 'Resa :'}
          </Typography>
          {statusFilterOptions.filter((s) => s.value !== 'all').map((opt) => (
            <Box key={opt.value} sx={LEGEND_ITEM_SX}>
              <Box sx={{ ...LEGEND_DOT_BASE_SX, backgroundColor: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus] }} />
              <Typography variant="caption" sx={{ ...LEGEND_TEXT_SX, color: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus] }}>
                {opt.label}
              </Typography>
            </Box>
          ))}
          {showInterventions && (
            <>
              <Box sx={DIVIDER_SX} />
              <Typography variant="caption" fontWeight={700} sx={LEGEND_LABEL_SX}>
                {t('dashboard.planning.legendInterventions') || 'Inter. :'}
              </Typography>
              <Box sx={LEGEND_ITEM_SX}>
                <CleaningServices sx={{ fontSize: 10, color: INTERVENTION_TYPE_COLORS.cleaning }} />
                <Typography variant="caption" sx={{ ...LEGEND_TEXT_SX, color: INTERVENTION_TYPE_COLORS.cleaning }}>
                  {INTERVENTION_TYPE_LABELS.cleaning}
                </Typography>
              </Box>
              <Box sx={LEGEND_ITEM_SX}>
                <Build sx={{ fontSize: 10, color: INTERVENTION_TYPE_COLORS.maintenance }} />
                <Typography variant="caption" sx={{ ...LEGEND_TEXT_SX, color: INTERVENTION_TYPE_COLORS.maintenance }}>
                  {INTERVENTION_TYPE_LABELS.maintenance}
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {/* Intervention toggle */}
        <FormControlLabel
          control={<Switch size="small" checked={showInterventions} onChange={(e) => onShowInterventionsChange(e.target.checked)} />}
          label={<Typography variant="caption" sx={SWITCH_LABEL_SX}>{t('dashboard.planning.interventions') || 'Interventions'}</Typography>}
          sx={{ mr: 0, ml: 0 }}
        />

        {/* Intervention type filter */}
        {showInterventions && (
          <FormControl size="small" sx={FILTER_CONTROL_SX}>
            <InputLabel sx={FILTER_LABEL_SX}>{t('dashboard.planning.interventionType') || 'Type'}</InputLabel>
            <Select
              value={interventionTypeFilter}
              label={t('dashboard.planning.interventionType') || 'Type'}
              onChange={(e) => onInterventionTypeFilterChange(e.target.value as PlanningInterventionType | 'all')}
              sx={FILTER_SELECT_SX}
            >
              {interventionFilterOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={FILTER_MENUITEM_SX}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Status filter */}
        <FormControl size="small" sx={FILTER_CONTROL_WIDE_SX}>
          <InputLabel sx={FILTER_LABEL_SX}>{t('dashboard.planning.status') || 'Statut'}</InputLabel>
          <Select
            value={statusFilter}
            label={t('dashboard.planning.status') || 'Statut'}
            onChange={(e) => onStatusFilterChange(e.target.value as ReservationStatus | 'all')}
            sx={FILTER_SELECT_SX}
          >
            {statusFilterOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={FILTER_MENUITEM_SX}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Paper>
  );
});

PlanningToolbar.displayName = 'PlanningToolbar';

export default PlanningToolbar;
export type { ZoomLevel };
