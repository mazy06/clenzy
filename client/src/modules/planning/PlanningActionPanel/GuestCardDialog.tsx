import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
  TextField,
} from '@mui/material';
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
            <div className="w-[52px] h-[52px] rounded-[13px] bg-[var(--accent)] flex items-center justify-center text-[var(--on-accent)] font-[var(--font-display)] text-[1.125rem] font-semibold shrink-0 mt-0.5">
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
                  {saving && <CircularProgress size={14} />}
                </div>
              ) : (
                <Box
                  onClick={() => startEdit('name')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    cursor: onUpdateGuestInfo ? 'pointer' : 'default',
                    borderRadius: 0.5,
                    px: 0.5,
                    mx: -0.5,
                    '&:hover': onUpdateGuestInfo ? {
                      bgcolor: 'var(--hover)',
                      '& .edit-hint': { opacity: 1 },
                    } : {},
                  }}
                >
                  <p className="cn-text-body1 text-[1rem] font-bold">
                    {displayName}
                  </p>
                  {onUpdateGuestInfo && (
                    <Box component="span" className="edit-hint" sx={{ display: 'inline-flex', color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s' }}><Edit size={14} strokeWidth={1.75} /></Box>
                  )}
                  {saved === 'name' && <span className="inline-flex text-[var(--ok)]"><Check size={14} strokeWidth={1.75} /></span>}
                </Box>
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
                    {saving ? <CircularProgress size={12} /> : (
                      <IconButton size="small" onClick={commitEdit} sx={{ p: 0.25 }}>
                        <span className="inline-flex text-[var(--ok)]"><Check size={14} strokeWidth={1.75} /></span>
                      </IconButton>
                    )}
                  </div>
                ) : (
                  <Box
                    onClick={() => startEdit('email')}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: onUpdateGuestInfo ? 'pointer' : 'default',
                      borderRadius: 0.5,
                      px: 0.5,
                      mx: -0.5,
                      py: 0.25,
                      '&:hover': onUpdateGuestInfo ? {
                        bgcolor: 'var(--hover)',
                        '& .edit-hint': { opacity: 1 },
                      } : {},
                    }}
                  >
                    <span className="inline-flex text-muted-foreground"><Email size={'0.8rem'} strokeWidth={1.75} /></span>
                    <Typography sx={{ fontSize: '0.75rem', color: displayEmail ? 'text.secondary' : 'text.disabled', fontStyle: displayEmail ? 'normal' : 'italic' }}>
                      {displayEmail || 'Ajouter un email'}
                    </Typography>
                    {onUpdateGuestInfo && (
                      <Box component="span" className="edit-hint" sx={{ display: 'inline-flex', color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s' }}><Edit size={12} strokeWidth={1.75} /></Box>
                    )}
                    {saved === 'email' && <span className="inline-flex text-[var(--ok)]"><Check size={12} strokeWidth={1.75} /></span>}
                  </Box>
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
                    {saving && <CircularProgress size={12} />}
                  </div>
                ) : (
                  <Box
                    onClick={() => startEdit('phone')}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: onUpdateGuestInfo ? 'pointer' : 'default',
                      borderRadius: 0.5,
                      px: 0.5,
                      mx: -0.5,
                      py: 0.25,
                      '&:hover': onUpdateGuestInfo ? {
                        bgcolor: 'var(--hover)',
                        '& .edit-hint': { opacity: 1 },
                      } : {},
                    }}
                  >
                    <span className="inline-flex text-muted-foreground"><Phone size={'0.8rem'} strokeWidth={1.75} /></span>
                    <Typography sx={{ fontSize: '0.75rem', color: displayPhone ? 'text.secondary' : 'text.disabled', fontStyle: displayPhone ? 'normal' : 'italic' }}>
                      {displayPhone || 'Ajouter un telephone'}
                    </Typography>
                    {onUpdateGuestInfo && (
                      <Box component="span" className="edit-hint" sx={{ display: 'inline-flex', color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s' }}><Edit size={12} strokeWidth={1.75} /></Box>
                    )}
                    {saved === 'phone' && <span className="inline-flex text-[var(--ok)]"><Check size={12} strokeWidth={1.75} /></span>}
                  </Box>
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
                  <Chip
                    label={
                      RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus] ||
                      reservation.status
                    }
                    size="small"
                    sx={{
                      fontSize: '10.5px',
                      height: 20,
                      fontWeight: 700,
                      bgcolor: `color-mix(in srgb, ${statusTokenColor(reservation.status)} 14%, transparent)`,
                      color: statusTokenColor(reservation.status),
                    }}
                  />
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
                  <Box component="span" sx={{ display: 'inline-flex', mr: 0.25, verticalAlign: 'middle' }}>
                    <CalendarMonth size={12} strokeWidth={1.75} />
                  </Box>
                  Historique des sejours ({guestReservations.length})
                </p>
                <div className="flex flex-col gap-0.5">
                  {guestReservations
                    .flatMap((r) => (r.id !== reservation.id ? [(
                      <div className="flex justify-between items-center border border-[var(--line)] rounded-[0.75px] px-1.5 py-0.5" key={r.id}>
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
                          <Chip
                            label={
                              RESERVATION_STATUS_LABELS[r.status as ReservationStatus] || r.status
                            }
                            size="small"
                            sx={{
                              fontSize: '10.5px',
                              height: 18,
                              fontWeight: 700,
                              bgcolor: `color-mix(in srgb, ${statusTokenColor(r.status)} 14%, transparent)`,
                              color: statusTokenColor(r.status),
                            }}
                          />
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
                <Chip
                  label={reservation.confirmationCode}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.6875rem', fontWeight: 600 }}
                />
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
      <p className="cn-text-body1 font-[var(--font-display)] text-[0.875rem] font-semibold mt-0.5 tabular-nums">
        {value}
      </p>
    </div>
  );
}

export default GuestCardDialog;
