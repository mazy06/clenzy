import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { NightsStay } from '../../icons';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MinNightsEditDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (minNights: number) => Promise<void>;
  selectedDates: string[];
  loading: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return dates[0];
  const sorted = [...dates].sort();
  return `${sorted[0]} → ${sorted[sorted.length - 1]}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const MinNightsEditDialog: React.FC<MinNightsEditDialogProps> = ({
  open,
  onClose,
  onApply,
  selectedDates,
  loading,
}) => {
  const [minNights, setMinNights] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleApply = async () => {
    const n = parseInt(minNights, 10);
    if (Number.isNaN(n) || n < 1 || n > 365) {
      setError('Valeur entre 1 et 365');
      return;
    }
    setError('');
    await onApply(n);
    setMinNights('');
    onClose();
  };

  const handleClose = () => {
    setMinNights('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <NightsStay size={18} strokeWidth={1.75} />
        Définir le minimum de nuits
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {formatDateRange(selectedDates)}
            {selectedDates.length > 1 && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({selectedDates.length} dates)
              </Typography>
            )}
          </Typography>

          <TextField
            label="Minimum de nuits"
            type="number"
            value={minNights}
            onChange={(e) => setMinNights(e.target.value)}
            error={!!error}
            helperText={error || 'Surcharge le défaut de la propriété pour ces dates'}
            fullWidth
            autoFocus
            inputProps={{ min: 1, max: 365, step: 1 }}
          />

          <Typography variant="caption" color="text.secondary">
            Les réservations dont la date d'arrivée tombe sur l'une de ces dates devront
            respecter ce minimum. Le défaut de la propriété est remplacé uniquement sur
            les dates sélectionnées.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={loading || !minNights}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Appliquer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MinNightsEditDialog;
