import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner, Button } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, IconButton, Divider, TextField } from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Star as StarIcon,
  CalendarMonth as CalendarIcon,
  Note as NoteIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
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
        <div className="flex items-center gap-1.5">
          <span className="inline-flex text-primary"><PersonIcon size={'1.25rem'} strokeWidth={1.75} /></span>
          <p className="cn-text-body1 text-[0.9375rem] font-bold">
            {t('channels.guest.title')}
          </p>
        </div>
        <IconButton size="small" onClick={onClose}><CloseIcon size={'1rem'} strokeWidth={1.75} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {loading && (
          <div className="flex justify-center py-6">
            <Spinner className="size-7" />
          </div>
        )}

        {error && <Alert variant="destructive" className="text-[0.8125rem] mb-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

        {guest && !loading && (
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-[48px] h-[48px] rounded-[50%] bg-[var(--mui-primary)] flex items-center justify-center text-[white] text-[1.125rem] font-bold">
                {guest.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="cn-text-body1 text-[0.9375rem] font-bold">{guest.name}</p>
                <div className="flex gap-2 mt-0.5">
                  {guest.email && (
                    <div className="flex items-center gap-0.5">
                      <span className="inline-flex text-muted-foreground"><EmailIcon size={'0.75rem'} strokeWidth={1.75} /></span>
                      <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">{guest.email}</p>
                    </div>
                  )}
                  {guest.phone && (
                    <div className="flex items-center gap-0.5">
                      <span className="inline-flex text-muted-foreground"><PhoneIcon size={'0.75rem'} strokeWidth={1.75} /></span>
                      <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">{guest.phone}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              <StatBox label={t('channels.guest.totalStays')} value={String(guest.totalStays)} />
              <StatBox label={t('channels.guest.source')} value={guest.source} />
              {guest.averageRating && (
                <StatBox
                  label={t('channels.guest.avgRating')}
                  value={
                    <div className="flex items-center gap-0.5">
                      <StarIcon size={'0.75rem'} strokeWidth={1.75} color='var(--warn)' />
                      {guest.averageRating.toFixed(1)}
                    </div>
                  }
                />
              )}
              {guest.lastStayDate && (
                <StatBox label={t('channels.guest.lastStay')} value={new Date(guest.lastStayDate).toLocaleDateString('fr-FR')} />
              )}
            </div>

            {/* Special requests */}
            {guest.specialRequests && (
              <>
                <Divider />
                <div>
                  <p className="cn-text-body1 text-[0.6875rem] font-semibold mb-0.5 uppercase text-muted-foreground">
                    {t('channels.guest.specialRequests')}
                  </p>
                  <p className="cn-text-body1 text-[0.8125rem] bg-[var(--hover)] p-1.5 rounded-[1px]">
                    {guest.specialRequests}
                  </p>
                </div>
              </>
            )}

            {/* Notes */}
            <Divider />
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <p className="cn-text-body1 text-[0.6875rem] font-semibold uppercase text-muted-foreground">
                  <span className="inline-flex me-[1.5px] align-[middle]"><NoteIcon size={'0.75rem'} strokeWidth={1.75} /></span>
                  {t('channels.guest.notes')}
                </p>
                {!editingNotes && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                    {t('common.edit')}
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="flex flex-col gap-1">
                  <TextField
                    multiline
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.8125rem' } }}
                  />
                  <div className="flex gap-0.5 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setEditingNotes(false); setNotes(guest.notes ?? ''); }}>
                      {t('common.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                      {savingNotes ? <Spinner className="size-3" /> : t('common.save')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={cn('cn-text-body1 text-[0.8125rem]', guest.notes ? 'text-[var(--ink)]' : 'text-[var(--muted)]', guest.notes ? 'not-italic' : 'italic')}>
                  {guest.notes || t('channels.guest.noNotes')}
                </p>
              )}
            </div>

            {/* Reservation history */}
            {guest.reservations.length > 0 && (
              <>
                <Divider />
                <div>
                  <p className="cn-text-body1 text-[0.6875rem] font-semibold mb-1 uppercase text-muted-foreground">
                    <span className="inline-flex me-[1.5px] align-[middle]"><CalendarIcon size={'0.75rem'} strokeWidth={1.75} /></span>
                    {t('channels.guest.reservationHistory')} ({guest.reservations.length})
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {guest.reservations.map((r) => (
                      <div className="flex justify-between items-center border border-[var(--line)] rounded-[0.75px] px-1.5 py-0.5" key={r.id}>
                        <div>
                          <p className="cn-text-body1 text-[0.75rem] font-semibold">{r.propertyName}</p>
                          <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
                            {new Date(r.checkIn).toLocaleDateString('fr-FR')} → {new Date(r.checkOut).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="cn-text-body1 text-[0.75rem] font-semibold"><Money value={r.totalPrice} from="EUR" /></p>
                          <StatusChip size="sm" tokens={{ color: RESERVATION_STATUS_COLORS[r.status as keyof typeof RESERVATION_STATUS_COLORS] ?? '#757575', bg: `${RESERVATION_STATUS_COLORS[r.status as keyof typeof RESERVATION_STATUS_COLORS] ?? '#757575'}20` }} label={r.status} className="text-[0.5625rem]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-[var(--line)] rounded-[1px] px-2 py-1 text-center">
      <p className="cn-text-body1 text-[0.5625rem] text-muted-foreground uppercase font-medium">{label}</p>
      <p className="cn-text-body1 text-[0.875rem] font-bold mt-0.5">{value}</p>
    </div>
  );
}

export default GuestProfileDialog;
