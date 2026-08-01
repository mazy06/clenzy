import React, { useCallback, useMemo, useState } from 'react';
import { TextField, InputAdornment, Switch, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { LocalLaundryService, Add, Delete } from '../../icons';
import type { PricingConfig, BlanchisserieItem, CommissionConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import CommissionSection from './CommissionSection';

interface TabBlanchisserieProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabBlanchisserie({ config, canEdit, onUpdate, currencySymbol }: TabBlanchisserieProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  const items = useMemo(() => config.blanchisserieConfig || [], [config.blanchisserieConfig]);

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
    <div className="pt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <LocalLaundryService size={20} strokeWidth={1.75} color='var(--accent)' />
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.blanchisserie.title')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('tarification.blanchisserie.subtitle')}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tarification.blanchisserie.article')}</TableHead>
              <TableHead className="text-center">{t('tarification.blanchisserie.enabled')}</TableHead>
              <TableHead className="text-end">{t('tarification.blanchisserie.price')}</TableHead>
              {canEdit && <TableHead className="text-center w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.key}>
                <TableCell>
                  {t(`tarification.blanchisserie.items.${item.key}`, item.label)}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={item.enabled}
                    onChange={(e) => updateItem(index, { enabled: e.target.checked })}
                    disabled={!canEdit}
                    size="small"
                  />
                </TableCell>
                <TableCell className="text-end w-[140px]">
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
                    InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
                    sx={{ width: 120 }}
                  />
                </TableCell>
                {canEdit && (
                  <TableCell className="text-center">
                    <IconButton size="small" onClick={() => removeItem(index)} color="error">
                      <Delete size={16} strokeWidth={1.75} />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ─── Add button ────────────────────────────────────────────────── */}
      {canEdit && (
        <div className="mt-2">
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            {t('tarification.addArticle')}
          </Button>
        </div>
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
            InputProps={{ endAdornment: <InputAdornment position="end"><CurrencySymbol code={currency} /></InputAdornment> }}
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
    </div>
  );
}
