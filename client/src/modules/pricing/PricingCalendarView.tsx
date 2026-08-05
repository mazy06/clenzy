import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Spinner, Button, Card } from '../../components/ui';
import { cn } from '../../utils/cn';
import { ChevronLeft as ChevronLeftIcon } from '../../icons';
import { ChevronRight as ChevronRightIcon } from '../../icons';
import { CalendarMonth as CalendarMonthIcon, NightsStay } from '../../icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { CalendarPricingDay } from '../../services/api/calendarPricingApi';
import { minNightsKeys } from '../planning/hooks/usePlanningMinNights';
import EmptyState from '../../components/EmptyState';
import PricingEditDialog from './PricingEditDialog';
import MinNightsEditDialog from './MinNightsEditDialog';

// ─── Style Constants ────────────────────────────────────────────────────────

/** Densité de carte partagée : la surface vient de `Card`, le rythme d'ici. */
const PANEL_CLASS = 'gap-0 py-0 p-[9px]';

const SOURCE_COLORS: Record<string, string> = {
  OVERRIDE: '#D98E8E',
  PROMOTIONAL: '#BA68C8',
  SEASONAL: '#E0B483',
  LAST_MINUTE: '#8DB6D4',
  BASE: '#5CB8AA',
  PROPERTY_DEFAULT: '#8BA0B3',
};

const getSourceColor = (source: string): string => SOURCE_COLORS[source] ?? '#8BA0B3';

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
  // Ancre de selection (shift-click / drag) lue uniquement en handlers : ref.
  const selectionAnchorRef = useRef<string | null>(null);
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
      const anchor = selectionAnchorRef.current;
      if (event.shiftKey && anchor) {
        setSelectedDates(rangeBetween(anchor, dateStr));
        return;
      }
      selectionAnchorRef.current = dateStr;
      setSelectedDates([dateStr]);
      setIsDragging(true);
    },
    [selectedPropertyId, rangeBetween],
  );

  // Survol pendant le glisser : étend la plage depuis l'ancre → sélection de plage
  // « cliquer-glisser » sans passer par le formulaire de droite.
  const handleCellMouseEnter = useCallback(
    (dateStr: string) => {
      const anchor = selectionAnchorRef.current;
      if (!isDragging || !anchor) return;
      setSelectedDates(rangeBetween(anchor, dateStr));
    },
    [isDragging, rangeBetween],
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

  const selectedDatesSet = new Set(selectedDates);

  return (
    <div className="flex flex-col gap-2 flex-1">
      {/* ── Month navigation ── */}
      <Card className={PANEL_CLASS}>
        <div className="flex items-center justify-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={onPrevMonth} aria-label={t('common.previous', 'Précédent')}>
            <ChevronLeftIcon size={20} strokeWidth={1.75} />
          </Button>
          <p className="text-sm font-semibold min-w-[140px] text-center capitalize">
            {formatMonth(currentMonth, isFrench)}
          </p>
          <Button variant="ghost" size="icon-sm" onClick={onNextMonth} aria-label={t('common.next', 'Suivant')}>
            <ChevronRightIcon size={20} strokeWidth={1.75} />
          </Button>
        </div>
      </Card>

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
        <Card className={cn(PANEL_CLASS, 'relative flex flex-1 flex-col')}>
          {calendarPricingLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-[2] rounded-xl">
              <Spinner className="size-7" />
            </div>
          )}

          {/* Day headers — overline (pattern entête planning) */}
          <div className="grid grid-cols-[repeat(7,_1fr)] gap-0.5 mb-0.5">
            {dayHeaders.map((label) => (
              <div className="text-center py-0.5" key={label}>
                <span className="text-2xs font-semibold uppercase tracking-wide text-faint">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-[repeat(7,_1fr)] gap-0.5 flex-1">
            {calendarCells.map((cell) => {
              const pricing = pricingMap.get(cell.dateStr);
              const isSelected = selectedDatesSet.has(cell.dateStr);
              const isToday = cell.dateStr === todayISO;
              const sourceColor = pricing ? getSourceColor(pricing.priceSource) : '#8BA0B3';

              return (
                <div
                  key={cell.dateStr}
                  onMouseDown={(e) => cell.inMonth && handleCellMouseDown(cell.dateStr, e)}
                  onMouseEnter={() => cell.inMonth && handleCellMouseEnter(cell.dateStr)}
                  onDoubleClick={() => {
                    if (cell.inMonth && selectedPropertyId) {
                      setSelectedDates([cell.dateStr]);
                      setEditDialogOpen(true);
                    }
                  }}
                  className={cn(
                    'min-h-[64px] p-[3px] rounded-md select-none border border-solid flex flex-col',
                    'transition-[border-color,background-color] duration-150 ease-out-quart motion-reduce:transition-none',
                    cell.inMonth ? 'cursor-pointer opacity-100' : 'cursor-default opacity-30',
                    isSelected
                      ? 'bg-primary-soft border-primary shadow-[inset_0_0_0_1px_var(--color-primary)]'
                      : 'bg-transparent border-border shadow-none',
                    cell.inMonth && !isSelected && 'hover:border-primary/40 hover:bg-muted',
                  )}
                >
                  {/* Pastille « aujourd'hui » — pattern planning (carré accent r8) */}
                  {isToday ? (
                    <span className="inline-flex items-center justify-center w-[20px] h-[20px] rounded-[7px] bg-primary text-primary-foreground font-[family-name:var(--font-display)] font-semibold text-2xs leading-none self-start tabular-nums">
                      {cell.date.getDate()}
                    </span>
                  ) : (
                    <span className="text-2xs font-semibold leading-none tabular-nums">
                      {cell.date.getDate()}
                    </span>
                  )}

                  {pricing && pricing.nightlyPrice !== null && (
                    <p className="text-sm font-semibold flex-1 flex items-center justify-center tabular-nums" style={{ color: sourceColor, fontFamily: 'var(--font-display)' }}>
                      {pricing.nightlyPrice}
                    </p>
                  )}

                  {pricing && (
                    <div className="h-[3px] rounded-md mt-auto" style={{ backgroundColor: sourceColor }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-border">
            {Object.entries(SOURCE_COLORS).map(([key, color]) => (
              <div className="flex items-center gap-0.5" key={key}>
                <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: color }} />
                <span className="text-2xs text-muted-foreground">
                  {t(`dynamicPricing.priceSource.${key}`)}
                </span>
              </div>
            ))}
            <span className="text-2xs text-muted-foreground ms-auto italic">
              {t('dynamicPricing.calendar.rangeHint', 'Cliquez-glissez pour sélectionner une plage')}
            </span>
          </div>
        </Card>
      )}

      {/* ── Selection action bar ── */}
      {selectedDates.length > 0 && (
        <Card
          className={cn(
            PANEL_CLASS,
            'flex-row items-center justify-between bg-primary-soft ring-primary/30',
          )}
        >
          <p className="text-sm tabular-nums">
            {selectedDates.length} {t('common.date')}(s)
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDates([])}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMinNightsDialogOpen(true)}
            >
              <NightsStay size={14} strokeWidth={1.75} />
              Min-nights
            </Button>
            <Button
              size="sm"
              onClick={() => setEditDialogOpen(true)}
            >
              {t('dynamicPricing.calendar.editPrice')}
            </Button>
          </div>
        </Card>
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
    </div>
  );
};

export default PricingCalendarView;
