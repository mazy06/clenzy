import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Close,
  Person,
  Email,
  Phone,
  CalendarMonth,
  Home,
  AttachMoney,
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';
import type { Reservation } from '../../../services/api';
import { RESERVATION_STATUS_COLORS, RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS } from '../../../services/api/reservationsApi';
import type { ReservationStatus, ReservationSource } from '../../../services/api';

interface GuestCardDialogProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation;
  allEvents: PlanningEvent[];
}

const GuestCardDialog: React.FC<GuestCardDialogProps> = ({ open, onClose, reservation, allEvents }) => {
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
          <Person sx={{ fontSize: '1.25rem', color: 'primary.main' }} />
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
            Fiche client
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close sx={{ fontSize: '1rem' }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Header — Avatar + Name + Contact */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
              }}
            >
              {initials}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
                {reservation.guestName}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                {reservation.guestEmail && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Email sx={{ fontSize: '0.8rem', color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {reservation.guestEmail}
                    </Typography>
                  </Box>
                )}
                {reservation.guestPhone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Phone sx={{ fontSize: '0.8rem', color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {reservation.guestPhone}
                    </Typography>
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
              value={`${totalSpent.toFixed(0)} €`}
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
                    <Home sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      {reservation.propertyName}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarMonth sx={{ fontSize: 12, color: 'text.secondary' }} />
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
                    <AttachMoney sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                      {reservation.totalPrice?.toFixed(2)} €
                    </Typography>
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
                  <CalendarMonth
                    sx={{ fontSize: '0.75rem', mr: 0.25, verticalAlign: 'middle' }}
                  />
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
