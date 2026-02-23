import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  AutoAwesome,
  Handyman,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardPlanning } from '../../hooks/useDashboardPlanning';
import PlanningToolbar from './PlanningToolbar';
import type { ZoomLevel } from './PlanningToolbar';
import type { Reservation, ReservationStatus, ReservationSource, PlanningIntervention, PlanningInterventionType } from '../../services/api';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  INTERVENTION_TYPE_COLORS,
  INTERVENTION_TYPE_LABELS,
  INTERVENTION_STATUS_LABELS,
} from '../../services/api/reservationsApi';
import ThemedTooltip from '../../components/ThemedTooltip';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROPERTY_COL_WIDTH = 160;
const BAR_ROW_HEIGHT = 36;
const ROW_PADDING = 4;
const PROPERTIES_PER_PAGE = 8;
const GRADUATION_ROW_HEIGHT = 10;
// Puzzle jigsaw connector — vertical orientation (tab drops DOWN from reservation, notch cut into TOP of intervention)
const PUZZLE_TAB_DEPTH = 14;  // total depth of tab/notch protrusion (px)
const PUZZLE_NECK_HW = 3;     // half-width of the narrow neck (px)
const PUZZLE_KNOB_HW = 10;    // half-width of the round knob at widest point (px)
const PUZZLE_OVERLAP = 26;    // horizontal overlap between reservation end and intervention start (px)

// ─── Zoom system ─────────────────────────────────────────────────────────────

const HOUR_RANGE_START = 0;
const HOUR_RANGE_END = 24;
const TOTAL_HOURS = HOUR_RANGE_END - HOUR_RANGE_START; // 24

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; marks: number[]; label: string }> = {
  compact:  { dayWidth: 38,  marks: [], label: 'J' },
  standard: { dayWidth: 136, marks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], label: '1H' },
  detailed: { dayWidth: 260, marks: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5], label: '30m' },
};

// ─── Filter options ──────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'confirmed', label: 'Confirmees' },
  { value: 'pending', label: 'En attente' },
  { value: 'checked_in', label: 'Check-in' },
  { value: 'checked_out', label: 'Check-out' },
  { value: 'cancelled', label: 'Annulees' },
];

const INTERVENTION_FILTER_OPTIONS: { value: PlanningInterventionType | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'cleaning', label: 'Menage' },
  { value: 'maintenance', label: 'Maintenance' },
];

// ─── Stable sx objects (avoid re-creation on every render) ──────────────────

const SX_LOADING = { display: 'flex', justifyContent: 'center', py: 6 } as const;
const SX_ERROR = { mb: 2 } as const;
const SX_ROOT = { display: 'flex', flexDirection: 'column', height: '100%' } as const;
const SX_GRID_PAPER = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' } as const;
const SX_SCROLL_CONTAINER = { flex: 1, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' } as const;
const SX_MONTH_HEADER_ROW = { display: 'flex', backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' } as const;
const SX_MONTH_HEADER_SPACER = { width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, zIndex: 6, backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider' } as const;
const SX_GRAD_SPACER = { width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, zIndex: 4, backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', height: GRADUATION_ROW_HEIGHT } as const;
const SX_LOADING_MORE = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider', backgroundColor: 'action.hover', flexShrink: 0 } as const;
const SX_PAGINATION = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 0.5, px: 1.5, borderTop: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', flexShrink: 0 } as const;
const SX_PROPERTY_NAME = { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.primary', lineHeight: 1.3 } as const;
const SX_PROPERTY_OWNER = { fontSize: '0.5625rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'primary.main', lineHeight: 1.2, letterSpacing: '0.01em' } as const;
const SX_PROPERTY_CITY = { fontSize: '0.5625rem', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary', lineHeight: 1.2, letterSpacing: '0.02em' } as const;

// ─── Puzzle jigsaw clip-path generators ──────────────────────────────────────
// Vertical orientation: male tab drops DOWN from reservation bottom edge,
// female notch is cut into intervention TOP edge. Both use identical Bézier
// coefficients (vertical mirror) so they interlock perfectly.
//
// Tab shape: narrow neck (±PUZZLE_NECK_HW) widens into a round knob (±PUZZLE_KNOB_HW)
// using 4 cubic Bézier curves that form a smooth, organic mushroom/keyhole shape.

/** Male connector (reservation): rounded rectangle + jigsaw tab protruding DOWNWARD from bottom edge.
 *  Corners are rounded with R=14 arcs (top-left, top-right, bottom-left).
 *  @param w  visible bar width (px)
 *  @param h  visible bar height (px) — tab extends below h */
function buildMaleClipPath(w: number, h: number): string {
  const d = PUZZLE_TAB_DEPTH;
  const nk = PUZZLE_NECK_HW;
  const kb = PUZZLE_KNOB_HW;
  const cx = w - PUZZLE_OVERLAP / 2;
  const R = 14; // corner radius

  // Rounded top-left → top edge → rounded top-right → right edge → bottom to tab →
  // 4 Bézier tab curves → rest of bottom → rounded bottom-left → close
  return `path('M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${w - R} 0 A ${R} ${R} 0 0 1 ${w} ${R} L ${w} ${h} L ${cx + nk} ${h} C ${cx + nk} ${h + 4}, ${cx + kb} ${h + 4}, ${cx + kb} ${h + d * 0.5} C ${cx + kb} ${h + d - 3}, ${cx + 5} ${h + d}, ${cx} ${h + d} C ${cx - 5} ${h + d}, ${cx - kb} ${h + d - 3}, ${cx - kb} ${h + d * 0.5} C ${cx - kb} ${h + 4}, ${cx - nk} ${h + 4}, ${cx - nk} ${h} L ${R} ${h} A ${R} ${R} 0 0 1 0 ${h - R} Z')`;
}

/** Female connector (intervention): rectangle with jigsaw notch CARVED DOWN from top edge.
 *  The notch is a concave cutout — same mushroom shape as the male tab but
 *  subtracted from the bar instead of added. The clip-path traces the outline
 *  of the visible area: along the top edge, the path dips DOWN into the bar
 *  to form the notch, then comes back up. Uses identical Bézier offsets as male.
 *  @param w  total element width (px)
 *  @param h  element height (px) — notch occupies top PUZZLE_TAB_DEPTH pixels */
function buildFemaleClipPath(w: number, h: number): string {
  const d = PUZZLE_TAB_DEPTH;
  const nk = PUZZLE_NECK_HW;
  const kb = PUZZLE_KNOB_HW;
  const cx = PUZZLE_OVERLAP / 2;

  // Top-left → along top to left entry of notch → 4 Bézier curves going
  // DOWN into the bar (carving the notch) → back to top → rest of rectangle
  return `path('M 0 0 L ${cx - nk} 0 C ${cx - nk} 4, ${cx - kb} 4, ${cx - kb} ${d * 0.5} C ${cx - kb} ${d - 3}, ${cx - 5} ${d}, ${cx} ${d} C ${cx + 5} ${d}, ${cx + kb} ${d - 3}, ${cx + kb} ${d * 0.5} C ${cx + kb} 4, ${cx + nk} 4, ${cx + nk} 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z')`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
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

/** Returns pixel offset within a day cell for a given time string (HH:mm).
 *  Returns 0 in compact mode (dayColWidth <= 38). */
function getHourOffsetPx(timeStr: string | undefined, dayColWidth: number): number {
  if (!timeStr || dayColWidth <= 38) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  const hourDecimal = h + m / 60;
  const clamped = Math.max(HOUR_RANGE_START, Math.min(HOUR_RANGE_END, hourDecimal));
  return ((clamped - HOUR_RANGE_START) / TOTAL_HOURS) * dayColWidth;
}

const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Hook: ref callback for container ───────────────────────────────────────
// Simple ref callback — no ResizeObserver needed (width is not used)

function useContainerRef(): React.RefCallback<HTMLDivElement> {
  const refCallback = useCallback((node: HTMLDivElement | null) => {
    // Placeholder — only used as a ref for the container Paper.
    // No resize observation needed since the grid width is computed from days[].
    void node;
  }, []);
  return refCallback;
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
      seps.push({ month: m, year: y, label: `${MONTH_SHORT[m]} ${y}`, startIndex: i, count: 1 });
      currentMonth = m;
      currentYear = y;
    } else {
      seps[seps.length - 1].count++;
    }
  }
  return seps;
}

// ─── CSS gradient for hour tick marks (zero DOM overhead) ───────────────────

function buildHourTickGradient(zoomLevel: ZoomLevel, darkMode: boolean): string {
  const marks = ZOOM_CONFIG[zoomLevel].marks;
  if (marks.length === 0) return 'none';
  const stops = marks.map((h) => {
    const pct = ((h - HOUR_RANGE_START) / TOTAL_HOURS) * 100;
    const isHalfHour = !Number.isInteger(h);
    const color = h === 12
      ? 'rgba(25,118,210,0.18)'
      : isHalfHour
        ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')
        : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
    return `transparent calc(${pct}% - 0.5px), ${color} calc(${pct}% - 0.5px), ${color} calc(${pct}% + 0.5px), transparent calc(${pct}% + 0.5px)`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** CSS gradient for the graduation header row — stronger tick marks, zero DOM overhead */
function buildGraduationTickGradient(zoomLevel: ZoomLevel, darkMode: boolean, isToday: boolean): string {
  const marks = ZOOM_CONFIG[zoomLevel].marks;
  if (marks.length === 0) return 'none';
  const stops = marks.map((h) => {
    const pct = ((h - HOUR_RANGE_START) / TOTAL_HOURS) * 100;
    const isHalfHour = !Number.isInteger(h);
    const color = isToday
      ? (isHalfHour ? 'rgba(25,118,210,0.2)' : 'rgba(25,118,210,0.4)')
      : (h === 12
        ? 'rgba(25,118,210,0.25)'
        : isHalfHour
          ? (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
          : (darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'));
    return `transparent calc(${pct}% - 0.5px), ${color} calc(${pct}% - 0.5px), ${color} calc(${pct}% + 0.5px), transparent calc(${pct}% + 0.5px)`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DashboardPlanningProps {
  forfait?: string;
  zoomLevel: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
}

export default function DashboardPlanning({ forfait, zoomLevel, onZoomChange }: DashboardPlanningProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    properties,
    loading,
    loadingMore,
    error,
    currentDate,
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

  // Stable "today" that only changes when the calendar day changes
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date(), [todayKey]);

  // ─── Zoom level (controlled from parent) ─────────────────────────────────
  const dayColWidth = ZOOM_CONFIG[zoomLevel].dayWidth;
  const hourTickGradient = useMemo(() => buildHourTickGradient(zoomLevel, isDark), [zoomLevel, isDark]);
  const hasGraduation = ZOOM_CONFIG[zoomLevel].marks.length > 0;
  const graduationGradient = useMemo(() => buildGraduationTickGradient(zoomLevel, isDark, false), [zoomLevel, isDark]);
  const graduationGradientToday = useMemo(() => buildGraduationTickGradient(zoomLevel, isDark, true), [zoomLevel, isDark]);

  // ─── Pagination des proprietes ──────────────────────────────────────────
  const [propertyPage, setPropertyPage] = useState(0);
  const totalPropertyPages = Math.max(1, Math.ceil(properties.length / PROPERTIES_PER_PAGE));

  useEffect(() => {
    setPropertyPage(0);
  }, [properties.length]);

  const paginatedProperties = useMemo(() => {
    const start = propertyPage * PROPERTIES_PER_PAGE;
    return properties.slice(start, start + PROPERTIES_PER_PAGE);
  }, [properties, propertyPage]);

  // ─── Mois visible dynamique ──────────────────────────────────────────────
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);
  const [visibleMonthKey, setVisibleMonthKey] = useState('');

  // ─── Scroll horizontal vers aujourd'hui au montage (une seule fois) ─────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTodayRef = useRef(false);
  const daysRef = useRef(days);

  // Keep daysRef in sync — avoids recreating callbacks when days change
  useEffect(() => { daysRef.current = days; }, [days]);

  // One-shot scroll to today on initial load (and after goToday resets the flag)
  // IMPORTANT: `loading` is a dependency so the effect re-fires when loading transitions
  // from true→false. When loading=true, the component renders a spinner (not the scroll
  // container), so scrollContainerRef.current is null. Adding loading ensures we retry
  // once the grid DOM is actually rendered.
  useEffect(() => {
    if (loading || hasScrolledToTodayRef.current || days.length === 0) return;
    const timer = setTimeout(() => {
      if (!scrollContainerRef.current) return;
      const todayIndex = days.findIndex((d) => isSameDay(d, today));
      if (todayIndex >= 0) {
        // Positionner today au bord gauche (juste après la colonne logement)
        scrollContainerRef.current.scrollLeft = todayIndex * dayColWidth;
        hasScrolledToTodayRef.current = true;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [loading, days, today, dayColWidth]);

  // ─── Preservation du scroll lors du changement de zoom ──────────────────
  const prevDayColWidthRef = useRef(dayColWidth);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && prevDayColWidthRef.current !== dayColWidth && prevDayColWidthRef.current > 0) {
      // Trouver le jour actuellement centre
      const centerX = el.scrollLeft + el.clientWidth / 2 - PROPERTY_COL_WIDTH;
      const centerDayIndex = Math.floor(centerX / prevDayColWidthRef.current);
      // Re-scroller pour recentrer sur le meme jour
      const newScrollLeft = centerDayIndex * dayColWidth - el.clientWidth / 2 + PROPERTY_COL_WIDTH;
      el.scrollLeft = Math.max(0, newScrollLeft);
    }
    prevDayColWidthRef.current = dayColWidth;
  }, [dayColWidth]);

  // ─── Infinite scroll + detection du mois visible ────────────────────────
  // Uses daysRef to avoid recreating this callback when days array grows (extendRange)
  const computeVisibleMonth = useCallback(() => {
    const el = scrollContainerRef.current;
    const currentDays = daysRef.current;
    if (!el || currentDays.length === 0) return;

    const visibleX = el.scrollLeft + el.clientWidth * 0.33 - PROPERTY_COL_WIDTH;
    const dayIndex = Math.floor(Math.max(0, visibleX) / dayColWidth);
    const clampedIndex = Math.min(dayIndex, currentDays.length - 1);
    const visibleDay = currentDays[clampedIndex];
    if (visibleDay) {
      const key = `${visibleDay.getFullYear()}-${String(visibleDay.getMonth() + 1).padStart(2, '0')}`;
      // Only update state if month actually changed — avoids unnecessary re-renders during scroll
      setVisibleMonthKey((prev) => prev === key ? prev : key);
      setVisibleMonth((prev) => {
        if (prev && prev.getFullYear() === visibleDay.getFullYear() && prev.getMonth() === visibleDay.getMonth()) {
          return prev;
        }
        return new Date(visibleDay.getFullYear(), visibleDay.getMonth(), 1);
      });
    }
  }, [dayColWidth]);

  // Debounce ref for extend range — prevents multiple rapid calls during fast scroll
  const extendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGridScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Always update visible month immediately (cheap operation)
    computeVisibleMonth();

    // Debounce the extendRange check to avoid rapid-fire calls
    if (extendDebounceRef.current) {
      clearTimeout(extendDebounceRef.current);
    }
    extendDebounceRef.current = setTimeout(() => {
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) return;
      const threshold = scrollEl.scrollWidth * 0.8;
      if (scrollEl.scrollLeft + scrollEl.clientWidth >= threshold) {
        extendRange();
      }
    }, 300);
  }, [extendRange, computeVisibleMonth]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (extendDebounceRef.current) clearTimeout(extendDebounceRef.current);
    };
  }, []);

  // Initial visible month detection after data loads
  useEffect(() => {
    if (daysRef.current.length > 0) {
      const timer = setTimeout(computeVisibleMonth, 200);
      return () => clearTimeout(timer);
    }
  }, [computeVisibleMonth]);

  // ─── Convertir le scroll vertical en horizontal ─────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
      handleGridScroll();
    }
  }, [handleGridScroll]);

  // ─── Ref pour le container ──────────────────────────────────────────────
  const containerRef = useContainerRef();

  const gridWidth = PROPERTY_COL_WIDTH + days.length * dayColWidth;
  const monthSeparators = useMemo(() => computeMonthSeparators(days), [days]);

  // ─── Go-today handler (combines ref reset + navigation) ──────────────────
  const handleGoToday = useCallback(() => {
    hasScrolledToTodayRef.current = false;
    goToday();
  }, [goToday]);

  // ─── Group data by property ─────────────────────────────────────────────
  const reservationsByProperty = useMemo(() => {
    const map = new Map<number, Reservation[]>();
    filteredReservations.forEach((r) => {
      const list = map.get(r.propertyId) || [];
      list.push(r);
      map.set(r.propertyId, list);
    });
    return map;
  }, [filteredReservations]);

  const interventionsByProperty = useMemo(() => {
    const map = new Map<number, PlanningIntervention[]>();
    filteredInterventions.forEach((i) => {
      const list = map.get(i.propertyId) || [];
      list.push(i);
      map.set(i.propertyId, list);
    });
    return map;
  }, [filteredInterventions]);

  const totalRowHeight = BAR_ROW_HEIGHT + ROW_PADDING * 2
    + (showInterventions ? BAR_ROW_HEIGHT + ROW_PADDING + PUZZLE_TAB_DEPTH : 0);

  // ─── Stats filtrees par mois visible ────────────────────────────────────
  const visibleReservationCount = useMemo(() => {
    if (!visibleMonthKey) return filteredReservations.length;
    const [y, m] = visibleMonthKey.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return filteredReservations.filter(r => r.checkOut >= monthStart && r.checkIn <= monthEnd).length;
  }, [visibleMonthKey, filteredReservations]);

  const visibleInterventionCount = useMemo(() => {
    if (!visibleMonthKey) return filteredInterventions.length;
    const [y, m] = visibleMonthKey.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return filteredInterventions.filter(i => i.endDate >= monthStart && i.startDate <= monthEnd).length;
  }, [visibleMonthKey, filteredInterventions]);

  // ─── Title ──────────────────────────────────────────────────────────────
  const titleDate = visibleMonth ? visibleMonth : currentDate;
  const titleText = formatMonth(titleDate);

  // ─── Loading / Error ────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={SX_LOADING}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={SX_ERROR}>{error}</Alert>;
  }

  return (
    <Box sx={SX_ROOT}>
      {/* ─── Toolbar ─────────────────────────────────────────────────────── */}
      <PlanningToolbar
        onGoPrev={goPrev}
        onGoToday={handleGoToday}
        onGoNext={goNext}
        titleText={titleText}
        showInterventions={showInterventions}
        onShowInterventionsChange={setShowInterventions}
        interventionTypeFilter={interventionTypeFilter}
        onInterventionTypeFilterChange={setInterventionTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterOptions={STATUS_FILTER_OPTIONS}
        interventionFilterOptions={INTERVENTION_FILTER_OPTIONS}
      />

      {/* ─── Grid content ───────────────────────────────────────────────── */}
      {properties.length === 0 ? (
        forfait?.toLowerCase() === 'essentiel' ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderLeft: '4px solid', borderColor: 'primary.main', borderRadius: '12px' }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(107,138,154,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <LockIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              {t('dashboard.planning.lockedTitle')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: 480, mx: 'auto' }}>
              {t('dashboard.planning.lockedDescription')}
            </Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Home sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              {t('dashboard.planning.noProperties') || 'Aucun logement a afficher'}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              {t('dashboard.planning.noPropertiesHint') || "Les logements apparaitront ici une fois qu'ils seront crees et assignes."}
            </Typography>
          </Paper>
        )
      ) : (
        <Paper
          ref={containerRef}
          sx={SX_GRID_PAPER}
        >
          {/* Scrollable grid area */}
          <Box
            ref={scrollContainerRef}
            onScroll={handleGridScroll}
            onWheel={handleWheel}
            sx={SX_SCROLL_CONTAINER}
          >
            <Box sx={{ width: gridWidth, position: 'relative' }}>

              {/* ─── Month header row ──────────────────────────────────── */}
              {monthSeparators.length > 1 && (
                <Box sx={SX_MONTH_HEADER_ROW}>
                  <Box sx={SX_MONTH_HEADER_SPACER} />
                  {monthSeparators.map((sep) => (
                    <Box key={`${sep.year}-${sep.month}`} sx={{ width: sep.count * dayColWidth, textAlign: 'center', py: 0.25, borderRight: '2px solid', borderColor: 'primary.light', backgroundColor: 'background.paper' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'primary.main',
                        }}
                      >
                        {sep.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* ─── Header row (days — nom + numéro uniquement) ──────── */}
              <Box
                sx={{
                  display: 'flex',
                  backgroundColor: 'background.paper',
                  borderBottom: hasGraduation ? '1px solid' : '2px solid',
                  borderColor: 'divider',
                }}
              >
                {/* Property column header */}
                <Box
                  sx={{
                    width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0,
                    px: 1.5, py: 0.5, position: 'sticky', left: 0, zIndex: 4,
                    backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'text.secondary',
                    }}
                  >
                    {t('dashboard.planning.property') || 'Logement'}
                  </Typography>
                </Box>

                {/* Day columns — seulement nom + numéro */}
                {days.map((day, idx) => {
                  const isToday = isSameDay(day, today);
                  const isPast = day < today && !isToday;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isFirstOfMonth = day.getDate() === 1 && idx > 0;

                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        width: dayColWidth, minWidth: dayColWidth, textAlign: 'center',
                        py: 0.4,
                        borderRight: '1px solid',
                        borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                        borderRightWidth: isFirstOfMonth ? 2 : 1,
                        backgroundColor: isToday ? 'primary.main' : isPast ? (isDark ? theme.palette.grey[200] : '#e8e8e8') : isWeekend ? 'action.hover' : 'background.paper',
                        opacity: isPast ? 0.6 : 1,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.5625rem',
                          fontWeight: isToday ? 700 : 500,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          color: isToday ? 'primary.contrastText' : isPast ? 'text.disabled' : 'text.secondary',
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
                          fontWeight: isToday ? 700 : 600,
                          letterSpacing: '-0.02em',
                          color: isToday ? 'primary.contrastText' : isPast ? 'text.disabled' : 'text.primary',
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

              {/* ─── Graduation row (heures / minutes — rangée séparée) ─ */}
              {hasGraduation && (
                <Box
                  sx={{
                    display: 'flex',
                    backgroundColor: 'background.paper',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Property column spacer */}
                  <Box sx={SX_GRAD_SPACER} />

                  {/* Graduation tick marks per day — CSS gradient, zero DOM per tick */}
                  {days.map((day, idx) => {
                    const isToday = isSameDay(day, today);
                    const isPast = day < today && !isToday;
                    const isFirstOfMonth = day.getDate() === 1 && idx > 0;

                    return (
                      <Box
                        key={`grad-${day.toISOString()}`}
                        sx={{
                          width: dayColWidth, minWidth: dayColWidth,
                          height: GRADUATION_ROW_HEIGHT,
                          borderRight: '1px solid',
                          borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                          borderRightWidth: isFirstOfMonth ? 2 : 1,
                          backgroundColor: isToday
                            ? 'rgba(25,118,210,0.08)'
                            : isPast
                              ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
                              : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                          opacity: isPast ? 0.5 : 1,
                          backgroundImage: isToday ? graduationGradientToday : graduationGradient,
                        }}
                      />
                    );
                  })}
                </Box>
              )}

              {/* ─── Property rows (paginated) ──────────────────────── */}
              {paginatedProperties.map((property, rowIndex) => {
                const propertyReservations = reservationsByProperty.get(property.id) || [];
                const propertyInterventions = interventionsByProperty.get(property.id) || [];

                // Build lookup maps for linked interventions
                const reservationMap = new Map<number, Reservation>();
                for (const r of propertyReservations) reservationMap.set(r.id, r);

                const linkedReservationIds = new Set<number>();
                const linkedInterventions: PlanningIntervention[] = [];
                const standaloneInterventions: PlanningIntervention[] = [];

                for (const intervention of propertyInterventions) {
                  if (intervention.linkedReservationId && reservationMap.has(intervention.linkedReservationId)) {
                    linkedInterventions.push(intervention);
                    linkedReservationIds.add(intervention.linkedReservationId);
                  } else {
                    standaloneInterventions.push(intervention);
                  }
                }

                const rowBg = rowIndex % 2 === 0
                  ? theme.palette.background.paper
                  : (isDark ? theme.palette.grey[200] : '#f5f5f5');

                return (
                  <Box
                    key={property.id}
                    sx={{
                      display: 'flex', position: 'relative', height: totalRowHeight,
                      borderBottom: '1px solid', borderColor: 'divider', backgroundColor: rowBg,
                      '&:hover': { backgroundColor: isDark ? theme.palette.grey[300] : '#ebebeb' },
                      '&:hover > .sticky-property-cell': { backgroundColor: isDark ? theme.palette.grey[300] : '#ebebeb' },
                    }}
                  >
                    {/* Property name cell */}
                    <Box
                      className="sticky-property-cell"
                      sx={{
                        width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0, px: 1.5,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        position: 'sticky', left: 0, zIndex: 2, backgroundColor: rowBg,
                        borderRight: '1px solid', borderColor: 'divider', boxShadow: isDark ? '2px 0 4px rgba(0,0,0,0.3)' : '2px 0 4px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} sx={SX_PROPERTY_NAME}>
                        {property.name}
                      </Typography>
                      {property.ownerName && (
                        <Typography variant="caption" sx={SX_PROPERTY_OWNER}>
                          {property.ownerName}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={SX_PROPERTY_CITY}>
                        {property.city || property.address}
                      </Typography>
                    </Box>

                    {/* Day cells background + bars */}
                    <Box sx={{ display: 'flex', position: 'relative', flex: 1 }}>
                      {days.map((day, idx) => {
                        const isToday = isSameDay(day, today);
                        const isPast = day < today && !isToday;
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const isFirstOfMonth = day.getDate() === 1 && idx > 0;

                        return (
                          <Box
                            key={day.toISOString()}
                            sx={{
                              width: dayColWidth, minWidth: dayColWidth, height: '100%',
                              borderRight: '1px solid',
                              borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                              borderRightWidth: isFirstOfMonth ? 2 : 1,
                              backgroundColor: isPast
                                ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')
                                : isToday
                                  ? 'rgba(25, 118, 210, 0.06)'
                                  : isWeekend
                                    ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                                    : 'transparent',
                              backgroundImage: isPast ? 'none' : hourTickGradient,
                            }}
                          />
                        );
                      })}

                      {/* Reservation bars */}
                      {propertyReservations.map((reservation) => (
                        <MemoizedReservationBar
                          key={`res-${reservation.id}`}
                          reservation={reservation}
                          days={days}
                          rangeStart={dateRange.start}
                          today={today}
                          topOffset={ROW_PADDING}
                          barHeight={BAR_ROW_HEIGHT}
                          dayColWidth={dayColWidth}
                          zoomLevel={zoomLevel}
                          hasLinkedIntervention={linkedReservationIds.has(reservation.id)}
                        />
                      ))}

                      {/* Linked intervention bars (positioned at checkout of their reservation) */}
                      {showInterventions && linkedInterventions.map((intervention) => (
                        <MemoizedInterventionBar
                          key={`int-${intervention.id}`}
                          intervention={intervention}
                          days={days}
                          rangeStart={dateRange.start}
                          topOffset={ROW_PADDING + BAR_ROW_HEIGHT - 4 + PUZZLE_TAB_DEPTH}
                          barHeight={BAR_ROW_HEIGHT}
                          dayColWidth={dayColWidth}
                          zoomLevel={zoomLevel}
                          linkedReservation={reservationMap.get(intervention.linkedReservationId!)}
                          today={today}
                        />
                      ))}

                      {/* Standalone intervention bars (current behavior) */}
                      {showInterventions && standaloneInterventions.map((intervention) => (
                        <MemoizedInterventionBar
                          key={`int-${intervention.id}`}
                          intervention={intervention}
                          days={days}
                          rangeStart={dateRange.start}
                          topOffset={ROW_PADDING + BAR_ROW_HEIGHT + ROW_PADDING}
                          barHeight={BAR_ROW_HEIGHT}
                          dayColWidth={dayColWidth}
                          zoomLevel={zoomLevel}
                        />
                      ))}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Loading indicator */}
          {loadingMore && (
            <Box sx={SX_LOADING_MORE}>
              <CircularProgress size={12} />
              <Typography variant="caption" sx={{ fontSize: '0.5625rem', fontWeight: 500, color: 'text.secondary', letterSpacing: '0.02em' }}>
                {t('dashboard.planning.loadingMore')}
              </Typography>
            </Box>
          )}

          {/* Barre inférieure : Légende | Pagination | Stats */}
          <Box sx={SX_PAGINATION}>
            {/* Légende — gauche */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'flex-start' }}>
              {/* Réservations */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {t('dashboard.planning.legendReservations') || 'Réservations :'}
                </Typography>
                {STATUS_FILTER_OPTIONS.filter((s) => s.value !== 'all').map((opt) => (
                  <Box key={opt.value} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, backgroundColor: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus] }} />
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.5625rem',
                        fontWeight: 500,
                        color: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus],
                        letterSpacing: '0.01em',
                      }}
                    >
                      {opt.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {/* Interventions */}
              {showInterventions && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {t('dashboard.planning.legendInterventions') || 'Interventions :'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <AutoAwesome sx={{ fontSize: 9, color: INTERVENTION_TYPE_COLORS.cleaning }} />
                    <Typography variant="caption" sx={{ fontSize: '0.5625rem', fontWeight: 500, color: INTERVENTION_TYPE_COLORS.cleaning, letterSpacing: '0.01em' }}>
                      {INTERVENTION_TYPE_LABELS.cleaning}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Handyman sx={{ fontSize: 9, color: INTERVENTION_TYPE_COLORS.maintenance }} />
                    <Typography variant="caption" sx={{ fontSize: '0.5625rem', fontWeight: 500, color: INTERVENTION_TYPE_COLORS.maintenance, letterSpacing: '0.01em' }}>
                      {INTERVENTION_TYPE_LABELS.maintenance}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Pagination — centre */}
            {totalPropertyPages > 1 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton size="small" onClick={() => setPropertyPage((p) => Math.max(0, p - 1))} disabled={propertyPage === 0} sx={{ width: 24, height: 24 }}>
                  <ChevronLeft sx={{ fontSize: 16 }} />
                </IconButton>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    letterSpacing: '0.01em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {propertyPage * PROPERTIES_PER_PAGE + 1}–{Math.min((propertyPage + 1) * PROPERTIES_PER_PAGE, properties.length)} / {properties.length}
                </Typography>
                <IconButton size="small" onClick={() => setPropertyPage((p) => Math.min(totalPropertyPages - 1, p + 1))} disabled={propertyPage >= totalPropertyPages - 1} sx={{ width: 24, height: 24 }}>
                  <ChevronRight sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ) : (
              <Box />
            )}

            {/* Stats — droite */}
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.5625rem',
                fontWeight: 500,
                color: 'text.secondary',
                textAlign: 'right',
                letterSpacing: '0.01em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {visibleReservationCount} {t('dashboard.planning.reservations') || 'resa'}
              {showInterventions && <> &middot; {visibleInterventionCount} {t('dashboard.planning.interventionCount') || 'inter.'}</>}
              {' \u00B7 '}
              {properties.length} {t('dashboard.planning.properties') || 'logement'}{properties.length > 1 ? 's' : ''}
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

// ─── Source Logos ─────────────────────────────────────────────────────────────

import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.png';
import bookingLogoSmall from '../../assets/logo/logo-booking-planning.png';
import clenzyLogo from '../../assets/logo/clenzy-logo.png';
import homeAwayLogo from '../../assets/logo/HomeAway-logo.png';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import leboncoinLogo from '../../assets/logo/Leboncoin-logo.png';

const SOURCE_LOGOS: Record<string, string> = {
  airbnb: airbnbLogoSmall,
  booking: bookingLogoSmall,
  direct: clenzyLogo,
  homeaway: homeAwayLogo,
  expedia: expediaLogo,
  leboncoin: leboncoinLogo,
};

function SourceLogo({ source, size = 16 }: { source: ReservationSource; size?: number }) {
  const logo = SOURCE_LOGOS[source];
  const imgSize = size * 0.7;

  return (
    <Box
      sx={{
        width: size, height: size, minWidth: size, borderRadius: '50%',
        backgroundColor: 'transparent', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}
    >
      {logo ? (
        <img
          src={logo}
          alt={source}
          width={imgSize}
          height={imgSize}
          style={{ objectFit: 'contain', borderRadius: '50%' }}
        />
      ) : (
        <Typography sx={{ fontSize: size * 0.5, fontWeight: 700, color: '#9e9e9e', lineHeight: 1 }}>
          ?
        </Typography>
      )}
    </Box>
  );
}

// ─── ReservationBar Sub-component ────────────────────────────────────────────

interface ReservationBarProps {
  reservation: Reservation;
  days: Date[];
  rangeStart: Date;
  today: Date;
  topOffset: number;
  barHeight: number;
  dayColWidth: number;
  zoomLevel: ZoomLevel;
  hasLinkedIntervention?: boolean;
}

function ReservationBar({ reservation, days, rangeStart, today: todayOnly, topOffset, barHeight, dayColWidth, zoomLevel, hasLinkedIntervention }: ReservationBarProps) {
  const checkIn = toDateOnly(reservation.checkIn);
  const checkOut = toDateOnly(reservation.checkOut);

  const startOffset = daysBetween(rangeStart, checkIn);
  const endOffset = daysBetween(rangeStart, checkOut);

  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  // Hour-level adjustments
  const checkInHourOffset = (startOffset >= 0 && zoomLevel !== 'compact')
    ? getHourOffsetPx(reservation.checkInTime, dayColWidth)
    : 0;
  const checkOutHourOffset = (endOffset <= days.length && zoomLevel !== 'compact')
    ? getHourOffsetPx(reservation.checkOutTime, dayColWidth)
    : 0;

  const left = visibleStart * dayColWidth + checkInHourOffset;
  const right = visibleEnd * dayColWidth + checkOutHourOffset;
  const width = right - left;

  // ─── Statut effectif basé sur la date du jour ─────────────────────────────
  // Si annulé/en attente, on garde le statut brut.
  // Sinon on calcule en fonction de checkIn/checkOut vs aujourd'hui.
  const effectiveStatus: ReservationStatus = (() => {
    if (reservation.status === 'cancelled' || reservation.status === 'pending') {
      return reservation.status;
    }
    if (todayOnly > checkOut) return 'checked_out';
    if (todayOnly >= checkIn && todayOnly <= checkOut) return 'checked_in';
    return reservation.status; // futur → confirmed
  })();

  const color = RESERVATION_STATUS_COLORS[effectiveStatus];
  const statusLabel = RESERVATION_STATUS_LABELS[effectiveStatus];
  const nights = daysBetween(checkIn, checkOut);
  const checkInStr = checkIn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const checkOutStr = checkOut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const tooltipContent = [
    `${reservation.guestName} (${reservation.guestCount} pers.)`,
    `${checkInStr}${reservation.checkInTime ? ' ' + reservation.checkInTime : ''} \u2192 ${checkOutStr}${reservation.checkOutTime ? ' ' + reservation.checkOutTime : ''} (${nights} nuit${nights > 1 ? 's' : ''})`,
    `${statusLabel} \xB7 ${reservation.source.charAt(0).toUpperCase() + reservation.source.slice(1)}`,
    reservation.totalPrice > 0 ? `${reservation.totalPrice.toLocaleString('fr-FR')} €` : '',
  ].filter(Boolean).join('\n');

  return (
    <ThemedTooltip title={<Box sx={{ whiteSpace: 'pre-line', fontSize: '0.6875rem', lineHeight: 1.5, letterSpacing: '0.01em' }}>{tooltipContent}</Box>} arrow placement="top">
      <Box
        sx={{
          position: 'absolute', top: topOffset, left: left,
          width: hasLinkedIntervention ? Math.max(width, 16) : Math.max(width - 4, 16),
          height: (barHeight - 4) + (hasLinkedIntervention ? PUZZLE_TAB_DEPTH : 0),
          backgroundColor: color,
          borderRadius: '14px',
          clipPath: hasLinkedIntervention ? buildMaleClipPath(Math.max(width, 16), barHeight - 4) : 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 0.5, px: 1,
          pb: hasLinkedIntervention ? `${PUZZLE_TAB_DEPTH}px` : 0,
          overflow: 'visible',
          opacity: effectiveStatus === 'cancelled' ? 0.5 : effectiveStatus === 'checked_out' ? 0.55 : 0.9,
          backgroundImage: effectiveStatus === 'checked_out'
            ? `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 5px)`
            : 'none',
          transition: 'opacity 0.15s, box-shadow 0.15s',
          '&:hover': { opacity: 1, boxShadow: hasLinkedIntervention ? 'none' : `0 2px 8px ${color}60`, zIndex: 1 },
        }}
      >
        <SourceLogo source={reservation.source} size={barHeight - 12} />
        <Typography
          variant="caption"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.8125rem',
            letterSpacing: '0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: effectiveStatus === 'cancelled' ? 'line-through' : 'none',
          }}
        >
          {width > 60 ? reservation.guestName : reservation.guestName.split(' ')[0]}
        </Typography>
      </Box>
    </ThemedTooltip>
  );
}

const MemoizedReservationBar = React.memo(ReservationBar, (prev, next) => {
  return prev.reservation.id === next.reservation.id
    && prev.dayColWidth === next.dayColWidth
    && prev.zoomLevel === next.zoomLevel
    && prev.topOffset === next.topOffset
    && prev.hasLinkedIntervention === next.hasLinkedIntervention
    && prev.days.length === next.days.length
    && prev.rangeStart.getTime() === next.rangeStart.getTime()
    && prev.today.getTime() === next.today.getTime();
});

// ─── InterventionBar Sub-component ──────────────────────────────────────────

interface InterventionBarProps {
  intervention: PlanningIntervention;
  days: Date[];
  rangeStart: Date;
  topOffset: number;
  barHeight: number;
  dayColWidth: number;
  zoomLevel: ZoomLevel;
  linkedReservation?: Reservation;
  today?: Date;
}

function InterventionBar({ intervention, days, rangeStart, topOffset, barHeight, dayColWidth, zoomLevel, linkedReservation, today: todayProp }: InterventionBarProps) {
  const startDate = toDateOnly(intervention.startDate);
  const endDate = toDateOnly(intervention.endDate);
  const isLinked = !!linkedReservation;

  const startOffset = daysBetween(rangeStart, startDate);
  const endOffset = daysBetween(rangeStart, endDate) + 1;

  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  // For linked interventions: position at the checkout point of the reservation
  let left: number;
  if (isLinked) {
    const checkOut = toDateOnly(linkedReservation.checkOut);
    const checkOutOffset = daysBetween(rangeStart, checkOut);
    const checkOutHourOffset = (checkOutOffset <= days.length && zoomLevel !== 'compact')
      ? getHourOffsetPx(linkedReservation.checkOutTime, dayColWidth)
      : 0;
    // Overlap intervention with reservation so the jigsaw connectors interlock
    left = checkOutOffset * dayColWidth + checkOutHourOffset - PUZZLE_OVERLAP;
  } else {
    const startHourOffset = (startOffset >= 0 && zoomLevel !== 'compact')
      ? getHourOffsetPx(intervention.startTime, dayColWidth)
      : 0;
    left = visibleStart * dayColWidth + startHourOffset;
  }

  // Width adapts to label length — icon (11px) + gap (4px) + text + padding (16px)
  // ~5.5px per character at 0.5625rem font-size (Inter 600)
  const ICON_AND_PAD = 11 + 4 + 16;
  const CHAR_WIDTH = 5.5;
  const textWidth = intervention.title.length * CHAR_WIDTH;
  const width = Math.max(ICON_AND_PAD + textWidth, 60);

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
    isSingleDay
      ? `${startStr}${intervention.startTime ? ' ' + intervention.startTime : ''}${intervention.endTime ? ' \u2192 ' + intervention.endTime : ''}`
      : `${startStr} \u2192 ${endStr}`,
    `~${intervention.estimatedDurationHours}h`,
    intervention.notes || '',
  ].filter(Boolean).join('\n');

  const isCompleted = intervention.status === 'completed';
  const isCancelled = intervention.status === 'cancelled';
  const effectiveColor = isCancelled ? '#9e9e9e' : color;

  return (
    <ThemedTooltip title={<Box sx={{ whiteSpace: 'pre-line', fontSize: '0.6875rem', lineHeight: 1.5, letterSpacing: '0.01em' }}>{tooltipContent}</Box>} arrow placement="bottom">
      <Box
        sx={{
          position: 'absolute', top: isLinked ? topOffset - PUZZLE_TAB_DEPTH : topOffset, left: left,
          width: width + (isLinked ? PUZZLE_OVERLAP : 0), height: barHeight - 4,
          backgroundColor: effectiveColor,
          borderRadius: isLinked ? '0 14px 14px 14px' : '14px',
          clipPath: isLinked ? buildFemaleClipPath(width + PUZZLE_OVERLAP, barHeight - 4) : 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          pl: isLinked ? `${PUZZLE_OVERLAP}px` : 1, pr: 1, gap: 0.5,
          opacity: isCompleted ? 0.55 : isCancelled ? 0.4 : 0.85,
          transition: 'opacity 0.15s, box-shadow 0.15s',
          backgroundImage: isCompleted
            ? `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 5px)`
            : 'none',
          '&:hover': { opacity: 1, boxShadow: isLinked ? 'none' : `0 2px 6px ${color}50`, zIndex: 1 },
        }}
      >
        {intervention.type === 'cleaning'
          ? <AutoAwesome sx={{ fontSize: 14, color: '#fff', flexShrink: 0 }} />
          : <Handyman sx={{ fontSize: 14, color: '#fff', flexShrink: 0 }} />
        }
        <Typography
          variant="caption"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}
        >
          {typeLabel}
        </Typography>
      </Box>
    </ThemedTooltip>
  );
}

const MemoizedInterventionBar = React.memo(InterventionBar, (prev, next) => {
  return prev.intervention.id === next.intervention.id
    && prev.dayColWidth === next.dayColWidth
    && prev.zoomLevel === next.zoomLevel
    && prev.topOffset === next.topOffset
    && prev.days.length === next.days.length
    && prev.rangeStart.getTime() === next.rangeStart.getTime()
    && prev.linkedReservation?.id === next.linkedReservation?.id;
});
