import React, { useState, useMemo } from 'react';
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
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Add, DeleteOutline, LocalLaundryService, Save, Close } from '../../../icons';
import type { PropertyLaundryItem, BlanchisserieCatalogItem } from '../../../services/api/propertyInventoryApi';

interface Props {
  items: PropertyLaundryItem[];
  catalog: BlanchisserieCatalogItem[];
  canEdit: boolean;
  onAdd: (data: Partial<PropertyLaundryItem>) => Promise<unknown>;
  onUpdate: (data: Partial<PropertyLaundryItem> & { id: number }) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}

export default function LaundryItemsSection({ items, catalog, canEdit, onAdd, onUpdate, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [quantity, setQuantity] = useState(1);

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
    if (!catalogItem) return;
    await onAdd({ itemKey: selectedKey, label: catalogItem.label, quantityPerStay: quantity });
    setDialogOpen(false);
  };

  const handleQuantityChange = async (item: PropertyLaundryItem, newQty: number) => {
    if (newQty < 1 || newQty === item.quantityPerStay) return;
    await onUpdate({ id: item.id, quantityPerStay: newQty });
  };

  // Compute total cost per stay
  const totalPerStay = items.reduce((sum, item) => {
    const price = priceByKey[item.itemKey] ?? 0;
    return sum + price * item.quantityPerStay;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex text-info"><LocalLaundryService size={22} strokeWidth={1.75} /></span>
          <div>
            <h6 className="text-sm font-semibold tracking-tight">Linge de maison</h6>
            <p className="text-xs text-muted-foreground">
              Articles de linge a preparer apres chaque sejour
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={openAdd}
            disabled={availableCatalog.length === 0}
          >
            <Add size={18} strokeWidth={1.75} />
            Ajouter
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<LocalLaundryService />}
          title="Aucun article de linge configure"
          description={catalog.length === 0
            ? "Configurez d'abord le catalogue blanchisserie dans Configuration tarifaire"
            : undefined}
          action={canEdit && catalog.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={openAdd}>
              <Add size={18} strokeWidth={1.75} />
              Ajouter un article
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
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
                      <TableCell>{item.label}</TableCell>
                      <TableCell className="text-center">
                        {canEdit ? (
                          // Pas de Field ici : le champ n'a jamais eu de libelle visible,
                          // l'en-tete de colonne le porte. aria-label nomme la ligne.
                          <Input
                            id={`laundry-qty-${item.id}`}
                            aria-label={`Qte par sejour — ${item.label}`}
                            className="w-[70px] text-center"
                            type="number"
                            min={1}
                            value={item.quantityPerStay}
                            onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 1)}
                          />
                        ) : (
                          item.quantityPerStay
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        {unitPrice > 0 ? `${unitPrice.toFixed(2)} \u20AC` : '—'}
                      </TableCell>
                      <TableCell className="text-end font-medium">
                        {subtotal > 0 ? `${subtotal.toFixed(2)} \u20AC` : '—'}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-end">
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
                                  onClick={() => onDelete(item.id)}
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
                <TableRow>
                  <TableCell colSpan={3} className="text-end font-bold">
                    Total par sejour
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
      <Dialog open={dialogOpen} onOpenChange={(next) => { if (!next) setDialogOpen(false); }}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ajouter un article de linge</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
          {/* Aucun libelle visible a l'origine : l'aria-label porte le sens. */}
          <NativeSelect
            className="w-full"
            aria-label="Article de linge"
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            <NativeSelectOption value="" disabled>— Choisir un article —</NativeSelectOption>
            {availableCatalog.map((c) => (
              <NativeSelectOption key={c.key} value={c.key}>
                {c.label} ({c.price.toFixed(2)} {'\u20AC'})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Field className="w-[160px]">
            <FieldLabel htmlFor="laundry-add-quantity">Quantite par sejour</FieldLabel>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <Close size={18} strokeWidth={1.75} />
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={!selectedKey}>
              <Save size={18} strokeWidth={1.75} />
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
