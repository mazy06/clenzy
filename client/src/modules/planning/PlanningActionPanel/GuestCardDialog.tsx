import React, { useMemo, useState, useRef, useCallback } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Badge } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import { Dialog, DialogTitle, DialogContent, IconButton, Divider, TextField } from '@mui/material';
import { cn } from '../../../utils/cn';
import {
  Close,
  Person,
  Email,
  Phone,
  CalendarMonth,
  Home,
  AttachMoney,
  Edit,
  Check,
} from '../../../icons';
import { Money } from '../../../components/Money';
import type { PlanningEvent } from '../types';
import type { Reservation } from '../../../services/api';
import { RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS, isCollectedByChannel } from '../../../services/api/reservationsApi';
import { RESERVATION_STATUS_TOKEN_COLORS } from '../constants';
import type { ReservationStatus, ReservationSource } from '../../../services/api';

/** Couleur Signature du statut (mêmes constantes que les briques du planning). */
const statusTokenColor = (status: string): string =>
  RESERVATION_STATUS_TOKEN_COLORS[status] ?? 'var(--muted)';

interface GuestCardDialogProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation;
  allEvents: PlanningEvent[];
  onUpdateGuestInfo?: (reservationId: number, updates: { guestName?: string; guestEmail?: string; guestPhone?: string }) => Promise<{ success: boolean; error: string | null }>;
}

const GuestCardDialog: React.FC<GuestCardDialogProps> = ({ open, onClose, reservation, allEvents, onUpdateGuestInfo }) => {
  // Find all reservations from the same guest (by name match)
  const guestReservations = useMemo(() => {
    const name = reservation.guestName.toLowerCase().trim();
    return allEvents
      .flatMap((e) =>
        e.type === 'reservation' &&
        e.reservation &&
        e.reservation.guestName.toLowerCase().trim() === name
          ? [e.reservation]
          : [],
      )
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn)); // most recent first
  }, [reservation.guestName, allEvents]);

  const totalSpent = useMemo(
    () => guestReservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0),
    [guestReservations],
  );

  const initials = reservation.guestName
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const isICalSource = isCollectedByChannel(reservation);
  const hasNoPrice = !reservation.totalPrice || reservation.totalPrice === 0;

  // ── Editable fields ──────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<'name' | 'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // Optimistic local overrides (displayed immediately after save, before query refetch)
  const [localOverrides, setLocalOverrides] = useState<{ guestName?: string; guestEmail?: string; guestPhone?: string }>({});

  // Displayed values = local override > prop
  const displayName = localOverrides.guestName ?? reservation.guestName;
  const displayEmail = localOverrides.guestEmail ?? reservation.guestEmail;
  const displayPhone = localOverrides.guestPhone ?? reservation.guestPhone;

  const startEdit = useCallback((field: 'name' | 'email' | 'phone') => {
    if (!onUpdateGuestInfo) return;
    const current =
      field === 'name' ? (displayName || '') :
      field === 'email' ? (displayEmail || '') :
      (displayPhone || '');
    setEditingField(field);
    setEditValue(current);
    setSaved(null);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [onUpdateGuestInfo, displayName, displayEmail, displayPhone]);

  const commitEdit = useCallback(async () => {
    if (!editingField || !onUpdateGuestInfo) return;
    const trimmed = editValue.trim();

    // Validate name is not empty
    if (editingField === 'name' && !trimmed) {
      setEditingField(null);
      return;
    }

    // Check if value actually changed
    const original =
      editingField === 'name' ? (displayName || '') :
      editingField === 'email' ? (displayEmail || '') :
      (displayPhone || '');

    if (trimmed === original) {
      setEditingField(null);
      return;
    }

    const updates =
      editingField === 'name' ? { guestName: trimmed } :
      editingField === 'email' ? { guestEmail: trimmed } :
      { guestPhone: trimmed };

    setSaving(true);
    const result = await onUpdateGuestInfo(reservation.id, updates);
    setSaving(false);
    if (result.success) {
      // Optimistic update — display new value immediately
      setLocalOverrides((prev) => ({ ...prev, ...updates }));
      setSaved(editingField);
      setTimeout(() => setSaved(null), 2000);
    }
    setEditingField(null);
  }, [editingField, editValue, onUpdateGuestInfo, reservation, displayName, displayEmail, displayPhone]);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 0.5,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex text-[var(--accent)]"><Person size={20} strokeWidth={1.75} /></span>
          <p className="cn-text-body1 text-[0.9375rem] font-bold">
            Fiche client
          </p>
        </div>
        <IconButton size="small" onClick={onClose}>
          <Close size={'1rem'} strokeWidth={1.75} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <div className="flex flex-col gap-2">
          {/* Header — Avatar + Name + Contact */}
          <div className="flex items-start gap-3">
            {/* Avatar initiales : pattern messagerie (carré arrondi r13, accent,
                initiales display) — pas de rond plein */}
            <div className="w-[52px] h-[52px] rounded-[13px] bg-[var(--accent)] flex items-center justify-center text-[var(--on-accent)] font-[family-name:var(--font-display)] text-[1.125rem] font-semibold shrink-0 mt-0.5">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              {/* Editable guest name */}
              {editingField === 'name' ? (
                <div className="flex items-center gap-0.5">
                  <TextField
                    inputRef={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={commitEdit}
                    disabled={saving}
                    size="small"
                    fullWidth
                    variant="standard"
                    sx={{ '& input': { fontSize: '1rem', fontWeight: 700 } }}
                  />
                  {saving && <Spinner className="size-3.5" />}
                </div>
              ) : (
                <div
                  onClick={() => startEdit('name')}
                  className={cn(
                    'flex items-center gap-[3px] rounded-[4px] px-[3px] mx-[-3px]',
                    // Variante unique '&:hover .edit-hint' : evite toute ambiguite
                    // d'ordre entre les variantes hover: et [&_...]:
                    onUpdateGuestInfo
                      ? 'cursor-pointer hover:bg-[var(--hover)] [&:hover_.edit-hint]:opacity-100'
                      : 'cursor-default',
                  )}
                >
                  <p className="cn-text-body1 text-[1rem] font-bold">
                    {displayName}
                  </p>
                  {onUpdateGuestInfo && (
                    <span className="edit-hint inline-flex text-[var(--faint)] opacity-0" style={{ transition: 'opacity 0.15s' }}><Edit size={14} strokeWidth={1.75} /></span>
                  )}
                  {saved === 'name' && <span className="inline-flex text-[var(--ok)]"><Check size={14} strokeWidth={1.75} /></span>}
                </div>
              )}

              {/* Editable contact info */}
              <div className="flex flex-col gap-0.5 mt-0.5">
                {/* Email — editable */}
                {editingField === 'email' ? (
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><Email size={'0.8rem'} strokeWidth={1.75} /></span>
                    <TextField
                      inputRef={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      disabled={saving}
                      size="small"
                      fullWidth
                      variant="standard"
                      placeholder="email@exemple.com"
                      sx={{ '& input': { fontSize: '0.75rem' } }}
                    />
                    {saving ? <Spinner className="size-3" /> : (
                      <IconButton size="small" onClick={commitEdit} sx={{ p: 0.25 }}>
                        <span className="inline-flex text-[var(--ok)]"><Check size={14} strokeWidth={1.75} /></span>
                      </IconButton>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('email')}
                    className={cn(
                      'flex items-center gap-[3px] rounded-[4px] px-[3px] mx-[-3px] py-[1.5px]',
                      onUpdateGuestInfo
                        ? 'cursor-pointer hover:bg-[var(--hover)] [&:hover_.edit-hint]:opacity-100'
                        : 'cursor-default',
                    )}
                  >
                    <span className="inline-flex text-muted-foreground"><Email size={'0.8rem'} strokeWidth={1.75} /></span>
                    <p className={cn('cn-text-body1 text-[0.75rem]', displayEmail ? 'text-[var(--muted)]' : 'text-[var(--faint)]', displayEmail ? 'not-italic' : 'italic')}>
                      {displayEmail || 'Ajouter un email'}
                    </p>
                    {onUpdateGuestInfo && (
                      <span className="edit-hint inline-flex text-[var(--faint)] opacity-0" style={{ transition: 'opacity 0.15s' }}><Edit size={12} strokeWidth={1.75} /></span>
                    )}
                    {saved === 'email' && <span className="inline-flex text-[var(--ok)]"><Check size={12} strokeWidth={1.75} /></span>}
                  </div>
                )}

                {/* Phone — editable */}
                {editingField === 'phone' ? (
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><Phone size={'0.8rem'} strokeWidth={1.75} /></span>
                    <TextField
                      inputRef={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={commitEdit}
                      disabled={saving}
                      size="small"
                      fullWidth
                      variant="standard"
                      placeholder="+33 6 12 34 56 78"
                      sx={{ '& input': { fontSize: '0.75rem' } }}
                    />
                    {saving && <Spinner className="size-3" />}
                  </div>
                ) : (
                  <div
                    onClick={() => startEdit('phone')}
                    className={cn(
                      'flex items-center gap-[3px] rounded-[4px] px-[3px] mx-[-3px] py-[1.5px]',
                      onUpdateGuestInfo
                        ? 'cursor-pointer hover:bg-[var(--hover)] [&:hover_.edit-hint]:opacity-100'
                        : 'cursor-default',
                    )}
                  >
                    <span className="inline-flex text-muted-foreground"><Phone size={'0.8rem'} strokeWidth={1.75} /></span>
                    <p className={cn('cn-text-body1 text-[0.75rem]', displayPhone ? 'text-[var(--muted)]' : 'text-[var(--faint)]', displayPhone ? 'not-italic' : 'italic')}>
                      {displayPhone || 'Ajouter un telephone'}
                    </p>
                    {onUpdateGuestInfo && (
                      <span className="edit-hint inline-flex text-[var(--faint)] opacity-0" style={{ transition: 'opacity 0.15s' }}><Edit size={12} strokeWidth={1.75} /></span>
                    )}
                    {saved === 'phone' && <span className="inline-flex text-[var(--ok)]"><Check size={12} strokeWidth={1.75} /></span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-2">
            <StatBox label="Sejours" value={String(guestReservations.length)} />
            <StatBox
              label="Total depense"
              value={totalSpent <= 0 && isICalSource ? '—' : <Money value={totalSpent} from="EUR" decimals={0} />}
            />
            <StatBox
              label="Source"
              value={
                RESERVATION_SOURCE_LABELS[reservation.source as ReservationSource] ||
                reservation.source
              }
            />
            <StatBox
              label="Voyageurs"
              value={String(reservation.guestCount)}
            />
          </div>

          <Divider />

          {/* Current reservation */}
          <div>
            <p className="cn-text-body1 text-[0.6875rem] font-semibold uppercase text-muted-foreground mb-1">
              Reservation actuelle
            </p>
            <div className="border border-[var(--accent)] rounded-[10px] p-2 bg-[var(--accent-soft)]">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-0.5 mb-0.5">
                    <span className="inline-flex text-muted-foreground"><Home size={14} strokeWidth={1.75} /></span>
                    <p className="cn-text-body1 text-[0.8125rem] font-semibold">
                      {reservation.propertyName}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><CalendarMonth size={12} strokeWidth={1.75} /></span>
                    <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
                      {formatDate(reservation.checkIn)} → {formatDate(reservation.checkOut)}
                    </p>
                  </div>
                  {(reservation.checkInTime || reservation.checkOutTime) && (
                    <p className="cn-text-body1 text-[0.625rem] text-muted-foreground mt-0.5 ms-3.5">
                      {reservation.checkInTime && `Arrivee ${reservation.checkInTime}`}
                      {reservation.checkInTime && reservation.checkOutTime && ' · '}
                      {reservation.checkOutTime && `Depart ${reservation.checkOutTime}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5">
                    <span className="inline-flex text-muted-foreground"><AttachMoney size={14} strokeWidth={1.75} /></span>
                    {hasNoPrice && isICalSource ? (
                      <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic">
                        Non communiqué
                      </p>
                    ) : (
                      <p className="cn-text-body1 text-[0.8125rem] font-bold">
                        <Money value={reservation.totalPrice} from="EUR" />
                      </p>
                    )}
                  </div>
                  {/* Statut : texte couleur + fond soft (jamais d'aplat plein) */}
                  <StatusChip tokens={{ color: statusTokenColor(reservation.status), bg: `color-mix(in srgb, ${statusTokenColor(reservation.status)} 14%, transparent)` }} label={RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus] ||
                      reservation.status} className="text-[10.5px] h-[20px]" />
                </div>
              </div>
              {reservation.notes && (
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic mt-1 ps-3.5">
                  {reservation.notes}
                </p>
              )}
            </div>
          </div>

          {/* Reservation history */}
          {guestReservations.length > 1 && (
            <>
              <Divider />
              <div>
                <p className="cn-text-body1 text-[0.6875rem] font-semibold uppercase text-muted-foreground mb-1">
                  <span className="inline-flex me-[1.5px] align-[middle]">
                    <CalendarMonth size={12} strokeWidth={1.75} />
                  </span>
                  Historique des sejours ({guestReservations.length})
                </p>
                <div className="flex flex-col gap-0.5">
                  {guestReservations
                    .flatMap((r) => (r.id !== reservation.id ? [(
                      <div className="flex justify-between items-center border border-[var(--line)] rounded-[6px] px-1.5 py-0.5" key={r.id}>
                        <div>
                          <p className="cn-text-body1 text-[0.75rem] font-semibold">
                            {r.propertyName}
                          </p>
                          <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
                            {formatDate(r.checkIn)} → {formatDate(r.checkOut)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="cn-text-body1 text-[0.75rem] font-semibold">
                            <Money value={r.totalPrice} from="EUR" decimals={0} />
                          </p>
                          <StatusChip size="sm" tokens={{ color: statusTokenColor(r.status), bg: `color-mix(in srgb, ${statusTokenColor(r.status)} 14%, transparent)` }} label={RESERVATION_STATUS_LABELS[r.status as ReservationStatus] || r.status} className="text-[10.5px]" />
                        </div>
                      </div>
                    )] : []))}
                </div>
              </div>
            </>
          )}

          {reservation.confirmationCode && (
            <>
              <Divider />
              <div className="flex items-center gap-1.5">
                <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
                  Code de confirmation :
                </p>
                <Badge variant="outline" className="text-[0.6875rem] font-semibold">{reservation.confirmationCode}</Badge>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex-1 border border-[var(--line)] rounded-[10px] px-1.5 py-1 text-center">
      <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] uppercase tracking-[0.05em] font-bold">
        {label}
      </p>
      <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[0.875rem] font-semibold mt-0.5 tabular-nums">
        {value}
      </p>
    </div>
  );
}

export default GuestCardDialog;
