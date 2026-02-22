import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
  Alert,
  alpha,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { propertiesApi } from '../../services/api';
import type { Property } from '../../services/api/propertiesApi';
import type { Reservation, ReservationStatus } from '../../services/api/reservationsApi';
import type { CreateReservationData, UpdateReservationData } from '../../services/api/reservationsApi';
import { extractApiList } from '../../types';
import MiniDateRangePicker from '../../components/MiniDateRangePicker';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReservationFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateReservationData | UpdateReservationData) => Promise<void>;
  reservation?: Reservation | null;
  isSubmitting: boolean;
}

const STATUS_OPTIONS: ReservationStatus[] = [
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
];

// ─── Component ──────────────────────────────────────────────────────────────

const ReservationFormDialog: React.FC<ReservationFormDialogProps> = ({
  open,
  onClose,
  onSubmit,
  reservation,
  isSubmitting,
}) => {
  const { t, isFrench } = useTranslation();
  const { user } = useAuth();
  const isEditing = Boolean(reservation);
  const isExternalSource = reservation ? reservation.source !== 'direct' : false;

  // Role-based property access: SUPER_ADMIN and SUPER_MANAGER can change property
  const isPlatformStaff =
    user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';

  // ─── Form state ──────────────────────────────────────────────────
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCount, setGuestCount] = useState<number>(1);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ReservationStatus>('pending');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Fetch properties for select ──────────────────────────────────
  const propertiesQuery = useQuery({
    queryKey: ['properties-for-reservation-form'],
    queryFn: async () => {
      const data = await propertiesApi.getAll({ size: 500 });
      return extractApiList<Property>(data);
    },
    staleTime: 120_000,
    enabled: open,
  });

  // Auto-select first property for HOST users (non-platform staff)
  useEffect(() => {
    if (!isPlatformStaff && propertiesQuery.data && propertiesQuery.data.length > 0 && !propertyId && !reservation) {
      setPropertyId(propertiesQuery.data[0].id);
    }
  }, [isPlatformStaff, propertiesQuery.data, propertyId, reservation]);

  // ─── Populate form on edit ────────────────────────────────────────
  useEffect(() => {
    if (reservation) {
      setPropertyId(reservation.propertyId);
      setGuestName(reservation.guestName);
      setGuestEmail(reservation.guestEmail ?? '');
      setGuestPhone(reservation.guestPhone ?? '');
      setGuestCount(reservation.guestCount);
      setCheckIn(reservation.checkIn);
      setCheckOut(reservation.checkOut);
      setCheckInTime(reservation.checkInTime ?? '');
      setCheckOutTime(reservation.checkOutTime ?? '');
      setTotalPrice(reservation.totalPrice ?? '');
      setNotes(reservation.notes ?? '');
      setStatus(reservation.status);
    } else {
      resetForm();
    }
  }, [reservation, open]);

  function resetForm() {
    setPropertyId('');
    setGuestName('');
    setGuestEmail('');
    setGuestPhone('');
    setGuestCount(1);
    setCheckIn('');
    setCheckOut('');
    setCheckInTime('');
    setCheckOutTime('');
    setTotalPrice('');
    setNotes('');
    setStatus('pending');
    setSubmitError(null);
  }

  // ─── Validation ───────────────────────────────────────────────────
  const isValid = isEditing
    ? (isExternalSource ? true : guestName.trim() !== '' && checkIn !== '' && checkOut !== '')
    : propertyId !== '' && guestName.trim() !== '' && checkIn !== '' && checkOut !== '' && checkIn < checkOut;

  // ─── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      if (isEditing) {
        const updateData: UpdateReservationData = {
          notes,
          status,
        };
        if (!isExternalSource) {
          updateData.guestName = guestName;
          updateData.guestEmail = guestEmail || undefined;
          updateData.guestPhone = guestPhone || undefined;
          updateData.guestCount = guestCount;
          updateData.checkIn = checkIn;
          updateData.checkOut = checkOut;
          updateData.checkInTime = checkInTime || undefined;
          updateData.checkOutTime = checkOutTime || undefined;
          updateData.totalPrice = totalPrice !== '' ? Number(totalPrice) : undefined;
        }
        await onSubmit(updateData);
      } else {
        const createData: CreateReservationData = {
          propertyId: propertyId as number,
          guestName,
          guestEmail: guestEmail || undefined,
          guestPhone: guestPhone || undefined,
          guestCount,
          checkIn,
          checkOut,
          checkInTime: checkInTime || undefined,
          checkOutTime: checkOutTime || undefined,
          totalPrice: totalPrice !== '' ? Number(totalPrice) : undefined,
          notes: notes || undefined,
        };
        await onSubmit(createData);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      setSubmitError(message);
    }
  };

  // ─── Property display helper ──────────────────────────────────────
  const selectedPropertyName = propertiesQuery.data?.find((p) => p.id === propertyId)?.name ?? '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, fontSize: '0.9375rem', fontWeight: 700 }}>
        {isEditing ? t('reservations.edit') : t('reservations.create')}
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.8125rem' }}>
            {submitError}
          </Alert>
        )}

        {isEditing && isExternalSource && (
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8125rem' }}>
            {isFrench
              ? `Cette réservation provient de ${reservation?.source}. Seuls les notes et le statut sont modifiables.`
              : `This reservation comes from ${reservation?.source}. Only notes and status can be edited.`}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 0.5 }}>
          {/* ── Property selector ── */}
          {!isEditing && (
            <FormControl fullWidth size="small" required>
              <InputLabel>{t('reservations.fields.property')}</InputLabel>
              <Select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value as number)}
                label={t('reservations.fields.property')}
                disabled={!isPlatformStaff || propertiesQuery.isLoading}
              >
                {propertiesQuery.isLoading && (
                  <MenuItem disabled>
                    <CircularProgress size={14} sx={{ mr: 1 }} />
                    {t('common.loading')}
                  </MenuItem>
                )}
                {(propertiesQuery.data ?? []).map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
              {!isPlatformStaff && selectedPropertyName && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.625rem' }}>
                  {isFrench ? 'Propriété sélectionnée automatiquement' : 'Property auto-selected'}
                </Typography>
              )}
            </FormControl>
          )}

          {/* Show property name when editing */}
          {isEditing && reservation && (
            <Box sx={{ py: 0.5, px: 1, borderRadius: 1, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.5625rem', display: 'block' }}>
                {t('reservations.fields.property')}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
                {reservation.propertyName}
              </Typography>
            </Box>
          )}

          {/* ── Guest information ── */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6875rem', mt: 0.5 }}>
            {t('reservations.fields.guestInfo')}
          </Typography>

          {/* Guest name */}
          <TextField
            fullWidth
            size="small"
            label={t('reservations.fields.guestName')}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
            disabled={isEditing && isExternalSource}
          />

          {/* Guest email + phone */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              type="email"
              label={t('reservations.fields.guestEmail')}
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              disabled={isEditing && isExternalSource}
            />
            <TextField
              fullWidth
              size="small"
              type="tel"
              label={t('reservations.fields.guestPhone')}
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              disabled={isEditing && isExternalSource}
            />
          </Box>

          {/* Guest count */}
          <TextField
            size="small"
            type="number"
            label={t('reservations.fields.guestCount')}
            value={guestCount}
            onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1 }}
            disabled={isEditing && isExternalSource}
            sx={{ width: 180 }}
          />

          {/* ── Dates ── */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6875rem', mt: 0.5 }}>
            {t('reservations.fields.dates')}
          </Typography>

          {/* Calendar date range picker */}
          {!(isEditing && isExternalSource) && (
            <MiniDateRangePicker
              startDate={checkIn}
              endDate={checkOut}
              onChangeStart={setCheckIn}
              onChangeEnd={setCheckOut}
              isFrench={isFrench}
              startLabel={t('reservations.fields.checkIn')}
              endLabel={t('reservations.fields.checkOut')}
            />
          )}

          {/* Read-only dates for external source editing */}
          {isEditing && isExternalSource && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1, py: 0.5, px: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.5625rem', display: 'block' }}>
                  {t('reservations.fields.checkIn')}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                  {checkIn || '—'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, py: 0.5, px: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.5625rem', display: 'block' }}>
                  {t('reservations.fields.checkOut')}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                  {checkOut || '—'}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Date validation error */}
          {checkIn && checkOut && checkOut <= checkIn && (
            <Typography variant="caption" color="error" sx={{ fontSize: '0.625rem' }}>
              {isFrench
                ? "La date de départ doit être après la date d'arrivée"
                : 'Check-out must be after check-in'}
            </Typography>
          )}

          {/* Check-in / Check-out times */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              type="time"
              label={t('reservations.fields.checkInTime')}
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={isEditing && isExternalSource}
            />
            <TextField
              fullWidth
              size="small"
              type="time"
              label={t('reservations.fields.checkOutTime')}
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={isEditing && isExternalSource}
            />
          </Box>

          {/* ── Price + Status ── */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              type="number"
              label={t('reservations.fields.totalPrice')}
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value === '' ? '' : Number(e.target.value))}
              InputProps={{
                endAdornment: (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                    EUR
                  </Typography>
                ),
              }}
              inputProps={{ min: 0, step: 0.01 }}
              disabled={isEditing && isExternalSource}
              sx={{ flex: 1 }}
            />

            {/* Status (edit only) */}
            {isEditing && (
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('reservations.fields.status')}</InputLabel>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReservationStatus)}
                  label={t('reservations.fields.status')}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {t(`reservations.status.${s}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* Notes */}
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t('reservations.fields.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={onClose}
          size="small"
          disabled={isSubmitting}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={!isValid || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={14} /> : undefined}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          {isEditing ? t('common.save') : t('reservations.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReservationFormDialog;
