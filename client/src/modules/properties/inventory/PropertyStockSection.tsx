import React, { useEffect, useState } from 'react';
import { PROPERTY_ART } from '../propertyArtwork';
import { TriangleAlert } from 'lucide-react';
import StatusIcon from '../../../components/StatusIcon';
import { Alert, AlertDescription, Button, Card, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui';
import { Add, DeleteOutline, Edit } from '../../../icons';
import { useQueryClient } from '@tanstack/react-query';
import { StockItemEditor } from '../../stock/StockItemEditor';
import { StockThumbnail } from '../../stock/StockThumbnail';
import { resolveStockCatalog } from '../../stock/stockCatalog';
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

const CATEGORY_KEYS: Record<PropertyStockItem['category'], string> = {
  LINEN: 'properties.stock.categories.linen',
  TOILETRIES: 'properties.stock.categories.toiletries',
  CLEANING: 'properties.stock.categories.cleaning',
  CONSUMABLES: 'properties.stock.categories.consumables',
};

const EMPTY_FORM: PropertyStockItemRequest = {
  id: null,
  name: '',
  catalogKey: null,
  photoUrl: null,
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
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PropertyStockItem[] | null>(null);
  const [form, setForm] = useState<PropertyStockItemRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [restockingId, setRestockingId] = useState<number | null>(null);

  const reload = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['consumables'] });
    setError(null);
    propertyStockApi.list(propertyId).then(setItems).catch(() => setError(t('properties.stock.library.loadError')));
  }, [propertyId, t, queryClient]);

  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await propertyStockApi.save(propertyId, { ...form, name: form.name.trim() });
      void queryClient.invalidateQueries({ queryKey: ['stock-visual'] });
      setForm(null);
      reload();
    } catch {
      setError(t('properties.stock.library.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const restock = async (id: number) => {
    setRestockingId(id);
    try {
      await propertyStockApi.restock(propertyId, id);
      reload();
    } catch {
      setError(t('properties.stock.library.saveError'));
    } finally {
      setRestockingId(null);
    }
  };

  const remove = async (id: number) => {
    try {
      await propertyStockApi.remove(propertyId, id);
      void queryClient.invalidateQueries({ queryKey: ['stock-visual'] });
      reload();
    } catch { setError(t('properties.stock.library.saveError')); }
  };

  if (items === null && !error && !form) {
    return (
      <div className="flex justify-center py-9">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <Card className="pdt-surface gap-4 p-5 shadow-none">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src={PROPERTY_ART.stock} alt="" width={48} height={48} className="object-contain" />
          <h3 className="m-0 text-[13.5px] font-semibold">
            {t('properties.stock.title', 'Stock consommable')}
          </h3>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setError(null); setForm(EMPTY_FORM); }}>
            <Add size={15} />
            {t('properties.stock.add', 'Ajouter')}
          </Button>
        )}
      </div>

      {error && !form && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription>
        <Button size="sm" variant="outline" onClick={reload}>{t('common.retry', 'Réessayer')}</Button>
      </Alert>}
      {items?.length === 0 ? (
        <p className="m-0 py-4 text-xs text-muted-foreground">
          {t('properties.stock.empty',
            "Aucun article suivi. Le niveau descend automatiquement à chaque ménage ; sous le seuil, l'agent Opérations propose la commande fournisseur.")}
        </p>
      ) : (
        <Table className="pdt-stock-table">
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
            {(items ?? []).map((item) => {
              const low = item.reorderThreshold > 0 && item.quantity <= item.reorderThreshold;
              const reference = resolveStockCatalog(item.catalogKey, item.name);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="baitly-stock-item-name">
                      <StockThumbnail {...item} size={48} />
                      <div><span className="font-medium">{item.name}</span>
                        <small>{t(reference ? `properties.stock.library.families.${reference.family}` : CATEGORY_KEYS[item.category])}</small>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="tabular-nums">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                      {low && (
                        <StatusIcon tone="warning" icon={TriangleAlert}
                          label={t('properties.stock.low', 'Stock bas')} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums" data-label={t('properties.stock.threshold', 'Seuil')}>{item.reorderThreshold}</TableCell>
                  <TableCell className="tabular-nums" data-label={t('properties.stock.perStay', 'Conso / ménage')}>{item.consumptionPerStay}</TableCell>
                  <TableCell data-label={t('properties.stock.supplier', 'Fournisseur')}>{item.supplierName ?? '—'}</TableCell>
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
                        onClick={() => { setError(null); setForm({ ...item }); }}
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

      {form && <StockItemEditor value={form} onChange={setForm} saving={saving} error={error}
        onSave={save} onClose={() => { setForm(null); setError(null); }} />}
    </Card>
  );
}
