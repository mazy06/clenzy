import React, { useState, useMemo } from 'react';
import { Card } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { IconButton, TextField, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip } from '@mui/material';
import { Button } from '../../../components/ui';
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
          <span className="inline-flex text-[var(--mui-info)]"><LocalLaundryService size={22} strokeWidth={1.75} /></span>
          <div>
            <h6 className="cn-text-subtitle1 font-semibold">Linge de maison</h6>
            <p className="cn-text-body2 text-muted-foreground text-[0.8rem]">
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
        <Card className="gap-0 py-0 p-6 text-center">
          <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><LocalLaundryService size={40} strokeWidth={1.5} /></span>
          <p className="cn-text-body1 text-muted-foreground">Aucun article de linge configure</p>
          {catalog.length === 0 && (
            <p className="cn-text-body2 text-muted-foreground opacity-60 mt-0.5">
              Configurez d'abord le catalogue blanchisserie dans Configuration tarifaire
            </p>
          )}
          {canEdit && catalog.length > 0 && (
            <Button size="sm" variant="ghost" onClick={openAdd} className="mt-1.5">
              <Add size={18} strokeWidth={1.75} />
              Ajouter un article
            </Button>
          )}
        </Card>
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
                          <TextField
                            type="number"
                            value={item.quantityPerStay}
                            onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 1)}
                            size="small"
                            sx={{ width: 70 }}
                            inputProps={{ min: 1, style: { textAlign: 'center' } }}
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
                          <Tooltip title="Supprimer">
                            <IconButton size="small" color="error" onClick={() => onDelete(item.id)}>
                              <DeleteOutline size={16} strokeWidth={1.75} />
                            </IconButton>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un article de linge</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            displayEmpty
            size="small"
            fullWidth
          >
            <MenuItem value="" disabled>— Choisir un article —</MenuItem>
            {availableCatalog.map((c) => (
              <MenuItem key={c.key} value={c.key}>
                {c.label} ({c.price.toFixed(2)} {'\u20AC'})
              </MenuItem>
            ))}
          </Select>
          <TextField
            label="Quantite par sejour"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            size="small"
            sx={{ width: 160 }}
            inputProps={{ min: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            <Close size={18} strokeWidth={1.75} />
            Annuler
          </Button>
          <Button onClick={handleAdd} disabled={!selectedKey}>
            <Save size={18} strokeWidth={1.75} />
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
