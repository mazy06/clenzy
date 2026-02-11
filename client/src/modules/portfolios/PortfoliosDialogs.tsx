import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import type { PortfolioClient, Manager } from './usePortfoliosPage';

// ─── ReassignmentDialog ──────────────────────────────────────────────────────

interface ReassignmentDialogProps {
  open: boolean;
  onClose: () => void;
  client: PortfolioClient | null;
  onReassign: (clientId: number, newManagerId: number, notes: string) => void;
  managers: Manager[];
  loading: boolean;
}

export const ReassignmentDialog: React.FC<ReassignmentDialogProps> = ({
  open,
  onClose,
  client,
  onReassign,
  managers,
  loading,
}) => {
  const { t } = useTranslation();
  const [selectedManagerId, setSelectedManagerId] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (selectedManagerId && client) {
      onReassign(client.id, selectedManagerId, notes);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('portfolios.fields.reassignClient')} {client?.firstName} {client?.lastName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('portfolios.fields.newManager')}</InputLabel>
            <Select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(Number(e.target.value))}
              label="Nouveau Manager"
            >
              {managers.map((manager) => (
                <MenuItem key={manager.id} value={manager.id}>
                  {manager.firstName} {manager.lastName} - {manager.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Notes (optionnel)"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajoutez des notes sur cette réassignation..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedManagerId || loading}
        >
          {loading ? 'Réassignation...' : 'Réassigner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
