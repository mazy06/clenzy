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
  Tooltip,
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
  Send,
  MarkEmailRead,
  Email,
} from '../../../icons';
import type { PlanningEvent, PlanningProperty } from '../types';
import { reservationsApi, RESERVATION_STATUS_COLORS, RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS } from '../../../services/api/reservationsApi';
import type { ReservationStatus, ReservationSource } from '../../../services/api';
import { guestMessagingApi } from '../../../services/api/guestMessagingApi';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AccessTime, Settings, Bolt } from '../../../icons';
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
  onUpdateGuestInfo?: (reservationId: number, updates: { guestName?: string; guestEmail?: string; guestPhone?: string }) => Promise<{ success: boolean; error: string | null }>;
  onNavigate?: (view: import('../types').PanelView) => void;
}

const PanelReservationInfo: React.FC<PanelReservationInfoProps> = ({ event, allEvents, properties, onUpdateReservation, onChangeProperty, onCancelReservation, onUpdateNotes, onUpdateGuestInfo, onNavigate }) => {
  const reservation = event.reservation;
  const [guestCardOpen, setGuestCardOpen] = useState(false);
  const [changePropertyOpen, setChangePropertyOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  if (!reservation) return null;

  const statusColor = RESERVATION_STATUS_COLORS[reservation.status as ReservationStatus] || '#9e9e9e';
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus] || reservation.status;
  const sourceLabel = RESERVATION_SOURCE_LABELS[reservation.source as ReservationSource] || reservation.source;
  const isICalSource = reservation.source === 'airbnb' || reservation.source === 'booking' || reservation.source === 'other';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Guest info */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Person size={20} strokeWidth={1.75} /></Box>
          {editingName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = nameValue.trim();
                    if (trimmed && trimmed !== reservation.guestName && onUpdateGuestInfo) {
                      setNameSaving(true);
                      await onUpdateGuestInfo(reservation.id, { guestName: trimmed });
                      setNameSaving(false);
                    }
                    setEditingName(false);
                  } else if (e.key === 'Escape') {
                    setEditingName(false);
                  }
                }}
                onBlur={async () => {
                  const trimmed = nameValue.trim();
                  if (trimmed && trimmed !== reservation.guestName && onUpdateGuestInfo) {
                    setNameSaving(true);
                    await onUpdateGuestInfo(reservation.id, { guestName: trimmed });
                    setNameSaving(false);
                  }
                  setEditingName(false);
                }}
                disabled={nameSaving}
                style={{
                  flex: 1,
                  border: 'none',
                  borderBottom: '2px solid #6b8a9a',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontFamily: 'inherit',
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
                flex: 1,
                cursor: onUpdateGuestInfo ? 'pointer' : 'default',
                borderRadius: 0.5,
                px: 0.5,
                mx: -0.5,
                '&:hover': onUpdateGuestInfo ? {
                  bgcolor: 'action.hover',
                  '& .edit-icon': { opacity: 1 },
                } : {},
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                {reservation.guestName}
              </Typography>
              {onUpdateGuestInfo && (
                <Box component="span" className="edit-icon" sx={{ display: 'inline-flex', color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s' }}><Edit size={14} strokeWidth={1.75} /></Box>
              )}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={statusLabel}
            size="small"
            sx={{
              backgroundColor: `${statusColor}18`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.6875rem',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Chip
            label={sourceLabel}
            size="small"
            sx={{ fontSize: '0.6875rem', fontWeight: 600, backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
          <Chip
            label={`${reservation.guestCount} voyageur${reservation.guestCount > 1 ? 's' : ''}`}
            size="small"
            sx={{ fontSize: '0.6875rem', fontWeight: 600, backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
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
        <Box
          onClick={() => onNavigate?.({ type: 'property-details', propertyId: event.propertyId })}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 0.5,
            cursor: onNavigate ? 'pointer' : 'default',
            p: 0.5,
            borderRadius: 1,
            '&:hover': onNavigate ? { backgroundColor: 'action.hover' } : {},
          }}
        >
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Home size={18} strokeWidth={1.75} /></Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: onNavigate ? 'primary.main' : 'text.primary', textDecoration: onNavigate ? 'underline' : 'none', textDecorationStyle: 'dotted' as const }}>
            {reservation.propertyName}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Price & Payment link */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><AttachMoney size={18} strokeWidth={1.75} /></Box>
          {(!reservation.totalPrice || reservation.totalPrice === 0) && isICalSource ? (
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
              Tarif à la nuitée non communiqué — import iCal
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {reservation.totalPrice?.toFixed(2)} EUR
            </Typography>
          )}
        </Box>

        {/* Payment link status */}
        <PaymentLinkSection reservation={reservation} />
      </Box>

      <Divider />

      {/* Notes */}
      <NotesSection
        reservation={reservation}
        onSave={onUpdateNotes}
      />

      <Divider />

      {/* Messagerie automatique */}
      <MessagingAutomationStatus
        guestEmail={reservation.guestEmail}
        source={reservation.source}
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
            startIcon={<SwapHoriz size={14} strokeWidth={1.75} />}
            sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
            onClick={() => setChangePropertyOpen(true)}
          >
            Changer logement
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<Cancel size={14} strokeWidth={1.75} />}
            sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
            onClick={() => setCancelDialogOpen(true)}
            disabled={reservation.status === 'cancelled'}
          >
            Annuler
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNew size={14} strokeWidth={1.75} />}
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
        onUpdateGuestInfo={onUpdateGuestInfo}
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
          <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><Warning size={22} strokeWidth={1.75} /></Box>
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
            startIcon={cancelLoading ? <CircularProgress size={14} /> : <Cancel size={16} strokeWidth={1.75} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Confirmer l'annulation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Payment Link Section ────────────────────────────────────────────────────

interface PaymentLinkSectionProps {
  reservation: NonNullable<PlanningEvent['reservation']>;
}

const PaymentLinkSection: React.FC<PaymentLinkSectionProps> = ({ reservation }) => {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  // Local state to track after send without needing parent re-render
  const [lastSentAt, setLastSentAt] = useState<string | null>(reservation.paymentLinkSentAt || null);
  const [lastSentEmail, setLastSentEmail] = useState<string | null>(reservation.paymentLinkEmail || null);

  // Sync with prop changes (e.g. if parent re-fetches)
  useEffect(() => {
    setLastSentAt(reservation.paymentLinkSentAt || null);
    setLastSentEmail(reservation.paymentLinkEmail || null);
    setSuccess(false);
    setError(null);
    setShowEmailInput(false);
    setCustomEmail('');
  }, [reservation.id, reservation.paymentLinkSentAt, reservation.paymentLinkEmail]);

  const handleSend = async (email?: string) => {
    setSending(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await reservationsApi.sendPaymentLink(reservation.id, email || undefined);
      setLastSentAt(result.paymentLinkSentAt || new Date().toISOString());
      setLastSentEmail(result.paymentLinkEmail || email || reservation.guestEmail || null);
      setSuccess(true);
      setShowEmailInput(false);
      setCustomEmail('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const hasTotalPrice = reservation.totalPrice != null && reservation.totalPrice > 0;

  return (
    <Box sx={{ mt: 1 }}>
      {/* Status indicator */}
      {lastSentAt ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', mt: 0.25 }}><MarkEmailRead size={16} strokeWidth={1.75} color='#4A9B8E' /></Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: '#4A9B8E', fontWeight: 600, fontSize: '0.6875rem', display: 'block' }}>
              Lien de paiement envoye
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.625rem', display: 'block' }}>
              Le {formatDate(lastSentAt)} a {lastSentEmail}
            </Typography>
          </Box>
        </Box>
      ) : (
        hasTotalPrice && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><Email size={16} strokeWidth={1.75} /></Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
              Lien de paiement non envoye
            </Typography>
          </Box>
        )
      )}

      {/* Action buttons */}
      {hasTotalPrice && (
        <>
          {!showEmailInput ? (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Tooltip title={lastSentAt ? 'Renvoyer le lien de paiement' : 'Envoyer un lien de paiement Stripe par email'}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={sending ? <CircularProgress size={12} /> : <Send size={14} strokeWidth={1.75} />}
                  onClick={() => handleSend()}
                  disabled={sending || !reservation.guestEmail}
                  sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
                >
                  {lastSentAt ? 'Renvoyer' : 'Envoyer le lien'}
                </Button>
              </Tooltip>
              <Tooltip title="Envoyer a une autre adresse email">
                <Button
                  size="small"
                  variant="text"
                  startIcon={<Edit size={12} strokeWidth={1.75} />}
                  onClick={() => setShowEmailInput(true)}
                  disabled={sending}
                  sx={{ fontSize: '0.6875rem', textTransform: 'none', color: 'text.secondary' }}
                >
                  Autre email
                </Button>
              </Tooltip>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                size="small"
                type="email"
                placeholder="email@exemple.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                fullWidth
                autoFocus
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
                inputProps={{ style: { padding: '6px 10px' } }}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={sending ? <CircularProgress size={12} /> : <Send size={14} strokeWidth={1.75} />}
                  onClick={() => handleSend(customEmail)}
                  disabled={sending || !customEmail.trim() || !customEmail.includes('@')}
                  sx={{ fontSize: '0.6875rem', textTransform: 'none', flex: 1 }}
                >
                  Envoyer
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => { setShowEmailInput(false); setCustomEmail(''); }}
                  disabled={sending}
                  sx={{ fontSize: '0.6875rem', textTransform: 'none' }}
                >
                  Annuler
                </Button>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Feedback */}
      {success && (
        <Alert severity="success" sx={{ mt: 1, fontSize: '0.6875rem', py: 0, '& .MuiAlert-message': { fontSize: '0.6875rem' } }}>
          Lien de paiement envoye avec succes
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 1, fontSize: '0.6875rem', py: 0, '& .MuiAlert-message': { fontSize: '0.6875rem' } }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

// ─── Notes Section (auto-save on blur / debounce) ───────────────────────────

interface NotesSectionProps {
  reservation: NonNullable<PlanningEvent['reservation']>;
  onSave?: (reservationId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
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
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          Notes
          {items.length > 0 && (
            <Chip
              label={items.length}
              size="small"
              sx={{
                ml: 0.75,
                height: 18,
                fontSize: '0.625rem',
                fontWeight: 600,
                bgcolor: 'primary.main',
                color: 'white',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          )}
        </Typography>
        {saving && <CircularProgress size={12} />}
        {saved && <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><Check size={14} strokeWidth={1.75} /></Box>}
      </Box>

      {/* Bullet list */}
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'grey.300',
          borderRadius: 1,
          bgcolor: items.length > 0 ? 'grey.50' : 'transparent',
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
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              minHeight: 32,
              borderBottom: idx < items.length - 1 ? '1px solid' : 'none',
              borderColor: 'grey.200',
              '&:hover': { bgcolor: 'grey.100' },
              '&:hover .note-delete-btn': { opacity: 1 },
              cursor: 'pointer',
            }}
            onClick={() => { if (editingIdx !== idx) startEditing(idx); }}
          >
            {/* Bullet dot */}
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />

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
                  padding: 0,
                  lineHeight: 1.5,
                }}
              />
            ) : (
              <Typography
                sx={{
                  flex: 1,
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  userSelect: 'none',
                }}
              >
                {item}
              </Typography>
            )}

            {/* Delete button — visible on hover */}
            <IconButton
              className="note-delete-btn"
              size="small"
              onClick={(e) => { e.stopPropagation(); deleteItem(idx); }}
              sx={{
                opacity: 0,
                transition: 'opacity 0.15s',
                p: 0.25,
                color: 'text.disabled',
                '&:hover': { color: 'error.main', bgcolor: 'error.lighter' },
              }}
            >
              <Close size={14} strokeWidth={1.75} />
            </IconButton>
          </Box>
        ))}

        {/* New item input — always visible at the bottom */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, minHeight: 34 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'grey.300', flexShrink: 0 }} />
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
              padding: 0,
              lineHeight: 1.5,
              color: 'inherit',
            }}
          />
        </Box>
      </Box>

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
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><CalendarMonth size={18} strokeWidth={1.75} /></Box>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>Dates & Horaires</Typography>
        {!editing ? (
          <IconButton size="small" onClick={() => setEditing(true)} sx={{ p: 0.25 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Edit size={14} strokeWidth={1.75} /></Box>
          </IconButton>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={handleSave}
              disabled={!hasChanges}
              sx={{ p: 0.25, color: 'success.main' }}
            >
              <Check size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton size="small" onClick={handleCancel} sx={{ p: 0.25, color: 'error.main' }}>
              <Close size={16} strokeWidth={1.75} />
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
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Schedule size={12} strokeWidth={1.75} /></Box>
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {reservation.checkInTime}
                </Typography>
              </Box>
            )}
          </Box>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><SwapHoriz  /></Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">Check-out</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {reservation.checkOut}
            </Typography>
            {reservation.checkOutTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, justifyContent: 'flex-end' }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Schedule size={12} strokeWidth={1.75} /></Box>
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

// ─── Messagerie automatique : etat du toggle + sante du destinataire ────────

interface MessagingAutomationStatusProps {
  guestEmail?: string | null;
  source?: string | null;
}

const MessagingAutomationStatus: React.FC<MessagingAutomationStatusProps> = ({ guestEmail, source }) => {
  const navigate = useNavigate();
  const { data: config, isLoading } = useQuery({
    queryKey: ['messaging-automation-config'],
    queryFn: () => guestMessagingApi.getConfig(),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const hasEmail = Boolean(guestEmail && guestEmail.trim() && guestEmail.includes('@'));
  const isAnonymizedIcal = (source || '').toLowerCase() === 'airbnb'
    || (source || '').toLowerCase() === 'booking'
    || (source || '').toLowerCase().includes('ical');

  const checkInOk = config?.autoSendCheckIn && config?.checkInTemplateId != null;
  const checkOutOk = config?.autoSendCheckOut && config?.checkOutTemplateId != null;

  const rowStyle = (ok: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    py: 0.5,
    color: ok ? 'success.main' : 'text.disabled',
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
            <Bolt size={16} strokeWidth={1.75} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
            Messagerie automatique
          </Typography>
        </Box>
        <Tooltip title="Configurer dans Paramètres">
          <IconButton size="small" onClick={() => navigate('/settings?section=messaging')}>
            <Settings size={14} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </Box>

      {isLoading ? (
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>Chargement…</Typography>
      ) : (
        <Box sx={{ pl: 0.25 }}>
          {/* Check-in */}
          <Box sx={rowStyle(Boolean(checkInOk))}>
            {checkInOk
              ? <CheckCircle size={12} strokeWidth={2} />
              : <Close size={12} strokeWidth={2} />}
            <Typography sx={{ fontSize: '0.6875rem', color: 'inherit', fontWeight: 600 }}>
              Check-in
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
              {checkInOk
                ? `automatique · J–${config?.hoursBeforeCheckIn ?? 24}h`
                : 'désactivé (envoi manuel uniquement)'}
            </Typography>
          </Box>

          {/* Check-out */}
          <Box sx={rowStyle(Boolean(checkOutOk))}>
            {checkOutOk
              ? <CheckCircle size={12} strokeWidth={2} />
              : <Close size={12} strokeWidth={2} />}
            <Typography sx={{ fontSize: '0.6875rem', color: 'inherit', fontWeight: 600 }}>
              Check-out
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
              {checkOutOk
                ? `automatique · ${config?.hoursBeforeCheckOut ?? 12}h avant départ`
                : 'désactivé (envoi manuel uniquement)'}
            </Typography>
          </Box>

          {/* Destinataire */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 0.75, pt: 0.75, borderTop: '1px dashed', borderColor: 'divider' }}>
            <Box component="span" sx={{ display: 'inline-flex', color: hasEmail ? 'success.main' : 'warning.main', mt: 0.1 }}>
              {hasEmail
                ? <CheckCircle size={12} strokeWidth={2} />
                : <Warning size={12} strokeWidth={2} />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: hasEmail ? 'success.main' : 'warning.main' }}>
                {hasEmail ? `Email guest disponible (${guestEmail})` : 'Pas d\'email guest'}
              </Typography>
              {!hasEmail && (
                <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', mt: 0.25, lineHeight: 1.35 }}>
                  {isAnonymizedIcal
                    ? `Réservation importée via iCal (${source}) — l'email du voyageur n'est pas exposé par le canal. Renseigne-le manuellement dans la fiche client pour activer les envois.`
                    : 'Aucun message automatique ne pourra être envoyé tant que l\'email n\'est pas renseigné.'}
                </Typography>
              )}
              {hasEmail && !checkInOk && !checkOutOk && (
                <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', mt: 0.25, lineHeight: 1.35 }}>
                  Active l'automation dans Paramètres › Messagerie pour que les emails partent sans intervention.
                </Typography>
              )}
            </Box>
          </Box>

          {(checkInOk || checkOutOk) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, color: 'text.disabled' }}>
              <AccessTime size={10} strokeWidth={1.75} />
              <Typography sx={{ fontSize: '0.625rem', color: 'inherit', fontStyle: 'italic' }}>
                Scheduler : déclenchement horaire
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PanelReservationInfo;
