import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  TextField,
  Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Star as StarIcon,
  CalendarMonth as CalendarIcon,
  Note as NoteIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { airbnbApi } from '../../services/api/airbnbApi';
import type { GuestProfile } from '../../services/api/airbnbApi';
import { RESERVATION_STATUS_COLORS } from '../../services/api/reservationsApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GuestProfileDialogProps {
  guestId: number | null;
  open: boolean;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const GuestProfileDialog: React.FC<GuestProfileDialogProps> = ({ guestId, open, onClose }) => {
  const { t } = useTranslation();
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!guestId || !open) return;
    setLoading(true);
    setError(null);
    airbnbApi.getGuestProfile(guestId)
      .then((data) => {
        setGuest(data);
        setNotes(data.notes ?? '');
      })
      .catch(() => setError(t('channels.guest.errorLoading')))
      .finally(() => setLoading(false));
  }, [guestId, open, t]);

  const handleSaveNotes = useCallback(async () => {
    if (!guestId) return;
    setSavingNotes(true);
    try {
      const updated = await airbnbApi.updateGuestNotes(guestId, notes);
      setGuest(updated);
      setEditingNotes(false);
    } catch {
      // Error silently
    } finally {
      setSavingNotes(false);
    }
  }, [guestId, notes]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon sx={{ fontSize: '1.25rem', color: 'primary.main' }} />
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
            {t('channels.guest.title')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon sx={{ fontSize: '1rem' }} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ fontSize: '0.8125rem', mb: 1 }}>{error}</Alert>}

        {guest && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  fontSize: '1.125rem', fontWeight: 700,
                }}
              >
                {guest.name.charAt(0).toUpperCase()}
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>{guest.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
                  {guest.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <EmailIcon sx={{ fontSize: '0.75rem', color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>{guest.email}</Typography>
                    </Box>
                  )}
                  {guest.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <PhoneIcon sx={{ fontSize: '0.75rem', color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>{guest.phone}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Stats */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <StatBox label={t('channels.guest.totalStays')} value={String(guest.totalStays)} />
              <StatBox label={t('channels.guest.source')} value={guest.source} />
              {guest.averageRating && (
                <StatBox
                  label={t('channels.guest.avgRating')}
                  value={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <StarIcon sx={{ fontSize: '0.75rem', color: '#D4A574' }} />
                      {guest.averageRating.toFixed(1)}
                    </Box>
                  }
                />
              )}
              {guest.lastStayDate && (
                <StatBox label={t('channels.guest.lastStay')} value={new Date(guest.lastStayDate).toLocaleDateString('fr-FR')} />
              )}
            </Box>

            {/* Special requests */}
            {guest.specialRequests && (
              <>
                <Divider />
                <Box>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', color: 'text.secondary' }}>
                    {t('channels.guest.specialRequests')}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                    {guest.specialRequests}
                  </Typography>
                </Box>
              </>
            )}

            {/* Notes */}
            <Divider />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
                  <NoteIcon sx={{ fontSize: '0.75rem', mr: 0.25, verticalAlign: 'middle' }} />
                  {t('channels.guest.notes')}
                </Typography>
                {!editingNotes && (
                  <Button size="small" onClick={() => setEditingNotes(true)} sx={{ fontSize: '0.6875rem' }}>
                    {t('common.edit')}
                  </Button>
                )}
              </Box>
              {editingNotes ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <TextField
                    multiline
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.8125rem' } }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Button size="small" variant="outlined" onClick={() => { setEditingNotes(false); setNotes(guest.notes ?? ''); }} sx={{ fontSize: '0.6875rem' }}>
                      {t('common.cancel')}
                    </Button>
                    <Button size="small" variant="contained" onClick={handleSaveNotes} disabled={savingNotes} sx={{ fontSize: '0.6875rem' }}>
                      {savingNotes ? <CircularProgress size={12} /> : t('common.save')}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.8125rem', color: guest.notes ? 'text.primary' : 'text.secondary', fontStyle: guest.notes ? 'normal' : 'italic' }}>
                  {guest.notes || t('channels.guest.noNotes')}
                </Typography>
              )}
            </Box>

            {/* Reservation history */}
            {guest.reservations.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, mb: 0.75, textTransform: 'uppercase', color: 'text.secondary' }}>
                    <CalendarIcon sx={{ fontSize: '0.75rem', mr: 0.25, verticalAlign: 'middle' }} />
                    {t('channels.guest.reservationHistory')} ({guest.reservations.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {guest.reservations.map((r) => (
                      <Box
                        key={r.id}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: '1px solid', borderColor: 'divider', borderRadius: 0.75, px: 1, py: 0.5,
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{r.propertyName}</Typography>
                          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                            {new Date(r.checkIn).toLocaleDateString('fr-FR')} → {new Date(r.checkOut).toLocaleDateString('fr-FR')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{r.totalPrice}€</Typography>
                          <Chip
                            label={r.status}
                            size="small"
                            sx={{
                              fontSize: '0.5625rem', height: 18,
                              bgcolor: `${RESERVATION_STATUS_COLORS[r.status as keyof typeof RESERVATION_STATUS_COLORS] ?? '#757575'}20`,
                              color: RESERVATION_STATUS_COLORS[r.status as keyof typeof RESERVATION_STATUS_COLORS] ?? '#757575',
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.25, py: 0.75, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

export default GuestProfileDialog;
