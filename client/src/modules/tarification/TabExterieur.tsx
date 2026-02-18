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
import { Yard, Add, Delete } from '@mui/icons-material';
import type { PricingConfig, ServicePriceConfig, CommissionConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import CommissionSection from './CommissionSection';

interface TabExterieurProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
}

export default function TabExterieur({ config, canEdit, onUpdate }: TabExterieurProps) {
  const { t } = useTranslation();

  const items = config.exterieurConfig || [];

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(0);

  const updateItem = useCallback((index: number, partial: Partial<ServicePriceConfig>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...partial };
    onUpdate({ exterieurConfig: updated });
  }, [items, onUpdate]);

  const removeItem = useCallback((index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onUpdate({ exterieurConfig: updated });
  }, [items, onUpdate]);

  const handleAdd = useCallback(() => {
    if (!newItemName.trim()) return;
    const key = newItemName.trim().toUpperCase().replace(/\s+/g, '_');
    const newItem: ServicePriceConfig = {
      interventionType: key,
      basePrice: newItemPrice,
      enabled: true,
    };
    onUpdate({ exterieurConfig: [...items, newItem] });
    setNewItemName('');
    setNewItemPrice(0);
    setAddDialogOpen(false);
  }, [newItemName, newItemPrice, items, onUpdate]);

  const commission = (config.commissionConfigs || []).find((c) => c.category === 'exterieur');

  const handleCommissionChange = useCallback((updated: CommissionConfig) => {
    const configs = [...(config.commissionConfigs || [])];
    const idx = configs.findIndex((c) => c.category === 'exterieur');
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
        <Yard sx={{ color: 'purple', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          {t('tarification.exterieur.title')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tarification.exterieur.subtitle')}
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('tarification.exterieur.prestation')}</TableCell>
              <TableCell align="center">{t('tarification.exterieur.enabled')}</TableCell>
              <TableCell align="right">{t('tarification.exterieur.basePrice')}</TableCell>
              {canEdit && <TableCell align="center" sx={{ width: 48 }} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.interventionType}>
                <TableCell>
                  {t(`tarification.exterieur.types.${item.interventionType}`, item.interventionType)}
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
                    value={item.basePrice}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num)) updateItem(index, { basePrice: num });
                    }}
                    disabled={!canEdit || !item.enabled}
                    inputProps={{ step: 1, min: 0, style: { textAlign: 'right' } }}
                    InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
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
            {t('tarification.addPrestation')}
          </Button>
        </Box>
      )}

      {/* ─── Add dialog ──────────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('tarification.addPrestation')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={t('tarification.newItem.name')}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
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
            InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{t('tarification.cancel')}</Button>
          <Button onClick={handleAdd} variant="contained" disabled={!newItemName.trim()}>
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
