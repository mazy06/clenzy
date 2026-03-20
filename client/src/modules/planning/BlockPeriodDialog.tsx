import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Lock, Build } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import { planningKeys } from './hooks/usePlanningData';
import type { PlanningProperty } from './types';

interface BlockPeriodDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: number | null;
  startDate: string | null;
  endDate: string | null;
  properties: PlanningProperty[];
}

type BlockType = 'BLOCKED' | 'MAINTENANCE';

const BlockPeriodDialog: React.FC<BlockPeriodDialogProps> = ({
  open,
  onClose,
  propertyId: initialPropertyId,
  startDate: initialStart,
  endDate: initialEnd,
  properties,
}) => {
  const queryClient = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>(initialPropertyId ?? '');
  const [from, setFrom] = useState(initialStart ?? '');
  const [to, setTo] = useState(initialEnd ?? '');
  const [blockType, setBlockType] = useState<BlockType>('BLOCKED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      setSelectedPropertyId(initialPropertyId ?? '');
      setFrom(initialStart ?? '');
      setTo(initialEnd ?? '');
      setBlockType('BLOCKED');
      setNotes('');
      setError(null);
    }
  }, [open, initialPropertyId, initialStart, initialEnd]);

  const handleSubmit = async () => {
    if (!selectedPropertyId || !from || !to) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (from >= to) {
      setError('La date de fin doit etre apres la date de debut.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const label = blockType === 'MAINTENANCE'
        ? `Maintenance${notes ? ' : ' + notes : ''}`
        : notes || undefined;

      await calendarPricingApi.blockDates(
        selectedPropertyId as number,
        from,
        to,
        label,
      );

      // Rafraichir les donnees du planning
      queryClient.invalidateQueries({ queryKey: planningKeys.all });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du blocage';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const nights = from && to && to > from
    ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
    : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {blockType === 'MAINTENANCE' ? (
          <Build fontSize="small" color="warning" />
        ) : (
          <Lock fontSize="small" />
        )}
        Bloquer une periode
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Logement */}
          <FormControl fullWidth size="small">
            <InputLabel>Logement *</InputLabel>
            <Select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value as number)}
              label="Logement *"
            >
              {properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Type de blocage */}
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={blockType}
              onChange={(e) => setBlockType(e.target.value as BlockType)}
              label="Type"
            >
              <MenuItem value="BLOCKED">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Lock fontSize="small" sx={{ color: '#616161' }} />
                  Bloque (indisponible)
                </Box>
              </MenuItem>
              <MenuItem value="MAINTENANCE">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Build fontSize="small" sx={{ color: '#e65100' }} />
                  Maintenance / Travaux
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          {/* Dates */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Date debut *"
              type="date"
              size="small"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Date fin *"
              type="date"
              size="small"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>

          {nights > 0 && (
            <Typography variant="body2" color="text.secondary">
              {nights} nuit{nights > 1 ? 's' : ''} bloquee{nights > 1 ? 's' : ''}
            </Typography>
          )}

          {/* Notes */}
          <TextField
            label="Raison (optionnel)"
            size="small"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Sejour proprietaire, travaux plomberie..."
            multiline
            rows={2}
            fullWidth
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving || !selectedPropertyId || !from || !to}
          startIcon={saving ? <CircularProgress size={16} /> : <Lock />}
        >
          {saving ? 'Blocage...' : 'Bloquer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BlockPeriodDialog;
