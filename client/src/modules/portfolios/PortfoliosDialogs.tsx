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
  Typography,
  Avatar,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Close as CloseIcon,
  Person,
} from '@mui/icons-material';
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

  const handleClose = () => {
    setSelectedManagerId(0);
    setNotes('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <SwapHorizIcon color="primary" sx={{ fontSize: 22 }} />
          <Typography variant="h6" component="div" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            {t('portfolios.fields.reassignClient')}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        {/* Client info */}
        {client && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb: 2.5,
              p: 1.5,
              bgcolor: 'grey.50',
              borderRadius: 2,
            }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.78rem' }}>
              {client.firstName?.[0]}{client.lastName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {client.firstName} {client.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                {client.email}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Manager select */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel sx={{ fontSize: '0.85rem' }}>
            {t('portfolios.fields.newManager')}
          </InputLabel>
          <Select
            value={selectedManagerId}
            onChange={(e) => setSelectedManagerId(Number(e.target.value))}
            label={t('portfolios.fields.newManager')}
            sx={{ fontSize: '0.85rem' }}
          >
            {managers.map((manager) => (
              <MenuItem key={manager.id} value={manager.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: '0.85rem' }}>
                    {manager.firstName} {manager.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                    {manager.email}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Notes */}
        <TextField
          fullWidth
          size="small"
          label={t('portfolios.dialogs.notesOptional')}
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('portfolios.dialogs.notesPlaceholder')}
          InputProps={{ sx: { fontSize: '0.85rem' } }}
          InputLabelProps={{ sx: { fontSize: '0.85rem' } }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, justifyContent: 'flex-end' }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          size="small"
          disabled={loading}
          sx={{ minWidth: 90, fontSize: '0.82rem' }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={!selectedManagerId || loading}
          startIcon={loading ? <CircularProgress size={14} /> : <SwapHorizIcon sx={{ fontSize: 16 }} />}
          sx={{ minWidth: 120, fontSize: '0.82rem' }}
        >
          {loading ? t('portfolios.dialogs.reassigning') : t('portfolios.dialogs.reassign')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
