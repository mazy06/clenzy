import React, { useCallback, useMemo, useState } from 'react';
import { TextField, InputAdornment, Switch, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Build, Add, Delete } from '../../icons';
import type { ServicePriceConfig, CommissionConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import CommissionSection from './CommissionSection';

interface TabTravauxProps {
  /** Liste éditée (catalogue org OU surcouche technicien). */
  items: ServicePriceConfig[];
  canEdit: boolean;
  onItemsChange: (items: ServicePriceConfig[]) => void;
  currencySymbol: string;
  /** Commission org (admin uniquement). Absente en mode technicien. */
  commission?: CommissionConfig;
  onCommissionChange?: (c: CommissionConfig) => void;
  /** Titre/sous-titre optionnels (mode technicien : « Mes prestations »). */
  title?: string;
  subtitle?: string;
}

export default function TabTravaux({ items, canEdit, onItemsChange, currencySymbol, commission, onCommissionChange, title, subtitle }: TabTravauxProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [newItemDomain, setNewItemDomain] = useState('');

  // Libellé affiché : porté par la donnée, repli i18n puis clé brute.
  const labelOf = useCallback(
    (item: ServicePriceConfig) => item.label || t(`tarification.travaux.types.${item.interventionType}`, item.interventionType),
    [t],
  );

  // Groupement par domaine (en conservant l'index d'origine pour l'édition).
  const grouped = useMemo(() => {
    const map = new Map<string, { item: ServicePriceConfig; index: number }[]>();
    items.forEach((item, index) => {
      const domain = item.domain || t('tarification.travaux.otherDomain', 'Autre');
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push({ item, index });
    });
    return Array.from(map.entries());
  }, [items, t]);

  const updateItem = useCallback((index: number, partial: Partial<ServicePriceConfig>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...partial };
    onItemsChange(updated);
  }, [items, onItemsChange]);

  const removeItem = useCallback((index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  }, [items, onItemsChange]);

  const handleAdd = useCallback(() => {
    if (!newItemName.trim()) return;
    const key = newItemName.trim().toUpperCase().replace(/\s+/g, '_');
    const newItem: ServicePriceConfig = {
      interventionType: key,
      basePrice: newItemPrice,
      enabled: true,
      label: newItemName.trim(),
      domain: newItemDomain.trim() || undefined,
    };
    onItemsChange([...items, newItem]);
    setNewItemName('');
    setNewItemPrice(0);
    setNewItemDomain('');
    setAddDialogOpen(false);
  }, [newItemName, newItemPrice, newItemDomain, items, onItemsChange]);

  return (
    <div className="pt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-[var(--bui-warning-ink)]"><Build size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {title ?? t('tarification.travaux.title')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {subtitle ?? t('tarification.travaux.subtitle')}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tarification.travaux.prestation')}</TableHead>
              <TableHead className="text-center">{t('tarification.travaux.enabled')}</TableHead>
              <TableHead className="text-end">{t('tarification.travaux.basePrice')}</TableHead>
              {canEdit && <TableHead className="text-center w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map(([domain, entries]) => (
              <React.Fragment key={domain}>
                {/* En-tête de domaine */}
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 4 : 3}
                    className="py-[4.5px] bg-[var(--field)]"
                  >
                    <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
                      {domain}
                    </p>
                  </TableCell>
                </TableRow>
                {entries.map(({ item, index }) => (
                  <TableRow key={item.interventionType}>
                    <TableCell>{labelOf(item)}</TableCell>
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
                        value={item.basePrice}
                        onChange={(e) => {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) updateItem(index, { basePrice: num });
                        }}
                        disabled={!canEdit || !item.enabled}
                        inputProps={{ step: 1, min: 0, style: { textAlign: 'right' } }}
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
              </React.Fragment>
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
            {t('tarification.addPrestation')}
          </Button>
        </div>
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
            label={t('tarification.newItem.domain', 'Domaine')}
            value={newItemDomain}
            onChange={(e) => setNewItemDomain(e.target.value)}
            size="small"
            fullWidth
            placeholder={t('tarification.travaux.otherDomain', 'Autre')}
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
          <Button onClick={handleAdd} variant="contained" disabled={!newItemName.trim()}>
            {t('tarification.add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Commission (admin uniquement) ───────────────────────────── */}
      {commission && onCommissionChange && (
        <CommissionSection
          commission={commission}
          canEdit={canEdit}
          onChange={onCommissionChange}
        />
      )}
    </div>
  );
}
