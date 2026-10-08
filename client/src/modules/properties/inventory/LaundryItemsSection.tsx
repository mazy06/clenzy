import React, { useState, useMemo } from 'react';
import { InventoryThumbnail } from './InventoryThumbnail';
import EmptyState from '../../../components/EmptyState';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Button } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Add, DeleteOutline, Save, Close } from '../../../icons';
import type { PropertyLaundryItem, BlanchisserieCatalogItem } from '../../../services/api/propertyInventoryApi';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
  items: PropertyLaundryItem[];
  catalog: BlanchisserieCatalogItem[];
  canEdit: boolean;
  onAdd: (data: Partial<PropertyLaundryItem>) => Promise<unknown>;
  onUpdate: (data: Partial<PropertyLaundryItem> & { id: number }) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}

export default function LaundryItemsSection({ items, catalog, canEdit, onAdd, onUpdate, onDelete }: Props) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a map of catalog prices by key
  const priceByKey = useMemo(() => {
    const map: Record<string, number> = {};
    catalog.forEach((c) => { map[c.key] = c.price; });
    return map;
  }, [catalog]);

  // Filter out items already added
  const existingKeys = useMemo(() => new Set(items.map((i) => i.itemKey)), [items]);
  const availableCatalog = useMemo(
    () => catalog.filter((c) => !existingKeys.has(c.key)),
    [catalog, existingKeys],
  );

  const openAdd = () => {
    setSelectedKey('');
    setQuantity(1);
    setDialogOpen(true);
  };

  const handleAdd = async () => {
    const catalogItem = catalog.find((c) => c.key === selectedKey);
    if (!catalogItem || busy) return;
    setBusy(true); setError(null);
    try {
      await onAdd({ itemKey: selectedKey, label: catalogItem.label, quantityPerStay: quantity });
      setDialogOpen(false);
    } catch { setError(t('common.error')); }
    finally { setBusy(false); }
  };

  const handleQuantityChange = async (item: PropertyLaundryItem, newQty: number) => {
    if (!Number.isInteger(newQty) || newQty < 1 || busy) return false;
    if (newQty === item.quantityPerStay) return true;
    setBusy(true); setError(null);
    try { await onUpdate({ id: item.id, quantityPerStay: newQty }); return true; }
    catch { setError(t('common.error')); return false; }
    finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await onDelete(id); }
    catch { setError(t('common.error')); }
    finally { setBusy(false); }
  };

  // Compute total cost per stay
  const totalPerStay = items.reduce((sum, item) => {
    const price = priceByKey[item.itemKey] ?? 0;
    return sum + price * item.quantityPerStay;
  }, 0);

  return (
    <div className="pdt-surface p-5">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-1.5">
          <InventoryThumbnail name={t('properties.laundry.title')} catalogKey="bath-towel" size={48} />
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{t('properties.laundry.title')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('properties.laundry.subtitle')}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={openAdd}
            disabled={busy || availableCatalog.length === 0}
          >
            <Add size={18} strokeWidth={1.75} />
            {t('properties.stock.add', 'Ajouter')}
          </Button>
        )}
      </div>
      {error && !dialogOpen && <FieldError>{error}</FieldError>}

      {items.length === 0 ? (
        <EmptyState
          icon={<InventoryThumbnail name={t('properties.laundry.title')} catalogKey="bath-towel" size={64} />}
          title={t('properties.laundry.empty')}
          description={catalog.length === 0
            ? t('properties.laundry.emptyNoCatalog')
            : undefined}
          action={canEdit && catalog.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={openAdd}>
              <Add size={18} strokeWidth={1.75} />
              {t('properties.laundry.addItem')}
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          <div className="pdt-laundry-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-center">Qte / sejour</TableHead>
                  <TableHead className="text-end">Prix unitaire</TableHead>
                  <TableHead className="text-end">Sous-total</TableHead>
                  {canEdit && <TableHead className="text-end w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const unitPrice = priceByKey[item.itemKey] ?? 0;
                  const subtotal = unitPrice * item.quantityPerStay;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="pdt-laundry-name"><span className="flex items-center gap-2"><InventoryThumbnail name={item.label} catalogKey={item.itemKey} size={40} /><span>{item.label}</span></span></TableCell>
                      <TableCell className="text-center">
                        {canEdit ? (
                          // Pas de Field ici : le champ n'a jamais eu de libelle visible,
                          // l'en-tete de colonne le porte. aria-label nomme la ligne.
                          <Input
                            key={`${item.id}:${item.quantityPerStay}`}
                            id={`laundry-qty-${item.id}`}
                            aria-label={`Qte par sejour — ${item.label}`}
                            className="w-[70px] text-center"
                            type="number"
                            min={1}
                            defaultValue={item.quantityPerStay}
                            disabled={busy}
                            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                            onBlur={async (event) => {
                              const input = event.currentTarget;
                              if (!await handleQuantityChange(item, Number(input.value))) input.value = String(item.quantityPerStay);
                            }}
                          />
                        ) : (
                          item.quantityPerStay
                        )}
                      </TableCell>
                      <TableCell className="pdt-laundry-unit text-end">
                        {unitPrice > 0 ? `${unitPrice.toFixed(2)} \u20AC` : '—'}
                      </TableCell>
                      <TableCell className="pdt-laundry-subtotal text-end font-medium tabular-nums">
                        {subtotal > 0 ? `${subtotal.toFixed(2)} \u20AC` : '—'}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="pdt-laundry-delete text-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Le span porte la ref que Radix pose sur son
                                  enfant : Button est une fonction, il n'en
                                  transmet pas. */}
                              <span className="inline-flex">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={busy}
                                  onClick={() => void remove(item.id)}
                                  aria-label={`Supprimer ${item.label}`}
                                  className="text-destructive hover:bg-destructive-soft"
                                >
                                  <DeleteOutline size={16} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {/* Total row */}
                <TableRow className="pdt-laundry-total">
                  <TableCell colSpan={3} className="text-end font-bold">
                    {t('properties.laundry.totalPerStay')}
                  </TableCell>
                  <TableCell className="text-end font-bold text-[0.95rem]">
                    {totalPerStay.toFixed(2)} {'\u20AC'}
                  </TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Dialog Add */}
      <Dialog open={dialogOpen} onOpenChange={(next) => { if (!next && !busy) setDialogOpen(false); }}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('properties.laundry.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
          {/* Aucun libelle visible a l'origine : l'aria-label porte le sens. */}
          <NativeSelect
            className="w-full"
            aria-label={t('properties.laundry.itemLabel')}
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            <NativeSelectOption value="" disabled>{t('properties.laundry.chooseItem')}</NativeSelectOption>
            {availableCatalog.map((c) => (
              <NativeSelectOption key={c.key} value={c.key}>
                {c.label} ({c.price.toFixed(2)} {'\u20AC'})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Field className="w-[160px]">
            <FieldLabel htmlFor="laundry-add-quantity">{t('properties.laundry.quantityPerStay')}</FieldLabel>
            <Input
              id="laundry-add-quantity"
              className="w-full"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </Field>
          </div>
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDialogOpen(false)}>
              <Close size={18} strokeWidth={1.75} />
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={!selectedKey || busy}>
              <Save size={18} strokeWidth={1.75} />
              {t('properties.stock.add', 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
