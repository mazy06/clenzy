import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  TextField,
  CircularProgress,
} from '@mui/material';
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
import { toDate } from '../utils/dateUtils';
import { toneTokensSx } from '../../../components/StatusChip';
import GuestAvatar from '../../../components/GuestAvatar';

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

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
};

/** Couleur + fond doux par statut (tokens — violet « Départ » = constante documentée). */
const STATUS_SOFT: Record<string, string> = {
  confirmed: 'var(--ok-soft)',
  pending: 'var(--warn-soft)',
  checked_in: 'var(--info-soft)',
  checked_out: `${PLANNING_DEPARTURE_VIOLET}1F`,
  cancelled: 'var(--hover)',
};

/** Chip canal : tokens de canal (airbnb / booking / direct), repli neutre. */
function getChannelChipTokens(source: string): { bg: string; color: string } {
  switch (source) {
    case 'airbnb': return { bg: 'var(--airbnb-soft)', color: 'var(--airbnb-ink)' };
    case 'booking': return { bg: 'var(--booking-soft)', color: 'var(--booking-ink)' };
    case 'direct': return { bg: 'var(--direct-soft)', color: 'var(--direct-ink)' };
    default: return { bg: 'var(--field)', color: 'var(--muted)' };
  }
}

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

  const chipSx = (bg: string, color: string) => ({
    ...toneTokensSx({ color, bg }),
    borderRadius: 'var(--radius-pill)',
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      {/* ─── Identité : avatar 56 + nom (display) + canal · statut ────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <GuestAvatar
            name={reservation.guestName}
            photoUrl={reservation.guestAvatarUrl}
            size={56}
            sx={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {editingName ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                    else if (e.key === 'Escape') setEditingName(false);
                  }}
                  onBlur={commitName}
                  disabled={nameSaving}
                  style={{
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
                  }}
                />
                {nameSaving && <CircularProgress size={14} />}
              </Box>
            ) : (
              <Box
                onClick={() => {
                  if (onUpdateGuestInfo) {
                    setNameValue(reservation.guestName);
                    setEditingName(true);
                    setTimeout(() => nameInputRef.current?.focus(), 0);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: onUpdateGuestInfo ? 'pointer' : 'default',
                  borderRadius: '6px',
                  px: 0.5,
                  mx: -0.5,
                  '&:hover': onUpdateGuestInfo ? {
                    backgroundColor: 'var(--hover)',
                    '& .edit-icon': { opacity: 1 },
                  } : {},
                }}
              >
                <Box
                  component="span"
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.0625rem',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {reservation.guestName}
                </Box>
                {onUpdateGuestInfo && (
                  <Box component="span" className="edit-icon" sx={{ display: 'inline-flex', color: 'var(--faint)', opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
                    <Edit size={14} strokeWidth={1.75} />
                  </Box>
                )}
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, mt: '3px' }}>
              {sourceLogo && (
                <Box
                  component="img"
                  src={sourceLogo}
                  alt=""
                  sx={{ width: 13, height: 13, objectFit: 'contain', display: 'block' }}
                />
              )}
              <Box component="span" sx={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {channelLabel}
              </Box>
              <Box component="span" sx={{ fontSize: '0.75rem', color: 'var(--faint)' }}>·</Box>
              <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor }}>
                {statusLabel}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Rangée de chips : statut / canal / voyageurs */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
          <Chip label={statusLabel} size="small" sx={chipSx(statusSoft, statusColor)} />
          <Chip label={channelLabel} size="small" sx={chipSx(channelTokens.bg, channelTokens.color)} />
          <Chip
            label={`${reservation.guestCount} voyageur${reservation.guestCount > 1 ? 's' : ''}`}
            size="small"
            sx={chipSx('var(--field)', 'var(--body)')}
          />
        </Box>
      </Box>

      {/* ─── DATES & HORAIRES ──────────────────────────────────────────── */}
      <EditableDatesSection reservation={reservation} onUpdate={onUpdateReservation} />

      {/* ─── NOTES ─────────────────────────────────────────────────────── */}
      <NotesSection reservation={reservation} onSave={onUpdateNotes} />
    </Box>
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
    <Box sx={{ textAlign: align, minWidth: 0 }}>
      <Box component="span" sx={{ ...OVERLINE_SX, display: 'block', mb: 0.375 }}>{label}</Box>
      <Box
        component="span"
        sx={{
          display: 'block',
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--ink)',
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {fmtBigDate(date)}
      </Box>
      {time && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.375, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Schedule size={12} strokeWidth={1.75} /></Box>
          <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {time}
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}>
          <CalendarMonth size={13} strokeWidth={1.75} />
        </Box>
        <Box component="span" sx={{ ...OVERLINE_SX, flex: 1 }}>Dates & horaires</Box>
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
          <Box sx={{ display: 'flex', gap: 0.25 }}>
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
          </Box>
        )}
      </Box>

      {!editing ? (
        /* Mode lecture : 2 colonnes + flèche centrale */
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <DateColumn label="Check-in" date={reservation.checkIn} time={reservation.checkInTime} align="left" />
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)', flexShrink: 0 }}>
            <ArrowForward size={16} strokeWidth={1.75} />
          </Box>
          <DateColumn label="Check-out" date={reservation.checkOut} time={reservation.checkOutTime} align="right" />
        </Box>
      ) : (
        /* Mode édition (flow historique conservé) */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Check-in */}
          <Box>
            <Box component="span" sx={{ ...OVERLINE_SX, display: 'block', mb: 0.375 }}>Check-in</Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
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
            </Box>
          </Box>

          {/* Check-out */}
          <Box>
            <Box component="span" sx={{ ...OVERLINE_SX, display: 'block', mb: 0.375 }}>Check-out</Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
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
            </Box>
          </Box>

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
            <Box component="span" sx={{ fontSize: '0.625rem', color: 'var(--warn)' }}>
              Les interventions liees (menage) seront automatiquement decalees.
            </Box>
          )}
        </Box>
      )}
    </Box>
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
    <Box>
      {/* Header overline */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Box component="span" sx={{ ...OVERLINE_SX, flex: 1 }}>
          Notes{items.length > 0 ? ` · ${items.length}` : ''}
        </Box>
        {saving && <CircularProgress size={12} />}
        {saved && <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)' }}><Check size={14} strokeWidth={1.75} /></Box>}
      </Box>

      {/* Bloc référence : téléphone (donnée existante, omis sinon) */}
      {reservation.guestPhone && (
        <Box sx={{ backgroundColor: 'var(--field)', borderRadius: '10px', px: 1.5, py: 1, mb: 1 }}>
          <Box component="span" sx={{ ...OVERLINE_SX, display: 'block', mb: 0.25 }}>Téléphone</Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Phone size={12} strokeWidth={1.75} /></Box>
            <Box component="span" sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {reservation.guestPhone}
            </Box>
          </Box>
        </Box>
      )}

      {/* Bloc notes éditables (bullets, auto-save) */}
      <Box
        sx={{
          backgroundColor: 'var(--field)',
          borderRadius: '10px',
          maxHeight: 260,
          overflowY: 'auto',
        }}
      >
        {items.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.5,
              minHeight: 32,
              borderBottom: idx < items.length - 1 ? '1px solid var(--field-line)' : 'none',
              '&:hover': { backgroundColor: 'var(--hover)' },
              '&:hover .note-delete-btn': { opacity: 1 },
              cursor: 'pointer',
            }}
            onClick={() => { if (editingIdx !== idx) startEditing(idx); }}
          >
            {/* Bullet dot */}
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)', flexShrink: 0 }} />

            {/* Text or inline edit */}
            {editingIdx === idx ? (
              <input
                ref={editInputRef}
                value={editingText}
                onChange={e => setEditingText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '0.8125rem',
                  fontFamily: 'inherit',
                  color: 'var(--ink)',
                  padding: 0,
                  lineHeight: 1.5,
                }}
              />
            ) : (
              <Box
                component="span"
                sx={{
                  flex: 1,
                  fontSize: '0.8125rem',
                  color: 'var(--body)',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  userSelect: 'none',
                }}
              >
                {item}
              </Box>
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
          </Box>
        ))}

        {/* New item input — always visible at the bottom */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, minHeight: 34 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--line-2)', flexShrink: 0 }} />
          <input
            ref={newInputRef}
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={handleNewKeyDown}
            onBlur={() => { if (newItemText.trim()) addItem(); }}
            placeholder={items.length === 0 ? 'Ajouter une note...' : 'Ajouter...'}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              color: 'inherit',
              padding: 0,
              lineHeight: 1.5,
            }}
          />
        </Box>
      </Box>

      {error && (
        <Box component="span" sx={{ display: 'block', fontSize: '0.625rem', color: 'var(--err)', mt: 0.25 }}>
          {error}
        </Box>
      )}
    </Box>
  );
};

export default PanelReservationInfo;
