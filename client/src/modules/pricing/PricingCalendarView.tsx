import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  CircularProgress,
} from '@mui/material';
import { ChevronLeft as ChevronLeftIcon } from '../../icons';
import { ChevronRight as ChevronRightIcon } from '../../icons';
import { CalendarMonth as CalendarMonthIcon, NightsStay } from '../../icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api';
import type { CalendarPricingDay } from '../../services/api/calendarPricingApi';
import { minNightsKeys } from '../planning/hooks/usePlanningMinNights';
import EmptyState from '../../components/EmptyState';
import PricingEditDialog from './PricingEditDialog';
import MinNightsEditDialog from './MinNightsEditDialog';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: 1.5,
} as const;

const SOURCE_COLORS: Record<string, string> = {
  OVERRIDE: '#D98E8E',
  PROMOTIONAL: '#BA68C8',
  SEASONAL: '#E0B483',
  LAST_MINUTE: '#8DB6D4',
  BASE: '#5CB8AA',
  PROPERTY_DEFAULT: '#8BA0B3',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingCalendarViewProps {
  selectedPropertyId: number | null;
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  calendarPricing: CalendarPricingDay[];
  calendarPricingLoading: boolean;
  onUpdatePrice: (data: { propertyId: number; from: string; to: string; nightlyPrice: number; source?: string }) => Promise<void>;
  updatePriceLoading: boolean;
  currency?: string;
}

// ─── Calendar Helpers ───────────────────────────────────────────────────────

interface CalendarCell {
  date: Date;
  dateStr: string;
  inMonth: boolean;
}

function buildCalendarGrid(month: Date): CalendarCell[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: CalendarCell[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, m, -i);
    cells.push({ date: d, dateStr: toISO(d), inMonth: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, m, day);
    cells.push({ date: d, dateStr: toISO(d), inMonth: true });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, m + 1, i);
      cells.push({ date: d, dateStr: toISO(d), inMonth: false });
    }
  }

  return cells;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonth(date: Date, isFrench: boolean): string {
  return date.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

const PricingCalendarView: React.FC<PricingCalendarViewProps> = ({
  selectedPropertyId,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  calendarPricing,
  calendarPricingLoading,
  onUpdatePrice,
  updatePriceLoading,
  currency = 'EUR',
}) => {
  const { t, isFrench } = useTranslation();

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [minNightsDialogOpen, setMinNightsDialogOpen] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const queryClient = useQueryClient();

  // Mutation pour creer un override min-nights en lot sur les dates selectionnees.
  // Apres succes, invalide le cache du planning pour refresh des badges 🌙.
  const minNightsMutation = useMutation({
    mutationFn: async (minNights: number) => {
      if (!selectedPropertyId || selectedDates.length === 0) return;
      const sorted = [...selectedDates].sort();
      // L'API attend une plage [from, to) ouverte a droite → on ajoute 1 jour a `to`
      const lastDate = new Date(sorted[sorted.length - 1]);
      lastDate.setDate(lastDate.getDate() + 1);
      const toExclusive = lastDate.toISOString().slice(0, 10);
      await calendarPricingApi.createMinNightsOverrideBulk({
        propertyId: selectedPropertyId,
        from: sorted[0],
        to: toExclusive,
        minNights,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: minNightsKeys.all });
      setSelectedDates([]);
    },
  });

  const calendarCells = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth]);
  const todayISO = useMemo(() => toISO(new Date()), []);

  const pricingMap = useMemo(() => {
    const map = new Map<string, CalendarPricingDay>();
    for (const day of calendarPricing) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarPricing]);

  const dayHeaders = useMemo(
    () =>
      isFrench
        ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    [isFrench],
  );

  // Plage inclusive entre deux dates du mois affiché (ordre visuel du calendrier).
  const rangeBetween = useCallback(
    (anchor: string, target: string): string[] => {
      const allDates = calendarCells.flatMap((c) => (c.inMonth ? [c.dateStr] : []));
      const a = allDates.indexOf(anchor);
      const b = allDates.indexOf(target);
      if (a < 0 || b < 0) return [target];
      return allDates.slice(Math.min(a, b), Math.max(a, b) + 1);
    },
    [calendarCells],
  );

  // Début de sélection : simple clic = 1 date + ancre + démarre le glisser ;
  // Maj+clic = étend depuis l'ancre existante (raccourci conservé).
  const handleCellMouseDown = useCallback(
    (dateStr: string, event: React.MouseEvent) => {
      if (!selectedPropertyId) return;
      if (event.shiftKey && selectionAnchor) {
        setSelectedDates(rangeBetween(selectionAnchor, dateStr));
        return;
      }
      setSelectionAnchor(dateStr);
      setSelectedDates([dateStr]);
      setIsDragging(true);
    },
    [selectedPropertyId, selectionAnchor, rangeBetween],
  );

  // Survol pendant le glisser : étend la plage depuis l'ancre → sélection de plage
  // « cliquer-glisser » sans passer par le formulaire de droite.
  const handleCellMouseEnter = useCallback(
    (dateStr: string) => {
      if (!isDragging || !selectionAnchor) return;
      setSelectedDates(rangeBetween(selectionAnchor, dateStr));
    },
    [isDragging, selectionAnchor, rangeBetween],
  );

  // Fin du glisser, où que le curseur soit relâché.
  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isDragging]);

  const handleApplyPrice = useCallback(
    async (price: number) => {
      if (!selectedPropertyId || selectedDates.length === 0) return;
      const sorted = [...selectedDates].sort();
      // L'API attend une plage [from, to) ouverte a droite → on ajoute 1 jour a `to`
      const lastDate = new Date(sorted[sorted.length - 1]);
      lastDate.setDate(lastDate.getDate() + 1);
      const toExclusive = lastDate.toISOString().slice(0, 10);
      await onUpdatePrice({
        propertyId: selectedPropertyId,
        from: sorted[0],
        to: toExclusive,
        nightlyPrice: price,
      });
      setSelectedDates([]);
    },
    [selectedPropertyId, selectedDates, onUpdatePrice],
  );

  const handleApplyMinNights = useCallback(
    async (minNights: number) => {
      await minNightsMutation.mutateAsync(minNights);
    },
    [minNightsMutation],
  );

  const getSourceColor = (source: string): string => SOURCE_COLORS[source] ?? '#8BA0B3';

  const selectedDatesSet = new Set(selectedDates);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
      {/* ── Month navigation ── */}
      <Paper sx={CARD_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton onClick={onPrevMonth} size="small">
            <ChevronLeftIcon size={20} strokeWidth={1.75} />
          </IconButton>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ minWidth: 140, textAlign: 'center', textTransform: 'capitalize', fontSize: '0.8125rem' }}
          >
            {formatMonth(currentMonth, isFrench)}
          </Typography>
          <IconButton onClick={onNextMonth} size="small">
            <ChevronRightIcon size={20} strokeWidth={1.75} />
          </IconButton>
        </Box>
      </Paper>

      {/* ── No property selected — état vide standardisé ── */}
      {!selectedPropertyId && (
        <EmptyState
          icon={<CalendarMonthIcon />}
          title={t('dynamicPricing.calendar.noProperty')}
          description={t('dynamicPricing.calendar.noPropertyHint')}
          minHeight={260}
        />
      )}

      {/* ── Calendar grid ── */}
      {selectedPropertyId && (
        <Paper sx={{ ...CARD_SX, position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {calendarPricingLoading && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'color-mix(in srgb, var(--card) 70%, transparent)',
                zIndex: 2,
                borderRadius: '14px',
              }}
            >
              <CircularProgress size={28} />
            </Box>
          )}

          {/* Day headers — overline (pattern entête planning) */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', mb: '2px' }}>
            {dayHeaders.map((label) => (
              <Box key={label} sx={{ textAlign: 'center', py: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Calendar cells */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', flex: 1 }}>
            {calendarCells.map((cell) => {
              const pricing = pricingMap.get(cell.dateStr);
              const isSelected = selectedDatesSet.has(cell.dateStr);
              const isToday = cell.dateStr === todayISO;
              const sourceColor = pricing ? getSourceColor(pricing.priceSource) : '#8BA0B3';

              return (
                <Box
                  key={cell.dateStr}
                  onMouseDown={(e) => cell.inMonth && handleCellMouseDown(cell.dateStr, e)}
                  onMouseEnter={() => cell.inMonth && handleCellMouseEnter(cell.dateStr)}
                  onDoubleClick={() => {
                    if (cell.inMonth && selectedPropertyId) {
                      setSelectedDates([cell.dateStr]);
                      setEditDialogOpen(true);
                    }
                  }}
                  sx={{
                    minHeight: 64,
                    p: 0.5,
                    borderRadius: '8px',
                    userSelect: 'none',
                    cursor: cell.inMonth ? 'pointer' : 'default',
                    opacity: cell.inMonth ? 1 : 0.3,
                    bgcolor: isSelected ? 'var(--accent-soft)' : 'transparent',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--line)',
                    boxShadow: isSelected ? 'inset 0 0 0 1px var(--accent)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': cell.inMonth && !isSelected
                      ? { borderColor: 'var(--line-2)', bgcolor: 'var(--hover)' }
                      : {},
                  }}
                >
                  {/* Pastille « aujourd'hui » — pattern planning (carré accent r8) */}
                  {isToday ? (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        borderRadius: '7px',
                        bgcolor: 'var(--accent)',
                        color: 'var(--on-accent)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: '0.6875rem',
                        lineHeight: 1,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {cell.date.getDate()}
                    </Box>
                  ) : (
                    <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1, fontSize: '0.6875rem', fontVariantNumeric: 'tabular-nums' }}>
                      {cell.date.getDate()}
                    </Typography>
                  )}

                  {pricing && pricing.nightlyPrice !== null && (
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: sourceColor,
                        fontFamily: 'var(--font-display)',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {pricing.nightlyPrice}
                    </Typography>
                  )}

                  {pricing && (
                    <Box sx={{ height: 3, borderRadius: 1, bgcolor: sourceColor, mt: 'auto' }} />
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'var(--line)' }}>
            {Object.entries(SOURCE_COLORS).map(([key, color]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                  {t(`dynamicPricing.priceSource.${key}`)}
                </Typography>
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', ml: 'auto', fontStyle: 'italic' }}>
              {t('dynamicPricing.calendar.rangeHint', 'Cliquez-glissez pour sélectionner une plage')}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* ── Selection action bar ── */}
      {selectedDates.length > 0 && (
        <Paper
          sx={{
            ...CARD_SX,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'var(--accent-soft)',
            borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
            {selectedDates.length} {t('common.date')}(s)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="text"
              size="small"
              onClick={() => setSelectedDates([])}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<NightsStay size={14} strokeWidth={1.75} />}
              onClick={() => setMinNightsDialogOpen(true)}
            >
              Min-nights
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => setEditDialogOpen(true)}
            >
              {t('dynamicPricing.calendar.editPrice')}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Price edit dialog */}
      <PricingEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onApply={handleApplyPrice}
        selectedDates={selectedDates}
        loading={updatePriceLoading}
        currency={currency}
      />

      {/* Min-nights edit dialog */}
      <MinNightsEditDialog
        open={minNightsDialogOpen}
        onClose={() => setMinNightsDialogOpen(false)}
        onApply={handleApplyMinNights}
        selectedDates={selectedDates}
        loading={minNightsMutation.isPending}
      />
    </Box>
  );
};

export default PricingCalendarView;
