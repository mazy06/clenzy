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
import type { PlanningEvent } from '../types';
import type { Reservation } from '../../../services/api';
import { RESERVATION_STATUS_COLORS, RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS } from '../../../services/api/reservationsApi';
import type { ReservationStatus, ReservationSource } from '../../../services/api';

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
      .filter(
        (e) =>
          e.type === 'reservation' &&
          e.reservation &&
          e.reservation.guestName.toLowerCase().trim() === name,
      )
      .map((e) => e.reservation!)
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

  const isICalSource = reservation.source === 'airbnb' || reservation.source === 'booking' || reservation.source === 'other';
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
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Person size={'1.25rem'} strokeWidth={1.75} /></Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
            Fiche client
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close size={'1rem'} strokeWidth={1.75} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Header — Avatar + Name + Contact */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.125rem',
                fontWeight: 700,
                flexShrink: 0,
                mt: 0.5,
              }}
            >
              {initials}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {/* Editable guest name */}
              {editingField === 'name' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                </Box>
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
                      bgcolor: 'action.hover',
                      '& .edit-hint': { opacity: 1 },
                    } : {},
                  }}
                >
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
                    {displayName}
                  </Typography>
                  {onUpdateGuestInfo && (
                    <Edit className="edit-hint" sx={{ fontSize: 14, color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s' }} />
                  )}
                  {saved === 'name' && <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><Check size={14} strokeWidth={1.75} /></Box>}
                </Box>
              )}

              {/* Editable contact info */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                {/* Email — editable */}
                {editingField === 'email' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Email size={'0.8rem'} strokeWidth={1.75} /></Box>
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
                        <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><Check size={14} strokeWidth={1.75} /></Box>
                      </IconButton>
                    )}
                  </Box>
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
                        bgcolor: 'action.hover',
                        '& .edit-hint': { opacity: 1 },
                      } : {},
                    }}
                  >
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Email size={'0.8rem'} strokeWidth={1.75} /></Box>
                    <Typography sx={{ fontSize: '0.75rem', color: displayEmail ? 'text.secondary' : 'text.disabled', fontStyle: displayEmail ? 'normal' : 'italic' }}>
                      {displayEmail || 'Ajouter un email'}
                    </Typography>
                    {onUpdateGuestInfo && (
                      <Edit className="edit-hint" sx={{ fontSize: 12, color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s' }} />
                    )}
                    {saved === 'email' && <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><Check size={12} strokeWidth={1.75} /></Box>}
                  </Box>
                )}

                {/* Phone — editable */}
                {editingField === 'phone' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Phone size={'0.8rem'} strokeWidth={1.75} /></Box>
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
                  </Box>
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
                        bgcolor: 'action.hover',
                        '& .edit-hint': { opacity: 1 },
                      } : {},
                    }}
                  >
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Phone size={'0.8rem'} strokeWidth={1.75} /></Box>
                    <Typography sx={{ fontSize: '0.75rem', color: displayPhone ? 'text.secondary' : 'text.disabled', fontStyle: displayPhone ? 'normal' : 'italic' }}>
                      {displayPhone || 'Ajouter un telephone'}
                    </Typography>
                    {onUpdateGuestInfo && (
                      <Edit className="edit-hint" sx={{ fontSize: 12, color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s' }} />
                    )}
                    {saved === 'phone' && <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><Check size={12} strokeWidth={1.75} /></Box>}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* Stats */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <StatBox label="Sejours" value={String(guestReservations.length)} />
            <StatBox
              label="Total depense"
              value={totalSpent > 0 ? `${totalSpent.toFixed(0)} €` : (isICalSource ? '—' : '0 €')}
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
          </Box>

          <Divider />

          {/* Current reservation */}
          <Box>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 0.75,
              }}
            >
              Reservation actuelle
            </Typography>
            <Box
              sx={{
                border: '2px solid',
                borderColor: 'primary.main',
                borderRadius: 1,
                p: 1.25,
                bgcolor: 'rgba(107, 138, 154, 0.04)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Home size={14} strokeWidth={1.75} /></Box>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      {reservation.propertyName}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><CalendarMonth size={12} strokeWidth={1.75} /></Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {formatDate(reservation.checkIn)} → {formatDate(reservation.checkOut)}
                    </Typography>
                  </Box>
                  {(reservation.checkInTime || reservation.checkOutTime) && (
                    <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', mt: 0.25, ml: 2.25 }}>
                      {reservation.checkInTime && `Arrivee ${reservation.checkInTime}`}
                      {reservation.checkInTime && reservation.checkOutTime && ' · '}
                      {reservation.checkOutTime && `Depart ${reservation.checkOutTime}`}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><AttachMoney size={14} strokeWidth={1.75} /></Box>
                    {hasNoPrice && isICalSource ? (
                      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
                        Non communiqué
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                        {reservation.totalPrice?.toFixed(2)} €
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={
                      RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus] ||
                      reservation.status
                    }
                    size="small"
                    sx={{
                      fontSize: '0.5625rem',
                      height: 20,
                      fontWeight: 600,
                      bgcolor:
                        RESERVATION_STATUS_COLORS[reservation.status as ReservationStatus] || '#757575',
                      color: '#fff',
                    }}
                  />
                </Box>
              </Box>
              {reservation.notes && (
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    color: 'text.secondary',
                    fontStyle: 'italic',
                    mt: 0.75,
                    pl: 2.25,
                  }}
                >
                  {reservation.notes}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Reservation history */}
          {guestReservations.length > 1 && (
            <>
              <Divider />
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    mb: 0.75,
                  }}
                >
                  <Box component="span" sx={{ display: 'inline-flex', mr: 0.25, verticalAlign: 'middle' }}>
                    <CalendarMonth size={12} strokeWidth={1.75} />
                  </Box>
                  Historique des sejours ({guestReservations.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {guestReservations
                    .filter((r) => r.id !== reservation.id)
                    .map((r) => (
                      <Box
                        key={r.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 0.75,
                          px: 1,
                          py: 0.5,
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {r.propertyName}
                          </Typography>
                          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                            {formatDate(r.checkIn)} → {formatDate(r.checkOut)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {r.totalPrice?.toFixed(0)} €
                          </Typography>
                          <Chip
                            label={
                              RESERVATION_STATUS_LABELS[r.status as ReservationStatus] || r.status
                            }
                            size="small"
                            sx={{
                              fontSize: '0.5625rem',
                              height: 18,
                              bgcolor: `${RESERVATION_STATUS_COLORS[r.status as ReservationStatus] ?? '#757575'}20`,
                              color:
                                RESERVATION_STATUS_COLORS[r.status as ReservationStatus] ??
                                '#757575',
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                </Box>
              </Box>
            </>
          )}

          {reservation.confirmationCode && (
            <>
              <Divider />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  Code de confirmation :
                </Typography>
                <Chip
                  label={reservation.confirmationCode}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.6875rem', fontWeight: 600 }}
                />
              </Box>
            </>
          )}
        </Box>
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
    <Box
      sx={{
        flex: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        px: 1,
        py: 0.75,
        textAlign: 'center',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.5625rem',
          color: 'text.secondary',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default GuestCardDialog;
