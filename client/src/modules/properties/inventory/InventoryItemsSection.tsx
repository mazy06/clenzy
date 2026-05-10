import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  InputAdornment,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
} from '@mui/material';
import {
  Add,
  Edit,
  DeleteOutline,
  Inventory2,
  Save,
  Close,
  Restaurant,
  Weekend,
  Hotel,
  Bathtub,
  Yard,
  Computer,
  LocalLaundryService,
  DoorFront,
  Kitchen,
  MoreHoriz,
  Label,
  Category,
  StickyNote2,
  Remove,
  Numbers,
} from '@mui/icons-material';
import type { PropertyInventoryItem } from '../../../services/api/propertyInventoryApi';

// ─── Categories with icons ──────────────────────────────────────────────────

interface InventoryCategory {
  value: string;
  label: string;
  icon: React.ReactElement;
  color: string; // chip color for the table & selector
}

const CATEGORIES: InventoryCategory[] = [
  { value: 'Cuisine',       label: 'Cuisine',       icon: <Restaurant fontSize="small" />,           color: '#f59e0b' },
  { value: 'Salon',         label: 'Salon',         icon: <Weekend fontSize="small" />,              color: '#8b5cf6' },
  { value: 'Chambre',       label: 'Chambre',       icon: <Hotel fontSize="small" />,                color: '#3b82f6' },
  { value: 'Salle de bain', label: 'Salle de bain', icon: <Bathtub fontSize="small" />,              color: '#06b6d4' },
  { value: 'Exterieur',     label: 'Exterieur',     icon: <Yard fontSize="small" />,                 color: '#10b981' },
  { value: 'Bureau',        label: 'Bureau',        icon: <Computer fontSize="small" />,             color: '#6366f1' },
  { value: 'Buanderie',     label: 'Buanderie',     icon: <LocalLaundryService fontSize="small" />,  color: '#0ea5e9' },
  { value: 'Entree',        label: 'Entree',        icon: <DoorFront fontSize="small" />,            color: '#a16207' },
  { value: 'Rangement',     label: 'Rangement',     icon: <Kitchen fontSize="small" />,              color: '#64748b' },
  { value: 'Autre',         label: 'Autre',         icon: <MoreHoriz fontSize="small" />,            color: '#94a3b8' },
];

const CATEGORY_BY_VALUE = CATEGORIES.reduce<Record<string, InventoryCategory>>((acc, c) => {
  acc[c.value] = c;
  return acc;
}, {});

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
    setForm({
      name: item.name,
      category: item.category ?? '',
      quantity: item.quantity,
      notes: item.notes ?? '',
    });
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

  const incrementQty = (delta: number) => {
    setForm((f) => ({ ...f, quantity: Math.max(1, f.quantity + delta) }));
  };

  const renderCategoryChip = (categoryValue: string) => {
    const cat = CATEGORY_BY_VALUE[categoryValue];
    if (!cat) {
      return <Chip label={categoryValue} size="small" variant="outlined" />;
    }
    return (
      <Chip
        icon={React.cloneElement(cat.icon, { sx: { fontSize: 14, color: `${cat.color} !important` } })}
        label={cat.label}
        size="small"
        variant="outlined"
        sx={{
          borderColor: cat.color,
          color: cat.color,
          fontWeight: 500,
          '& .MuiChip-icon': { ml: 0.5 },
        }}
      />
    );
  };

  // Sort items so the same categories appear together
  const orderedItems = useMemo(() => {
    const order = CATEGORIES.map((c) => c.value);
    return [...items].sort((a, b) => {
      const ai = order.indexOf(a.category ?? '');
      const bi = order.indexOf(b.category ?? '');
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [items]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Inventory2 sx={{ color: 'primary.main', fontSize: 22 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Inventaire du logement
            </Typography>
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
              {orderedItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.category && renderCategoryChip(item.category)}</TableCell>
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
                        <IconButton size="small" color="error" onClick={() => onDelete(item.id)}>
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

      {/* ─── Add / Edit dialog ──────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            py: 1.75,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <Inventory2 sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600} lineHeight={1.2}>
              {editingId ? "Modifier l'objet" : 'Ajouter un objet'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Renseigne les infos de l'equipement ou du mobilier
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: '20px !important', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* ── Designation ────────────────────────────────────────────── */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 600,
                color: 'text.secondary',
                mb: 0.75,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.6875rem',
              }}
            >
              <Label sx={{ fontSize: 14 }} />
              Designation
            </Typography>
            <TextField
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
              size="small"
              autoFocus
              placeholder="Ex : Canape 3 places, Lave-linge Bosch, Aspirateur Dyson..."
            />
          </Box>

          {/* ── Categorie (visual selector) ────────────────────────────── */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 600,
                color: 'text.secondary',
                mb: 0.75,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.6875rem',
              }}
            >
              <Category sx={{ fontSize: 14 }} />
              Categorie
            </Typography>
            <ToggleButtonGroup
              value={form.category}
              exclusive
              onChange={(_, v) => setForm({ ...form, category: v ?? '' })}
              size="small"
              sx={{
                flexWrap: 'wrap',
                gap: 0.75,
                '& .MuiToggleButtonGroup-grouped': {
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '8px !important',
                  textTransform: 'none',
                  px: 1.25,
                  py: 0.5,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                },
              }}
            >
              {CATEGORIES.map((cat) => {
                const selected = form.category === cat.value;
                return (
                  <ToggleButton
                    key={cat.value}
                    value={cat.value}
                    sx={{
                      gap: 0.5,
                      color: selected ? 'common.white' : cat.color,
                      bgcolor: selected ? cat.color : 'transparent',
                      borderColor: selected ? `${cat.color} !important` : 'divider',
                      '&:hover': {
                        bgcolor: selected ? cat.color : `${cat.color}15`,
                      },
                      '&.Mui-selected': {
                        bgcolor: cat.color,
                        color: 'common.white',
                        '&:hover': { bgcolor: cat.color, opacity: 0.9 },
                      },
                    }}
                  >
                    {React.cloneElement(cat.icon, {
                      sx: { fontSize: 16, color: selected ? 'common.white' : cat.color },
                    })}
                    {cat.label}
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
          </Box>

          {/* ── Quantite (stepper) ─────────────────────────────────────── */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 600,
                color: 'text.secondary',
                mb: 0.75,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.6875rem',
              }}
            >
              <Numbers sx={{ fontSize: 14 }} />
              Quantite
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton
                onClick={() => incrementQty(-1)}
                size="small"
                disabled={form.quantity <= 1}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  width: 32,
                  height: 32,
                }}
              >
                <Remove sx={{ fontSize: 16 }} />
              </IconButton>
              <TextField
                type="number"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })
                }
                size="small"
                inputProps={{
                  min: 1,
                  style: { textAlign: 'center', fontWeight: 600, width: 50 },
                }}
                sx={{ width: 80 }}
              />
              <IconButton
                onClick={() => incrementQty(1)}
                size="small"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  width: 32,
                  height: 32,
                }}
              >
                <Add sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          </Box>

          {/* ── Notes ──────────────────────────────────────────────────── */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 600,
                color: 'text.secondary',
                mb: 0.75,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontSize: '0.6875rem',
              }}
            >
              <StickyNote2 sx={{ fontSize: 14 }} />
              Notes <Box component="span" sx={{ fontWeight: 400, ml: 0.5 }}>(optionnel)</Box>
            </Typography>
            <TextField
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              multiline
              rows={2}
              size="small"
              fullWidth
              placeholder="Marque, modele, etat, emplacement precis..."
            />
          </Box>
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            startIcon={<Close />}
            sx={{ textTransform: 'none' }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<Save />}
            disabled={!form.name.trim()}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {editingId ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
