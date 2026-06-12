import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  Box,
  Typography,
  TextField,
  Chip,
  Autocomplete,
  CircularProgress,
  Collapse,
  Switch,
  useMediaQuery,
} from '@mui/material';
import {
  Close,
  Home,
  PersonAdd,
  Person,
  NightsStay,
  Percent,
  Edit as EditIcon,
  Remove as RemoveIcon,
  Add as AddIcon,
  Group as GroupIcon,
  CleaningServices,
  AccessTime,
  CheckCircle,
  Schedule,
  Public as GlobeIcon,
  Search as SearchIcon,
  ChevronLeft,
  ChevronRight,
  Numbers as HashIcon,
  Receipt as ReceiptIcon,
  RemoveCircleOutline as MinusCircleIcon,
  Check,
  Warning as WarningIcon,
} from '../../icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuickCreateData, PlanningEvent } from './types';
import type { CreateReservationData } from '../../services/api';
import { reservationsApi, guestsApi, propertiesApi } from '../../services/api';
import type { GuestDto, CreateGuestData } from '../../services/api';
import { planningKeys } from './hooks/usePlanningData';

// ─── Modale « Nouvelle réservation » (maquette Signature) ────────────────────
//
// Reskin fidèle de la référence « Modale Nouvelle Réservation.html » (.s-modal /
// .rm-*) : carte 980px radius 18 shadow-pop, entête titre + pilule canal +
// segmented statut + propriété + ✕, corps 2 colonnes (dates/calendrier range/
// heures/voyageur | tarification/ménage/taxe/code/notes), alerte conflit pleine
// largeur, pied surface-2. Tokens var(--…) de theme/signature/tokens.css.
// AUCUNE logique modifiée : états, queries, mutations et validations intacts.

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlanningQuickCreateDialogProps {
  open: boolean;
  data: QuickCreateData | null;
  onClose: () => void;
  /** All planning events for conflict detection */
  events?: PlanningEvent[];
}

type PricingMode = 'custom' | 'discount_euro' | 'discount_percent';

// ─── Styles « Signature » ────────────────────────────────────────────────────

/** Overline de section (.rm-sec) */
const SEC_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
} as const;

/** Champ flottant (.rm-field/.rm-input) — appliqué aux TextField outlined. */
const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    minHeight: 44,
    borderRadius: '11px',
    backgroundColor: 'var(--field)',
    fontFamily: 'inherit',
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--ink)',
    transition: 'box-shadow .14s, background-color .14s',
    '& fieldset': { borderColor: 'var(--field-line)', transition: 'border-color .14s' },
    '&:hover fieldset': { borderColor: 'var(--field-line)' },
    '&.Mui-focused': { backgroundColor: 'var(--card)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: '1px' },
    '&.MuiInputBase-adornedStart': { paddingLeft: '13px' },
    '&.Mui-disabled': { backgroundColor: 'var(--field)' },
  },
  '& .MuiOutlinedInput-input': { padding: '0 13px', height: 44, boxSizing: 'border-box' },
  '& .MuiInputBase-adornedStart .MuiOutlinedInput-input': { paddingLeft: '8px' },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--faint)', fontWeight: 500, opacity: 1 },
  '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: 'var(--body)' },
  '& .MuiInputLabel-root': {
    // 14px × scale(0.75) = 10.5px une fois flottant (réf. label .rm-field)
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--muted)',
    '&.Mui-focused': { color: 'var(--muted)' },
    '&.Mui-disabled': { color: 'var(--muted)' },
  },
} as const;

/** Variante textarea (.rm-textarea) */
const TEXTAREA_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '11px',
    backgroundColor: 'var(--field)',
    padding: '11px 13px',
    fontFamily: 'inherit',
    fontSize: '13px',
    color: 'var(--body)',
    lineHeight: 1.5,
    transition: 'box-shadow .14s, background-color .14s',
    '& fieldset': { borderColor: 'var(--field-line)', transition: 'border-color .14s' },
    '&:hover fieldset': { borderColor: 'var(--field-line)' },
    '&.Mui-focused': { backgroundColor: 'var(--card)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: '1px' },
  },
  '& .MuiOutlinedInput-input': { padding: 0 },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--faint)', fontWeight: 500, opacity: 1 },
  '& .MuiInputLabel-root': {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--muted)',
    '&.Mui-focused': { color: 'var(--muted)' },
  },
} as const;

/** Bouton .s-btn (base) */
const BTN_BASE_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  height: 38,
  padding: '0 17px',
  borderRadius: '11px',
  fontFamily: 'inherit',
  fontSize: '12.5px',
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'transform .12s, background .14s, border-color .14s, color .14s',
  '&:active:not(:disabled)': { transform: 'scale(.97)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
} as const;

/** .s-btn--ghost */
const BTN_GHOST_SX = {
  ...BTN_BASE_SX,
  background: 'none',
  color: 'var(--muted)',
  '&:hover': { color: 'var(--ink)' },
} as const;

/** .s-btn--p (contour accent) */
const BTN_PRIMARY_SX = {
  ...BTN_BASE_SX,
  background: 'transparent',
  borderColor: 'var(--accent)',
  color: 'var(--accent)',
  '&:hover:not(:disabled)': { backgroundColor: 'var(--accent-soft)' },
  '&:disabled': { opacity: 0.45, cursor: 'not-allowed' },
} as const;

/** Lien accent (.rm-link / .rm-clear) */
const LINK_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12.5px',
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
  background: 'none',
  border: 0,
  padding: 0,
  fontFamily: 'inherit',
  alignSelf: 'flex-start',
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
} as const;

/** Segmented (.rm-status / .rm-tariftabs) — conteneur */
const SEG_WRAP_SX = {
  display: 'inline-flex',
  backgroundColor: 'var(--field)',
  border: '1px solid var(--field-line)',
  borderRadius: '10px',
  padding: '3px',
  gap: '2px',
} as const;

/** Segmented — bouton */
const segBtnSx = (on: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: 0,
  background: on ? 'var(--card)' : 'none',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  color: on ? 'var(--accent)' : 'var(--muted)',
  padding: '6px 12px',
  borderRadius: '7px',
  cursor: 'pointer',
  boxShadow: on ? '0 1px 3px rgba(21,36,45,.12)' : 'none',
  transition: 'background .14s, color .14s',
  whiteSpace: 'nowrap' as const,
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
});

/** Icône d'adornment (.rm-ic) */
const AdornIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}>{children}</Box>
);

/** Toggle ménage (.rm-toggle) — Switch MUI redimensionné 42×24, pouce 20. */
const SWITCH_SX = {
  width: 42,
  height: 24,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: '2px',
    '&.Mui-checked': {
      transform: 'translateX(18px)',
      '& + .MuiSwitch-track': { backgroundColor: 'var(--accent)', opacity: 1 },
    },
  },
  '& .MuiSwitch-thumb': { width: 20, height: 20, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' },
  '& .MuiSwitch-track': { borderRadius: 99, backgroundColor: 'var(--line-2)', opacity: 1, transition: 'background-color .18s' },
} as const;

/** Generate a random confirmation code for direct reservations */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `DIR-${code}`;
}

// ─── Calendrier range « Signature » (.rm-cal) ───────────────────────────────
// Même comportement que MiniDateRangePicker (sélection début → fin, reset si
// fin < début, Effacer), look maquette : grille 7 col gap 3, jours aspect 1,
// in-range accent-soft sans radius, edges accent blanc.

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

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

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

/** Champ date flottant cliquable (Arrivée / Départ) — affichage + cible de sélection. */
const FloatDateField: React.FC<{
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
      transition: 'border-color .14s, box-shadow .14s, background-color .14s',
      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
    }}
  >
    <Box
      component="span"
      sx={{
        position: 'absolute',
        top: -7,
        left: 12,
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

interface SignatureRangeCalendarProps {
  startDate: string;
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
  /** Nombre de nuits (affiché dans la ligne sous le calendrier). */
  nights: number;
}

const SignatureRangeCalendar: React.FC<SignatureRangeCalendarProps> = ({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  nights,
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

  const cells = useMemo(() => buildCalGrid(viewMonth), [viewMonth]);

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

  const monthLabel = viewMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Champs Arrivée / Départ (cibles de sélection) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <FloatDateField
          label="Arrivée"
          value={startDate}
          active={selectingField === 'start'}
          onClick={() => setSelectingField('start')}
        />
        <FloatDateField
          label="Départ"
          value={endDate}
          active={selectingField === 'end'}
          onClick={() => setSelectingField('end')}
        />
      </Box>

      <Box>
        {/* Navigation mois */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '6px' }}>
          <Box
            component="button"
            type="button"
            aria-label="Mois précédent"
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            sx={CAL_NAV_BTN_SX}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </Box>
          <Box
            component="b"
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--ink)',
              minWidth: 120,
              textAlign: 'center',
              textTransform: 'capitalize',
            }}
          >
            {monthLabel}
          </Box>
          <Box
            component="button"
            type="button"
            aria-label="Mois suivant"
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            sx={CAL_NAV_BTN_SX}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </Box>
        </Box>

        {/* Grille 7 colonnes */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {WEEKDAYS.map((label, i) => (
            <Box
              key={`${label}-${i}`}
              sx={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', padding: '4px 0' }}
            >
              {label}
            </Box>
          ))}
          {cells.map((cell) => {
            const isStart = cell.dateStr === startDate;
            const isEnd = cell.dateStr === endDate;
            const edge = isStart || isEnd;
            const inRange = !edge && isInRange(cell.dateStr);

            return (
              <Box
                key={cell.dateStr}
                component="button"
                type="button"
                disabled={!cell.inMonth}
                onClick={() => cell.inMonth && handleCellClick(cell.dateStr)}
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
                  ...(cell.inMonth && !edge && !inRange
                    ? { '&:hover': { backgroundColor: 'var(--hover)' } }
                    : {}),
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
                }}
              >
                {cell.date.getDate()}
              </Box>
            );
          })}
        </Box>

        {/* Nuits + Effacer */}
        {(startDate || endDate) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            {nights > 0 ? (
              <Box
                sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}
              >
                <NightsStay size={13} strokeWidth={1.75} />
                {nights} nuit{nights > 1 ? 's' : ''}
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
              sx={{ ...LINK_SX, fontSize: '12px', alignSelf: 'auto' }}
            >
              Effacer
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const PlanningQuickCreateDialog: React.FC<PlanningQuickCreateDialogProps> = ({
  open,
  data,
  onClose,
  events = [],
}) => {
  const queryClient = useQueryClient();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // ── Dates ──────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Guest ──────────────────────────────────────────────────────────────
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestDto | null>(null);
  const [showCreateGuestForm, setShowCreateGuestForm] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState('');
  const [newGuestLastName, setNewGuestLastName] = useState('');
  const [newGuestEmail, setNewGuestEmail] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');

  // ── Pricing ────────────────────────────────────────────────────────────
  const [pricingMode, setPricingMode] = useState<PricingMode>('custom');
  const [pricingValue, setPricingValue] = useState('');

  // ── Status ────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<'confirmed' | 'pending'>('pending');

  // ── Times ─────────────────────────────────────────────────────────────
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');

  // ── Cleaning ──────────────────────────────────────────────────────────
  const [createCleaning, setCreateCleaning] = useState(false);
  const [cleaningFee, setCleaningFee] = useState('');

  // ── Tourist tax ───────────────────────────────────────────────────────
  const [touristTaxPerPerson, setTouristTaxPerPerson] = useState('');

  // ── Confirmation code ─────────────────────────────────────────────────
  const [confirmationCode, setConfirmationCode] = useState('');

  // ── Other fields ──────────────────────────────────────────────────────
  const [guestCount, setGuestCount] = useState(2);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Fetch fresh property details (for cleaningBasePrice fallback) ─────
  const propertyId = data?.propertyId;
  const freshPropertyQuery = useQuery({
    queryKey: ['property-fresh', propertyId],
    queryFn: () => propertiesApi.getById(propertyId!),
    enabled: !!propertyId && open,
    staleTime: 30_000,
  });

  // ── Init state from data ──────────────────────────────────────────────
  useEffect(() => {
    if (data && open) {
      const defaultCheckIn = data.defaultCheckInTime ?? '15:00';
      const defaultCheckOut = data.defaultCheckOutTime ?? '11:00';

      // ── Auto-adjust start: find the latest event end within the selected range ──
      let adjustedStartDate = data.startDate;
      let adjustedCheckInTime = defaultCheckIn;

      const toTs = (date: string, time?: string) => time ? `${date} ${time}` : date;
      const samePropertyEvents = events.filter((e) => e.propertyId === data.propertyId);

      // Find events that overlap with the selected range
      let latestEndTs = '';
      let latestEndDate = '';
      let latestEndTime = '';

      for (const evt of samePropertyEvents) {
        const evtEnd = toTs(evt.endDate, evt.endTime);
        const evtStart = toTs(evt.startDate, evt.startTime);
        const rangeStart = toTs(data.startDate, defaultCheckIn);
        const rangeEnd = toTs(data.endDate, defaultCheckOut);

        // Event overlaps with the selected range
        if (evtStart < rangeEnd && evtEnd > rangeStart) {
          if (evtEnd > latestEndTs) {
            latestEndTs = evtEnd;
            latestEndDate = evt.endDate;
            latestEndTime = evt.endTime || '';
          }
        }
      }

      // If conflicting events found, push start after the latest one
      if (latestEndTs && latestEndDate) {
        // For reservations ending on a date with a checkout time (e.g. 11:00),
        // the cleaning starts at checkout. We need to find the latest intervention
        // linked to that checkout date too — already handled since interventions
        // are included in events list.
        adjustedStartDate = latestEndDate;

        // If the latest event ends with a time, use it as the new check-in time
        // (or default check-in if it's earlier)
        if (latestEndTime) {
          // Use the later of: latest event end time vs default check-in
          adjustedCheckInTime = latestEndTime > defaultCheckIn ? latestEndTime : defaultCheckIn;
        }

        // If adjusted start equals or exceeds the end date, keep at least 1 night
        if (adjustedStartDate >= data.endDate) {
          adjustedStartDate = data.endDate;
          // Push end date by 1 day to ensure at least 1 night
          const newEnd = new Date(data.endDate);
          newEnd.setDate(newEnd.getDate() + 1);
          setEndDate(newEnd.toISOString().split('T')[0]);
        } else {
          setEndDate(data.endDate);
        }
      } else {
        setEndDate(data.endDate);
      }

      setStartDate(adjustedStartDate);
      setCheckInTime(adjustedCheckInTime);
      setCheckOutTime(defaultCheckOut);
      setStatus('pending');
      setCreateCleaning(data.cleaningFrequency?.toUpperCase() === 'AFTER_EACH_STAY');
      setCleaningFee(data.cleaningBasePrice ? String(data.cleaningBasePrice) : '');
      setTouristTaxPerPerson('');
      setConfirmationCode(generateConfirmationCode());
      setGuestSearchQuery('');
      setSelectedGuest(null);
      setShowCreateGuestForm(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestPhone('');
      setPricingMode('custom');
      setPricingValue('');
      setGuestCount(2);
      setNotes('');
      setError(null);
    }
  }, [data, open, events]);

  // ── Fallback: fill cleaning fields from fresh property data ───────────
  const freshProp = freshPropertyQuery.data;
  useEffect(() => {
    if (!open || !freshProp) return;
    // Only fill if not already set from planning data
    if (!cleaningFee && freshProp.cleaningBasePrice) {
      setCleaningFee(String(freshProp.cleaningBasePrice));
    }
    if (!createCleaning && freshProp.cleaningFrequency?.toUpperCase() === 'AFTER_EACH_STAY') {
      setCreateCleaning(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshProp, open]);

  // ── Conflict detection (reservations + interventions) ─────────────────
  const conflictWarnings = useMemo(() => {
    if (!data || !startDate || !endDate) return [];
    const warnings: string[] = [];

    // Combine date + time into a comparable timestamp
    const toTs = (date: string, time?: string) => time ? `${date} ${time}` : date;
    const newStart = toTs(startDate, checkInTime);
    const newEnd = toTs(endDate, checkOutTime);

    // Check events on the same property
    const samePropertyEvents = events.filter((e) => e.propertyId === data.propertyId);

    for (const evt of samePropertyEvents) {
      const evtStart = toTs(evt.startDate, evt.startTime);
      const evtEnd = toTs(evt.endDate, evt.endTime);

      // Overlap: newStart < evtEnd AND evtStart < newEnd
      if (newStart < evtEnd && evtStart < newEnd) {
        if (evt.type === 'reservation') {
          warnings.push(`Conflit avec la réservation de ${evt.label} (${evt.startDate} → ${evt.endDate})`);
        } else if (evt.type === 'cleaning') {
          warnings.push(`Conflit avec un ménage prévu (${evt.startDate} ${evt.startTime || ''} → ${evt.endDate} ${evt.endTime || ''})`);
        } else if (evt.type === 'maintenance') {
          warnings.push(`Conflit avec une maintenance prévue (${evt.startDate} ${evt.startTime || ''} → ${evt.endDate} ${evt.endTime || ''})`);
        } else {
          warnings.push(`Conflit avec un blocage (${evt.startDate} → ${evt.endDate})`);
        }
      }
    }

    return warnings;
  }, [data, startDate, endDate, checkInTime, checkOutTime, events]);

  const hasConflict = conflictWarnings.length > 0;

  // ── Computed values ────────────────────────────────────────────────────
  const numberOfNights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [startDate, endDate]);

  const baseNightlyPrice = data?.nightlyPrice ?? 0;

  const effectiveNightlyPrice = useMemo(() => {
    if (!pricingValue || isNaN(parseFloat(pricingValue))) return baseNightlyPrice;
    const val = parseFloat(pricingValue);
    switch (pricingMode) {
      case 'custom':
        return val;
      case 'discount_euro':
        return Math.max(0, baseNightlyPrice - val);
      case 'discount_percent':
        return Math.max(0, baseNightlyPrice * (1 - val / 100));
    }
  }, [pricingMode, pricingValue, baseNightlyPrice]);

  const cleaningFeeAmount = useMemo(() => {
    if (!createCleaning || !cleaningFee) return 0;
    return parseFloat(cleaningFee) || 0;
  }, [createCleaning, cleaningFee]);

  const touristTaxAmount = useMemo(() => {
    const rate = parseFloat(touristTaxPerPerson) || 0;
    return Math.round(rate * guestCount * numberOfNights * 100) / 100;
  }, [touristTaxPerPerson, guestCount, numberOfNights]);

  const accommodationTotal = useMemo(
    () => Math.round(effectiveNightlyPrice * numberOfNights * 100) / 100,
    [effectiveNightlyPrice, numberOfNights],
  );

  const totalPrice = useMemo(
    () => Math.round((accommodationTotal + cleaningFeeAmount + touristTaxAmount) * 100) / 100,
    [accommodationTotal, cleaningFeeAmount, touristTaxAmount],
  );

  // ── Guest search (debounced via staleTime) ─────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(guestSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [guestSearchQuery]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['guest-search', debouncedSearch],
    queryFn: () => guestsApi.search(debouncedSearch),
    enabled: debouncedSearch.length >= 2 && !selectedGuest,
    staleTime: 10_000,
  });

  // ── Guest create mutation ──────────────────────────────────────────────
  const createGuestMutation = useMutation({
    mutationFn: (guestData: CreateGuestData) => guestsApi.create(guestData),
    onSuccess: (guest) => {
      setSelectedGuest(guest);
      setShowCreateGuestForm(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestPhone('');
    },
  });

  const handleCreateGuest = useCallback(() => {
    if (!newGuestFirstName.trim() || !newGuestLastName.trim()) return;
    createGuestMutation.mutate({
      firstName: newGuestFirstName.trim(),
      lastName: newGuestLastName.trim(),
      email: newGuestEmail.trim() || undefined,
      phone: newGuestPhone.trim() || undefined,
    });
  }, [newGuestFirstName, newGuestLastName, newGuestEmail, newGuestPhone, createGuestMutation]);

  // ── Reservation create mutation ────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (createData: CreateReservationData) => reservationsApi.create(createData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.all });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la création');
    },
  });

  const handleSubmit = useCallback(() => {
    if (!data) return;
    if (!selectedGuest) {
      setError('Veuillez sélectionner ou créer un voyageur');
      return;
    }
    if (!startDate || !endDate) {
      setError('Veuillez sélectionner les dates');
      return;
    }
    if (hasConflict) {
      setError('Impossible de créer la réservation : conflit avec un évènement existant sur ce créneau');
      return;
    }

    setError(null);
    createMutation.mutate({
      propertyId: data.propertyId,
      guestName: selectedGuest.fullName,
      guestId: selectedGuest.id,
      guestCount,
      checkIn: startDate,
      checkOut: endDate,
      checkInTime,
      checkOutTime,
      status,
      totalPrice: totalPrice || undefined,
      cleaningFee: cleaningFeeAmount || undefined,
      touristTaxAmount: touristTaxAmount || undefined,
      confirmationCode: confirmationCode || undefined,
      createCleaning,
      notes: notes || undefined,
    });
  }, [data, selectedGuest, startDate, endDate, checkInTime, checkOutTime, status, guestCount, totalPrice, cleaningFeeAmount, touristTaxAmount, confirmationCode, createCleaning, notes, hasConflict, createMutation]);

  if (!data) return null;

  const pricingLabel =
    pricingMode === 'custom'
      ? 'Prix perso. (€/nuit)'
      : pricingMode === 'discount_euro'
        ? 'Réduction (€)'
        : 'Réduction (%)';

  const estimatedCleaningPrice = freshProp?.cleaningBasePrice ?? data.cleaningBasePrice;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 980,
          maxWidth: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--card)',
          backgroundImage: 'none',
          color: 'var(--body)',
          border: '1px solid var(--line)',
          borderRadius: '18px',
          boxShadow: 'var(--shadow-pop)',
          // Entrée .s-modal : translateY(12px) scale(.985) → none
          '@keyframes rmodalIn': {
            from: { transform: 'translateY(12px) scale(.985)' },
            to: { transform: 'none' },
          },
          animation: reduceMotion ? 'none' : 'rmodalIn .22s cubic-bezier(.16,1,.3,1)',
        },
      }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(10,18,24,.5)', backdropFilter: 'blur(3px)' },
        },
      }}
    >
      {/* ── Entête (.rm-head) ─────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '18px 22px',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}
      >
        <Typography
          component="span"
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          Nouvelle réservation
        </Typography>

        {/* Pilule canal (.rm-chan) */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent)',
            backgroundColor: 'var(--accent-soft)',
            borderRadius: '20px',
            padding: '4px 11px',
            flexShrink: 0,
          }}
        >
          <GlobeIcon size={13} strokeWidth={2} />
          Direct
        </Box>

        {/* Segmented statut (.rm-status) */}
        <Box sx={{ ...SEG_WRAP_SX, marginLeft: '4px', flexShrink: 0 }}>
          <Box component="button" type="button" onClick={() => setStatus('pending')} sx={segBtnSx(status === 'pending')}>
            <Schedule size={13} strokeWidth={1.75} />
            En attente
          </Box>
          <Box component="button" type="button" onClick={() => setStatus('confirmed')} sx={segBtnSx(status === 'confirmed')}>
            <CheckCircle size={13} strokeWidth={1.75} />
            Confirmée
          </Box>
        </Box>

        {/* Propriété (.rm-prop) */}
        <Box
          sx={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--ink)',
            minWidth: 0,
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', flexShrink: 0 }}>
            <Home size={16} strokeWidth={1.75} />
          </Box>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.propertyName}
          </Box>
        </Box>

        {/* ✕ (.rm-x) */}
        <Box
          component="button"
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            border: '1px solid var(--line-2)',
            backgroundColor: 'var(--card)',
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 0,
            transition: 'color .14s, border-color .14s',
            '&:hover': { color: 'var(--err)', borderColor: 'var(--err)' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
          }}
        >
          <Close size={16} strokeWidth={1.75} />
        </Box>
      </Box>

      {/* ── Corps 2 colonnes (.rm-body) ───────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* ── Colonne gauche : dates + calendrier + heures + voyageur ───── */}
        <Box
          sx={{
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            borderRight: '1px solid var(--line)',
          }}
        >
          <Typography sx={SEC_SX}>Dates du séjour</Typography>

          <SignatureRangeCalendar
            startDate={startDate}
            endDate={endDate}
            onChangeStart={setStartDate}
            onChangeEnd={setEndDate}
            nights={numberOfNights}
          />

          {/* Heures arrivée / départ */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <TextField
              label="Arrivée"
              type="time"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <AdornIcon><AccessTime size={15} strokeWidth={1.75} /></AdornIcon>,
              }}
              InputLabelProps={{ shrink: true }}
              sx={FIELD_SX}
            />
            <TextField
              label="Départ"
              type="time"
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <AdornIcon><AccessTime size={15} strokeWidth={1.75} /></AdornIcon>,
              }}
              InputLabelProps={{ shrink: true }}
              sx={FIELD_SX}
            />
          </Box>

          <Typography sx={{ ...SEC_SX, marginTop: '4px' }}>Voyageur</Typography>

          {selectedGuest ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <Chip
                icon={<Person size={15} strokeWidth={1.75} />}
                label={selectedGuest.fullName}
                onDelete={() => {
                  setSelectedGuest(null);
                  setGuestSearchQuery('');
                }}
                sx={{
                  height: 32,
                  borderRadius: '10px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--ink)',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  '& .MuiChip-icon': { color: 'var(--accent)' },
                  '& .MuiChip-deleteIcon': {
                    color: 'var(--accent)',
                    '&:hover': { color: 'var(--accent-deep)' },
                  },
                }}
              />
              {selectedGuest.email && (
                <Typography
                  sx={{
                    fontSize: '11.5px',
                    color: 'var(--muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedGuest.email}
                </Typography>
              )}
            </Box>
          ) : (
            <Autocomplete
              freeSolo={false}
              options={searchResults}
              getOptionLabel={(option) => option.fullName}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                      {option.fullName}
                    </Typography>
                    {option.email && (
                      <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                        {option.email}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              inputValue={guestSearchQuery}
              onInputChange={(_, val) => setGuestSearchQuery(val)}
              value={null}
              onChange={(_, val) => {
                if (val) setSelectedGuest(val);
              }}
              loading={isSearching}
              noOptionsText={debouncedSearch.length >= 2 ? 'Aucun voyageur trouvé' : 'Tapez au moins 2 caractères'}
              slotProps={{
                paper: {
                  sx: {
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    boxShadow: 'var(--shadow-pop)',
                    backgroundColor: 'var(--card)',
                    backgroundImage: 'none',
                  },
                },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Rechercher un voyageur…"
                  sx={[
                    FIELD_SX,
                    {
                      '& .MuiOutlinedInput-root': { padding: '0 39px 0 13px' },
                      '& .MuiOutlinedInput-root .MuiAutocomplete-input': { padding: '0 0 0 8px', fontWeight: 500 },
                    },
                  ]}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <AdornIcon><SearchIcon size={15} strokeWidth={1.75} /></AdornIcon>,
                    endAdornment: (
                      <>
                        {isSearching ? <CircularProgress size={16} sx={{ color: 'var(--accent)' }} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}

          {/* Créer une fiche client (.rm-link) + formulaire */}
          {!selectedGuest && (
            <>
              <Box
                component="button"
                type="button"
                onClick={() => setShowCreateGuestForm(!showCreateGuestForm)}
                sx={LINK_SX}
              >
                <PersonAdd size={15} strokeWidth={1.75} />
                {showCreateGuestForm ? 'Annuler' : 'Créer une fiche client'}
              </Box>

              <Collapse in={showCreateGuestForm} sx={{ marginTop: '-10px' }}>
                <Box
                  sx={{
                    padding: '18px 14px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    backgroundColor: 'var(--surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    marginTop: '10px',
                  }}
                >
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <TextField
                      label="Prénom"
                      value={newGuestFirstName}
                      onChange={(e) => setNewGuestFirstName(e.target.value)}
                      required
                      InputLabelProps={{ shrink: true }}
                      sx={FIELD_SX}
                    />
                    <TextField
                      label="Nom"
                      value={newGuestLastName}
                      onChange={(e) => setNewGuestLastName(e.target.value)}
                      required
                      InputLabelProps={{ shrink: true }}
                      sx={FIELD_SX}
                    />
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <TextField
                      label="Email"
                      type="email"
                      value={newGuestEmail}
                      onChange={(e) => setNewGuestEmail(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={FIELD_SX}
                    />
                    <TextField
                      label="Téléphone"
                      value={newGuestPhone}
                      onChange={(e) => setNewGuestPhone(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={FIELD_SX}
                    />
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    onClick={handleCreateGuest}
                    disabled={!newGuestFirstName.trim() || !newGuestLastName.trim() || createGuestMutation.isPending}
                    sx={{ ...BTN_PRIMARY_SX, height: 32, fontSize: '12px', padding: '0 14px', alignSelf: 'flex-start' }}
                  >
                    {createGuestMutation.isPending ? (
                      <CircularProgress size={14} sx={{ color: 'var(--accent)' }} />
                    ) : (
                      'Créer le voyageur'
                    )}
                  </Box>
                  {createGuestMutation.isError && (
                    <Typography sx={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--err)' }}>
                      Erreur lors de la création
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </>
          )}

          {/* Compteur voyageurs (.rm-count) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
                <GroupIcon size={16} strokeWidth={1.75} />
              </Box>
              Voyageurs
            </Box>
            <Box
              sx={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--field)',
                border: '1px solid var(--field-line)',
                borderRadius: '10px',
                padding: '3px',
              }}
            >
              <Box
                component="button"
                type="button"
                aria-label="Moins de voyageurs"
                onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                disabled={guestCount <= 1}
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '8px',
                  border: 0,
                  backgroundColor: 'var(--card)',
                  color: 'var(--body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'color .14s',
                  '&:hover:not(:disabled)': { color: 'var(--accent)' },
                  '&:disabled': { opacity: 0.4, cursor: 'default' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
                }}
              >
                <RemoveIcon size={15} strokeWidth={1.75} />
              </Box>
              <Box
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  minWidth: 30,
                  textAlign: 'center',
                  userSelect: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {guestCount}
              </Box>
              <Box
                component="button"
                type="button"
                aria-label="Plus de voyageurs"
                onClick={() => setGuestCount((c) => Math.min(20, c + 1))}
                disabled={guestCount >= 20}
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '8px',
                  border: 0,
                  backgroundColor: 'var(--card)',
                  color: 'var(--body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'color .14s',
                  '&:hover:not(:disabled)': { color: 'var(--accent)' },
                  '&:disabled': { opacity: 0.4, cursor: 'default' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
                }}
              >
                <AddIcon size={15} strokeWidth={1.75} />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Colonne droite : tarification + ménage + code + notes ─────── */}
        <Box sx={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <Typography sx={SEC_SX}>Tarification</Typography>

          {/* Base + prix perso */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <TextField
              label="Base / nuit (€)"
              value={baseNightlyPrice > 0 ? baseNightlyPrice : ''}
              fullWidth
              disabled
              InputProps={{
                startAdornment: (
                  <Box component="span" sx={{ color: 'var(--faint)', fontSize: '14px', fontWeight: 600 }}>€</Box>
                ),
              }}
              InputLabelProps={{ shrink: true }}
              sx={FIELD_SX}
            />
            <TextField
              label={pricingLabel}
              type="number"
              value={pricingValue}
              onChange={(e) => setPricingValue(e.target.value)}
              fullWidth
              placeholder="—"
              inputProps={{ min: 0, step: 0.01 }}
              InputLabelProps={{ shrink: true }}
              sx={FIELD_SX}
            />
          </Box>

          {/* Onglets tarification (.rm-tariftabs) */}
          <Box sx={{ ...SEG_WRAP_SX, width: '100%' }}>
            <Box
              component="button"
              type="button"
              onClick={() => { setPricingMode('custom'); setPricingValue(''); }}
              sx={{ ...segBtnSx(pricingMode === 'custom'), flex: 1, gap: '5px', padding: '7px' }}
            >
              <EditIcon size={13} strokeWidth={1.75} />
              Personnalisé
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => { setPricingMode('discount_euro'); setPricingValue(''); }}
              sx={{ ...segBtnSx(pricingMode === 'discount_euro'), flex: 1, gap: '5px', padding: '7px' }}
            >
              <MinusCircleIcon size={13} strokeWidth={1.75} />
              Réduction €
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => { setPricingMode('discount_percent'); setPricingValue(''); }}
              sx={{ ...segBtnSx(pricingMode === 'discount_percent'), flex: 1, gap: '5px', padding: '7px' }}
            >
              <Percent size={13} strokeWidth={1.75} />
              Réduction %
            </Box>
          </Box>

          {/* Récap (.rm-recap) */}
          {numberOfNights > 0 && (
            <Box sx={{ backgroundColor: 'var(--accent-soft)', borderRadius: '12px', padding: '14px 16px' }}>
              <Typography sx={{ fontSize: '13px', color: 'var(--body)', fontVariantNumeric: 'tabular-nums' }}>
                {numberOfNights} nuit{numberOfNights > 1 ? 's' : ''} × {effectiveNightlyPrice.toFixed(2)} € ={' '}
                <Box component="b" sx={{ color: 'var(--ink)' }}>{accommodationTotal.toFixed(2)} €</Box>
              </Typography>
              {cleaningFeeAmount > 0 && (
                <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                  + Ménage : {cleaningFeeAmount.toFixed(2)} €
                </Typography>
              )}
              {touristTaxAmount > 0 && (
                <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                  + Taxe de séjour : {touristTaxAmount.toFixed(2)} €
                </Typography>
              )}
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '17px',
                  fontWeight: 600,
                  color: 'var(--accent-deep)',
                  marginTop: '6px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                Total : {totalPrice.toFixed(2)} €
              </Typography>
            </Box>
          )}

          {/* Toggle ménage (.rm-toggle) */}
          <Box
            component="label"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'var(--ink)',
              width: 'fit-content',
            }}
          >
            <Switch
              checked={createCleaning}
              onChange={(e) => setCreateCleaning(e.target.checked)}
              sx={SWITCH_SX}
              disableRipple
            />
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
              <CleaningServices size={16} strokeWidth={1.75} />
            </Box>
            Ménage au départ
          </Box>

          {/* Frais ménage (si toggle actif) + taxe de séjour */}
          <Box sx={{ display: 'grid', gridTemplateColumns: createCleaning ? '1fr 1fr' : '1fr', gap: '12px' }}>
            {createCleaning && (
              <TextField
                label="Frais ménage (€)"
                type="number"
                value={cleaningFee}
                onChange={(e) => setCleaningFee(e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <AdornIcon><CleaningServices size={15} strokeWidth={1.75} /></AdornIcon>,
                }}
                InputLabelProps={{ shrink: true }}
                placeholder={estimatedCleaningPrice ? String(estimatedCleaningPrice) : '0'}
                sx={FIELD_SX}
              />
            )}
            <TextField
              label="Taxe / pers. / nuit (€)"
              type="number"
              value={touristTaxPerPerson}
              onChange={(e) => setTouristTaxPerPerson(e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
              InputProps={{
                startAdornment: <AdornIcon><ReceiptIcon size={15} strokeWidth={1.75} /></AdornIcon>,
                endAdornment: touristTaxAmount > 0 ? (
                  <Typography
                    sx={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      color: 'var(--muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    = {touristTaxAmount.toFixed(2)} €
                  </Typography>
                ) : undefined,
              }}
              InputLabelProps={{ shrink: true }}
              placeholder="0"
              sx={FIELD_SX}
            />
          </Box>
          {createCleaning && estimatedCleaningPrice != null && estimatedCleaningPrice > 0 && (
            <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '-12px' }}>
              Montant estimé du logement : {estimatedCleaningPrice.toFixed(2)} €
            </Typography>
          )}

          {/* Code de confirmation */}
          <TextField
            label="Code de confirmation"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <AdornIcon><HashIcon size={15} strokeWidth={1.75} /></AdornIcon>,
            }}
            InputLabelProps={{ shrink: true }}
            sx={FIELD_SX}
          />

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="Informations complémentaires…"
            InputLabelProps={{ shrink: true }}
            sx={TEXTAREA_SX}
          />
        </Box>

        {/* ── Alerte conflit pleine largeur (.rm-conflict) ───────────────── */}
        {hasConflict && (
          <Box
            sx={{
              gridColumn: '1 / -1',
              margin: '0 22px 20px',
              backgroundColor: 'var(--warn-soft)',
              border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
              borderRadius: '12px',
              padding: '13px 16px',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--ink)',
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}>
                <WarningIcon size={17} strokeWidth={1.75} />
              </Box>
              Conflit détecté
            </Box>
            {conflictWarnings.map((w, i) => (
              <Typography key={i} sx={{ fontSize: '12.5px', color: 'var(--body)', marginTop: '4px', paddingLeft: '26px' }}>
                {w}
              </Typography>
            ))}
          </Box>
        )}

        {/* Message d'erreur */}
        {error && (
          <Typography
            sx={{
              gridColumn: '1 / -1',
              margin: '0 22px 20px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--err)',
            }}
          >
            {error}
          </Typography>
        )}
      </Box>

      {/* ── Pied (.rm-foot) ───────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '14px 22px',
          borderTop: '1px solid var(--line)',
          backgroundColor: 'var(--surface-2)',
          flexShrink: 0,
        }}
      >
        <Box component="button" type="button" onClick={onClose} sx={BTN_GHOST_SX}>
          Annuler
        </Box>
        <Box
          component="button"
          type="button"
          onClick={handleSubmit}
          disabled={createMutation.isPending || !selectedGuest || !startDate || !endDate || hasConflict}
          sx={BTN_PRIMARY_SX}
        >
          <Check size={15} strokeWidth={2} />
          {createMutation.isPending ? 'Création…' : 'Créer la réservation'}
        </Box>
      </Box>
    </Dialog>
  );
};

export default PlanningQuickCreateDialog;
