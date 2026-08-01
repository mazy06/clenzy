import React, { useState } from 'react';
import { Spinner } from '../../components/ui';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Avatar, IconButton } from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Close as CloseIcon,
  Person,
} from '../../icons';
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
          borderRadius: '18px',
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
        <div className="flex items-center gap-1.5">
          <SwapHorizIcon color="primary" size={22} strokeWidth={1.75} />
          <div className="cn-text-h6 text-[1rem] font-semibold">
            {t('portfolios.fields.reassignClient')}
          </div>
        </div>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        {/* Client info */}
        {client && (
          <div className="flex items-center gap-2 mb-3.5 p-2 bg-[var(--field)] rounded-[2px]">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: '10px', fontSize: '0.78rem' }}>
              {client.firstName?.[0]}{client.lastName?.[0]}
            </Avatar>
            <div>
              <h6 className="cn-text-subtitle2 text-[0.85rem] font-semibold">
                {client.firstName} {client.lastName}
              </h6>
              <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                {client.email}
              </span>
            </div>
          </div>
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
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex text-muted-foreground"><Person size={16} strokeWidth={1.75} /></span>
                  <p className="cn-text-body1 text-[0.85rem]">
                    {manager.firstName} {manager.lastName}
                  </p>
                  <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                    {manager.email}
                  </span>
                </div>
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
          startIcon={loading ? <Spinner className="size-3.5" /> : <SwapHorizIcon size={16} strokeWidth={1.75} />}
          sx={{ minWidth: 120, fontSize: '0.82rem' }}
        >
          {loading ? t('portfolios.dialogs.reassigning') : t('portfolios.dialogs.reassign')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
