import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Box,
  Typography,
  Chip,
  Divider,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  CalendarMonth,
  Person,
  Home,
  AttachMoney,
  Edit,
  SwapHoriz,
  Cancel,
  OpenInNew,
  Check,
  Close,
  Schedule,
  Warning,
  Save,
} from '@mui/icons-material';
import type { PlanningEvent, PlanningProperty } from '../types';
import { RESERVATION_STATUS_COLORS, RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS } from '../../../services/api/reservationsApi';
import type { ReservationStatus, ReservationSource } from '../../../services/api';
import GuestCardDialog from './GuestCardDialog';
import ChangePropertyDialog from './ChangePropertyDialog';

interface PanelReservationInfoProps {
  event: PlanningEvent;
  allEvents: PlanningEvent[];
  properties?: PlanningProperty[];
  onUpdateReservation?: (reservationId: number, updates: {
    checkIn?: string;
    checkOut?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }) => Promise<{ success: boolean; error: string | null }>;
  onChangeProperty?: (reservationId: number, newPropertyId: number, newPropertyName: string) => Promise<{ success: boolean; error: string | null }>;
  onCancelReservation?: (reservationId: number) => Promise<{ success: boolean; error: string | null }>;
  onUpdateNotes?: (reservationId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
}

const PanelReservationInfo: React.FC<PanelReservationInfoProps> = ({ event, allEvents, properties, onUpdateReservation, onChangeProperty, onCancelReservation, onUpdateNotes }) => {
  const reservation = event.reservation;
  const [guestCardOpen, setGuestCardOpen] = useState(false);
  const [changePropertyOpen, setChangePropertyOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  if (!reservation) return null;

  const statusColor = RESERVATION_STATUS_COLORS[reservation.status as ReservationStatus] || '#9e9e9e';
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus] || reservation.status;
  const sourceLabel = RESERVATION_SOURCE_LABELS[reservation.source as ReservationSource] || reservation.source;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Guest info */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Person sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {reservation.guestName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={statusLabel}
            size="small"
            sx={{
              backgroundColor: statusColor,
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.6875rem',
            }}
          />
          <Chip
            label={sourceLabel}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.6875rem' }}
          />
          <Chip
            label={`${reservation.guestCount} voyageur${reservation.guestCount > 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.6875rem' }}
          />
        </Box>
      </Box>

      <Divider />

      {/* Dates & Times — editable */}
      <EditableDatesSection
        reservation={reservation}
        onUpdate={onUpdateReservation}
      />

      <Divider />

      {/* Property */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Home sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {reservation.propertyName}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Price */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AttachMoney sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {reservation.totalPrice?.toFixed(2)} EUR
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Notes */}
      <NotesSection
        reservation={reservation}
        onSave={onUpdateNotes}
      />

      <Divider />

      {/* Quick actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.5 }}>
          Actions rapides
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SwapHoriz sx={{ fontSize: 14 }} />}
            sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
            onClick={() => setChangePropertyOpen(true)}
          >
            Changer logement
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<Cancel sx={{ fontSize: 14 }} />}
            sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
            onClick={() => setCancelDialogOpen(true)}
            disabled={reservation.status === 'cancelled'}
          >
            Annuler
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
            sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
            onClick={() => setGuestCardOpen(true)}
          >
            Fiche client
          </Button>
        </Box>
      </Box>

      {/* Guest Card Dialog */}
      <GuestCardDialog
        open={guestCardOpen}
        onClose={() => setGuestCardOpen(false)}
        reservation={reservation}
        allEvents={allEvents}
      />

      {/* Change Property Dialog */}
      {properties && onChangeProperty && (
        <ChangePropertyDialog
          open={changePropertyOpen}
          onClose={() => setChangePropertyOpen(false)}
          reservation={reservation}
          allEvents={allEvents}
          properties={properties}
          onConfirm={async (targetPropertyId, targetPropertyName) => {
            const result = await onChangeProperty(reservation.id, targetPropertyId, targetPropertyName);
            if (result.success) {
              setChangePropertyOpen(false);
            }
            return result;
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => { setCancelDialogOpen(false); setCancelError(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, pt: 2, px: 2.5 }}>
          <Warning sx={{ fontSize: 22, color: 'error.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Annuler la reservation
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', mb: 1 }}>
            Etes-vous sur de vouloir annuler la reservation de{' '}
            <strong>{reservation.guestName}</strong> au{' '}
            <strong>{reservation.propertyName}</strong> ?
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', mb: 1 }}>
            Du <strong>{reservation.checkIn}</strong> au <strong>{reservation.checkOut}</strong>
          </Typography>
          <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
            Les interventions liees (menage) seront egalement annulees. Cette action est irreversible.
          </Alert>
          {cancelError && (
            <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1 }}>
              {cancelError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1 }}>
          <Button
            onClick={() => { setCancelDialogOpen(false); setCancelError(null); }}
            size="small"
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Retour
          </Button>
          <Button
            onClick={async () => {
              if (!onCancelReservation) return;
              setCancelLoading(true);
              setCancelError(null);
              const result = await onCancelReservation(reservation.id);
              setCancelLoading(false);
              if (result.success) {
                setCancelDialogOpen(false);
              } else {
                setCancelError(result.error);
              }
            }}
            variant="contained"
            color="error"
            size="small"
            disabled={cancelLoading || !onCancelReservation}
            startIcon={cancelLoading ? <CircularProgress size={14} /> : <Cancel sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Confirmer l'annulation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Notes Section (auto-save on blur / debounce) ───────────────────────────

interface NotesSectionProps {
  reservation: NonNullable<PlanningEvent['reservation']>;
  onSave?: (reservationId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
}

const NotesSection: React.FC<NotesSectionProps> = ({ reservation, onSave }) => {
  const [notes, setNotes] = useState(reservation.notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when reservation changes
  useEffect(() => {
    setNotes(reservation.notes || '');
    setSaved(false);
    setError(null);
  }, [reservation.id, reservation.notes]);

  const hasChanges = notes !== (reservation.notes || '');

  const saveNotes = useCallback(async (value: string) => {
    if (!onSave) return;
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

  const handleChange = (value: string) => {
    setNotes(value);
    setSaved(false);
    setError(null);
    // Debounce auto-save (1.5s after last keystroke)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotes(value);
    }, 1500);
  };

  const handleBlur = () => {
    // Save immediately on blur if changed
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (hasChanges) {
      saveNotes(notes);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>Notes</Typography>
        {saving && <CircularProgress size={12} />}
        {saved && <Check sx={{ fontSize: 14, color: 'success.main' }} />}
      </Box>
      <TextField
        multiline
        rows={2}
        fullWidth
        size="small"
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Ajouter une note..."
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '0.8125rem',
          },
        }}
      />
      {error && (
        <Typography variant="caption" color="error" sx={{ fontSize: '0.625rem', mt: 0.25, display: 'block' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

// ─── Editable Dates & Times Section ─────────────────────────────────────────

interface EditableDatesSectionProps {
  reservation: NonNullable<PlanningEvent['reservation']>;
  onUpdate?: (reservationId: number, updates: {
    checkIn?: string;
    checkOut?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }) => Promise<{ success: boolean; error: string | null }>;
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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <CalendarMonth sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>Dates & Horaires</Typography>
        {!editing ? (
          <IconButton size="small" onClick={() => setEditing(true)} sx={{ p: 0.25 }}>
            <Edit sx={{ fontSize: 14, color: 'text.secondary' }} />
          </IconButton>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={handleSave}
              disabled={!hasChanges}
              sx={{ p: 0.25, color: 'success.main' }}
            >
              <Check sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" onClick={handleCancel} sx={{ p: 0.25, color: 'error.main' }}>
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {!editing ? (
        /* Display mode */
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Check-in</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {reservation.checkIn}
            </Typography>
            {reservation.checkInTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {reservation.checkInTime}
                </Typography>
              </Box>
            )}
          </Box>
          <SwapHoriz sx={{ color: 'text.disabled' }} />
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">Check-out</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {reservation.checkOut}
            </Typography>
            {reservation.checkOutTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, justifyContent: 'flex-end' }}>
                <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {reservation.checkOutTime}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      ) : (
        /* Edit mode */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Check-in */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.25, display: 'block' }}>
              Check-in
            </Typography>
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
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.25, display: 'block' }}>
              Check-out
            </Typography>
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
            <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.625rem' }}>
              Les interventions liees (menage) seront automatiquement decalees.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PanelReservationInfo;
