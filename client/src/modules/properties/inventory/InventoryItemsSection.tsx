import React, { useState } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Chip,
} from '@mui/material';
import { Add, Edit, DeleteOutline, Inventory2, Save, Close } from '@mui/icons-material';
import type { PropertyInventoryItem } from '../../../services/api/propertyInventoryApi';

const DEFAULT_CATEGORIES = [
  'Cuisine', 'Salon', 'Chambre', 'Salle de bain', 'Exterieur',
  'Bureau', 'Buanderie', 'Entree', 'Rangement', 'Autre',
];

interface Props {
  items: PropertyInventoryItem[];
  canEdit: boolean;
  onAdd: (data: Partial<PropertyInventoryItem>) => Promise<unknown>;
  onUpdate: (data: Partial<PropertyInventoryItem> & { id: number }) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}

export default function InventoryItemsSection({ items, canEdit, onAdd, onUpdate, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', category: '', quantity: 1, notes: '' });

  const openAdd = () => {
    setForm({ name: '', category: '', quantity: 1, notes: '' });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (item: PropertyInventoryItem) => {
    setForm({ name: item.name, category: item.category ?? '', quantity: item.quantity, notes: item.notes ?? '' });
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await onUpdate({ id: editingId, ...form });
    } else {
      await onAdd(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: number) => {
    await onDelete(id);
  };

  // Group by category
  const grouped = items.reduce<Record<string, PropertyInventoryItem[]>>((acc, item) => {
    const cat = item.category || 'Non classe';
    (acc[cat] = acc[cat] || []).push(item);
    return acc;
  }, {});

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Inventory2 sx={{ color: 'primary.main', fontSize: 22 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Inventaire du logement</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Mobilier, electromenager et equipements presents dans la propriete
            </Typography>
          </Box>
        </Box>
        {canEdit && (
          <Button size="small" startIcon={<Add />} onClick={openAdd} variant="outlined">
            Ajouter
          </Button>
        )}
      </Box>

      {items.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Inventory2 sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">Aucun objet reference pour cette propriete</Typography>
          {canEdit && (
            <Button size="small" startIcon={<Add />} onClick={openAdd} sx={{ mt: 1 }}>
              Ajouter un objet
            </Button>
          )}
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Designation</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell align="center">Qte</TableCell>
                <TableCell>Notes</TableCell>
                {canEdit && <TableCell align="right" sx={{ width: 80 }} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.category && <Chip label={item.category} size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell align="center">{item.quantity}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    {item.notes || '—'}
                  </TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => openEdit(item)}>
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
                          <DeleteOutline sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog Add/Edit */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier l\'objet' : 'Ajouter un objet'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Designation"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            fullWidth
            size="small"
          />
          <Select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            displayEmpty
            size="small"
            fullWidth
          >
            <MenuItem value="">— Categorie —</MenuItem>
            {DEFAULT_CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
          <TextField
            label="Quantite"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            size="small"
            sx={{ width: 120 }}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="Notes (optionnel)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            multiline
            rows={2}
            size="small"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} startIcon={<Close />}>Annuler</Button>
          <Button onClick={handleSave} variant="contained" startIcon={<Save />} disabled={!form.name.trim()}>
            {editingId ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
