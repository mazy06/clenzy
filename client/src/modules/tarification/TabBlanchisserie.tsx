import React, { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { LocalLaundryService, Add, Delete } from '@mui/icons-material';
import type { PricingConfig, BlanchisserieItem, CommissionConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import CommissionSection from './CommissionSection';

interface TabBlanchisserieProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabBlanchisserie({ config, canEdit, onUpdate, currencySymbol }: TabBlanchisserieProps) {
  const { t } = useTranslation();

  const items = config.blanchisserieConfig || [];

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(0);

  const updateItem = useCallback((index: number, partial: Partial<BlanchisserieItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...partial };
    onUpdate({ blanchisserieConfig: updated });
  }, [items, onUpdate]);

  const removeItem = useCallback((index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onUpdate({ blanchisserieConfig: updated });
  }, [items, onUpdate]);

  const handleAdd = useCallback(() => {
    if (!newItemLabel.trim()) return;
    const key = newItemLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const newItem: BlanchisserieItem = {
      key,
      label: newItemLabel.trim(),
      price: newItemPrice,
      enabled: true,
    };
    onUpdate({ blanchisserieConfig: [...items, newItem] });
    setNewItemLabel('');
    setNewItemPrice(0);
    setAddDialogOpen(false);
  }, [newItemLabel, newItemPrice, items, onUpdate]);

  const commission = (config.commissionConfigs || []).find((c) => c.category === 'blanchisserie');

  const handleCommissionChange = useCallback((updated: CommissionConfig) => {
    const configs = [...(config.commissionConfigs || [])];
    const idx = configs.findIndex((c) => c.category === 'blanchisserie');
    if (idx >= 0) {
      configs[idx] = updated;
    } else {
      configs.push(updated);
    }
    onUpdate({ commissionConfigs: configs });
  }, [config.commissionConfigs, onUpdate]);

  return (
    <Box sx={{ pt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LocalLaundryService sx={{ color: '#6B8A9A', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          {t('tarification.blanchisserie.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tarification.blanchisserie.subtitle')}
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('tarification.blanchisserie.article')}</TableCell>
              <TableCell align="center">{t('tarification.blanchisserie.enabled')}</TableCell>
              <TableCell align="right">{t('tarification.blanchisserie.price')}</TableCell>
              {canEdit && <TableCell align="center" sx={{ width: 48 }} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.key}>
                <TableCell>
                  {t(`tarification.blanchisserie.items.${item.key}`, item.label)}
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={item.enabled}
                    onChange={(e) => updateItem(index, { enabled: e.target.checked })}
                    disabled={!canEdit}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right" sx={{ width: 140 }}>
                  <TextField
                    type="number"
                    size="small"
                    value={item.price}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num)) updateItem(index, { price: num });
                    }}
                    disabled={!canEdit || !item.enabled}
                    inputProps={{ step: 0.5, min: 0, style: { textAlign: 'right' } }}
                    InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
                    sx={{ width: 120 }}
                  />
                </TableCell>
                {canEdit && (
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => removeItem(index)} color="error">
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ─── Add button ────────────────────────────────────────────────── */}
      {canEdit && (
        <Box sx={{ mt: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            {t('tarification.addArticle')}
          </Button>
        </Box>
      )}

      {/* ─── Add dialog ──────────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('tarification.addArticle')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={t('tarification.newItem.label')}
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
          <TextField
            label={t('tarification.newItem.price')}
            type="number"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
            size="small"
            fullWidth
            InputProps={{ endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{t('tarification.cancel')}</Button>
          <Button onClick={handleAdd} variant="contained" disabled={!newItemLabel.trim()}>
            {t('tarification.add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Commission ──────────────────────────────────────────────── */}
      {commission && (
        <CommissionSection
          commission={commission}
          canEdit={canEdit}
          onChange={handleCommissionChange}
        />
      )}
    </Box>
  );
}
