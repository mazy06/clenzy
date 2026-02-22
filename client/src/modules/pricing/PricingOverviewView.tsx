import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { CalendarPricingDay } from '../../services/api/calendarPricingApi';
import type { Property } from '../../services/api/propertiesApi';
import { dynamicPricingKeys } from '../../hooks/useDynamicPricing';

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
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          minWidth: 150,
        }}
      >
        <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8125rem' }}>
          {property.name}
        </Typography>
      </TableCell>
      {days.map((day) => {
        const dateStr = toISO(year, month, day);
        const entry = pricingMap.get(dateStr);
        const sourceColor = entry ? SOURCE_COLORS[entry.priceSource] ?? '#BDBDBD' : 'transparent';

        if (isLoading) {
          return (
            <TableCell key={day} sx={{ textAlign: 'center', px: 0.5 }}>
              <CircularProgress size={12} />
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
              <Tooltip title={`${entry.priceSource} - ${dateStr}`} arrow>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  sx={{ color: sourceColor, cursor: 'default' }}
                >
                  {entry.nightlyPrice}
                </Typography>
              </Tooltip>
            ) : (
              <Typography variant="caption" color="text.disabled">
                -
              </Typography>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Month navigation */}
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

      {/* Loading */}
      {propertiesLoading && (
        <Paper sx={{ ...CARD_SX, display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Paper>
      )}

      {/* Empty state */}
      {!propertiesLoading && properties.length === 0 && (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
            {t('dynamicPricing.calendar.noProperty')}
          </Typography>
        </Paper>
      )}

      {/* Overview table */}
      {!propertiesLoading && properties.length > 0 && (
        <TableContainer
          component={Paper}
          sx={{
            ...CARD_SX,
            p: 0,
            maxHeight: 'calc(100vh - 280px)',
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    bgcolor: 'background.paper',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    minWidth: 150,
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6875rem' }}>
                    {t('common.name')}
                  </Typography>
                </TableCell>
                {days.map((day) => (
                  <TableCell key={day} sx={{ textAlign: 'center', px: 0.5, minWidth: 40 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                      {day}
                    </Typography>
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
        <Paper sx={CARD_SX}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
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
    </Box>
  );
};

export default PricingOverviewView;
