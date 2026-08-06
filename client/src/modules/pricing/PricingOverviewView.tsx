import React, { useMemo } from 'react';
import { cn } from '../../utils/cn';
import {
  Button,
  Card,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { ChevronLeft as ChevronLeftIcon } from '../../icons';
import { ChevronRight as ChevronRightIcon } from '../../icons';
import { CalendarMonth as CalendarMonthIcon } from '../../icons';
import EmptyState from '../../components/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { CalendarPricingDay } from '../../services/api/calendarPricingApi';
import type { Property } from '../../services/api/propertiesApi';
import { dynamicPricingKeys } from '../../hooks/useDynamicPricing';

// ─── Style Constants ────────────────────────────────────────────────────────

// Le primitif Table pose lui-meme son conteneur `cn-table-container`
// (overflow-x-auto) : c'est LUI qui doit porter la hauteur max, sinon l'en-tete
// `sticky top-0` se collerait a un scrollport qui ne defile pas verticalement.
const TABLE_SCROLL_CLASS =
  '[&_[data-slot=table-container]]:max-h-[calc(100vh-280px)] '
  + '[&_[data-slot=table-container]]:overflow-y-auto';

// Premiere colonne figee, en propriete LOGIQUE (le PMS est RTL). Le fond doit
// etre opaque, sinon les colonnes suivantes defilent par transparence dessous.
const STICKY_COL_CLASS = 'sticky start-0 min-w-[150px] bg-card border-e border-border';

const SOURCE_COLORS: Record<string, string> = {
  OVERRIDE: '#D98E8E',
  PROMOTIONAL: '#BA68C8',
  SEASONAL: '#E0B483',
  LAST_MINUTE: '#8DB6D4',
  BASE: '#5CB8AA',
  PROPERTY_DEFAULT: '#8BA0B3',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingOverviewViewProps {
  properties: Property[];
  propertiesLoading: boolean;
  currentMonth: Date;
  from: string;
  to: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(date: Date): number[] {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days: number[] = [];
  for (let i = 1; i <= last; i++) days.push(i);
  return days;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMonth(date: Date, isFrench: boolean): string {
  return date.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// ─── Per-Property Row ───────────────────────────────────────────────────────

const PropertyRow: React.FC<{
  property: Property;
  from: string;
  to: string;
  days: number[];
  year: number;
  month: number;
}> = ({ property, from, to, days, year, month }) => {
  const { data: pricing, isLoading } = useQuery<CalendarPricingDay[]>({
    queryKey: dynamicPricingKeys.calendarPricing(property.id, from, to),
    queryFn: () => calendarPricingApi.getPricing(property.id, from, to),
  });

  const pricingMap = useMemo(() => {
    const map = new Map<string, CalendarPricingDay>();
    if (pricing) {
      for (const day of pricing) {
        map.set(day.date, day);
      }
    }
    return map;
  }, [pricing]);

  return (
    <TableRow>
      <TableCell className={cn(STICKY_COL_CLASS, 'z-[5]')}>
        <p className="text-sm font-semibold truncate">
          {property.name}
        </p>
      </TableCell>
      {days.map((day) => {
        const dateStr = toISO(year, month, day);
        const entry = pricingMap.get(dateStr);
        const sourceColor = entry ? SOURCE_COLORS[entry.priceSource] ?? '#BDBDBD' : 'transparent';

        if (isLoading) {
          return (
            <TableCell key={day} className="text-center px-[3px]">
              <Spinner className="size-3" />
            </TableCell>
          );
        }

        return (
          <TableCell
            key={day}
            className="text-center px-[3px] py-[3px] min-w-[44px]"
            // Couleur calculee au runtime : une classe Tailwind ne peut pas
            // naitre d'une variable.
            style={{ borderBottom: `3px solid ${sourceColor}` }}
          >
            {entry && entry.nightlyPrice !== null ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs font-semibold cursor-default tabular-nums" style={{ color: sourceColor }}>
                    {entry.nightlyPrice}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{`${entry.priceSource} - ${dateStr}`}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-xs text-muted-foreground opacity-60">
                -
              </span>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const PricingOverviewView: React.FC<PricingOverviewViewProps> = ({
  properties,
  propertiesLoading,
  currentMonth,
  from,
  to,
  onPrevMonth,
  onNextMonth,
}) => {
  const { t, isFrench } = useTranslation();

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  return (
    <div className="flex flex-col gap-2">
      {/* Month navigation */}
      <Card className="gap-0 py-0 p-[9px]">
        <div className="flex items-center justify-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={t('common.previous', 'Précédent')} onClick={onPrevMonth}>
            <ChevronLeftIcon size={20} strokeWidth={1.75} />
          </Button>
          <p className="text-sm font-semibold min-w-[140px] text-center capitalize">
            {formatMonth(currentMonth, isFrench)}
          </p>
          <Button variant="ghost" size="icon-sm" aria-label={t('common.next', 'Suivant')} onClick={onNextMonth}>
            <ChevronRightIcon size={20} strokeWidth={1.75} />
          </Button>
        </div>
      </Card>

      {/* Loading */}
      {propertiesLoading && (
        <Card className="gap-0 items-center px-[9px] py-6">
          <Spinner className="size-7" />
        </Card>
      )}

      {/* Empty state */}
      {!propertiesLoading && properties.length === 0 && (
        <EmptyState
          icon={<CalendarMonthIcon />}
          title={t('dynamicPricing.calendar.noProperty')}
          description={t('dynamicPricing.calendar.noPropertyHint')}
          variant="plain"
        />
      )}

      {/* Overview table */}
      {!propertiesLoading && properties.length > 0 && (
        <Card className={cn('gap-0 py-0', TABLE_SCROLL_CLASS)}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn(STICKY_COL_CLASS, 'top-0 z-20')}>
                  <span className="text-2xs font-semibold uppercase tracking-wide text-faint">
                    {t('common.name')}
                  </span>
                </TableHead>
                {days.map((day) => (
                  <TableHead key={day} className="sticky top-0 z-10 bg-card text-center px-[3px] min-w-[40px]">
                    <span className="text-2xs font-semibold text-faint tabular-nums">
                      {day}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <PropertyRow
                  key={property.id}
                  property={property}
                  from={from}
                  to={to}
                  days={days}
                  year={year}
                  month={month}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Legend */}
      {!propertiesLoading && properties.length > 0 && (
        <Card className="gap-0 py-0 p-[9px]">
          <div className="flex flex-wrap gap-2">
            {Object.entries(SOURCE_COLORS).map(([key, color]) => (
              <div className="flex items-center gap-0.5" key={key}>
                <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: color }} />
                <span className="text-2xs text-muted-foreground">
                  {t(`dynamicPricing.priceSource.${key}`)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PricingOverviewView;
