import React, { useCallback, useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '../../components/ui';
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
        <span className="inline-flex text-warning"><Build size={20} strokeWidth={1.75} /></span>
        <h6 className="text-sm font-semibold">
          {title ?? t('tarification.travaux.title')}
        </h6>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
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
                    className="py-[4.5px] bg-field"
                  >
                    <p className="text-2xs font-semibold uppercase tracking-wide text-faint">
                      {domain}
                    </p>
                  </TableCell>
                </TableRow>
                {entries.map(({ item, index }) => (
                  <TableRow key={item.interventionType}>
                    <TableCell>{labelOf(item)}</TableCell>
                    <TableCell className="text-center">
                      {/* Pas de libelle visible : l'en-tete de colonne le porte,
                          l'interrupteur reprend le nom de la ligne en aria-label. */}
                      <Switch
                        aria-label={labelOf(item)}
                        checked={item.enabled}
                        onCheckedChange={(checked) => updateItem(index, { enabled: checked })}
                        disabled={!canEdit}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="text-end w-[140px]">
                      {/* Pas de libelle visible dans la cellule : l'en-tete de
                          colonne le porte, le champ reprend le nom de la ligne
                          en aria-label. */}
                      <InputGroup className="w-[120px]">
                        <InputGroupInput
                          id={`travaux-price-${item.interventionType}`}
                          aria-label={labelOf(item)}
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
                          aria-label={t('tarification.travaux.remove', 'Supprimer') + ' — ' + labelOf(item)}
                          onClick={() => removeItem(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive-soft"
                        >
                          <Delete size={16} strokeWidth={1.75} />
                        </Button>
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
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Add />
            {t('tarification.addPrestation')}
          </Button>
        </div>
      )}

      {/* ─── Add dialog ──────────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={(next) => { if (!next) setAddDialogOpen(false); }}>
        <DialogContent aria-describedby={undefined} className="max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('tarification.addPrestation')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <Field>
              <FieldLabel htmlFor="travaux-new-name">{t('tarification.newItem.name')}</FieldLabel>
              <Input
                id="travaux-new-name"
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="travaux-new-domain">
                {t('tarification.newItem.domain', 'Domaine')}
              </FieldLabel>
              <Input
                id="travaux-new-domain"
                placeholder={t('tarification.travaux.otherDomain', 'Autre')}
                value={newItemDomain}
                onChange={(e) => setNewItemDomain(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="travaux-new-price">{t('tarification.newItem.price')}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="travaux-new-price"
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
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{t('tarification.cancel')}</Button>
            <Button onClick={handleAdd} disabled={!newItemName.trim()}>
              {t('tarification.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
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
