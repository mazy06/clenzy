import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
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
  CircularProgress,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  Home,
  CleaningServices,
  Build,
  ViewDay,
  ViewWeek,
  CalendarMonth,
  AllInclusive,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardPlanning } from '../../hooks/useDashboardPlanning';
import type { PlanningViewMode } from '../../hooks/useDashboardPlanning';
import type { Reservation, ReservationStatus, PlanningIntervention, PlanningInterventionType } from '../../services/api';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  INTERVENTION_TYPE_COLORS,
  INTERVENTION_TYPE_LABELS,
  INTERVENTION_STATUS_LABELS,
} from '../../services/api/reservationsApi';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROPERTY_COL_WIDTH = 160;
const DAY_COL_WIDTH = 38; // Largeur fixe par jour en mode continu
const MIN_DAY_COL_WIDTH = 32;
const RESERVATION_ROW_HEIGHT = 36;
const INTERVENTION_ROW_HEIGHT = 28;
const ROW_PADDING = 4;
const PROPERTIES_PER_PAGE = 8;

// Day view constants
const DAY_HOUR_START = 6;   // Afficher à partir de 6h
const DAY_HOUR_END = 23;    // Jusqu'à 23h
const DAY_HOUR_WIDTH = 80;  // Largeur par heure en pixels
const DAY_TOTAL_HOURS = DAY_HOUR_END - DAY_HOUR_START;
const DAY_ROW_HEIGHT = 70;  // Hauteur par propriété en vue jour

const STATUS_FILTER_OPTIONS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'pending', label: 'En attente' },
  { value: 'checked_in', label: 'Check-in' },
  { value: 'checked_out', label: 'Check-out' },
  { value: 'cancelled', label: 'Annulées' },
];

const INTERVENTION_FILTER_OPTIONS: { value: PlanningInterventionType | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'cleaning', label: 'Ménage' },
  { value: 'maintenance', label: 'Maintenance' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function toDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function daysBetween(d1: Date, d2: Date): number {
  const ms = d2.getTime() - d1.getTime();
  return Math.round(ms / 86400000);
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// ─── Hook: mesure dynamique de la largeur du conteneur ──────────────────────

function useContainerWidth(): [React.RefCallback<HTMLDivElement>, number] {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    elementRef.current = node;

    if (node) {
      setWidth(node.getBoundingClientRect().width);

      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [refCallback, width];
}

// ─── Compute month separators for header ────────────────────────────────────

interface MonthSeparator {
  month: number;
  year: number;
  label: string;
  startIndex: number;
  count: number;
}

function computeMonthSeparators(days: Date[]): MonthSeparator[] {
  if (days.length === 0) return [];
  const seps: MonthSeparator[] = [];
  let currentMonth = -1;
  let currentYear = -1;

  for (let i = 0; i < days.length; i++) {
    const m = days[i].getMonth();
    const y = days[i].getFullYear();
    if (m !== currentMonth || y !== currentYear) {
      seps.push({
        month: m,
        year: y,
        label: `${MONTH_SHORT[m]} ${y}`,
        startIndex: i,
        count: 1,
      });
      currentMonth = m;
      currentYear = y;
    } else {
      seps[seps.length - 1].count++;
    }
  }
  return seps;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DashboardPlanningProps {
  forfait?: string;
}

export default function DashboardPlanning({ forfait }: DashboardPlanningProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    properties,
    loading,
    loadingMore,
    error,
    currentDate,
    viewMode,
    setViewMode,
    goToday,
    goPrev,
    goNext,
    extendRange,
    statusFilter,
    setStatusFilter,
    interventionTypeFilter,
    setInterventionTypeFilter,
    showInterventions,
    setShowInterventions,
    dateRange,
    days,
    filteredReservations,
    filteredInterventions,
  } = useDashboardPlanning();

  const today = useMemo(() => new Date(), []);

  // ─── Pagination des propriétés ─────────────────────────────────────────
  const [propertyPage, setPropertyPage] = useState(0);
  const totalPropertyPages = Math.max(1, Math.ceil(properties.length / PROPERTIES_PER_PAGE));

  // Reset page si le nombre de propriétés change
  useEffect(() => {
    setPropertyPage(0);
  }, [properties.length]);

  const paginatedProperties = useMemo(() => {
    const start = propertyPage * PROPERTIES_PER_PAGE;
    return properties.slice(start, start + PROPERTIES_PER_PAGE);
  }, [properties, propertyPage]);

  // ─── Mois visible dynamique (mode continu) ──────────────────────────────
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);

  // ─── Scroll horizontal vers aujourd'hui au montage ─────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToToday = useCallback(() => {
    if (!scrollContainerRef.current || days.length === 0) return;
    const todayIndex = days.findIndex((d) => isSameDay(d, today));
    if (todayIndex >= 0) {
      const scrollLeft = todayIndex * DAY_COL_WIDTH - 100; // 100px de marge à gauche
      scrollContainerRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [days, today]);

  useEffect(() => {
    // Petit délai pour laisser le temps au DOM de se rendre
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [scrollToToday]);

  // ─── Infinite scroll + détection du mois visible ────────────────────────
  const [visibleMonthKey, setVisibleMonthKey] = useState(''); // "YYYY-MM" string pour comparaison fiable

  const computeVisibleMonth = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || viewMode !== 'continuous' || days.length === 0) return;

    // Trouver le jour au ~1/3 de la zone visible
    const visibleX = el.scrollLeft + el.clientWidth * 0.33 - PROPERTY_COL_WIDTH;
    const dayIndex = Math.floor(Math.max(0, visibleX) / DAY_COL_WIDTH);
    const clampedIndex = Math.min(dayIndex, days.length - 1);
    const visibleDay = days[clampedIndex];
    if (visibleDay) {
      const key = `${visibleDay.getFullYear()}-${String(visibleDay.getMonth() + 1).padStart(2, '0')}`;
      setVisibleMonthKey(key);
      setVisibleMonth(new Date(visibleDay.getFullYear(), visibleDay.getMonth(), 1));
    }
  }, [viewMode, days]);

  const handleGridScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // 1. Infinite scroll : charger plus quand on approche de la fin
    if (viewMode === 'continuous' && !loadingMore) {
      const threshold = el.scrollWidth * 0.8;
      if (el.scrollLeft + el.clientWidth >= threshold) {
        extendRange();
      }
    }

    // 2. Mois visible
    computeVisibleMonth();
  }, [viewMode, loadingMore, extendRange, computeVisibleMonth]);

  // Après un chargement, re-vérifier
  useEffect(() => {
    if (!loadingMore && viewMode === 'continuous') {
      const timer = setTimeout(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth * 0.8) {
          extendRange();
        }
        computeVisibleMonth();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loadingMore, viewMode, extendRange, computeVisibleMonth]);

  // Initialiser le mois visible au montage/changement de jours
  useEffect(() => {
    if (days.length > 0 && viewMode === 'continuous') {
      const timer = setTimeout(computeVisibleMonth, 200);
      return () => clearTimeout(timer);
    }
  }, [days.length, viewMode, computeVisibleMonth]);

  // ─── Convertir le scroll vertical (molette) en scroll horizontal ────────
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
      // Mettre à jour mois visible et vérifier infinite scroll
      handleGridScroll();
    }
  }, [handleGridScroll]);

  // ─── Mesure dynamique de la largeur ────────────────────────────────────
  const [containerRef, containerWidth] = useContainerWidth();

  // En mode continu, forcer DAY_COL_WIDTH fixe pour permettre le scroll
  const dayColWidth = useMemo(() => {
    if (viewMode === 'continuous') return DAY_COL_WIDTH;
    if (containerWidth <= 0 || days.length === 0) return MIN_DAY_COL_WIDTH;
    const availableWidth = containerWidth - PROPERTY_COL_WIDTH - 2;
    const computed = Math.floor(availableWidth / days.length);
    return Math.max(computed, MIN_DAY_COL_WIDTH);
  }, [containerWidth, days.length, viewMode]);

  const gridWidth = PROPERTY_COL_WIDTH + days.length * dayColWidth;

  // Month separators pour l'en-tête en mode continu
  const monthSeparators = useMemo(() => computeMonthSeparators(days), [days]);

  // Group reservations by propertyId
  const reservationsByProperty = useMemo(() => {
    const map = new Map<number, Reservation[]>();
    filteredReservations.forEach((r) => {
      const list = map.get(r.propertyId) || [];
      list.push(r);
      map.set(r.propertyId, list);
    });
    return map;
  }, [filteredReservations]);

  // Group interventions by propertyId
  const interventionsByProperty = useMemo(() => {
    const map = new Map<number, PlanningIntervention[]>();
    filteredInterventions.forEach((i) => {
      const list = map.get(i.propertyId) || [];
      list.push(i);
      map.set(i.propertyId, list);
    });
    return map;
  }, [filteredInterventions]);

  // Compute row height per property
  const totalRowHeight = RESERVATION_ROW_HEIGHT + ROW_PADDING * 2
    + (showInterventions ? INTERVENTION_ROW_HEIGHT + ROW_PADDING : 0);

  // ─── Stats filtrées par mois visible (mode continu) ────────────────────
  // IMPORTANT: ces useMemo doivent être AVANT les early returns (règle des hooks)
  const visibleReservationCount = useMemo(() => {
    if (viewMode !== 'continuous' || !visibleMonthKey) return filteredReservations.length;
    const [y, m] = visibleMonthKey.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return filteredReservations.filter(r => r.checkOut >= monthStart && r.checkIn <= monthEnd).length;
  }, [viewMode, visibleMonthKey, filteredReservations]);

  const visibleInterventionCount = useMemo(() => {
    if (viewMode !== 'continuous' || !visibleMonthKey) return filteredInterventions.length;
    const [y, m] = visibleMonthKey.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return filteredInterventions.filter(i => i.endDate >= monthStart && i.startDate <= monthEnd).length;
  }, [viewMode, visibleMonthKey, filteredInterventions]);

  // ─── Title ───────────────────────────────────────────────────────────────
  const titleDate = viewMode === 'continuous' && visibleMonth ? visibleMonth : currentDate;
  const titleText = viewMode === 'day'
    ? currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : formatMonth(titleDate);

  // ─── Loading / Error / Render ────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Toolbar ─────────────────────────────────────────────────────── */}
      <Paper sx={{ p: 1, mb: 1, flexShrink: 0 }}>
        {/* Ligne 1 : Navigation + Stats + Légende + Filtres + Interventions */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {/* View mode toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v as PlanningViewMode)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                py: 0.25,
                px: 0.75,
                fontSize: '0.6875rem',
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="day">
              <Tooltip title="Jour"><ViewDay sx={{ fontSize: 16 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="week">
              <Tooltip title="Semaine"><ViewWeek sx={{ fontSize: 16 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="month">
              <Tooltip title="Mois"><CalendarMonth sx={{ fontSize: 16 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="continuous">
              <Tooltip title="Continu"><AllInclusive sx={{ fontSize: 16 }} /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <IconButton size="small" onClick={goPrev}>
              <ChevronLeft sx={{ fontSize: 20 }} />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TodayIcon sx={{ fontSize: 14 }} />}
              onClick={() => { goToday(); setTimeout(scrollToToday, 150); }}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1, py: 0.25, minWidth: 'auto' }}
            >
              {t('dashboard.planning.today') || "Aujourd'hui"}
            </Button>
            <IconButton size="small" onClick={goNext}>
              <ChevronRight sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Title */}
          <Typography
            variant="subtitle2"
            fontWeight={600}
            sx={{ fontSize: '0.8125rem', textTransform: 'capitalize' }}
          >
            {titleText}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Stats summary */}
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
            {visibleReservationCount} résa
            {showInterventions && <> · {visibleInterventionCount} inter.</>}
            {' · '}
            {properties.length} logement{properties.length > 1 ? 's' : ''}
          </Typography>

          {/* ─── Legend (inline) ─── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
              Résa :
            </Typography>
            {STATUS_FILTER_OPTIONS.filter((s) => s.value !== 'all').map((opt) => (
              <Box key={opt.value} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus],
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.5625rem', color: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus], fontWeight: 600 }}>
                  {opt.label}
                </Typography>
              </Box>
            ))}

            {showInterventions && (
              <>
                <Box sx={{ width: '1px', height: 12, backgroundColor: 'divider', mx: 0.25 }} />
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                  Inter. :
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <CleaningServices sx={{ fontSize: 10, color: INTERVENTION_TYPE_COLORS.cleaning }} />
                  <Typography variant="caption" sx={{ fontSize: '0.5625rem', color: INTERVENTION_TYPE_COLORS.cleaning, fontWeight: 600 }}>
                    {INTERVENTION_TYPE_LABELS.cleaning}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Build sx={{ fontSize: 10, color: INTERVENTION_TYPE_COLORS.maintenance }} />
                  <Typography variant="caption" sx={{ fontSize: '0.5625rem', color: INTERVENTION_TYPE_COLORS.maintenance, fontWeight: 600 }}>
                    {INTERVENTION_TYPE_LABELS.maintenance}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Intervention toggle */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showInterventions}
                onChange={(e) => setShowInterventions(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" sx={{ fontSize: '0.6875rem' }}>
                Interventions
              </Typography>
            }
            sx={{ mr: 0, ml: 0 }}
          />

          {/* Intervention type filter */}
          {showInterventions && (
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Type</InputLabel>
              <Select
                value={interventionTypeFilter}
                label="Type"
                onChange={(e) => setInterventionTypeFilter(e.target.value as PlanningInterventionType | 'all')}
                sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
              >
                {INTERVENTION_FILTER_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.75rem' }}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Status filter */}
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Statut</InputLabel>
            <Select
              value={statusFilter}
              label="Statut"
              onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | 'all')}
              sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.75rem' }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* ─── Grid content ─────────────────────────────────────────────── */}
      {properties.length === 0 ? (
        forfait?.toLowerCase() === 'essentiel' ? (
          <Paper
            sx={{
              p: 4,
              textAlign: 'center',
              borderLeft: '4px solid #6B8A9A',
              borderRadius: '12px',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: 'rgba(107,138,154,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <LockIcon sx={{ fontSize: 28, color: '#6B8A9A' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#1E293B', mb: 0.5 }}>
              Planning non disponible avec le forfait Essentiel
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: 480, mx: 'auto' }}>
              Votre forfait actuel ne permet pas l'acces au planning interactif ni a l'import
              automatique de vos calendriers Airbnb, Booking et autres plateformes.
              Passez au forfait Confort ou Premium pour debloquer cette fonctionnalite.
            </Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Home sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              {t('dashboard.planning.noProperties') || 'Aucun logement a afficher'}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              {t('dashboard.planning.noPropertiesHint') ||
                "Les logements apparaitront ici une fois qu'ils seront crees et assignes."}
            </Typography>
          </Paper>
        )
      ) : viewMode === 'day' ? (
        /* ─── Day View (timeline horaire) ─────────────────────────────── */
        <Paper
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ flex: 1, overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Box sx={{ width: PROPERTY_COL_WIDTH + DAY_TOTAL_HOURS * DAY_HOUR_WIDTH, position: 'relative' }}>
              {/* Hours header */}
              <Box
                sx={{
                  display: 'flex',
                  position: 'sticky',
                  top: 0,
                  zIndex: 3,
                  backgroundColor: 'background.paper',
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    width: PROPERTY_COL_WIDTH,
                    minWidth: PROPERTY_COL_WIDTH,
                    flexShrink: 0,
                    px: 1.5,
                    py: 0.75,
                    position: 'sticky',
                    left: 0,
                    zIndex: 4,
                    backgroundColor: 'background.paper',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem' }}>
                    {t('dashboard.planning.property') || 'Logement'}
                  </Typography>
                </Box>
                {Array.from({ length: DAY_TOTAL_HOURS }, (_, i) => {
                  const hour = DAY_HOUR_START + i;
                  return (
                    <Box
                      key={hour}
                      sx={{
                        width: DAY_HOUR_WIDTH,
                        minWidth: DAY_HOUR_WIDTH,
                        textAlign: 'center',
                        py: 0.5,
                        borderRight: '1px solid',
                        borderColor: hour === 12 ? 'primary.light' : 'divider',
                        borderRightWidth: hour === 12 ? 2 : 1,
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        {`${hour}h`}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* Property rows (day view) */}
              {paginatedProperties.map((property, rowIndex) => {
                const dayStr = dateRange.start.toISOString().split('T')[0];
                // Réservations qui touchent ce jour
                const propRes = (reservationsByProperty.get(property.id) || []).filter(
                  (r) => r.checkIn <= dayStr && r.checkOut >= dayStr
                );
                // Interventions qui touchent ce jour
                const propInt = showInterventions
                  ? (interventionsByProperty.get(property.id) || []).filter(
                      (i) => i.startDate <= dayStr && i.endDate >= dayStr
                    )
                  : [];
                const dayRowBg = rowIndex % 2 === 0 ? '#ffffff' : '#f5f5f5';

                return (
                  <Box
                    key={property.id}
                    sx={{
                      display: 'flex',
                      position: 'relative',
                      minHeight: DAY_ROW_HEIGHT,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: dayRowBg,
                      '&:hover': { backgroundColor: '#ebebeb' },
                      '&:hover > .sticky-property-cell': { backgroundColor: '#ebebeb' },
                    }}
                  >
                    {/* Property name */}
                    <Box
                      className="sticky-property-cell"
                      sx={{
                        width: PROPERTY_COL_WIDTH,
                        minWidth: PROPERTY_COL_WIDTH,
                        flexShrink: 0,
                        px: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        backgroundColor: dayRowBg,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {property.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {property.city || property.address}
                      </Typography>
                    </Box>

                    {/* Timeline area */}
                    <Box sx={{ position: 'relative', flex: 1, display: 'flex' }}>
                      {/* Hour grid lines */}
                      {Array.from({ length: DAY_TOTAL_HOURS }, (_, i) => {
                        const hour = DAY_HOUR_START + i;
                        return (
                          <Box
                            key={hour}
                            sx={{
                              width: DAY_HOUR_WIDTH,
                              minWidth: DAY_HOUR_WIDTH,
                              height: '100%',
                              borderRight: '1px solid',
                              borderColor: hour === 12 ? 'primary.light' : 'divider',
                              borderRightWidth: hour === 12 ? 2 : 1,
                            }}
                          />
                        );
                      })}

                      {/* Check-in markers */}
                      {propRes.filter((r) => r.checkIn === dayStr && r.checkInTime).map((r) => {
                        const hour = parseTime(r.checkInTime!);
                        const leftPx = (hour - DAY_HOUR_START) * DAY_HOUR_WIDTH;
                        const color = RESERVATION_STATUS_COLORS[r.status];
                        return (
                          <Tooltip
                            key={`ci-${r.id}`}
                            title={
                              <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                                {`Check-in ${r.checkInTime}\n${r.guestName} (${r.guestCount} pers.)\n${RESERVATION_STATUS_LABELS[r.status]}`}
                              </Box>
                            }
                            arrow
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 4,
                                left: leftPx,
                                width: Math.max(DAY_HOUR_WIDTH * 2, 120),
                                height: 26,
                                backgroundColor: color,
                                borderRadius: '4px 12px 12px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                px: 0.75,
                                cursor: 'pointer',
                                opacity: 0.9,
                                overflow: 'hidden',
                                '&:hover': { opacity: 1, boxShadow: `0 2px 8px ${color}60`, zIndex: 1 },
                              }}
                            >
                              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.625rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {`\u2794 ${r.checkInTime} ${r.guestName}`}
                              </Typography>
                            </Box>
                          </Tooltip>
                        );
                      })}

                      {/* Check-out markers */}
                      {propRes.filter((r) => r.checkOut === dayStr && r.checkOutTime).map((r) => {
                        const hour = parseTime(r.checkOutTime!);
                        const leftPx = Math.max(0, (hour - DAY_HOUR_START) * DAY_HOUR_WIDTH - DAY_HOUR_WIDTH * 2);
                        const color = RESERVATION_STATUS_COLORS[r.status];
                        return (
                          <Tooltip
                            key={`co-${r.id}`}
                            title={
                              <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                                {`Check-out ${r.checkOutTime}\n${r.guestName} (${r.guestCount} pers.)\n${RESERVATION_STATUS_LABELS[r.status]}`}
                              </Box>
                            }
                            arrow
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 4,
                                left: leftPx,
                                width: Math.max(DAY_HOUR_WIDTH * 2, 120),
                                height: 26,
                                backgroundColor: color,
                                borderRadius: '12px 4px 4px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                px: 0.75,
                                cursor: 'pointer',
                                opacity: 0.7,
                                overflow: 'hidden',
                                '&:hover': { opacity: 1, boxShadow: `0 2px 8px ${color}60`, zIndex: 1 },
                              }}
                            >
                              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.625rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {`${r.guestName} ${r.checkOutTime} \u2794`}
                              </Typography>
                            </Box>
                          </Tooltip>
                        );
                      })}

                      {/* Séjour en cours (pas de check-in/out ce jour) */}
                      {propRes.filter((r) => r.checkIn < dayStr && r.checkOut > dayStr).map((r) => {
                        const color = RESERVATION_STATUS_COLORS[r.status];
                        return (
                          <Tooltip
                            key={`stay-${r.id}`}
                            title={
                              <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                                {`Séjour en cours\n${r.guestName} (${r.guestCount} pers.)\n${RESERVATION_STATUS_LABELS[r.status]}`}
                              </Box>
                            }
                            arrow
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 4,
                                left: 0,
                                right: 0,
                                height: 26,
                                backgroundColor: color,
                                opacity: 0.25,
                                borderRadius: 0,
                              }}
                            />
                          </Tooltip>
                        );
                      })}

                      {/* Intervention bars */}
                      {propInt.map((inter) => {
                        const startHour = inter.startDate === dayStr && inter.startTime
                          ? parseTime(inter.startTime)
                          : DAY_HOUR_START;
                        const endHour = inter.endDate === dayStr && inter.endTime
                          ? parseTime(inter.endTime)
                          : DAY_HOUR_END;
                        const leftPx = (startHour - DAY_HOUR_START) * DAY_HOUR_WIDTH;
                        const widthPx = Math.max((endHour - startHour) * DAY_HOUR_WIDTH, 40);
                        const color = INTERVENTION_TYPE_COLORS[inter.type];
                        const typeLabel = INTERVENTION_TYPE_LABELS[inter.type];
                        const statusLabel = INTERVENTION_STATUS_LABELS[inter.status];

                        return (
                          <Tooltip
                            key={`int-${inter.id}`}
                            title={
                              <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                                {[
                                  `${typeLabel} · ${statusLabel}`,
                                  inter.title,
                                  inter.assigneeName,
                                  `${inter.startTime || ''} → ${inter.endTime || ''}`,
                                  `~${inter.estimatedDurationHours}h`,
                                  inter.notes || '',
                                ].filter(Boolean).join('\n')}
                              </Box>
                            }
                            arrow
                            placement="bottom"
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 36,
                                left: leftPx,
                                width: widthPx,
                                height: 24,
                                backgroundColor: inter.status === 'cancelled' ? '#9e9e9e' : color,
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                px: 0.5,
                                overflow: 'hidden',
                                opacity: inter.status === 'completed' ? 0.55 : inter.status === 'cancelled' ? 0.4 : 0.85,
                                '&:hover': { opacity: 1, boxShadow: `0 2px 6px ${color}50`, zIndex: 1 },
                              }}
                            >
                              {inter.type === 'cleaning'
                                ? <CleaningServices sx={{ fontSize: 12, color: '#fff', mr: 0.25, flexShrink: 0 }} />
                                : <Build sx={{ fontSize: 12, color: '#fff', mr: 0.25, flexShrink: 0 }} />
                              }
                              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.5625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {inter.startTime && inter.endTime ? `${inter.startTime}-${inter.endTime} ` : ''}{inter.title}
                              </Typography>
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Pagination (day view) */}
          {totalPropertyPages > 1 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                py: 0.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                flexShrink: 0,
              }}
            >
              <IconButton size="small" onClick={() => setPropertyPage((p) => Math.max(0, p - 1))} disabled={propertyPage === 0}>
                <ChevronLeft sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {propertyPage * PROPERTIES_PER_PAGE + 1} - {Math.min((propertyPage + 1) * PROPERTIES_PER_PAGE, properties.length)} / {properties.length} logements
              </Typography>
              <IconButton size="small" onClick={() => setPropertyPage((p) => Math.min(totalPropertyPages - 1, p + 1))} disabled={propertyPage >= totalPropertyPages - 1}>
                <ChevronRight sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </Paper>
      ) : (
        <Paper
          ref={containerRef}
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {/* Scrollable grid area */}
          <Box
            ref={scrollContainerRef}
            onScroll={handleGridScroll}
            onWheel={handleWheel}
            sx={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Box sx={{ width: gridWidth, position: 'relative' }}>
              {/* ─── Month header row (visible en mode continu) ──────── */}
              {viewMode === 'continuous' && monthSeparators.length > 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                    backgroundColor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Empty cell for property column */}
                  <Box
                    sx={{
                      width: PROPERTY_COL_WIDTH,
                      minWidth: PROPERTY_COL_WIDTH,
                      flexShrink: 0,
                      position: 'sticky',
                      left: 0,
                      zIndex: 6,
                      backgroundColor: 'background.paper',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                  {monthSeparators.map((sep) => (
                    <Box
                      key={`${sep.year}-${sep.month}`}
                      sx={{
                        width: sep.count * dayColWidth,
                        textAlign: 'center',
                        py: 0.25,
                        borderRight: '2px solid',
                        borderColor: 'primary.light',
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                          fontSize: '0.6875rem',
                          textTransform: 'capitalize',
                          color: 'primary.main',
                        }}
                      >
                        {sep.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* ─── Header row (days) ──────────────────────────────────── */}
              <Box
                sx={{
                  display: 'flex',
                  position: 'sticky',
                  top: viewMode === 'continuous' && monthSeparators.length > 1 ? 24 : 0,
                  zIndex: 3,
                  backgroundColor: 'background.paper',
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                {/* Property column header */}
                <Box
                  sx={{
                    width: PROPERTY_COL_WIDTH,
                    minWidth: PROPERTY_COL_WIDTH,
                    flexShrink: 0,
                    px: 1.5,
                    py: 0.5,
                    position: 'sticky',
                    left: 0,
                    zIndex: 4,
                    backgroundColor: 'background.paper',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem' }}>
                    {t('dashboard.planning.property') || 'Logement'}
                  </Typography>
                </Box>

                {/* Day columns */}
                {days.map((day, idx) => {
                  const isToday = isSameDay(day, today);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isFirstOfMonth = day.getDate() === 1 && idx > 0;

                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        width: dayColWidth,
                        minWidth: dayColWidth,
                        textAlign: 'center',
                        py: 0.25,
                        borderRight: '1px solid',
                        borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                        borderRightWidth: isFirstOfMonth ? 2 : 1,
                        backgroundColor: isToday
                          ? 'primary.main'
                          : isWeekend
                            ? 'action.hover'
                            : 'background.paper',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.5625rem',
                          fontWeight: isToday ? 700 : 400,
                          color: isToday ? 'primary.contrastText' : 'text.secondary',
                          display: 'block',
                          lineHeight: 1.2,
                        }}
                      >
                        {WEEKDAY_SHORT[day.getDay()]}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.6875rem',
                          fontWeight: isToday ? 700 : 500,
                          color: isToday ? 'primary.contrastText' : 'text.primary',
                          display: 'block',
                          lineHeight: 1.2,
                        }}
                      >
                        {day.getDate()}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* ─── Property rows (paginated) ──────────────────────── */}
              {paginatedProperties.map((property, rowIndex) => {
                const propertyReservations = reservationsByProperty.get(property.id) || [];
                const propertyInterventions = interventionsByProperty.get(property.id) || [];
                const rowBg = rowIndex % 2 === 0 ? '#ffffff' : '#f5f5f5';

                return (
                  <Box
                    key={property.id}
                    sx={{
                      display: 'flex',
                      position: 'relative',
                      height: totalRowHeight,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: rowBg,
                      '&:hover': { backgroundColor: '#ebebeb' },
                      '&:hover > .sticky-property-cell': { backgroundColor: '#ebebeb' },
                    }}
                  >
                    {/* Property name cell */}
                    <Box
                      className="sticky-property-cell"
                      sx={{
                        width: PROPERTY_COL_WIDTH,
                        minWidth: PROPERTY_COL_WIDTH,
                        flexShrink: 0,
                        px: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        backgroundColor: rowBg,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          fontSize: '0.8125rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {property.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.6875rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {property.city || property.address}
                      </Typography>
                    </Box>

                    {/* Day cells background + bars */}
                    <Box sx={{ display: 'flex', position: 'relative', flex: 1 }}>
                      {days.map((day, idx) => {
                        const isToday = isSameDay(day, today);
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const isFirstOfMonth = day.getDate() === 1 && idx > 0;

                        return (
                          <Box
                            key={day.toISOString()}
                            sx={{
                              width: dayColWidth,
                              minWidth: dayColWidth,
                              height: '100%',
                              borderRight: '1px solid',
                              borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                              borderRightWidth: isFirstOfMonth ? 2 : 1,
                              backgroundColor: isToday
                                ? 'rgba(25, 118, 210, 0.06)'
                                : isWeekend
                                  ? 'rgba(0,0,0,0.02)'
                                  : 'transparent',
                            }}
                          />
                        );
                      })}

                      {/* Reservation bars (top sub-row) */}
                      {propertyReservations.map((reservation) => (
                        <ReservationBar
                          key={`res-${reservation.id}`}
                          reservation={reservation}
                          days={days}
                          rangeStart={dateRange.start}
                          topOffset={ROW_PADDING}
                          barHeight={RESERVATION_ROW_HEIGHT}
                          dayColWidth={dayColWidth}
                        />
                      ))}

                      {/* Intervention bars (bottom sub-row) */}
                      {showInterventions &&
                        propertyInterventions.map((intervention) => (
                          <InterventionBar
                            key={`int-${intervention.id}`}
                            intervention={intervention}
                            days={days}
                            rangeStart={dateRange.start}
                            topOffset={ROW_PADDING + RESERVATION_ROW_HEIGHT + ROW_PADDING}
                            barHeight={INTERVENTION_ROW_HEIGHT}
                            dayColWidth={dayColWidth}
                          />
                        ))}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* ─── Loading indicator (infinite scroll) ─────────────────────── */}
          {loadingMore && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                py: 0.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'action.hover',
                flexShrink: 0,
              }}
            >
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                Chargement des mois suivants…
              </Typography>
            </Box>
          )}

          {/* ─── Pagination bar (propriétés) ────────────────────────────── */}
          {totalPropertyPages > 1 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                py: 0.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                flexShrink: 0,
              }}
            >
              <IconButton
                size="small"
                onClick={() => setPropertyPage((p) => Math.max(0, p - 1))}
                disabled={propertyPage === 0}
              >
                <ChevronLeft sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {propertyPage * PROPERTIES_PER_PAGE + 1}
                {' - '}
                {Math.min((propertyPage + 1) * PROPERTIES_PER_PAGE, properties.length)}
                {' / '}
                {properties.length} logements
              </Typography>
              <IconButton
                size="small"
                onClick={() => setPropertyPage((p) => Math.min(totalPropertyPages - 1, p + 1))}
                disabled={propertyPage >= totalPropertyPages - 1}
              >
                <ChevronRight sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}

// ─── ReservationBar Sub-component ────────────────────────────────────────────

interface ReservationBarProps {
  reservation: Reservation;
  days: Date[];
  rangeStart: Date;
  topOffset: number;
  barHeight: number;
  dayColWidth: number;
}

function ReservationBar({ reservation, days, rangeStart, topOffset, barHeight, dayColWidth }: ReservationBarProps) {
  const checkIn = toDateOnly(reservation.checkIn);
  const checkOut = toDateOnly(reservation.checkOut);

  const startOffset = daysBetween(rangeStart, checkIn);
  const endOffset = daysBetween(rangeStart, checkOut);

  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  const left = visibleStart * dayColWidth;
  const width = (visibleEnd - visibleStart) * dayColWidth;
  const color = RESERVATION_STATUS_COLORS[reservation.status];
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status];

  const nights = daysBetween(checkIn, checkOut);
  const checkInStr = checkIn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const checkOutStr = checkOut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const tooltipContent = [
    `${reservation.guestName} (${reservation.guestCount} pers.)`,
    `${checkInStr} \u2192 ${checkOutStr} (${nights} nuit${nights > 1 ? 's' : ''})`,
    `${statusLabel} \xB7 ${reservation.source.charAt(0).toUpperCase() + reservation.source.slice(1)}`,
    reservation.totalPrice > 0 ? `${reservation.totalPrice.toLocaleString('fr-FR')} \u20AC` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Tooltip
      title={
        <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem', lineHeight: 1.5 }}>
          {tooltipContent}
        </Box>
      }
      arrow
      placement="top"
    >
      <Box
        sx={{
          position: 'absolute',
          top: topOffset,
          left: left,
          width: Math.max(width - 4, 16),
          height: barHeight - 4,
          backgroundColor: color,
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          px: 0.75,
          overflow: 'hidden',
          opacity: reservation.status === 'cancelled' ? 0.5 : 0.9,
          transition: 'opacity 0.15s, box-shadow 0.15s',
          '&:hover': {
            opacity: 1,
            boxShadow: `0 2px 8px ${color}60`,
            zIndex: 1,
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.6875rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: reservation.status === 'cancelled' ? 'line-through' : 'none',
          }}
        >
          {width > 60 ? reservation.guestName : reservation.guestName.split(' ')[0]}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// ─── InterventionBar Sub-component ──────────────────────────────────────────

interface InterventionBarProps {
  intervention: PlanningIntervention;
  days: Date[];
  rangeStart: Date;
  topOffset: number;
  barHeight: number;
  dayColWidth: number;
}

function InterventionBar({ intervention, days, rangeStart, topOffset, barHeight, dayColWidth }: InterventionBarProps) {
  const startDate = toDateOnly(intervention.startDate);
  const endDate = toDateOnly(intervention.endDate);

  const startOffset = daysBetween(rangeStart, startDate);
  const endOffset = daysBetween(rangeStart, endDate) + 1;

  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  const left = visibleStart * dayColWidth;
  const width = (visibleEnd - visibleStart) * dayColWidth;
  const color = INTERVENTION_TYPE_COLORS[intervention.type];
  const typeLabel = INTERVENTION_TYPE_LABELS[intervention.type];
  const statusLabel = INTERVENTION_STATUS_LABELS[intervention.status];

  const startStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const endStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const isSingleDay = intervention.startDate === intervention.endDate;

  const tooltipContent = [
    `${typeLabel} \xB7 ${statusLabel}`,
    intervention.title,
    `${intervention.assigneeName}`,
    isSingleDay ? startStr : `${startStr} \u2192 ${endStr}`,
    `~${intervention.estimatedDurationHours}h`,
    intervention.notes || '',
  ]
    .filter(Boolean)
    .join('\n');

  const isCompleted = intervention.status === 'completed';
  const isCancelled = intervention.status === 'cancelled';

  return (
    <Tooltip
      title={
        <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem', lineHeight: 1.5 }}>
          {tooltipContent}
        </Box>
      }
      arrow
      placement="bottom"
    >
      <Box
        sx={{
          position: 'absolute',
          top: topOffset,
          left: left,
          width: Math.max(width - 4, 16),
          height: barHeight - 4,
          backgroundColor: isCancelled ? '#9e9e9e' : color,
          borderRadius: '3px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          px: 0.5,
          overflow: 'hidden',
          opacity: isCompleted ? 0.55 : isCancelled ? 0.4 : 0.85,
          transition: 'opacity 0.15s, box-shadow 0.15s',
          backgroundImage: isCompleted
            ? `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 5px)`
            : 'none',
          '&:hover': {
            opacity: 1,
            boxShadow: `0 2px 6px ${color}50`,
            zIndex: 1,
          },
        }}
      >
        {width > 40 && (
          intervention.type === 'cleaning'
            ? <CleaningServices sx={{ fontSize: 11, color: '#fff', mr: 0.25, flexShrink: 0 }} />
            : <Build sx={{ fontSize: 11, color: '#fff', mr: 0.25, flexShrink: 0 }} />
        )}
        <Typography
          variant="caption"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.5625rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}
        >
          {width > 80 ? intervention.title : typeLabel}
        </Typography>
      </Box>
    </Tooltip>
  );
}
