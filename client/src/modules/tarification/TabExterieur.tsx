import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  Switch,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Yard, Add, Delete } from '../../icons';
import type { PricingConfig, ServicePriceConfig, CommissionConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import CommissionSection from './CommissionSection';

interface TabExterieurProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabExterieur({ config, canEdit, onUpdate, currencySymbol }: TabExterieurProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  const items = useMemo(() => config.exterieurConfig || [], [config.exterieurConfig]);

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
    <div className="pt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-success"><Yard size={20} strokeWidth={1.75} /></span>
        <h6 className="text-sm font-semibold">
          {t('tarification.exterieur.title')}
        </h6>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('tarification.exterieur.subtitle')}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tarification.exterieur.prestation')}</TableHead>
              <TableHead className="text-center">{t('tarification.exterieur.enabled')}</TableHead>
              <TableHead className="text-end">{t('tarification.exterieur.basePrice')}</TableHead>
              {canEdit && <TableHead className="text-center w-[48px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.interventionType}>
                <TableCell>
                  {t(`tarification.exterieur.types.${item.interventionType}`, item.interventionType)}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    aria-label={t(`tarification.exterieur.types.${item.interventionType}`, item.interventionType)}
                    checked={item.enabled}
                    onCheckedChange={(checked) => updateItem(index, { enabled: checked })}
                    size="sm"
                    disabled={!canEdit}
                  />
                </TableCell>
                <TableCell className="text-end w-[140px]">
                  {/* Pas de libelle visible dans la cellule : l'en-tete de
                      colonne le porte, le champ reprend le nom de la ligne en
                      aria-label. */}
                  <InputGroup className="w-[120px]">
                    <InputGroupInput
                      id={`exterieur-price-${item.interventionType}`}
                      aria-label={t(`tarification.exterieur.types.${item.interventionType}`, item.interventionType)}
                      type="number"
                      step={1}
                      min={0}
                      className="text-end tabular-nums"
                      value={item.basePrice}
                      onChange={(e) => {
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num)) updateItem(index, { basePrice: num });
                      }}
                      disabled={!canEdit || !item.enabled}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('tarification.delete', 'Supprimer')}
                      onClick={() => removeItem(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive-soft"
                    >
                      <Delete size={16} strokeWidth={1.75} />
                    </Button>
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
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Add />
            {t('tarification.addPrestation')}
          </Button>
        </div>
      )}

      {/* ─── Add dialog ──────────────────────────────────────────────── */}
      {/* maxWidth="xs" + fullWidth MUI = pleine largeur plafonnee a 444 px. */}
      <Dialog open={addDialogOpen} onOpenChange={(next) => { if (!next) setAddDialogOpen(false); }}>
        <DialogContent className="w-full sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('tarification.addPrestation')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="exterieur-new-name">{t('tarification.newItem.name')}</FieldLabel>
              <Input
                id="exterieur-new-name"
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="exterieur-new-price">{t('tarification.newItem.price')}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="exterieur-new-price"
                  type="number"
                  className="tabular-nums"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>{t('tarification.cancel')}</Button>
            <Button variant="default" onClick={handleAdd} disabled={!newItemName.trim()}>
              {t('tarification.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
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
