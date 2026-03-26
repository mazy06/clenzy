import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, FormControlLabel, Switch, Box,
} from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BookingServiceItem, CreateItemPayload } from '../../../services/api/bookingServiceOptionsApi';

interface ItemDialogProps {
  open: boolean;
  item?: BookingServiceItem;
  onClose: () => void;
  onSave: (data: CreateItemPayload) => void;
}

const PRICING_MODES = [
  { value: 'PER_BOOKING', labelKey: 'serviceOptions.pricingMode.perBooking' },
  { value: 'PER_PERSON', labelKey: 'serviceOptions.pricingMode.perPerson' },
  { value: 'PER_NIGHT', labelKey: 'serviceOptions.pricingMode.perNight' },
] as const;

const INPUT_TYPES = [
  { value: 'CHECKBOX', labelKey: 'serviceOptions.inputType.checkbox' },
  { value: 'QUANTITY', labelKey: 'serviceOptions.inputType.quantity' },
] as const;

const ItemDialog: React.FC<ItemDialogProps> = ({ open, item, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [pricingMode, setPricingMode] = useState<'PER_BOOKING' | 'PER_PERSON' | 'PER_NIGHT'>('PER_BOOKING');
  const [inputType, setInputType] = useState<'QUANTITY' | 'CHECKBOX'>('CHECKBOX');
  const [maxQuantity, setMaxQuantity] = useState<number | null>(null);
  const [mandatory, setMandatory] = useState(false);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '');
      setDescription(item?.description ?? '');
      setPrice(item?.price ?? 0);
      setPricingMode(item?.pricingMode ?? 'PER_BOOKING');
      setInputType(item?.inputType ?? 'CHECKBOX');
      setMaxQuantity(item?.maxQuantity ?? null);
      setMandatory(item?.mandatory ?? false);
    }
  }, [open, item]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      price,
      pricingMode,
      inputType,
      maxQuantity: inputType === 'QUANTITY' ? maxQuantity : null,
      mandatory,
      active: item?.active ?? true,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
        {item ? t('serviceOptions.editItem') : t('serviceOptions.addItem')}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          autoFocus fullWidth size="small"
          label={t('common.name')}
          value={name} onChange={(e) => setName(e.target.value)}
        />
        <TextField
          fullWidth size="small" multiline minRows={2} maxRows={4}
          label={t('common.description')}
          value={description} onChange={(e) => setDescription(e.target.value)}
        />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField
            fullWidth size="small" type="number"
            label={t('serviceOptions.fields.price')}
            value={price}
            onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth size="small" select
            label={t('serviceOptions.fields.pricingMode')}
            value={pricingMode}
            onChange={(e) => setPricingMode(e.target.value as typeof pricingMode)}
          >
            {PRICING_MODES.map(m => (
              <MenuItem key={m.value} value={m.value}>{t(m.labelKey)}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField
            fullWidth size="small" select
            label={t('serviceOptions.fields.inputType')}
            value={inputType}
            onChange={(e) => setInputType(e.target.value as typeof inputType)}
          >
            {INPUT_TYPES.map(it => (
              <MenuItem key={it.value} value={it.value}>{t(it.labelKey)}</MenuItem>
            ))}
          </TextField>
          {inputType === 'QUANTITY' && (
            <TextField
              fullWidth size="small" type="number"
              label={t('serviceOptions.fields.maxQuantity')}
              value={maxQuantity ?? ''}
              onChange={(e) => setMaxQuantity(e.target.value ? parseInt(e.target.value) : null)}
              inputProps={{ min: 1 }}
            />
          )}
        </Box>
        <FormControlLabel
          control={<Switch checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} size="small" />}
          label={t('serviceOptions.fields.mandatory')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">{t('common.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained" size="small" disabled={!name.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ItemDialog.displayName = 'ItemDialog';

export default ItemDialog;
