import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
import { Alert, IconButton, TextField } from '@mui/material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarMonth,
  Edit,
  Check,
  Close,
  Schedule,
  ArrowForward,
  Phone,
} from '../../../icons';
import type { PlanningEvent } from '../types';
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_SOURCE_LABELS,
} from '../../../services/api/reservationsApi';
import type { ReservationStatus, ReservationSource } from '../../../services/api';
import { RESERVATION_STATUS_TOKEN_COLORS, PLANNING_DEPARTURE_VIOLET } from '../constants';
import { getSourceLogo } from '../utils/sourceLogos';
import { getChannelChipTokens } from '../../../utils/channelChipTokens';
import { toDate } from '../utils/dateUtils';
import { toneTokensSx } from '../../../components/StatusChip';
import GuestAvatar from '../../../components/GuestAvatar';
import PanelReservationCompliance from './PanelReservationCompliance';

// ─── Onglet Infos (maquette Signature) ───────────────────────────────────────
//
// Avatar 56px + nom (display) + ligne logo canal + « · statut » ; rangée de
// chips statut/canal/voyageurs (tokens) ; section « DATES & HORAIRES »
// (overline + crayon — l'édition inline historique est conservée) en 2
// colonnes Check-in / Check-out ; section « NOTES » en blocs var(--field)
// radius 10 (téléphone + notes éditables existantes). Le prix / lien de
// paiement vit dans l'onglet Paiement, le logement dans l'onglet Logement,
// la messagerie auto dans Opérations, les actions rapides dans le pied.

type ActionResult = { success: boolean; error: string | null };

const OVERLINE_CLASS = 'text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)]';

/** Couleur + fond doux par statut (tokens — violet « Départ » = constante documentée). */
const STATUS_SOFT: Record<string, string> = {
  confirmed: 'var(--ok-soft)',
  pending: 'var(--warn-soft)',
  checked_in: 'var(--info-soft)',
  checked_out: `${PLANNING_DEPARTURE_VIOLET}1F`,
  cancelled: 'var(--hover)',
};

/** Styles inline statiques des inputs d'édition (hoistés hors render). */
const NAME_EDIT_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 'none',
  borderBottom: '2px solid var(--accent)',
  outline: 'none',
  background: 'transparent',
  fontSize: '1.0625rem',
  fontWeight: 700,
  fontFamily: 'var(--font-display)',
  color: 'var(--ink)',
  padding: '2px 0',
};

const NOTE_EDIT_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  color: 'var(--ink)',
  padding: 0,
  lineHeight: 1.5,
};

const NOTE_NEW_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  fontSize: '0.8125rem',
  fontFamily: 'inherit',
  color: 'inherit',
  padding: 0,
  lineHeight: 1.5,
};

/** Chip canal : tokens de canal (airbnb / booking / direct), repli neutre. */
interface PanelReservationInfoProps {
  event: PlanningEvent;
  onUpdateReservation?: (reservationId: number, updates: {
    checkIn?: string;
    checkOut?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }) => Promise<ActionResult>;
  onUpdateNotes?: (reservationId: number, notes: string) => Promise<ActionResult>;
  onUpdateGuestInfo?: (reservationId: number, updates: { guestName?: string; guestEmail?: string; guestPhone?: string }) => Promise<ActionResult>;
}

const PanelReservationInfo: React.FC<PanelReservationInfoProps> = ({
  event,
  onUpdateReservation,
  onUpdateNotes,
  onUpdateGuestInfo,
}) => {
  const reservation = event.reservation;
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  if (!reservation) return null;

  const statusColor = RESERVATION_STATUS_TOKEN_COLORS[reservation.status] ?? 'var(--ink)';
  const statusSoft = STATUS_SOFT[reservation.status] ?? 'var(--hover)';
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus] || reservation.status;
  const channelLabel = RESERVATION_SOURCE_LABELS[reservation.source as ReservationSource] || reservation.source;
  const channelTokens = getChannelChipTokens(reservation.source);
  const sourceLogo = getSourceLogo(reservation.source);

  const commitName = async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== reservation.guestName && onUpdateGuestInfo) {
      setNameSaving(true);
      await onUpdateGuestInfo(reservation.id, { guestName: trimmed });
      setNameSaving(false);
    }
    setEditingName(false);
  };


  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── Identité : avatar 56 + nom (display) + canal · statut ────── */}
      <div>
        <div className="flex items-center gap-2">
          <GuestAvatar
            name={reservation.guestName}
            photoUrl={reservation.guestAvatarUrl}
            size={56}
            sx={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}
          />
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-0.5">
                <input
                  ref={nameInputRef}
                  aria-label="Nom du client"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                    else if (e.key === 'Escape') setEditingName(false);
                  }}
                  onBlur={commitName}
                  disabled={nameSaving}
                  style={NAME_EDIT_INPUT_STYLE}
                />
                {nameSaving && <Spinner className="size-3.5" />}
              </div>
            ) : (
              <div
                onClick={() => {
                  if (onUpdateGuestInfo) {
                    setNameValue(reservation.guestName);
                    setEditingName(true);
                    setTimeout(() => nameInputRef.current?.focus(), 0);
                  }
                }}
                className={cn(
                  'flex items-center gap-[3px] rounded-[6px] px-[3px] mx-[-3px]',
                  onUpdateGuestInfo
                    ? 'cursor-pointer hover:bg-[var(--hover)] [&:hover_.edit-icon]:opacity-100'
                    : 'cursor-default',
                )}
              >
                <span className="font-[family-name:var(--font-display)] text-[1.0625rem] font-bold text-[var(--ink)] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                  {reservation.guestName}
                </span>
                {onUpdateGuestInfo && (
                  <span className="edit-icon inline-flex text-[var(--faint)] opacity-0" style={{ transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
                    <Edit size={14} strokeWidth={1.75} />
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-[3.75px] mt-[3px]">
              {sourceLogo && (
                <img className="w-[13px] h-[13px] object-contain block" src={sourceLogo} alt="" />
              )}
              <span className="text-[0.75rem] text-[var(--muted)]">
                {channelLabel}
              </span>
              <span className="text-[0.75rem] text-[var(--faint)]">·</span>
              <span className="text-[0.75rem] font-semibold" style={{ color: statusColor }}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Rangée de chips : statut / canal / voyageurs */}
        <div className="flex gap-1 flex-wrap mt-2">
          <StatusChip pill tokens={{ color: statusColor, bg: statusSoft }} label={statusLabel} />
          <StatusChip pill tokens={{ color: channelTokens.color, bg: channelTokens.bg }} label={channelLabel} />
          <StatusChip pill tokens={{ color: 'var(--body)', bg: 'var(--field)' }} label={`${reservation.guestCount} voyageur${reservation.guestCount > 1 ? 's' : ''}`} />
        </div>
      </div>

      {/* ─── DATES & HORAIRES ──────────────────────────────────────────── */}
      <EditableDatesSection reservation={reservation} onUpdate={onUpdateReservation} />

      {/* ─── NOTES ─────────────────────────────────────────────────────── */}
      <NotesSection reservation={reservation} onSave={onUpdateNotes} />

      {/* ─── FICHE DE POLICE / CONFORMITÉ (rendu seulement si ≥1 déclaration) ─── */}
      <PanelReservationCompliance reservationId={reservation.id} />
    </div>
  );
};

// ─── Section DATES & HORAIRES (overline + édition inline conservée) ─────────

interface EditableDatesSectionProps {
  reservation: NonNullable<PlanningEvent['reservation']>;
  onUpdate?: (reservationId: number, updates: {
    checkIn?: string;
    checkOut?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }) => Promise<ActionResult>;
}

const EditableDatesSection: React.FC<EditableDatesSectionProps> = ({ reservation, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [checkIn, setCheckIn] = useState(reservation.checkIn);
  const [checkOut, setCheckOut] = useState(reservation.checkOut);
  const [checkInTime, setCheckInTime] = useState(reservation.checkInTime || '');
  const [checkOutTime, setCheckOutTime] = useState(reservation.checkOutTime || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset when reservation changes
  useEffect(() => {
    setCheckIn(reservation.checkIn);
    setCheckOut(reservation.checkOut);
    setCheckInTime(reservation.checkInTime || '');
    setCheckOutTime(reservation.checkOutTime || '');
    setEditing(false);
    setValidationError(null);
  }, [reservation.id, reservation.checkIn, reservation.checkOut, reservation.checkInTime, reservation.checkOutTime]);

  const hasChanges =
    checkIn !== reservation.checkIn ||
    checkOut !== reservation.checkOut ||
    checkInTime !== (reservation.checkInTime || '') ||
    checkOutTime !== (reservation.checkOutTime || '');

  const handleSave = async () => {
    if (!onUpdate || !hasChanges) return;
    setValidationError(null);

    const updates: { checkIn?: string; checkOut?: string; checkInTime?: string; checkOutTime?: string } = {};
    if (checkIn !== reservation.checkIn) updates.checkIn = checkIn;
    if (checkOut !== reservation.checkOut) updates.checkOut = checkOut;
    if (checkInTime !== (reservation.checkInTime || '')) updates.checkInTime = checkInTime;
    if (checkOutTime !== (reservation.checkOutTime || '')) updates.checkOutTime = checkOutTime;

    const result = await onUpdate(reservation.id, updates);
    if (result.success) {
      setEditing(false);
    } else {
      setValidationError(result.error);
    }
  };

  const handleCancel = () => {
    setCheckIn(reservation.checkIn);
    setCheckOut(reservation.checkOut);
    setCheckInTime(reservation.checkInTime || '');
    setCheckOutTime(reservation.checkOutTime || '');
    setEditing(false);
    setValidationError(null);
  };

  /** « 10 févr. » en gros display. */
  const fmtBigDate = (iso: string) => {
    try { return format(toDate(iso), 'd MMM', { locale: fr }); } catch { return iso; }
  };

  const DateColumn = ({ label, date, time, align }: { label: string; date: string; time?: string; align: 'left' | 'right' }) => (
    // `align` pilote deja la rangee d'heure en logique (justify-start/end) : on garde
    // text-start/text-end pour que les deux restent coherents en RTL.
    <div className={cn('min-w-0', align === 'right' ? 'text-end' : 'text-start')}>
      <span className={cn(OVERLINE_CLASS, 'block mb-[2.25px]')}>{label}</span>
      <span className="block font-[family-name:var(--font-display)] text-[1.25rem] font-bold text-[var(--ink)] leading-[1.15] tabular-nums whitespace-nowrap">
        {fmtBigDate(date)}
      </span>
      {time && (
        <div className={cn('flex items-center gap-[3px] mt-[2.25px]', align === 'right' ? 'justify-end' : 'justify-start')}>
          <span className="inline-flex text-[var(--muted)]"><Schedule size={12} strokeWidth={1.75} /></span>
          <span className="text-[0.75rem] font-semibold text-[var(--muted)] tabular-nums">
            {time}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="inline-flex text-[var(--faint)]">
          <CalendarMonth size={13} strokeWidth={1.75} />
        </span>
        <span className={cn(OVERLINE_CLASS, 'flex-1')}>Dates &amp; horaires</span>
        {!editing ? (
          onUpdate && (
            <IconButton
              size="small"
              onClick={() => setEditing(true)}
              aria-label="Modifier les dates"
              sx={{ p: 0.375, color: 'var(--muted)', '&:hover': { color: 'var(--ink)', backgroundColor: 'var(--hover)' } }}
            >
              <Edit size={13} strokeWidth={1.75} />
            </IconButton>
          )
        ) : (
          <div className="flex gap-0.5">
            <IconButton
              size="small"
              onClick={handleSave}
              disabled={!hasChanges}
              sx={{ p: 0.375, color: 'var(--ok)', '&.Mui-disabled': { color: 'var(--faint)' } }}
            >
              <Check size={15} strokeWidth={1.75} />
            </IconButton>
            <IconButton size="small" onClick={handleCancel} sx={{ p: 0.375, color: 'var(--err)' }}>
              <Close size={15} strokeWidth={1.75} />
            </IconButton>
          </div>
        )}
      </div>

      {!editing ? (
        /* Mode lecture : 2 colonnes + flèche centrale */
        <div className="flex justify-between items-center gap-1.5">
          <DateColumn label="Check-in" date={reservation.checkIn} time={reservation.checkInTime} align="left" />
          <span className="inline-flex text-[var(--faint)] shrink-0">
            <ArrowForward size={16} strokeWidth={1.75} />
          </span>
          <DateColumn label="Check-out" date={reservation.checkOut} time={reservation.checkOutTime} align="right" />
        </div>
      ) : (
        /* Mode édition (flow historique conservé) */
        <div className="flex flex-col gap-2">
          {/* Check-in */}
          <div>
            <span className={cn(OVERLINE_CLASS, 'block mb-[2.25px]')}>Check-in</span>
            <div className="flex gap-1.5">
              <TextField
                type="date"
                size="small"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                inputProps={{ style: { padding: '6px 8px' } }}
              />
              <TextField
                type="time"
                size="small"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                placeholder="HH:mm"
                sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                inputProps={{ style: { padding: '6px 8px' } }}
              />
            </div>
          </div>

          {/* Check-out */}
          <div>
            <span className={cn(OVERLINE_CLASS, 'block mb-[2.25px]')}>Check-out</span>
            <div className="flex gap-1.5">
              <TextField
                type="date"
                size="small"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                inputProps={{ style: { padding: '6px 8px' } }}
              />
              <TextField
                type="time"
                size="small"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                placeholder="HH:mm"
                sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                inputProps={{ style: { padding: '6px 8px' } }}
              />
            </div>
          </div>

          {validationError && (
            <Alert
              severity="error"
              onClose={() => setValidationError(null)}
              sx={{
                fontSize: '0.75rem',
                py: 0,
                '& .MuiAlert-message': { fontSize: '0.75rem' },
                '& .MuiAlert-icon': { fontSize: '1rem', py: 0.5 },
              }}
            >
              {validationError}
            </Alert>
          )}

          {hasChanges && !validationError && (
            <span className="text-[0.625rem] text-[var(--warn)]">
              Les interventions liees (menage) seront automatiquement decalees.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Section NOTES : blocs var(--field) radius 10 + édition conservée ───────

interface NotesSectionProps {
  reservation: NonNullable<PlanningEvent['reservation']>;
  onSave?: (reservationId: number, notes: string) => Promise<ActionResult>;
}

const BULLET = '• ';

/** Parse raw notes string into bullet items */
function parseBullets(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split('\n').filter(l => l.trim().length > 0).map(l =>
    l.startsWith(BULLET) ? l.slice(BULLET.length) : l,
  );
}

/** Serialize bullet items back to notes string */
function serializeBullets(items: string[]): string {
  if (items.length === 0) return '';
  return items.map(i => `${BULLET}${i}`).join('\n');
}

const NotesSection: React.FC<NotesSectionProps> = ({ reservation, onSave }) => {
  const [items, setItems] = useState<string[]>(() => parseBullets(reservation.notes || ''));
  const [newItemText, setNewItemText] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Reset when reservation changes
  useEffect(() => {
    setItems(parseBullets(reservation.notes || ''));
    setNewItemText('');
    setEditingIdx(null);
    setSaved(false);
    setError(null);
  }, [reservation.id, reservation.notes]);

  const saveNotes = useCallback(async (nextItems: string[]) => {
    if (!onSave) return;
    const value = serializeBullets(nextItems);
    if (value === (reservation.notes || '')) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await onSave(reservation.id, value);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result.error);
    }
  }, [onSave, reservation.id, reservation.notes]);

  // ── Add new item ─────────────────────────────────────────────────────────
  const addItem = useCallback(() => {
    const text = newItemText.trim();
    if (!text) return;
    const next = [...items, text];
    setItems(next);
    setNewItemText('');
    saveNotes(next);
    // Re-focus input for rapid entry
    setTimeout(() => newInputRef.current?.focus(), 0);
  }, [newItemText, items, saveNotes]);

  const handleNewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  // ── Delete item ──────────────────────────────────────────────────────────
  const deleteItem = useCallback((idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    saveNotes(next);
    // If we were editing this item, cancel edit
    if (editingIdx === idx) {
      setEditingIdx(null);
      setEditingText('');
    }
  }, [items, saveNotes, editingIdx]);

  // ── Inline edit item ─────────────────────────────────────────────────────
  const startEditing = (idx: number) => {
    setEditingIdx(idx);
    setEditingText(items[idx]);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitEdit = useCallback(() => {
    if (editingIdx === null) return;
    const text = editingText.trim();
    if (!text) {
      // Empty → delete the item
      deleteItem(editingIdx);
    } else if (text !== items[editingIdx]) {
      const next = [...items];
      next[editingIdx] = text;
      setItems(next);
      saveNotes(next);
    }
    setEditingIdx(null);
    setEditingText('');
  }, [editingIdx, editingText, items, saveNotes, deleteItem]);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditingIdx(null);
      setEditingText('');
    }
  };

  return (
    <div>
      {/* Header overline */}
      <div className="flex items-center gap-1 mb-1.5">
        <span className={cn(OVERLINE_CLASS, 'flex-1')}>
          Notes{items.length > 0 ? ` · ${items.length}` : ''}
        </span>
        {saving && <Spinner className="size-3" />}
        {saved && <span className="inline-flex text-[var(--ok)]"><Check size={14} strokeWidth={1.75} /></span>}
      </div>

      {/* Bloc référence : téléphone (donnée existante, omis sinon) */}
      {reservation.guestPhone && (
        <div className="bg-[var(--field)] rounded-[10px] px-2 py-1.5 mb-1.5">
          <span className={cn(OVERLINE_CLASS, 'block mb-[1.5px]')}>Téléphone</span>
          <div className="flex items-center gap-1">
            <span className="inline-flex text-[var(--muted)]"><Phone size={12} strokeWidth={1.75} /></span>
            <span className="text-[0.8125rem] font-semibold text-[var(--ink)] tabular-nums">
              {reservation.guestPhone}
            </span>
          </div>
        </div>
      )}

      {/* Bloc notes éditables (bullets, auto-save) */}
      <div className="bg-[var(--field)] rounded-[10px] max-h-[260px] overflow-y-auto">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-center gap-[4.5px] px-[9px] py-[3px] min-h-[32px] cursor-pointer',
              'hover:bg-[var(--hover)] [&:hover_.note-delete-btn]:opacity-100',
              idx < items.length - 1 && 'border-b border-solid border-b-[var(--field-line)]',
            )}
            onClick={() => { if (editingIdx !== idx) startEditing(idx); }}
          >
            {/* Bullet dot */}
            <div className="w-[6px] h-[6px] rounded-[50%] bg-[var(--accent)] shrink-0" />

            {/* Text or inline edit */}
            {editingIdx === idx ? (
              <input
                ref={editInputRef}
                aria-label="Modifier la note"
                value={editingText}
                onChange={e => setEditingText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                style={NOTE_EDIT_INPUT_STYLE}
              />
            ) : (
              <span className="flex-1 text-[0.8125rem] text-[var(--body)] leading-[1.5] overflow-hidden text-ellipsis select-none">
                {item}
              </span>
            )}

            {/* Delete button — visible on hover */}
            <IconButton
              className="note-delete-btn"
              size="small"
              onClick={(e) => { e.stopPropagation(); deleteItem(idx); }}
              sx={{
                opacity: 0,
                transition: 'opacity var(--duration-fast) var(--ease-out)',
                p: 0.25,
                color: 'var(--faint)',
                '&:hover': { color: 'var(--err)', backgroundColor: 'var(--err-soft)' },
              }}
            >
              <Close size={14} strokeWidth={1.75} />
            </IconButton>
          </div>
        ))}

        {/* New item input — always visible at the bottom */}
        <div className="flex items-center gap-1 px-2 py-0.5 min-h-[34px]">
          <div className="w-[6px] h-[6px] rounded-[50%] bg-[var(--line-2)] shrink-0" />
          <input
            ref={newInputRef}
            aria-label="Ajouter une note"
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={handleNewKeyDown}
            onBlur={() => { if (newItemText.trim()) addItem(); }}
            placeholder={items.length === 0 ? 'Ajouter une note...' : 'Ajouter...'}
            style={NOTE_NEW_INPUT_STYLE}
          />
        </div>
      </div>

      {error && (
        <span className="block text-[0.625rem] text-[var(--err)] mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
};

export default PanelReservationInfo;
