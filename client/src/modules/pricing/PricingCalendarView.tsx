import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  CircularProgress,
  alpha,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from '../../hooks/useTranslation';
import type { CalendarPricingDay } from '../../services/api/calendarPricingApi';
import PricingEditDialog from './PricingEditDialog';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
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
}) => {
  const { t, isFrench } = useTranslation();

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);

  const calendarCells = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth]);

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

  const handleCellClick = useCallback(
    (dateStr: string, event: React.MouseEvent) => {
      if (!selectedPropertyId) return;

      if (event.shiftKey && selectionAnchor) {
        const allDates = calendarCells.filter((c) => c.inMonth).map((c) => c.dateStr);
        const anchorIdx = allDates.indexOf(selectionAnchor);
        const currentIdx = allDates.indexOf(dateStr);
        if (anchorIdx >= 0 && currentIdx >= 0) {
          const start = Math.min(anchorIdx, currentIdx);
          const end = Math.max(anchorIdx, currentIdx);
          setSelectedDates(allDates.slice(start, end + 1));
        }
      } else {
        setSelectionAnchor(dateStr);
        setSelectedDates((prev) =>
          prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [dateStr],
        );
      }
    },
    [selectedPropertyId, selectionAnchor, calendarCells],
  );

  const handleApplyPrice = useCallback(
    async (price: number) => {
      if (!selectedPropertyId || selectedDates.length === 0) return;
      const sorted = [...selectedDates].sort();
      await onUpdatePrice({
        propertyId: selectedPropertyId,
        from: sorted[0],
        to: sorted[sorted.length - 1],
        nightlyPrice: price,
      });
      setSelectedDates([]);
    },
    [selectedPropertyId, selectedDates, onUpdatePrice],
  );

  const getSourceColor = (source: string): string => SOURCE_COLORS[source] ?? '#8BA0B3';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
      {/* ── Month navigation ── */}
      <Paper sx={CARD_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton onClick={onPrevMonth} size="small">
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ minWidth: 140, textAlign: 'center', textTransform: 'capitalize', fontSize: '0.8125rem' }}
          >
            {formatMonth(currentMonth, isFrench)}
          </Typography>
          <IconButton onClick={onNextMonth} size="small">
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Paper>

      {/* ── No property selected ── */}
      {!selectedPropertyId && (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('dynamicPricing.calendar.noProperty')}
          </Typography>
        </Paper>
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
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.7),
                zIndex: 2,
                borderRadius: 1.5,
              }}
            >
              <CircularProgress size={28} />
            </Box>
          )}

          {/* Day headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', mb: '2px' }}>
            {dayHeaders.map((label) => (
              <Box key={label} sx={{ textAlign: 'center', py: 0.5 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Calendar cells */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', flex: 1 }}>
            {calendarCells.map((cell) => {
              const pricing = pricingMap.get(cell.dateStr);
              const isSelected = selectedDates.includes(cell.dateStr);
              const sourceColor = pricing ? getSourceColor(pricing.priceSource) : '#8BA0B3';

              return (
                <Box
                  key={cell.dateStr}
                  onClick={(e) => cell.inMonth && handleCellClick(cell.dateStr, e)}
                  onDoubleClick={() => {
                    if (cell.inMonth && selectedPropertyId) {
                      setSelectedDates([cell.dateStr]);
                      setEditDialogOpen(true);
                    }
                  }}
                  sx={{
                    minHeight: 64,
                    p: 0.5,
                    borderRadius: 1,
                    cursor: cell.inMonth ? 'pointer' : 'default',
                    opacity: cell.inMonth ? 1 : 0.3,
                    bgcolor: isSelected
                      ? (theme) => alpha(theme.palette.primary.main, 0.12)
                      : 'transparent',
                    border: isSelected ? '2px solid' : '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': cell.inMonth
                      ? { borderColor: 'primary.light', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }
                      : {},
                  }}
                >
                  <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1, fontSize: '0.6875rem' }}>
                    {cell.date.getDate()}
                  </Typography>

                  {pricing && pricing.nightlyPrice !== null && (
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: sourceColor,
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            {Object.entries(SOURCE_COLORS).map(([key, color]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                  {t(`dynamicPricing.priceSource.${key}`)}
                </Typography>
              </Box>
            ))}
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
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
            {selectedDates.length} {t('common.date')}(s)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="text"
              size="small"
              onClick={() => setSelectedDates([])}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => setEditDialogOpen(true)}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
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
      />
    </Box>
  );
};

export default PricingCalendarView;
