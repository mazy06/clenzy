import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Snackbar,
  Chip,
} from '@mui/material';
import {
  ContentCopy,
  AddCircleOutline,
  RemoveCircleOutline,
  Block,
  Star,
  Warning,
  Label,
  Send,
  TaskAlt,
  Close,
  Check,
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';

// ── Staff (for team messages & task assignment) ────────────────────────────
const TEAM_MEMBERS = [
  'Fatou Diallo',
  'Carmen Lopez',
  'Nathalie Blanc',
  'Amina Keita',
  'Lucie Moreau',
  'Marc Dupuis',
  'Jean-Pierre Martin',
  'Thomas Bernard',
];

interface PanelActionsProps {
  event: PlanningEvent;
  allEvents?: PlanningEvent[];
  onUpdateReservation?: (reservationId: number, updates: {
    checkIn?: string;
    checkOut?: string;
  }) => Promise<{ success: boolean; error: string | null }>;
  onUpdateNotes?: (reservationId: number, notes: string) => Promise<{ success: boolean; error: string | null }>;
  onCreateIntervention?: (data: {
    propertyId: number;
    propertyName: string;
    type: 'cleaning' | 'maintenance';
    title: string;
    assigneeName: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    estimatedDurationHours: number;
    notes?: string;
    linkedReservationId?: number;
  }) => Promise<{ success: boolean; error: string | null }>;
  onDuplicateReservation?: (reservationId: number, newCheckIn: string, newCheckOut: string) => Promise<{ success: boolean; error: string | null }>;
}

const PanelActions: React.FC<PanelActionsProps> = ({
  event,
  allEvents,
  onUpdateReservation,
  onUpdateNotes,
  onCreateIntervention,
  onDuplicateReservation,
}) => {
  const isReservation = event.type === 'reservation';
  const reservation = event.reservation;

  // ── Dialog states ────────────────────────────────────────────────────────

  // Duplicate
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [dupCheckIn, setDupCheckIn] = useState('');
  const [dupCheckOut, setDupCheckOut] = useState('');
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);

  // Extend / Shorten
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(1);
  const [extendMode, setExtendMode] = useState<'extend' | 'shorten'>('extend');
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  // Block after departure
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockDays, setBlockDays] = useState(1);
  const [blockReason, setBlockReason] = useState('Preparation logement');
  const [blockLoading, setBlockLoading] = useState(false);

  // Custom tag
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const [tagLoading, setTagLoading] = useState(false);

  // Send message
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);

  // Internal task
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);

  // VIP / Attention states (toggled via notes)
  const [vipLoading, setVipLoading] = useState(false);
  const [attentionLoading, setAttentionLoading] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const today = new Date().toISOString().split('T')[0];

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const currentNotes = reservation?.notes || '';
  const isVip = currentNotes.includes('[VIP]');
  const hasAttention = currentNotes.includes('[ATTENTION]');

  // ── Handlers ─────────────────────────────────────────────────────────────

  // 1. Dupliquer
  const handleDuplicate = async () => {
    if (!reservation || !onDuplicateReservation || !dupCheckIn || !dupCheckOut) return;
    setDupLoading(true);
    setDupError(null);
    const result = await onDuplicateReservation(reservation.id, dupCheckIn, dupCheckOut);
    setDupLoading(false);
    if (result.success) {
      setDuplicateOpen(false);
      showSnackbar('Reservation dupliquee avec succes');
    } else {
      setDupError(result.error);
    }
  };

  // 2. Prolonger / Raccourcir
  const handleExtend = async () => {
    if (!reservation || !onUpdateReservation) return;
    const days = extendMode === 'extend' ? extendDays : -extendDays;
    const newCheckOut = addDays(reservation.checkOut, days);

    if (newCheckOut <= reservation.checkIn) {
      setExtendError('La date de fin doit etre apres la date de debut');
      return;
    }

    setExtendLoading(true);
    setExtendError(null);
    const result = await onUpdateReservation(reservation.id, { checkOut: newCheckOut });
    setExtendLoading(false);
    if (result.success) {
      setExtendOpen(false);
      showSnackbar(
        extendMode === 'extend'
          ? `Sejour prolonge de ${extendDays} jour${extendDays > 1 ? 's' : ''}`
          : `Sejour raccourci de ${extendDays} jour${extendDays > 1 ? 's' : ''}`,
      );
    } else {
      setExtendError(result.error);
    }
  };

  // 3. Bloquer logement
  const handleBlock = async () => {
    if (!reservation || !onCreateIntervention) return;
    setBlockLoading(true);
    const startDate = reservation.checkOut;
    const endDate = addDays(startDate, blockDays);
    const result = await onCreateIntervention({
      propertyId: reservation.propertyId,
      propertyName: reservation.propertyName,
      type: 'maintenance',
      title: `Blocage : ${blockReason}`,
      assigneeName: 'Systeme',
      startDate,
      endDate,
      startTime: '00:00',
      endTime: '23:59',
      estimatedDurationHours: blockDays * 24,
      notes: `Logement bloque apres depart de ${reservation.guestName}. Raison : ${blockReason}`,
      linkedReservationId: reservation.id,
    });
    setBlockLoading(false);
    if (result.success) {
      setBlockOpen(false);
      showSnackbar(`Logement bloque pour ${blockDays} jour${blockDays > 1 ? 's' : ''}`);
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  // 4. Toggle VIP
  const handleToggleVip = async () => {
    if (!reservation || !onUpdateNotes) return;
    setVipLoading(true);
    let newNotes: string;
    if (isVip) {
      newNotes = currentNotes.replace(/\[VIP\] ?/, '').trim();
    } else {
      newNotes = `[VIP] ${currentNotes}`.trim();
    }
    const result = await onUpdateNotes(reservation.id, newNotes);
    setVipLoading(false);
    if (result.success) {
      showSnackbar(isVip ? 'Marqueur VIP retire' : 'Marque comme VIP');
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  // 5. Toggle Attention
  const handleToggleAttention = async () => {
    if (!reservation || !onUpdateNotes) return;
    setAttentionLoading(true);
    let newNotes: string;
    if (hasAttention) {
      newNotes = currentNotes.replace(/\[ATTENTION\] ?/, '').trim();
    } else {
      newNotes = `[ATTENTION] ${currentNotes}`.trim();
    }
    const result = await onUpdateNotes(reservation.id, newNotes);
    setAttentionLoading(false);
    if (result.success) {
      showSnackbar(hasAttention ? 'Marqueur Attention retire' : 'Attention particuliere ajoutee');
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  // 6. Custom tag
  const handleAddTag = async () => {
    if (!reservation || !onUpdateNotes || !tagValue.trim()) return;
    setTagLoading(true);
    const tag = `[${tagValue.trim().toUpperCase()}]`;
    const newNotes = `${tag} ${currentNotes}`.trim();
    const result = await onUpdateNotes(reservation.id, newNotes);
    setTagLoading(false);
    if (result.success) {
      setTagDialogOpen(false);
      setTagValue('');
      showSnackbar(`Tag "${tag}" ajoute`);
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  // 7. Send message
  const handleSendMessage = async () => {
    if (!reservation || !onUpdateNotes || !messageRecipient || !messageText.trim()) return;
    setMessageLoading(true);
    const timestamp = new Date().toLocaleString('fr-FR');
    const msgLine = `\n--- Message a ${messageRecipient} (${timestamp}) ---\n${messageText.trim()}`;
    const newNotes = (currentNotes + msgLine).trim();
    const result = await onUpdateNotes(reservation.id, newNotes);
    setMessageLoading(false);
    if (result.success) {
      setMessageOpen(false);
      setMessageRecipient('');
      setMessageText('');
      showSnackbar(`Message envoye a ${messageRecipient}`);
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  // 8. Create internal task
  const handleCreateTask = async () => {
    if (!reservation || !onCreateIntervention || !taskTitle.trim() || !taskAssignee) return;
    setTaskLoading(true);
    const result = await onCreateIntervention({
      propertyId: reservation.propertyId,
      propertyName: reservation.propertyName,
      type: 'maintenance',
      title: taskTitle.trim(),
      assigneeName: taskAssignee,
      startDate: taskDueDate || today,
      endDate: taskDueDate || today,
      estimatedDurationHours: 1,
      notes: `Tache interne liee a la reservation de ${reservation.guestName}`,
      linkedReservationId: reservation.id,
    });
    setTaskLoading(false);
    if (result.success) {
      setTaskOpen(false);
      setTaskTitle('');
      setTaskAssignee('');
      setTaskDueDate('');
      showSnackbar('Tache interne creee');
    } else {
      showSnackbar(result.error || 'Erreur', 'error');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Optimization & logistics */}
      {isReservation && reservation && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
            Optimisation
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
              fullWidth
              onClick={() => {
                // Pre-fill with dates shifted by the stay duration
                const duration = Math.round(
                  (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / (1000 * 60 * 60 * 24),
                );
                const newIn = addDays(reservation.checkOut, 1);
                const newOut = addDays(newIn, duration);
                setDupCheckIn(newIn);
                setDupCheckOut(newOut);
                setDupError(null);
                setDuplicateOpen(true);
              }}
              sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
            >
              Dupliquer reservation
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddCircleOutline sx={{ fontSize: 14 }} />}
              fullWidth
              onClick={() => {
                setExtendMode('extend');
                setExtendDays(1);
                setExtendError(null);
                setExtendOpen(true);
              }}
              sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
            >
              Prolonger sejour
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RemoveCircleOutline sx={{ fontSize: 14 }} />}
              fullWidth
              onClick={() => {
                setExtendMode('shorten');
                setExtendDays(1);
                setExtendError(null);
                setExtendOpen(true);
              }}
              sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
            >
              Raccourcir sejour
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Block sx={{ fontSize: 14 }} />}
              fullWidth
              onClick={() => {
                setBlockDays(1);
                setBlockReason('Preparation logement');
                setBlockOpen(true);
              }}
              sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
            >
              Bloquer logement apres depart
            </Button>
          </Box>
        </Box>
      )}

      {isReservation && <Divider />}

      {/* Tags & markers */}
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
          Marqueurs
          {(isVip || hasAttention) && (
            <Box component="span" sx={{ ml: 1 }}>
              {isVip && <Chip label="VIP" size="small" sx={{ fontSize: '0.5625rem', height: 18, bgcolor: '#FFB800', color: '#fff', mr: 0.5 }} />}
              {hasAttention && <Chip label="ATTENTION" size="small" sx={{ fontSize: '0.5625rem', height: 18, bgcolor: '#EF4444', color: '#fff' }} />}
            </Box>
          )}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Button
            size="small"
            variant={isVip ? 'contained' : 'outlined'}
            startIcon={vipLoading ? <CircularProgress size={14} /> : <Star sx={{ fontSize: 14, color: isVip ? '#fff' : '#FFB800' }} />}
            fullWidth
            disabled={vipLoading || !reservation}
            onClick={handleToggleVip}
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              justifyContent: 'flex-start',
              ...(isVip && { bgcolor: '#FFB800', '&:hover': { bgcolor: '#E5A600' } }),
            }}
          >
            {isVip ? 'Retirer VIP' : 'Marquer VIP'}
          </Button>
          <Button
            size="small"
            variant={hasAttention ? 'contained' : 'outlined'}
            startIcon={attentionLoading ? <CircularProgress size={14} /> : <Warning sx={{ fontSize: 14, color: hasAttention ? '#fff' : '#EF4444' }} />}
            fullWidth
            disabled={attentionLoading || !reservation}
            onClick={handleToggleAttention}
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              justifyContent: 'flex-start',
              ...(hasAttention && { bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' } }),
            }}
          >
            {hasAttention ? 'Retirer attention' : 'Attention particuliere'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Label sx={{ fontSize: 14 }} />}
            fullWidth
            disabled={!reservation}
            onClick={() => {
              setTagValue('');
              setTagDialogOpen(true);
            }}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Ajouter tag personnalise
          </Button>
        </Box>
      </Box>

      <Divider />

      {/* Coordination */}
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
          Coordination interne
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Send sx={{ fontSize: 14 }} />}
            fullWidth
            disabled={!reservation}
            onClick={() => {
              setMessageRecipient('');
              setMessageText('');
              setMessageOpen(true);
            }}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Envoyer message equipe
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<TaskAlt sx={{ fontSize: 14 }} />}
            fullWidth
            disabled={!reservation}
            onClick={() => {
              setTaskTitle('');
              setTaskAssignee('');
              setTaskDueDate(reservation?.checkOut || today);
              setTaskOpen(true);
            }}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Creer tache interne
          </Button>
        </Box>
      </Box>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Duplicate Dialog */}
      <Dialog open={duplicateOpen} onClose={() => setDuplicateOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ContentCopy sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Dupliquer reservation</Typography>
          </Box>
          <IconButton size="small" onClick={() => setDuplicateOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {reservation && (
            <Alert severity="info" sx={{ fontSize: '0.75rem', mb: 2, '& .MuiAlert-message': { py: 0.25 } }}>
              Copie de la reservation de <strong>{reservation.guestName}</strong> ({reservation.guestCount} pers.) dans <strong>{reservation.propertyName}</strong>
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              type="date" label="Nouveau check-in" value={dupCheckIn}
              onChange={(e) => { setDupCheckIn(e.target.value); if (e.target.value > dupCheckOut) setDupCheckOut(e.target.value); }}
              size="small" fullWidth InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              type="date" label="Nouveau check-out" value={dupCheckOut}
              onChange={(e) => setDupCheckOut(e.target.value)}
              size="small" fullWidth InputLabelProps={{ shrink: true }}
              inputProps={{ min: dupCheckIn }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>
          {dupError && <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1.5 }}>{dupError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setDuplicateOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleDuplicate} variant="contained" size="small" disabled={!dupCheckIn || !dupCheckOut || dupCheckIn >= dupCheckOut || dupLoading}
            startIcon={dupLoading ? <CircularProgress size={14} /> : <ContentCopy sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Dupliquer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Extend / Shorten Dialog */}
      <Dialog open={extendOpen} onClose={() => setExtendOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {extendMode === 'extend'
              ? <AddCircleOutline sx={{ fontSize: 20, color: 'success.main' }} />
              : <RemoveCircleOutline sx={{ fontSize: 20, color: 'warning.main' }} />
            }
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              {extendMode === 'extend' ? 'Prolonger le sejour' : 'Raccourcir le sejour'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setExtendOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {reservation && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Check-out actuel : <strong>{reservation.checkOut}</strong>
              {' → '}
              Nouveau : <strong>{addDays(reservation.checkOut, extendMode === 'extend' ? extendDays : -extendDays)}</strong>
            </Typography>
          )}
          <TextField
            type="number"
            label={`Nombre de jours a ${extendMode === 'extend' ? 'ajouter' : 'retirer'}`}
            value={extendDays}
            onChange={(e) => setExtendDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
            size="small" fullWidth
            inputProps={{ min: 1, max: 30 }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />
          {extendError && <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1.5 }}>{extendError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setExtendOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleExtend} variant="contained" size="small" disabled={extendLoading}
            color={extendMode === 'extend' ? 'primary' : 'warning'}
            startIcon={extendLoading ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Block Property Dialog */}
      <Dialog open={blockOpen} onClose={() => setBlockOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Block sx={{ fontSize: 20, color: 'error.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Bloquer le logement</Typography>
          </Box>
          <IconButton size="small" onClick={() => setBlockOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {reservation && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Bloquer <strong>{reservation.propertyName}</strong> apres le depart du <strong>{reservation.checkOut}</strong>
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              type="number" label="Nombre de jours de blocage" value={blockDays}
              onChange={(e) => setBlockDays(Math.max(1, Math.min(14, parseInt(e.target.value) || 1)))}
              size="small" fullWidth inputProps={{ min: 1, max: 14 }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              label="Raison du blocage" value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              size="small" fullWidth
              placeholder="Preparation, travaux, desinfection..."
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setBlockOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleBlock} variant="contained" color="error" size="small" disabled={blockLoading}
            startIcon={blockLoading ? <CircularProgress size={14} /> : <Block sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Bloquer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custom Tag Dialog */}
      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Label sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Tag personnalise</Typography>
          </Box>
          <IconButton size="small" onClick={() => setTagDialogOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <TextField
            label="Nom du tag" value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            size="small" fullWidth
            placeholder="Ex: EARLY-CHECKIN, LATE-CHECKOUT, GROUPE..."
            helperText={tagValue ? `Sera affiche comme : [${tagValue.toUpperCase()}]` : ''}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setTagDialogOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleAddTag} variant="contained" size="small" disabled={!tagValue.trim() || tagLoading}
            startIcon={tagLoading ? <CircularProgress size={14} /> : <Label sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={messageOpen} onClose={() => setMessageOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Send sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Message a l'equipe</Typography>
          </Box>
          <IconButton size="small" onClick={() => setMessageOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select label="Destinataire" value={messageRecipient}
              onChange={(e) => setMessageRecipient(e.target.value)}
              size="small" fullWidth required
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            >
              <MenuItem value="__all__">Toute l'equipe</MenuItem>
              {TEAM_MEMBERS.map((name) => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Message" value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              size="small" fullWidth multiline rows={3} required
              placeholder="Instructions, informations importantes..."
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setMessageOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleSendMessage} variant="contained" size="small"
            disabled={!messageRecipient || !messageText.trim() || messageLoading}
            startIcon={messageLoading ? <CircularProgress size={14} /> : <Send sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Internal Task Dialog */}
      <Dialog open={taskOpen} onClose={() => setTaskOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TaskAlt sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Tache interne</Typography>
          </Box>
          <IconButton size="small" onClick={() => setTaskOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Titre de la tache" value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              size="small" fullWidth required
              placeholder="Ex: Verifier chaudiere, Reparer volet..."
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              select label="Assigner a" value={taskAssignee}
              onChange={(e) => setTaskAssignee(e.target.value)}
              size="small" fullWidth required
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            >
              {TEAM_MEMBERS.map((name) => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="date" label="Date limite" value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              size="small" fullWidth InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setTaskOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleCreateTask} variant="contained" size="small"
            disabled={!taskTitle.trim() || !taskAssignee || taskLoading}
            startIcon={taskLoading ? <CircularProgress size={14} /> : <TaskAlt sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Creer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ fontSize: '0.8125rem' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PanelActions;
