import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Close, Add } from '@mui/icons-material';

interface CreateInterventionDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: number;
  propertyName: string;
  /** Pre-fill type for "Planifier maintenance" shortcut */
  defaultType?: 'cleaning' | 'maintenance';
  /** Link to a reservation (for reservation-specific interventions) */
  linkedReservationId?: number;
  /** Pre-fill dates (e.g. checkout date for post-checkout cleaning) */
  defaultStartDate?: string;
  defaultEndDate?: string;
  onConfirm: (data: {
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
}

const STAFF_OPTIONS = [
  'Fatou Diallo',
  'Carmen Lopez',
  'Nathalie Blanc',
  'Amina Keita',
  'Lucie Moreau',
  'Marc Dupuis',
  'Jean-Pierre Martin',
  'Thomas Bernard',
];

const CreateInterventionDialog: React.FC<CreateInterventionDialogProps> = ({
  open,
  onClose,
  propertyId,
  propertyName,
  defaultType = 'maintenance',
  linkedReservationId,
  defaultStartDate,
  defaultEndDate,
  onConfirm,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [type, setType] = useState<'cleaning' | 'maintenance'>(defaultType);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate || today);
  const [endDate, setEndDate] = useState(defaultEndDate || today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [duration, setDuration] = useState(3);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setType(defaultType);
    setTitle('');
    setAssignee('');
    setStartDate(defaultStartDate || today);
    setEndDate(defaultEndDate || today);
    setStartTime('09:00');
    setEndTime('12:00');
    setDuration(3);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleConfirm = async () => {
    if (!title.trim()) {
      setError('Le titre est obligatoire');
      return;
    }
    if (!assignee) {
      setError("L'assignation est obligatoire");
      return;
    }
    if (startDate > endDate) {
      setError('La date de fin doit etre apres la date de debut');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await onConfirm({
      propertyId,
      propertyName,
      type,
      title: title.trim(),
      assigneeName: assignee,
      startDate,
      endDate,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      estimatedDurationHours: duration,
      notes: notes.trim() || undefined,
      linkedReservationId,
    });

    setLoading(false);
    if (result.success) {
      handleClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Add sx={{ fontSize: 22, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Nouvelle intervention
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
        {/* Property info */}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
          Logement : <strong>{propertyName}</strong>
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Type */}
          <TextField
            select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as 'cleaning' | 'maintenance')}
            size="small"
            fullWidth
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          >
            <MenuItem value="cleaning">Menage</MenuItem>
            <MenuItem value="maintenance">Maintenance</MenuItem>
          </TextField>

          {/* Title */}
          <TextField
            label="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            fullWidth
            required
            placeholder={type === 'cleaning' ? 'Menage complet...' : 'Reparation...'}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />

          {/* Assignee */}
          <TextField
            select
            label="Assigne a"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            size="small"
            fullWidth
            required
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          >
            {STAFF_OPTIONS.map((name) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </TextField>

          {/* Dates */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              type="date"
              label="Date debut"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              type="date"
              label="Date fin"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: startDate }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>

          {/* Times */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              type="time"
              label="Heure debut"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              type="time"
              label="Heure fin"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>

          {/* Duration */}
          <TextField
            type="number"
            label="Duree estimee (heures)"
            value={duration}
            onChange={(e) => setDuration(Math.max(0.5, Number(e.target.value)))}
            size="small"
            fullWidth
            inputProps={{ min: 0.5, step: 0.5 }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Instructions, details..."
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
        <Button onClick={handleClose} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          size="small"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} /> : <Add sx={{ fontSize: 16 }} />}
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}
        >
          Creer l'intervention
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateInterventionDialog;
