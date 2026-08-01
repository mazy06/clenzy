import React, { useCallback, useMemo, useState } from 'react';
import { Switch, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '../../components/ui';
import {
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../../components/ui';
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
                  {/* Pas de libelle visible : l'en-tete de colonne porte le sens,
                      l'aria-label nomme la ligne concernee pour le lecteur d'ecran. */}
                  <InputGroup className="w-[120px]">
                    <InputGroupInput
                      id={`laundry-price-${item.key}`}
                      aria-label={t(`tarification.blanchisserie.items.${item.key}`, item.label)}
                      type="number"
                      className="text-end"
                      value={item.price}
                      onChange={(e) => {
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) updateItem(index, { price: num });
                      }}
                      disabled={!canEdit || !item.enabled}
                      step={0.5}
                      min={0}
                    />
                    <InputGroupAddon align="inline-end">
                      <CurrencySymbol code={currency} />
                    </InputGroupAddon>
                  </InputGroup>
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
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Add />
            {t('tarification.addArticle')}
          </Button>
        </div>
      )}

      {/* ─── Add dialog ──────────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('tarification.addArticle')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Field>
            <FieldLabel htmlFor="laundry-new-label">{t('tarification.newItem.label')}</FieldLabel>
            <Input
              id="laundry-new-label"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="laundry-new-price">{t('tarification.newItem.price')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="laundry-new-price"
                type="number"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
              />
              <InputGroupAddon align="inline-end">
                <CurrencySymbol code={currency} />
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>{t('tarification.cancel')}</Button>
          <Button onClick={handleAdd} disabled={!newItemLabel.trim()}>
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
