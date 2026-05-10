import React, { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Skeleton,
  useTheme,
} from '@mui/material';
import { ArrowForward, CalendarMonth, Add } from '../../icons';
import type { NavigateFunction } from 'react-router-dom';
import { useDashboardPlanning } from '../../hooks/useDashboardPlanning';
import apiClient from '../../services/apiClient';
import {
  RESERVATION_STATUS_COLORS,
  INTERVENTION_TYPE_COLORS,
} from '../../services/api/reservationsApi';
import type { Reservation, PlanningIntervention, ReservationStatus, PlanningInterventionType } from '../../services/api';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

// ─── Props ──────────────────────────────────────────────────────────────────

interface MiniPlanningWidgetProps {
  navigate: NavigateFunction;
  t: TranslationFn;
  /** When true, shows a simple intervention list instead of property grid */
  isOperational?: boolean;
  onReady?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_PROPERTIES = 5;
const DAYS_COUNT = 7;
const PROPERTY_COL_WIDTH = 120;
const ROW_HEIGHT = 36;
const MS_PER_DAY = 86_400_000;
const COL_WIDTH_PCT = 100 / DAYS_COUNT;

// Reservation bar positioning (top portion of row)
const RES_BAR_TOP = 4;
const RES_BAR_HEIGHT = 18;

// Intervention marker positioning (bottom portion of row)
const INTER_BAR_BOTTOM = 3;
const INTER_BAR_HEIGHT = 7;

const CARD_CONTENT_SX = {
  p: 1.5,
  '&:last-child': { pb: 1.5 },
} as const;

const SECTION_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

const VIEW_ALL_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  py: 0.25,
  px: 0.75,
  minWidth: 'auto',
  letterSpacing: '0.01em',
} as const;

const PROPERTY_NAME_SX = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'text.primary',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: PROPERTY_COL_WIDTH,
  flexShrink: 0,
  lineHeight: `${ROW_HEIGHT}px`,
} as const;

const DAY_HEADER_SX = {
  fontSize: '0.5625rem',
  fontWeight: 600,
  textAlign: 'center',
  color: 'text.secondary',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.02em',
  lineHeight: 1.2,
} as const;

const LEGEND_DOT_SX = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
} as const;

const LEGEND_LABEL_SX = {
  fontSize: '0.5625rem',
  color: 'text.secondary',
  fontWeight: 500,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface PositionedBar {
  id: string | number;
  left: number;   // %
  width: number;  // %
  color: string;
  roundLeft: boolean;
  roundRight: boolean;
}

interface InterventionMarker {
  id: string;
  left: number;   // %
  width: number;  // %
  color: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get next N days from today */
const getNextDays = (count: number): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
};

/** Format a day for header */
const formatDayHeader = (date: Date, t: TranslationFn): { dayName: string; dayNum: string } => {
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const key = dayKeys[date.getDay()];
  return {
    dayName: t(`dashboard.miniPlanning.days.${key}`),
    dayNum: String(date.getDate()),
  };
};

/** Get day index relative to window start (can be negative or > DAYS_COUNT) */
const getDayOffset = (dateStr: string, windowStart: Date): number => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - windowStart.getTime()) / MS_PER_DAY);
};

/** Check if two dates are the same calendar day */
const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// ─── Component ──────────────────────────────────────────────────────────────

const MiniPlanningWidget: React.FC<MiniPlanningWidgetProps> = React.memo(({ navigate, t, isOperational = false, onReady }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { properties, reservations, filteredInterventions, loading } = useDashboardPlanning();

  // For operational roles: fetch interventions directly (not property-based)
  interface MyIntervention { id: number; title?: string; type: string; status: string; propertyName?: string; scheduledDate?: string; }
  const { data: myInterventions = [], isLoading: myIntLoading } = useQuery<MyIntervention[]>({
    queryKey: ['my-interventions-planning'],
    queryFn: async () => {
      const res = await apiClient.get<{ content: MyIntervention[] }>('/interventions', { params: { size: 50 } });
      return Array.isArray(res) ? res : (res?.content ?? []);
    },
    enabled: isOperational,
    staleTime: 60_000,
  });

  // Signal readiness when data loaded
  const isDataLoading = isOperational ? myIntLoading : loading;
  const readyFired = useRef(false);
  useEffect(() => {
    if (!isDataLoading && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [isDataLoading, onReady]);

  // Interventions for operational roles (all statuses, sorted by date)
  const operationalInterventions = useMemo(() => {
    if (!isOperational) return [];
    return myInterventions
      .filter((i: { scheduledDate?: string }) => !!i.scheduledDate)
      .sort((a: { scheduledDate?: string }, b: { scheduledDate?: string }) =>
        new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime()
      )
      .map((i: { id: number; title?: string; type: string; propertyName?: string; scheduledDate?: string }) => ({
        id: String(i.id),
        type: i.type,
        propertyName: i.propertyName || i.title || i.type,
        startDate: i.scheduledDate || '',
      }));
  }, [isOperational, myInterventions]);

  const next7Days = useMemo(() => getNextDays(DAYS_COUNT), []);
  const windowStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const visibleProperties = useMemo(
    () => properties.slice(0, MAX_PROPERTIES),
    [properties],
  );

  // Pre-compute positioned bars for each property
  const grid = useMemo(() => {
    return visibleProperties.map((prop) => {
      const propRes = reservations.filter(
        (r) => r.propertyId === prop.id && r.status !== 'cancelled',
      );
      const propInter = filteredInterventions.filter(
        (i) => i.propertyId === prop.id && i.status !== 'cancelled',
      );

      // ── Reservation bars: center-to-center for "nuitées" ──
      // Bar spans from center of checkIn column to center of checkOut column.
      // This makes each "night" visually straddle the boundary between two days.
      const resBars: PositionedBar[] = propRes.map((res) => {
        const checkInIdx = getDayOffset(res.checkIn, windowStart);
        const checkOutIdx = getDayOffset(res.checkOut, windowStart);

        // Fractional positions [0..1] in the days area
        const rawStart = (checkInIdx + 0.5) / DAYS_COUNT;
        const rawEnd = (checkOutIdx + 0.5) / DAYS_COUNT;

        const clampedStart = Math.max(0, rawStart);
        const clampedEnd = Math.min(1, rawEnd);

        return {
          id: res.id,
          left: clampedStart * 100,
          width: Math.max(0, (clampedEnd - clampedStart) * 100),
          color: RESERVATION_STATUS_COLORS[res.status as ReservationStatus] ?? '#6B8A9A',
          roundLeft: rawStart >= 0,
          roundRight: rawEnd <= 1,
        };
      }).filter((b) => b.width > 0);

      // ── Intervention markers: 1/5 column width, centered per day ──
      const interBars: InterventionMarker[] = [];
      for (const inter of propInter) {
        const startIdx = getDayOffset(inter.startDate, windowStart);
        const endIdx = inter.endDate
          ? getDayOffset(inter.endDate, windowStart)
          : startIdx;

        const firstDay = Math.max(0, startIdx);
        const lastDay = Math.min(DAYS_COUNT - 1, endIdx);

        for (let d = firstDay; d <= lastDay; d++) {
          const markerWidth = COL_WIDTH_PCT / 5;
          const centerX = (d + 0.5) / DAYS_COUNT * 100;
          interBars.push({
            id: `${inter.id}-${d}`,
            left: centerX - markerWidth / 2,
            width: markerWidth,
            color: INTERVENTION_TYPE_COLORS[inter.type as PlanningInterventionType] ?? '#9B7FC4',
          });
        }
      }

      return { property: prop, resBars, interBars };
    });
  }, [visibleProperties, reservations, filteredInterventions, windowStart]);

  return (
    <Card sx={{ borderRadius: '12px' }}>
      <CardContent sx={CARD_CONTENT_SX}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
            <CalendarMonth size={16} strokeWidth={1.75} />
            {t('dashboard.miniPlanning.title')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward size={12} strokeWidth={1.75} />}
            onClick={() => navigate('/planning')}
            sx={VIEW_ALL_SX}
          >
            {t('dashboard.miniPlanning.viewAll')}
          </Button>
        </Box>

        {(isOperational ? myIntLoading : loading) ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 0.5 }}>
                <Skeleton variant="text" width={PROPERTY_COL_WIDTH} height={ROW_HEIGHT} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="rounded" sx={{ height: ROW_HEIGHT, borderRadius: '4px' }} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : isOperational ? (
          /* ── Operational view: simple list of upcoming interventions ── */
          operationalInterventions.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                {t('dashboard.miniPlanning.noInterventions')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {operationalInterventions.slice(0, 7).map((inter) => {
                const color = INTERVENTION_TYPE_COLORS[inter.type as PlanningInterventionType] ?? '#9B7FC4';
                const date = inter.startDate ? new Date(inter.startDate) : null;
                const isToday = date ? isSameCalendarDay(date, new Date()) : false;
                return (
                  <Box
                    key={inter.id}
                    onClick={() => navigate(`/interventions/${inter.id}`)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isToday ? 'primary.main' : 'divider',
                      bgcolor: isToday ? (isDark ? 'rgba(107,138,154,0.08)' : 'rgba(107,138,154,0.04)') : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-1px)',
                        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.15)' : '0 2px 8px rgba(107,138,154,0.10)',
                      },
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }}>
                        {inter.propertyName || inter.type}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 500, flexShrink: 0 }}>
                      {date ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '-'}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )
        ) : visibleProperties.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 3 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', fontSize: '0.8125rem' }}
            >
              {t('dashboard.miniPlanning.noProperties')}
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add size={14} strokeWidth={1.75} />}
              onClick={() => navigate('/properties/new')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: '8px',
                px: 2,
                py: 0.5,
                background: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
                color: '#fff',
                '&:hover': { filter: 'brightness(0.9)' },
              }}
            >
              {t('dashboard.miniPlanning.addProperty')}
            </Button>
          </Box>
        ) : (
          <>
            {/* Day headers */}
            <Box sx={{ display: 'flex', mb: 0.5 }}>
              <Box sx={{ width: PROPERTY_COL_WIDTH, flexShrink: 0 }} />
              <Box sx={{ flex: 1, display: 'flex' }}>
                {next7Days.map((day, i) => {
                  const { dayName, dayNum } = formatDayHeader(day, t);
                  const highlight = isSameCalendarDay(day, windowStart);
                  return (
                    <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
                      <Typography sx={{
                        ...DAY_HEADER_SX,
                        color: highlight ? 'primary.main' : 'text.secondary',
                        fontWeight: highlight ? 700 : 600,
                      }}>
                        {dayName}
                      </Typography>
                      <Typography sx={{
                        fontSize: '0.6875rem',
                        fontWeight: highlight ? 700 : 500,
                        color: highlight ? 'primary.main' : 'text.primary',
                        textAlign: 'center',
                      }}>
                        {dayNum}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Property rows */}
            {grid.map(({ property, resBars, interBars }) => (
              <Box
                key={property.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' },
                }}
              >
                {/* Property name */}
                <Typography sx={PROPERTY_NAME_SX}>
                  {property.name}
                </Typography>

                {/* Days area — relative container for positioned bars */}
                <Box sx={{ flex: 1, position: 'relative', height: ROW_HEIGHT }}>
                  {/* Column backgrounds (today highlight + visual grid) */}
                  <Box sx={{ display: 'flex', position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {next7Days.map((day, i) => (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          bgcolor: isSameCalendarDay(day, windowStart)
                            ? (isDark ? 'rgba(107,138,154,0.06)' : 'rgba(107,138,154,0.04)')
                            : 'transparent',
                        }}
                      />
                    ))}
                  </Box>

                  {/* Reservation bars (nuitées — straddle between days) */}
                  {resBars.map((bar) => (
                    <Box
                      key={bar.id}
                      sx={{
                        position: 'absolute',
                        left: `${bar.left}%`,
                        width: `${bar.width}%`,
                        top: RES_BAR_TOP,
                        height: RES_BAR_HEIGHT,
                        borderRadius: `${bar.roundLeft ? 10 : 0}px ${bar.roundRight ? 10 : 0}px ${bar.roundRight ? 10 : 0}px ${bar.roundLeft ? 10 : 0}px`,
                        bgcolor: bar.color,
                        opacity: 0.8,
                        transition: 'opacity 0.2s ease',
                      }}
                    />
                  ))}

                  {/* Intervention markers (1/5 column width, bottom of row) */}
                  {interBars.map((bar) => (
                    <Box
                      key={bar.id}
                      sx={{
                        position: 'absolute',
                        left: `${bar.left}%`,
                        width: `${bar.width}%`,
                        bottom: INTER_BAR_BOTTOM,
                        height: INTER_BAR_HEIGHT,
                        borderRadius: '3px',
                        bgcolor: bar.color,
                        opacity: 0.9,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ))}

            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ ...LEGEND_DOT_SX, bgcolor: '#4A9B8E' }} />
                <Typography sx={LEGEND_LABEL_SX}>{t('dashboard.miniPlanning.legend.reservation')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ ...LEGEND_DOT_SX, bgcolor: '#9B7FC4' }} />
                <Typography sx={LEGEND_LABEL_SX}>{t('dashboard.miniPlanning.legend.cleaning')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ ...LEGEND_DOT_SX, bgcolor: '#7EBAD0' }} />
                <Typography sx={LEGEND_LABEL_SX}>{t('dashboard.miniPlanning.legend.maintenance')}</Typography>
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
});

MiniPlanningWidget.displayName = 'MiniPlanningWidget';

export default MiniPlanningWidget;
