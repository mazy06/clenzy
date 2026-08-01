import React, { useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
// Le tableau reste MUI : `stickyHeader` (+ la premiere colonne collante) n'a pas
// d'equivalent dans le kit, et le remplacer casserait le defilement horizontal.
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ChevronLeft as ChevronLeftIcon } from '../../icons';
import { ChevronRight as ChevronRightIcon } from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { CalendarPricingDay } from '../../services/api/calendarPricingApi';
import type { Property } from '../../services/api/propertiesApi';
import { dynamicPricingKeys } from '../../hooks/useDynamicPricing';

// ─── Style Constants ────────────────────────────────────────────────────────

// Surface « carte » : le Paper MUI ne portait que ces declarations.
const CARD_CLASS = 'border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px]';

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
    <TableRow hover>
      <TableCell
        sx={{
          position: 'sticky',
          left: 0,
          zIndex: 1,
          bgcolor: 'var(--card)',
          borderRight: '1px solid',
          borderColor: 'var(--line)',
          minWidth: 150,
        }}
      >
        <p className="cn-text-body2 font-semibold truncate text-[0.8125rem]">
          {property.name}
        </p>
      </TableCell>
      {days.map((day) => {
        const dateStr = toISO(year, month, day);
        const entry = pricingMap.get(dateStr);
        const sourceColor = entry ? SOURCE_COLORS[entry.priceSource] ?? '#BDBDBD' : 'transparent';

        if (isLoading) {
          return (
            <TableCell key={day} sx={{ textAlign: 'center', px: 0.5 }}>
              <Spinner className="size-3" />
            </TableCell>
          );
        }

        return (
          <TableCell
            key={day}
            sx={{
              textAlign: 'center',
              px: 0.5,
              py: 0.5,
              minWidth: 44,
              borderBottom: '3px solid',
              borderBottomColor: sourceColor,
            }}
          >
            {entry && entry.nightlyPrice !== null ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cn-text-caption font-semibold cursor-default tabular-nums" style={{ color: sourceColor }}>
                    {entry.nightlyPrice}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{`${entry.priceSource} - ${dateStr}`}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="cn-text-caption text-muted-foreground opacity-60">
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
      <div className={cn(CARD_CLASS, 'p-[9px]')}>
        <div className="flex items-center justify-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={t('common.previous', 'Précédent')} onClick={onPrevMonth}>
            <ChevronLeftIcon size={20} strokeWidth={1.75} />
          </Button>
          <p className="cn-text-body2 font-semibold min-w-[140px] text-center capitalize text-[0.8125rem]">
            {formatMonth(currentMonth, isFrench)}
          </p>
          <Button variant="ghost" size="icon-sm" aria-label={t('common.next', 'Suivant')} onClick={onNextMonth}>
            <ChevronRightIcon size={20} strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {propertiesLoading && (
        <div className={cn(CARD_CLASS, 'flex justify-center px-[9px] py-6')}>
          <Spinner className="size-7" />
        </div>
      )}

      {/* Empty state */}
      {!propertiesLoading && properties.length === 0 && (
        <div className={cn(CARD_CLASS, 'p-6 text-center')}>
          <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
            {t('dynamicPricing.calendar.noProperty')}
          </p>
        </div>
      )}

      {/* Overview table */}
      {!propertiesLoading && properties.length > 0 && (
        <TableContainer className={cn(CARD_CLASS, 'max-h-[calc(100vh-280px)]')}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    bgcolor: 'var(--card)',
                    borderRight: '1px solid',
                    borderColor: 'var(--line)',
                    minWidth: 150,
                  }}
                >
                  <span className="cn-text-caption text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[0.06em]">
                    {t('common.name')}
                  </span>
                </TableCell>
                {days.map((day) => (
                  <TableCell key={day} sx={{ textAlign: 'center', px: 0.5, minWidth: 40 }}>
                    <span className="cn-text-caption font-semibold text-[0.6875rem] text-[var(--faint)] tabular-nums">
                      {day}
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
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
        </TableContainer>
      )}

      {/* Legend */}
      {!propertiesLoading && properties.length > 0 && (
        <div className={cn(CARD_CLASS, 'p-[9px]')}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SOURCE_COLORS).map(([key, color]) => (
              <div className="flex items-center gap-0.5" key={key}>
                <div className="w-[10px] h-[10px] rounded-[50%]" style={{ backgroundColor: color }} />
                <span className="cn-text-caption text-muted-foreground text-[0.625rem]">
                  {t(`dynamicPricing.priceSource.${key}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingOverviewView;
