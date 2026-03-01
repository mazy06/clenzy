import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material';
import { Close, Home, CalendarMonth } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QuickCreateData } from './types';
import type { CreateReservationData, ReservationSource } from '../../services/api';
import { reservationsApi } from '../../services/api';
import { planningKeys } from './hooks/usePlanningData';

interface PlanningQuickCreateDialogProps {
  open: boolean;
  data: QuickCreateData | null;
  onClose: () => void;
}

const SOURCE_OPTIONS: { value: ReservationSource; label: string }[] = [
  { value: 'direct', label: 'Direct' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking', label: 'Booking.com' },
  { value: 'other', label: 'Autre' },
];

const PlanningQuickCreateDialog: React.FC<PlanningQuickCreateDialogProps> = ({
  open,
  data,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [source, setSource] = useState<ReservationSource>('direct');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (createData: CreateReservationData) => reservationsApi.create(createData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.all });
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la creation');
    },
  });

  const handleClose = () => {
    setGuestName('');
    setGuestCount(2);
    setSource('direct');
    setTotalPrice('');
    setNotes('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!data || !guestName.trim()) {
      setError('Le nom du voyageur est requis');
      return;
    }

    createMutation.mutate({
      propertyId: data.propertyId,
      guestName: guestName.trim(),
      guestCount,
      checkIn: data.startDate,
      checkOut: data.endDate,
      totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
      notes: notes || undefined,
    });
  };

  if (!data) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxWidth: 480,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
          Nouvelle reservation
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Pre-filled info */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Home sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
              {data.propertyName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarMonth sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              {data.startDate} → {data.endDate}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nom du voyageur"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            fullWidth
            size="small"
            required
            autoFocus
            error={!!error && !guestName.trim()}
            helperText={error && !guestName.trim() ? error : undefined}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Voyageurs"
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
              size="small"
              inputProps={{ min: 1, max: 20 }}
              sx={{ width: 120 }}
            />

            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Source</InputLabel>
              <Select
                value={source}
                label="Source"
                onChange={(e) => setSource(e.target.value as ReservationSource)}
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Prix total (EUR)"
            type="number"
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ min: 0, step: 0.01 }}
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
          />
        </Box>

        {error && guestName.trim() && (
          <Typography color="error" variant="caption" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          sx={{ textTransform: 'none' }}
        >
          {createMutation.isPending ? 'Creation...' : 'Creer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlanningQuickCreateDialog;
