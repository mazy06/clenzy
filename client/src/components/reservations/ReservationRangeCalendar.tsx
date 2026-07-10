import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { ChevronLeft, ChevronRight, NightsStay } from '../../icons';

// ─── Calendrier range « Signature » (.rm-cal) ───────────────────────────────
// Extrait de PlanningQuickCreateDialog pour être partagé par ReservationDialog.
// Comportement : sélection début → fin, reset si fin < début, Effacer. Look
// maquette « Signature » : grille 7 col gap 3, jours aspect 1, in-range
// accent-soft sans radius, edges accent blanc. Tokens var(--…).

interface CalCell {
  date: Date;
  dateStr: string;
  inMonth: boolean;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildCalGrid(month: Date): CalCell[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: CalCell[] = [];
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

const DEFAULT_WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const CAL_NAV_BTN_SX = {
  width: 28,
  height: 28,
  borderRadius: '8px',
  border: '1px solid var(--line-2)',
  backgroundColor: 'var(--card)',
  color: 'var(--muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'color .14s, border-color .14s',
  '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
} as const;

const CLEAR_LINK_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
  background: 'none',
  border: 0,
  padding: 0,
  fontFamily: 'inherit',
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
} as const;

/** Champ date flottant cliquable (Arrivée / Départ) — affichage + cible de sélection. */
export const FloatDateField: React.FC<{
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, value, active, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      position: 'relative',
      width: '100%',
      height: 44,
      borderRadius: '11px',
      backgroundColor: active ? 'var(--card)' : 'var(--field)',
      border: '1px solid',
      borderColor: active ? 'var(--accent)' : 'var(--field-line)',
      boxShadow: active ? '0 0 0 3px var(--accent-soft)' : 'none',
      display: 'flex',
      alignItems: 'center',
      padding: '0 13px',
      fontFamily: 'inherit',
      fontSize: '13.5px',
      fontWeight: value ? 600 : 500,
      color: value ? 'var(--ink)' : 'var(--faint)',
      cursor: 'pointer',
      textAlign: 'left',
      fontVariantNumeric: 'tabular-nums',
      transition: 'border-color .14s, box-shadow .14s, background-color .14s',
      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
    }}
  >
    <Box
      component="span"
      sx={{
        position: 'absolute',
        top: -7,
        insetInlineStart: 12,
        backgroundColor: 'var(--card)',
        padding: '0 5px',
        fontSize: '10.5px',
        fontWeight: 600,
        color: 'var(--muted)',
        lineHeight: '14px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
    {value || '—'}
  </Box>
);

export interface ReservationRangeCalendarProps {
  startDate: string;
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
  /** Nombre de nuits (affiché dans la ligne sous le calendrier). */
  nights: number;
  /** Libellés i18n. */
  arrivalLabel: string;
  departureLabel: string;
  clearLabel: string;
  /** Texte « N nuits » déjà formaté (pluralisation gérée par le parent). */
  nightsText: string;
  prevMonthLabel: string;
  nextMonthLabel: string;
  /** Locale pour le libellé du mois (ex. 'fr-FR', 'en-US', 'ar'). */
  locale: string;
  /** 7 initiales de jours (Lun→Dim). */
  weekdayLabels?: string[];
}

const ReservationRangeCalendar: React.FC<ReservationRangeCalendarProps> = ({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  nights,
  arrivalLabel,
  departureLabel,
  clearLabel,
  nightsText,
  prevMonthLabel,
  nextMonthLabel,
  locale,
  weekdayLabels = DEFAULT_WEEKDAYS,
}) => {
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  // Sync displayed month when startDate prop changes (e.g. set by parent after mount)
  useEffect(() => {
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      setViewMonth((prev) => {
        if (prev.getFullYear() === y && prev.getMonth() === m - 1) return prev;
        return new Date(y, m - 1, 1);
      });
    }
  }, [startDate]);

  const [selectingField, setSelectingField] = useState<'start' | 'end'>('start');

  // Deux mois côte à côte (mois courant + suivant) ; repli à un seul mois si étroit.
  const singleMonth = useMediaQuery('(max-width: 760px)');
  const secondMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    [viewMonth],
  );
  const cells1 = useMemo(() => buildCalGrid(viewMonth), [viewMonth]);
  const cells2 = useMemo(() => buildCalGrid(secondMonth), [secondMonth]);

  const handleCellClick = useCallback(
    (dateStr: string) => {
      if (selectingField === 'start') {
        onChangeStart(dateStr);
        if (endDate && dateStr > endDate) {
          onChangeEnd('');
        }
        setSelectingField('end');
      } else {
        if (startDate && dateStr < startDate) {
          onChangeStart(dateStr);
          onChangeEnd('');
          setSelectingField('end');
        } else {
          onChangeEnd(dateStr);
          setSelectingField('start');
        }
      }
    },
    [selectingField, startDate, endDate, onChangeStart, onChangeEnd],
  );

  const isInRange = useCallback(
    (dateStr: string): boolean => {
      if (!startDate || !endDate) return false;
      return dateStr >= startDate && dateStr <= endDate;
    },
    [startDate, endDate],
  );

  const fmtMonth = (d: Date) => d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  // Rend UN mois : libellé + en-tête jours + grille 7 colonnes. La plage (edges /
  // in-range) fonctionne à cheval sur les deux mois via les mêmes handlers.
  const renderMonth = (cells: CalCell[], label: string) => (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box
        component="b"
        sx={{
          display: 'block',
          fontFamily: 'var(--font-display)',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--ink)',
          textAlign: 'center',
          textTransform: 'capitalize',
          marginBottom: '6px',
        }}
      >
        {label}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
        {weekdayLabels.map((wl, i) => (
          <Box
            key={`${wl}-${i}`}
            sx={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', padding: '4px 0' }}
          >
            {wl}
          </Box>
        ))}
        {cells.map((cell) => {
          // Jours des mois adjacents : cellule vide (garde l'alignement 7 colonnes),
          // pas de numéro ni de surbrillance — ils n'appartiennent pas à ce mois.
          if (!cell.inMonth) return <Box key={cell.dateStr} aria-hidden sx={{ aspectRatio: '1' }} />;

          const isStart = cell.dateStr === startDate;
          const isEnd = cell.dateStr === endDate;
          const edge = isStart || isEnd;
          const inRange = !edge && isInRange(cell.dateStr);

          return (
            <Box
              key={cell.dateStr}
              component="button"
              type="button"
              onClick={() => handleCellClick(cell.dateStr)}
              sx={{
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 0,
                padding: 0,
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: edge
                  ? 'var(--on-accent)'
                  : inRange
                    ? 'var(--accent)'
                    : cell.inMonth
                      ? 'var(--body)'
                      : 'var(--faint)',
                backgroundColor: edge ? 'var(--accent)' : inRange ? 'var(--accent-soft)' : 'transparent',
                borderRadius: edge
                  ? isStart && isEnd
                    ? '9px'
                    : isStart
                      ? '9px 0 0 9px'
                      : '0 9px 9px 0'
                  : inRange
                    ? 0
                    : '9px',
                opacity: cell.inMonth ? 1 : 0.5,
                cursor: cell.inMonth ? 'pointer' : 'default',
                transition: 'background .12s, color .12s',
                userSelect: 'none',
                ...(cell.inMonth && !edge && !inRange ? { '&:hover': { backgroundColor: 'var(--hover)' } } : {}),
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
              }}
            >
              {cell.date.getDate()}
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Champs Arrivée / Départ (cibles de sélection) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <FloatDateField
          label={arrivalLabel}
          value={startDate}
          active={selectingField === 'start'}
          onClick={() => setSelectingField('start')}
        />
        <FloatDateField
          label={departureLabel}
          value={endDate}
          active={selectingField === 'end'}
          onClick={() => setSelectingField('end')}
        />
      </Box>

      <Box>
        {/* Navigation : décale la paire de mois. Chevrons aux extrémités (style Airbnb). */}
        <Box sx={{ position: 'relative', minHeight: 28, marginBottom: '2px' }}>
          <Box
            component="button"
            type="button"
            aria-label={prevMonthLabel}
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            sx={{ ...CAL_NAV_BTN_SX, position: 'absolute', insetInlineStart: 0, top: 0 }}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </Box>
          <Box
            component="button"
            type="button"
            aria-label={nextMonthLabel}
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            sx={{ ...CAL_NAV_BTN_SX, position: 'absolute', insetInlineEnd: 0, top: 0 }}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </Box>
        </Box>

        {/* Un ou deux mois côte à côte */}
        <Box sx={{ display: 'grid', gridTemplateColumns: singleMonth ? '1fr' : '1fr 1fr', gap: '28px' }}>
          {renderMonth(cells1, fmtMonth(viewMonth))}
          {!singleMonth && renderMonth(cells2, fmtMonth(secondMonth))}
        </Box>

        {/* Nuits + Effacer */}
        {(startDate || endDate) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            {nights > 0 ? (
              <Box
                sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}
              >
                <NightsStay size={13} strokeWidth={1.75} />
                {nightsText}
              </Box>
            ) : (
              <span />
            )}
            <Box
              component="button"
              type="button"
              onClick={() => {
                onChangeStart('');
                onChangeEnd('');
                setSelectingField('start');
              }}
              sx={CLEAR_LINK_SX}
            >
              {clearLabel}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ReservationRangeCalendar;
