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
  Tooltip,
  Chip,
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
  PhotoCamera,
  ImageIcon,
} from '../../../icons';
import type { PropertyInventoryItem } from '../../../services/api/propertyInventoryApi';

// ─── Image resize helper (max 800px, 80% JPEG quality) ──────────────────────

async function resizeImage(file: File, maxDim = 800, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read error'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('load error'));
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no ctx'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Categories with icons ──────────────────────────────────────────────────

interface InventoryCategory {
  value: string;
  label: string;
  icon: React.ReactElement;
  color: string;
}

const CATEGORIES: InventoryCategory[] = [
  { value: 'Cuisine',       label: 'Cuisine',       icon: <Restaurant size={16} strokeWidth={1.75} />,           color: '#f59e0b' },
  { value: 'Salon',         label: 'Salon',         icon: <Weekend size={16} strokeWidth={1.75} />,              color: '#8b5cf6' },
  { value: 'Chambre',       label: 'Chambre',       icon: <Hotel size={16} strokeWidth={1.75} />,                color: '#3b82f6' },
  { value: 'Salle de bain', label: 'Salle de bain', icon: <Bathtub size={16} strokeWidth={1.75} />,              color: '#06b6d4' },
  { value: 'Exterieur',     label: 'Exterieur',     icon: <Yard size={16} strokeWidth={1.75} />,                 color: '#10b981' },
  { value: 'Bureau',        label: 'Bureau',        icon: <Computer size={16} strokeWidth={1.75} />,             color: '#6366f1' },
  { value: 'Buanderie',     label: 'Buanderie',     icon: <LocalLaundryService size={16} strokeWidth={1.75} />,  color: '#0ea5e9' },
  { value: 'Entree',        label: 'Entree',        icon: <DoorFront size={16} strokeWidth={1.75} />,            color: '#a16207' },
  { value: 'Rangement',     label: 'Rangement',     icon: <Kitchen size={16} strokeWidth={1.75} />,              color: '#64748b' },
  { value: 'Autre',         label: 'Autre',         icon: <MoreHoriz size={16} strokeWidth={1.75} />,            color: '#94a3b8' },
];

const CATEGORY_BY_VALUE = CATEGORIES.reduce<Record<string, InventoryCategory>>((acc, c) => {
  acc[c.value] = c;
  return acc;
}, {});

const EMPTY_FORM: InventoryForm = { name: '', category: '', quantity: 1, notes: '', photoUrl: null };
interface InventoryForm {
  name: string;
  category: string;
  quantity: number;
  notes: string;
  photoUrl: string | null;
}

interface Props {
  items: PropertyInventoryItem[];
  canEdit: boolean;
  onAdd: (data: Partial<PropertyInventoryItem>) => Promise<unknown>;
  onUpdate: (data: Partial<PropertyInventoryItem> & { id: number }) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}

// ─── Field label helper ──────────────────────────────────────────────────────

const FieldLabel = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <Typography
    variant="caption"
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      fontWeight: 600,
      color: 'text.secondary',
      mb: 0.5,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      fontSize: '0.625rem',
    }}
  >
    {icon}
    {children}
  </Typography>
);

// ─── Inline form (used both for "add" at top and "edit" inline on a row) ─────

interface InlineFormProps {
  value: InventoryForm;
  onChange: (next: InventoryForm) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  submitting?: boolean;
}

// ─── Photo upload zone (used inside InlineForm) ─────────────────────────────

function PhotoUpload({ photoUrl, onChange }: { photoUrl: string | null; onChange: (url: string | null) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Format non supporté');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Fichier trop volumineux (>10 Mo)');
      return;
    }
    try {
      const dataUrl = await resizeImage(file, 800, 0.8);
      onChange(dataUrl);
    } catch {
      setError('Erreur de chargement');
    }
  };

  return (
    <Box>
      <FieldLabel icon={<PhotoCamera size={12} strokeWidth={1.75} />}>
        Photo
      </FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      {photoUrl ? (
        <Box
          sx={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: 1.5,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            backgroundImage: `url(${photoUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: 'pointer',
            transition: 'border-color 150ms',
            '&:hover': { borderColor: 'error.main' },
            '&:hover .photo-remove': { opacity: 1 },
          }}
          onClick={() => onChange(null)}
          title="Cliquer pour retirer la photo"
        >
          <Box
            className="photo-remove"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(239,68,68,0.7)',
              color: '#fff',
              opacity: 0,
              transition: 'opacity 150ms',
            }}
          >
            <Close size={20} strokeWidth={2} />
          </Box>
        </Box>
      ) : (
        <Box
          onClick={() => inputRef.current?.click()}
          sx={{
            width: 64,
            height: 64,
            borderRadius: 1.5,
            border: '1.5px dashed',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            cursor: 'pointer',
            color: 'text.disabled',
            transition: 'border-color 150ms, color 150ms, background-color 150ms',
            '&:hover': {
              borderColor: 'primary.main',
              color: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          <PhotoCamera size={20} strokeWidth={1.75} />
          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, lineHeight: 1 }}>
            Ajouter
          </Typography>
        </Box>
      )}
      {error && (
        <Typography sx={{ fontSize: '0.625rem', color: 'error.main', mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

function InlineForm({ value, onChange, onSubmit, onCancel, submitLabel, submitting }: InlineFormProps) {
  const incrementQty = (delta: number) =>
    onChange({ ...value, quantity: Math.max(1, value.quantity + delta) });

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        borderColor: 'divider',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : '#fafbfc'),
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '64px 1.5fr 2fr 0.9fr 1.6fr' }, gap: 2 }}>
        {/* Photo */}
        <PhotoUpload
          photoUrl={value.photoUrl}
          onChange={(url) => onChange({ ...value, photoUrl: url })}
        />

        {/* Designation */}
        <Box>
          <FieldLabel icon={<Label size={12} strokeWidth={1.75} />}>Designation</FieldLabel>
          <TextField
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            required
            fullWidth
            size="small"
            placeholder="Ex : Canape 3 places, Lave-linge Bosch..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.name.trim()) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </Box>

        {/* Categorie */}
        <Box sx={{ minWidth: 0 }}>
          <FieldLabel icon={<Category size={12} strokeWidth={1.75} />}>Categorie</FieldLabel>
          <ToggleButtonGroup
            value={value.category}
            exclusive
            onChange={(_, v) => onChange({ ...value, category: v ?? '' })}
            size="small"
            sx={{
              flexWrap: 'wrap',
              gap: 0.5,
              '& .MuiToggleButtonGroup-grouped': {
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '6px !important',
                textTransform: 'none',
                px: 0.75,
                py: 0.25,
                fontSize: '0.75rem',
                fontWeight: 500,
                gap: 0.4,
              },
            }}
          >
            {CATEGORIES.map((cat) => {
              const selected = value.category === cat.value;
              return (
                <ToggleButton
                  key={cat.value}
                  value={cat.value}
                  sx={{
                    color: selected ? 'common.white' : cat.color,
                    bgcolor: selected ? cat.color : 'transparent',
                    borderColor: selected ? `${cat.color} !important` : 'divider',
                    '&:hover': { bgcolor: selected ? cat.color : `${cat.color}15` },
                    '&.Mui-selected': {
                      bgcolor: cat.color,
                      color: 'common.white',
                      '&:hover': { bgcolor: cat.color, opacity: 0.9 },
                    },
                  }}
                >
                  {React.cloneElement(
                    cat.icon as React.ReactElement<{ size?: number; strokeWidth?: number; color?: string }>,
                    { size: 13, strokeWidth: 1.75, color: selected ? '#fff' : cat.color },
                  )}
                  {cat.label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>

        {/* Quantite */}
        <Box>
          <FieldLabel icon={<Numbers size={12} strokeWidth={1.75} />}>Quantite</FieldLabel>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton
              onClick={() => incrementQty(-1)}
              size="small"
              disabled={value.quantity <= 1}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, width: 28, height: 28 }}
            >
              <Remove size={14} strokeWidth={1.75} />
            </IconButton>
            <TextField
              type="number"
              value={value.quantity}
              onChange={(e) =>
                onChange({ ...value, quantity: Math.max(1, parseInt(e.target.value) || 1) })
              }
              size="small"
              inputProps={{
                min: 1,
                style: { textAlign: 'center', fontWeight: 600, padding: '4px 4px' },
              }}
              sx={{ width: 56 }}
            />
            <IconButton
              onClick={() => incrementQty(1)}
              size="small"
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, width: 28, height: 28 }}
            >
              <Add size={14} strokeWidth={1.75} />
            </IconButton>
          </Stack>
        </Box>

        {/* Notes */}
        <Box>
          <FieldLabel icon={<StickyNote2 size={12} strokeWidth={1.75} />}>
            Notes <Box component="span" sx={{ fontWeight: 400, ml: 0.5, textTransform: 'none', letterSpacing: 0 }}>(optionnel)</Box>
          </FieldLabel>
          <TextField
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            size="small"
            fullWidth
            placeholder="Marque, modele, emplacement..."
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
        {onCancel && (
          <Button
            onClick={onCancel}
            size="small"
            startIcon={<Close size={16} strokeWidth={1.75} />}
            sx={{ textTransform: 'none' }}
          >
            Annuler
          </Button>
        )}
        <Button
          onClick={onSubmit}
          variant="contained"
          size="small"
          startIcon={onCancel ? <Save size={16} strokeWidth={1.75} /> : <Add size={16} strokeWidth={1.75} />}
          disabled={!value.name.trim() || submitting}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {submitLabel}
        </Button>
      </Box>
    </Paper>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function InventoryItemsSection({ items, canEdit, onAdd, onUpdate, onDelete }: Props) {
  const [addForm, setAddForm] = useState<InventoryForm>(EMPTY_FORM);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<InventoryForm>(EMPTY_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    setAddSubmitting(true);
    try {
      await onAdd(addForm);
      setAddForm(EMPTY_FORM);
    } finally {
      setAddSubmitting(false);
    }
  };

  const startEdit = (item: PropertyInventoryItem) => {
    setEditForm({
      name: item.name,
      category: item.category ?? '',
      quantity: item.quantity,
      notes: item.notes ?? '',
      photoUrl: item.photoUrl ?? null,
    });
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleUpdate = async () => {
    if (!editingId || !editForm.name.trim()) return;
    setEditSubmitting(true);
    try {
      await onUpdate({ id: editingId, ...editForm });
      cancelEdit();
    } finally {
      setEditSubmitting(false);
    }
  };

  const renderCategoryChip = (categoryValue: string) => {
    const cat = CATEGORY_BY_VALUE[categoryValue];
    if (!cat) {
      return <Chip label={categoryValue} size="small" variant="outlined" />;
    }
    return (
      <Chip
        icon={React.cloneElement(
          cat.icon as React.ReactElement<{ size?: number; strokeWidth?: number; color?: string }>,
          { size: 14, strokeWidth: 1.75, color: cat.color },
        )}
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
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
          <Inventory2 size={22} strokeWidth={1.75} />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            Inventaire du logement
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
            Mobilier, electromenager et equipements presents dans la propriete
          </Typography>
        </Box>
      </Box>

      {/* Inline add form */}
      {canEdit && (
        <InlineForm
          value={addForm}
          onChange={setAddForm}
          onSubmit={handleAdd}
          submitLabel="Ajouter"
          submitting={addSubmitting}
        />
      )}

      {/* Items table — appears as soon as there is at least one item */}
      {items.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed', borderRadius: 2 }}
        >
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}>
            <Inventory2 size={36} strokeWidth={1.5} />
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            Aucun objet reference pour cette propriete
          </Typography>
          <Typography color="text.disabled" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
            Remplis le formulaire ci-dessus pour ajouter ton premier objet
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 64 }} />
                <TableCell>Designation</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell align="center">Qte</TableCell>
                <TableCell>Notes</TableCell>
                {canEdit && <TableCell align="right" sx={{ width: 80 }} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {orderedItems.map((item) => {
                const isEditing = editingId === item.id;
                if (isEditing) {
                  return (
                    <TableRow key={item.id}>
                      <TableCell colSpan={6} sx={{ p: 1, bgcolor: 'action.hover' }}>
                        <InlineForm
                          value={editForm}
                          onChange={setEditForm}
                          onSubmit={handleUpdate}
                          onCancel={cancelEdit}
                          submitLabel="Enregistrer"
                          submitting={editSubmitting}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ p: 0.75 }}>
                      {item.photoUrl ? (
                        <Box
                          component="a"
                          href={item.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            display: 'block',
                            width: 44,
                            height: 44,
                            borderRadius: 1,
                            backgroundImage: `url(${item.photoUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: 'zoom-in',
                            transition: 'transform 150ms',
                            '&:hover': { transform: 'scale(1.08)' },
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1,
                            border: '1px dashed',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.disabled',
                          }}
                        >
                          <ImageIcon size={16} strokeWidth={1.5} />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category && renderCategoryChip(item.category)}</TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {item.notes || '—'}
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Tooltip title="Modifier">
                          <IconButton size="small" onClick={() => startEdit(item)}>
                            <Edit size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
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
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
