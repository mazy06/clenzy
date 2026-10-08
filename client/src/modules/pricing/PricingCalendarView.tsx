import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Skeleton, Button, Card } from '../../components/ui';
import { cn } from '../../utils/cn';
import { ChevronPrev as ChevronPrevIcon } from '../../icons';
import { ChevronNext as ChevronNextIcon } from '../../icons';
import { CalendarMonth as CalendarMonthIcon, NightsStay } from '../../icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { CalendarPricingDay } from '../../services/api/calendarPricingApi';
import { minNightsKeys } from '../planning/hooks/usePlanningMinNights';
import EmptyState from '../../components/EmptyState';
import PricingEditDialog from './PricingEditDialog';
import MinNightsEditDialog from './MinNightsEditDialog';
import { activeIntlLocaleGregorian } from '../../utils/activeLocale';
import { useDateFormat } from '../../hooks/useDateFormat';
import { buildMonthGrid, toLocalISODate } from '../../utils/monthGrid';
import { weekdayHeaders } from '../../utils/localeDate';
import './pricingCalendar.css';
import BaitlyPricingProposal, { BaitlyPricingProposalSkeleton, type BaitlyPricingAiSelection } from './BaitlyPricingProposal';
import type { AiPricingRecommendation } from '../../services/api/aiApi';

// ─── Style Constants ────────────────────────────────────────────────────────

/** Densité de carte partagée : la surface vient de `Card`, le rythme d'ici. */
const PANEL_CLASS = 'bp-calendar-panel gap-0 p-4';

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
  toolbarControls?: React.ReactNode;
  hideToolbar?: boolean;
  propertyName?: string;
  proposalsLoading?: boolean;
  proposals?: Map<string, AiPricingRecommendation>;
  selectedProposalDate?: string;
  onSelectProposal?: (selection: BaitlyPricingAiSelection) => void;
}

// ─── Calendar Helpers ───────────────────────────────────────────────────────


// Le libellé de mois d'une grille GRÉGORIENNE : la langue suit l'utilisateur,
// le découpage reste celui de la grille. Un nom de mois hégirien coifferait
// ici une grille qui en couvre deux — c'est le piège que le planning évite en
// bornant sa fenêtre sur le mois affiché.
function formatMonth(date: Date): string {
  return date.toLocaleDateString(activeIntlLocaleGregorian(), {
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
  toolbarControls,
  hideToolbar = false,
  propertyName = '',
  proposals,
  proposalsLoading = false,
  selectedProposalDate,
  onSelectProposal,
}) => {
  const { t } = useTranslation();
  // Premier jour de semaine et week-end suivent la LANGUE : dimanche→samedi et
  // week-end vendredi-samedi en arabe, comme la grille du planning.
  const { isWeekend, language, weekStartsOn } = useDateFormat();

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

  const calendarCells = useMemo(
    () => buildMonthGrid(currentMonth, weekStartsOn),
    [currentMonth, weekStartsOn],
  );
  const todayISO = useMemo(() => toLocalISODate(new Date()), []);

  const pricingMap = useMemo(() => {
    const map = new Map<string, CalendarPricingDay>();
    for (const day of calendarPricing) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarPricing]);

  // Les sept entetes, dans l'ordre de la langue (cf. weekdayHeaders) : la liste
  // etait ecrite en dur en francais et en anglais, l'arabe heritait de l'anglais.
  const dayHeaders = useMemo(() => weekdayHeaders(language), [language]);

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

  useEffect(() => {
    setSelectedDates([]);
    selectionAnchorRef.current = null;
  }, [selectedPropertyId, currentMonth]);

  const selectedDatesSet = new Set(selectedDates);

  return (
    <div className="flex flex-col gap-2 flex-1">
      {/* ── Month navigation ── */}
      {!hideToolbar && <Card className="bp-month-toolbar bp-calendar-toolbar gap-0 p-0">
        <div className="bp-month-nav flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={onPrevMonth} aria-label={t('common.previous', 'Précédent')}>
            <ChevronPrevIcon size={20} strokeWidth={1.75} />
          </Button>
          <p className="text-sm font-semibold min-w-[140px] text-center capitalize">
            {formatMonth(currentMonth)}
          </p>
          <Button variant="ghost" size="icon-sm" onClick={onNextMonth} aria-label={t('common.next', 'Suivant')}>
            <ChevronNextIcon size={20} strokeWidth={1.75} />
          </Button>
        </div>
        {toolbarControls}
      </Card>}

      {/* ── No property selected — état vide standardisé ── */}
      {!selectedPropertyId && (
        <EmptyState
          icon={<CalendarMonthIcon />}
          title={t('dynamicPricing.calendar.noProperty')}
          description={t('dynamicPricing.calendar.noPropertyHint')}
          variant="plain"
          minHeight={260}
        />
      )}

      {/* ── Calendar grid ──
          `pc-grid` porte le jeton de teinte du week-end (pricingCalendar.css). */}
      {selectedPropertyId && (
        <Card className={cn(PANEL_CLASS, 'pc-grid relative flex flex-1 flex-col')}>
          <p className="bp-calendar-unit">{t('baitlyPricing.priceUnit', { currency, defaultValue: 'Prix par nuit ({{currency}})' })}</p>
          {calendarPricingLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-[2] rounded-xl">
              <Skeleton className="h-full w-full" />
            </div>
          )}

          {/* Day headers — overline (pattern entête planning). Clé par index :
              en arabe les libellés sont des lettres uniques, qui se répètent
              d'un jour à l'autre. */}
          <div className="grid grid-cols-[repeat(7,_1fr)] gap-0.5 mb-0.5">
            {dayHeaders.map((header, index) => (
              <div className="text-center py-0.5" key={index}>
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wide',
                    'text-muted-foreground',
                  )}
                >
                  {header.label}
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
              const weekend = isWeekend(cell.date);
              const sourceColor = pricing ? getSourceColor(pricing.priceSource) : '#8BA0B3';

              const recommendation = cell.inMonth ? proposals?.get(cell.dateStr) : undefined;
              const proposalSelected = selectedProposalDate === cell.dateStr;
              return (
                <div key={cell.dateStr}
                  onMouseEnter={() => !calendarPricingLoading && cell.inMonth && handleCellMouseEnter(cell.dateStr)}
                  className={cn(
                    'bp-day min-h-[80px] p-2 rounded-md select-none border border-solid flex flex-col',
                    'transition-[border-color,background-color] duration-150 ease-out-quart motion-reduce:transition-none',
                    cell.inMonth ? 'opacity-100' : 'opacity-30',
                    isSelected || proposalSelected
                      ? 'bg-primary-soft border-primary shadow-[inset_0_0_0_1px_var(--bui-primary)]'
                      : weekend ? 'border-border shadow-none bg-[var(--pc-cell-we)]' : 'bg-transparent border-border shadow-none',
                    cell.inMonth && !isSelected && 'hover:border-primary/40 hover:bg-muted',
                    (recommendation || (proposalsLoading && cell.inMonth)) && 'bp-day-with-ai',
                  )}>
                  <button type="button" className="bp-day-select" disabled={!cell.inMonth || calendarPricingLoading}
                    aria-pressed={cell.inMonth ? isSelected : undefined}
                    aria-label={cell.dateStr + ', ' + (pricing?.nightlyPrice ?? '–') + ' ' + currency}
                    onKeyDown={(e) => {
                      if (!cell.inMonth || calendarPricingLoading) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (e.shiftKey && selectionAnchorRef.current) setSelectedDates(rangeBetween(selectionAnchorRef.current, cell.dateStr));
                        else { selectionAnchorRef.current = cell.dateStr; setSelectedDates([cell.dateStr]); }
                      }
                    }}
                    onTouchStart={() => { if (cell.inMonth && !calendarPricingLoading) {
                      selectionAnchorRef.current = cell.dateStr; setSelectedDates([cell.dateStr]);
                    } }}
                    onMouseDown={(e) => !calendarPricingLoading && cell.inMonth && handleCellMouseDown(cell.dateStr, e)}
                    onClick={() => { if (!isDragging && selectedDates.length === 0) {
                      selectionAnchorRef.current = cell.dateStr; setSelectedDates([cell.dateStr]);
                    } }}
                    onDoubleClick={() => { setSelectedDates([cell.dateStr]); setEditDialogOpen(true); }}>
                    {isToday ? <span className="inline-flex items-center justify-center w-[20px] h-[20px] rounded-[7px] bg-primary text-primary-foreground font-semibold text-xs leading-none self-start tabular-nums">{cell.date.getDate()}</span>
                      : <span className="text-xs font-semibold leading-none tabular-nums">{cell.date.getDate()}</span>}
                    {cell.inMonth && <span className="bp-price text-base font-semibold text-foreground flex-1 flex items-center justify-center tabular-nums">{pricing?.nightlyPrice ?? '–'}</span>}
                  </button>
                  {proposalsLoading && cell.inMonth && !recommendation && <BaitlyPricingProposalSkeleton />}
                  {recommendation && selectedPropertyId && onSelectProposal && <BaitlyPricingProposal
                    selection={{ propertyId: selectedPropertyId, propertyName, currency: pricing?.currency ?? currency,
                      currentPrice: pricing?.nightlyPrice ?? null, recommendation }}
                    active={proposalSelected} onSelect={(selection) => { setSelectedDates([]); onSelectProposal(selection); }} />}
                  {pricing && <div className="h-[3px] rounded-md mt-auto" style={{ backgroundColor: sourceColor }} />}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-border">
            {Object.entries(SOURCE_COLORS).filter(([key]) => calendarPricing.some(day => day.priceSource === key)).map(([key, color]) => (
              <div className="flex items-center gap-0.5" key={key}>
                <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">
                  {t(`dynamicPricing.priceSource.${key}`)}
                </span>
              </div>
            ))}
            {proposals && proposals.size > 0 && <span className="bp-ai-legend"><span>{t('baitlyPricing.ai.short', 'IA')}</span>{t('baitlyPricing.ai.pending', 'À valider')}</span>}
            <span className="text-xs text-muted-foreground ms-auto italic">
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
              {t('baitlyPricing.minNights', "Séjour minimum")}
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
