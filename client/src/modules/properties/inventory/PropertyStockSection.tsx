import React, { useEffect, useState } from 'react';
import { Button, Card, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldLabel, Input, NativeSelect, NativeSelectOption, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui';
import { Add, DeleteOutline, Edit, Inventory2 } from '../../../icons';
import StatusChip from '../../../components/StatusChip';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  propertyStockApi,
  type PropertyStockItem,
  type PropertyStockItemRequest,
} from '../../../services/api/propertyStockApi';

interface Props {
  propertyId: number;
  canEdit: boolean;
}

const CATEGORY_LABELS: Record<PropertyStockItem['category'], string> = {
  LINEN: 'Linge',
  TOILETRIES: 'Accueil / toilette',
  CLEANING: 'Produits ménage',
  CONSUMABLES: 'Consommables',
};

const EMPTY_FORM: PropertyStockItemRequest = {
  id: null,
  name: '',
  category: 'LINEN',
  unit: null,
  quantity: 0,
  reorderThreshold: 0,
  reorderQuantity: 0,
  consumptionPerStay: 0,
  supplierName: null,
  supplierEmail: null,
};

/**
 * Fiche logement > Inventaire > Stock consommable (M5). Le niveau saisi ici
 * descend TOUT SEUL à chaque ménage complété (consommation par ménage) ; sous
 * le seuil, l'agent Opérations lève la carte « Commander » (si un fournisseur
 * est renseigné) et « Réassort reçu » ré-incrémente à la livraison.
 */
export default function PropertyStockSection({ propertyId, canEdit }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PropertyStockItem[] | null>(null);
  const [form, setForm] = useState<PropertyStockItemRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [restockingId, setRestockingId] = useState<number | null>(null);

  const reload = React.useCallback(() => {
    propertyStockApi.list(propertyId).then(setItems).catch(() => setItems([]));
  }, [propertyId]);

  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      await propertyStockApi.save(propertyId, form);
      setForm(null);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const restock = async (id: number) => {
    setRestockingId(id);
    try {
      await propertyStockApi.restock(propertyId, id);
      reload();
    } finally {
      setRestockingId(null);
    }
  };

  const remove = async (id: number) => {
    await propertyStockApi.remove(propertyId, id);
    reload();
  };

  const setField = <K extends keyof PropertyStockItemRequest>(key: K, value: PropertyStockItemRequest[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  if (items === null) {
    return (
      <div className="flex justify-center py-9">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inventory2 size={18} strokeWidth={1.75} className="text-muted-foreground" />
          <h3 className="m-0 text-[13.5px] font-semibold">
            {t('properties.stock.title', 'Stock consommable')}
          </h3>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setForm(EMPTY_FORM)}>
            <Add size={15} />
            {t('properties.stock.add', 'Ajouter')}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="m-0 py-4 text-xs text-muted-foreground">
          {t('properties.stock.empty',
            "Aucun article suivi. Le niveau descend automatiquement à chaque ménage ; sous le seuil, l'agent Opérations propose la commande fournisseur.")}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('properties.stock.name', 'Article')}</TableHead>
              <TableHead>{t('properties.stock.quantity', 'En stock')}</TableHead>
              <TableHead>{t('properties.stock.threshold', 'Seuil')}</TableHead>
              <TableHead>{t('properties.stock.perStay', 'Conso / ménage')}</TableHead>
              <TableHead>{t('properties.stock.supplier', 'Fournisseur')}</TableHead>
              {canEdit && <TableHead aria-label="actions" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const low = item.quantity <= item.reorderThreshold;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    <span className="block text-2xs text-muted-foreground">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="tabular-nums">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                      {low && (
                        <StatusChip tone="warn" size="sm"
                          label={t('properties.stock.low', 'Stock bas')} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{item.reorderThreshold}</TableCell>
                  <TableCell className="tabular-nums">{item.consumptionPerStay}</TableCell>
                  <TableCell>{item.supplierName ?? '—'}</TableCell>
                  {canEdit && (
                    <TableCell className="text-end whitespace-nowrap">
                      {low && (
                        <Button
                          variant="outline" size="xs"
                          disabled={restockingId != null}
                          onClick={() => restock(item.id)}
                          title={t('properties.stock.restockHint',
                            'Ré-incrémente le stock de la quantité de réappro (livraison reçue)')}
                        >
                          {restockingId === item.id ? <Spinner className="size-[13px]" /> : null}
                          {t('properties.stock.restock', 'Réassort reçu')}
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon-sm"
                        aria-label={t('common.edit', 'Modifier')}
                        onClick={() => setForm({ ...item })}
                      >
                        <Edit size={15} />
                      </Button>
                      <Button
                        variant="ghost" size="icon-sm"
                        aria-label={t('common.delete', 'Supprimer')}
                        onClick={() => remove(item.id)}
                      >
                        <DeleteOutline size={15} />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {form && (
        <Dialog open onOpenChange={(next) => { if (!next && !saving) setForm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {form.id == null
                  ? t('properties.stock.addTitle', 'Ajouter un article')
                  : t('properties.stock.editTitle', "Modifier l'article")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="stock-name">{t('properties.stock.name', 'Article')}</FieldLabel>
                  <Input
                    id="stock-name"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder={t('properties.stock.nameHint', 'Draps housse 160, gel douche…')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-category">{t('properties.stock.category', 'Catégorie')}</FieldLabel>
                  <NativeSelect
                    id="stock-category"
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value as PropertyStockItem['category'])}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel htmlFor="stock-quantity">{t('properties.stock.quantity', 'En stock')}</FieldLabel>
                  <Input
                    id="stock-quantity"
                    type="number" min={0}
                    className="tabular-nums"
                    value={form.quantity}
                    onChange={(e) => setField('quantity', Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-unit">{t('properties.stock.unit', 'Unité')}</FieldLabel>
                  <Input
                    id="stock-unit"
                    value={form.unit ?? ''}
                    onChange={(e) => setField('unit', e.target.value || null)}
                    placeholder={t('properties.stock.unitHint', 'pièces, flacons…')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-per-stay">{t('properties.stock.perStay', 'Conso / ménage')}</FieldLabel>
                  <Input
                    id="stock-per-stay"
                    type="number" min={0}
                    className="tabular-nums"
                    value={form.consumptionPerStay}
                    onChange={(e) => setField('consumptionPerStay', Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="stock-threshold">{t('properties.stock.threshold', 'Seuil de commande')}</FieldLabel>
                  <Input
                    id="stock-threshold"
                    type="number" min={0}
                    className="tabular-nums"
                    value={form.reorderThreshold}
                    onChange={(e) => setField('reorderThreshold', Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-reorder-qty">{t('properties.stock.reorderQty', 'Quantité de réappro')}</FieldLabel>
                  <Input
                    id="stock-reorder-qty"
                    type="number" min={0}
                    className="tabular-nums"
                    value={form.reorderQuantity}
                    onChange={(e) => setField('reorderQuantity', Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="stock-supplier-name">{t('properties.stock.supplierName', 'Fournisseur')}</FieldLabel>
                  <Input
                    id="stock-supplier-name"
                    value={form.supplierName ?? ''}
                    onChange={(e) => setField('supplierName', e.target.value || null)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="stock-supplier-email">{t('properties.stock.supplierEmail', 'Email fournisseur')}</FieldLabel>
                  <Input
                    id="stock-supplier-email"
                    type="email"
                    value={form.supplierEmail ?? ''}
                    onChange={(e) => setField('supplierEmail', e.target.value || null)}
                  />
                </Field>
              </div>
              <p className="m-0 text-2xs text-muted-foreground">
                {t('properties.stock.supplierHint',
                  'Sans email fournisseur, la constellation signale le stock bas en information ; avec, elle propose le bon de commande en un clic.')}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => setForm(null)}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button disabled={saving || !form.name.trim()} onClick={save}>
                {saving ? <Spinner className="size-[13px]" /> : null}
                {t('common.save', 'Enregistrer')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
