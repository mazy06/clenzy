import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Chip,
} from '@mui/material';
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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><LocalLaundryService size={22} strokeWidth={1.75} /></Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Linge de maison</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Articles de linge a preparer apres chaque sejour
            </Typography>
          </Box>
        </Box>
        {canEdit && (
          <Button
            size="small"
            startIcon={<Add size={18} strokeWidth={1.75} />}
            onClick={openAdd}
            variant="outlined"
            disabled={availableCatalog.length === 0}
          >
            Ajouter
          </Button>
        )}
      </Box>

      {items.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}><LocalLaundryService size={40} strokeWidth={1.5} /></Box>
          <Typography color="text.secondary">Aucun article de linge configure</Typography>
          {catalog.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              Configurez d'abord le catalogue blanchisserie dans Configuration tarifaire
            </Typography>
          )}
          {canEdit && catalog.length > 0 && (
            <Button size="small" startIcon={<Add size={18} strokeWidth={1.75} />} onClick={openAdd} sx={{ mt: 1 }}>
              Ajouter un article
            </Button>
          )}
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Article</TableCell>
                  <TableCell align="center">Qte / sejour</TableCell>
                  <TableCell align="right">Prix unitaire</TableCell>
                  <TableCell align="right">Sous-total</TableCell>
                  {canEdit && <TableCell align="right" sx={{ width: 50 }} />}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const unitPrice = priceByKey[item.itemKey] ?? 0;
                  const subtotal = unitPrice * item.quantityPerStay;
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.label}</TableCell>
                      <TableCell align="center">
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
                      <TableCell align="right">
                        {unitPrice > 0 ? `${unitPrice.toFixed(2)} \u20AC` : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {subtotal > 0 ? `${subtotal.toFixed(2)} \u20AC` : '—'}
                      </TableCell>
                      {canEdit && (
                        <TableCell align="right">
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
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>
                    Total par sejour
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {totalPerStay.toFixed(2)} {'\u20AC'}
                  </TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
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
          <Button onClick={() => setDialogOpen(false)} startIcon={<Close size={18} strokeWidth={1.75} />}>Annuler</Button>
          <Button onClick={handleAdd} variant="contained" startIcon={<Save size={18} strokeWidth={1.75} />} disabled={!selectedKey}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
