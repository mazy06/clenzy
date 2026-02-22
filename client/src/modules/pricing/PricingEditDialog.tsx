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
import { useTranslation } from '../../hooks/useTranslation';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingEditDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (price: number) => Promise<void>;
  selectedDates: string[];
  loading: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return dates[0];

  const sorted = [...dates].sort();
  return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PricingEditDialog: React.FC<PricingEditDialogProps> = ({
  open,
  onClose,
  onApply,
  selectedDates,
  loading,
}) => {
  const { t } = useTranslation();
  const [price, setPrice] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleApply = async () => {
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError(t('common.error'));
      return;
    }
    setError('');
    await onApply(numericPrice);
    setPrice('');
    onClose();
  };

  const handleClose = () => {
    setPrice('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('dynamicPricing.calendar.editPrice')}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {formatDateRange(selectedDates)}
            {selectedDates.length > 1 && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({selectedDates.length} {t('common.date')}s)
              </Typography>
            )}
          </Typography>

          <TextField
            label={t('dynamicPricing.calendar.pricePerNight')}
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={!!error}
            helperText={error}
            fullWidth
            autoFocus
            InputProps={{
              endAdornment: <Typography color="text.secondary">EUR</Typography>,
            }}
            inputProps={{ min: 0, step: 1 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={loading || !price}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {t('dynamicPricing.calendar.applyRange')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PricingEditDialog;
