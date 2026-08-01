import React, { useMemo, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Card } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Stack } from '@mui/material';
import { Input } from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
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

// Libelle local (icone + texte) — homonyme du FieldLabel du kit, volontairement
// conserve. Rendu en <label> pour porter le htmlFor quand il designe un champ.
const FieldLabel = ({ icon, htmlFor, children }: { icon: React.ReactNode; htmlFor?: string; children: React.ReactNode }) => (
  <label
    htmlFor={htmlFor}
    className="cn-text-caption flex items-center gap-0.5 font-bold text-[var(--faint)] mb-0.5 uppercase tracking-[.06em] text-[10.5px]"
  >
    {icon}
    {children}
  </label>
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
    <div>
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
        <div
          className="relative w-16 h-16 rounded-[12px] overflow-hidden border border-solid border-[var(--line)] bg-cover bg-center cursor-pointer transition-[border-color] duration-150 hover:border-[#C97A7A] [&:hover_.photo-remove]:opacity-100"
          style={{ backgroundImage: `url(${photoUrl})` }}
          onClick={() => onChange(null)}
          title="Cliquer pour retirer la photo"
        >
          <div className="photo-remove absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,_var(--err)_75%,_transparent)] text-[var(--on-accent)] opacity-0" style={{ transition: 'opacity 150ms' }}>
            <Close size={20} strokeWidth={2} />
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-[12px] border-[1.5px] border-dashed border-[var(--line)] flex flex-col items-center justify-center gap-[1.5px] cursor-pointer text-[var(--faint)] transition-[border-color,color,background-color] duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
        >
          <PhotoCamera size={20} strokeWidth={1.75} />
          <p className="cn-text-body1 text-[0.5625rem] font-semibold leading-[1]">
            Ajouter
          </p>
        </div>
      )}
      {error && (
        <p className="cn-text-body1 text-[0.625rem] text-destructive mt-0.5">
          {error}
        </p>
      )}
    </div>
  );
}

function InlineForm({ value, onChange, onSubmit, onCancel, submitLabel, submitting }: InlineFormProps) {
  // Le formulaire est monte deux fois (ajout en tete + edition d'une ligne) :
  // les identifiants doivent etre uniques par instance.
  const uid = React.useId();
  const incrementQty = (delta: number) =>
    onChange({ ...value, quantity: Math.max(1, value.quantity + delta) });

  return (
    <Card className="gap-0 py-0 p-3 mb-3 bg-[var(--surface-2)]">
      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[64px_1.5fr_2fr_0.9fr_1.6fr] gap-3">
        {/* Photo */}
        <PhotoUpload
          photoUrl={value.photoUrl}
          onChange={(url) => onChange({ ...value, photoUrl: url })}
        />

        {/* Designation */}
        <div>
          <FieldLabel icon={<Label size={12} strokeWidth={1.75} />} htmlFor={`${uid}-name`}>
            Designation
          </FieldLabel>
          <Input
            id={`${uid}-name`}
            required
            placeholder="Ex : Canape 3 places, Lave-linge Bosch..."
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.name.trim()) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </div>

        {/* Categorie */}
        <div className="min-w-0">
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
                    color: selected ? cat.color : 'var(--muted)',
                    bgcolor: 'transparent',
                    borderColor: 'var(--line-2)',
                    '&:hover': { bgcolor: `${cat.color}15` },
                    '&.Mui-selected': {
                      bgcolor: `${cat.color}1F`,
                      color: cat.color,
                      borderColor: `${cat.color} !important`,
                      '&:hover': { bgcolor: `${cat.color}1F` },
                    },
                  }}
                >
                  {React.cloneElement(
                    cat.icon as React.ReactElement<{ size?: number; strokeWidth?: number; color?: string }>,
                    { size: 13, strokeWidth: 1.75, color: cat.color },
                  )}
                  {cat.label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </div>

        {/* Quantite */}
        <div>
          <FieldLabel icon={<Numbers size={12} strokeWidth={1.75} />} htmlFor={`${uid}-quantity`}>
            Quantite
          </FieldLabel>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton
              onClick={() => incrementQty(-1)}
              size="small"
              disabled={value.quantity <= 1}
              sx={{ border: '1px solid var(--line-2)', bgcolor: 'var(--card)', borderRadius: '8px', width: 28, height: 28 }}
            >
              <Remove size={14} strokeWidth={1.75} />
            </IconButton>
            <Input
              id={`${uid}-quantity`}
              type="number"
              min={1}
              className="w-14 text-center font-semibold tabular-nums"
              value={value.quantity}
              onChange={(e) =>
                onChange({ ...value, quantity: Math.max(1, parseInt(e.target.value) || 1) })
              }
            />
            <IconButton
              onClick={() => incrementQty(1)}
              size="small"
              sx={{ border: '1px solid var(--line-2)', bgcolor: 'var(--card)', borderRadius: '8px', width: 28, height: 28 }}
            >
              <Add size={14} strokeWidth={1.75} />
            </IconButton>
          </Stack>
        </div>

        {/* Notes */}
        <div>
          <FieldLabel icon={<StickyNote2 size={12} strokeWidth={1.75} />} htmlFor={`${uid}-notes`}>
            Notes <span className="font-normal ms-[3px] normal-case tracking-0">(optionnel)</span>
          </FieldLabel>
          <Input
            id={`${uid}-notes`}
            placeholder="Marque, modele, emplacement..."
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-1.5 mt-2">
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
          >
            <Close size={16} strokeWidth={1.75} />
            Annuler
          </Button>
        )}
        <Button
          onClick={onSubmit}
          size="sm"
          disabled={!value.name.trim() || submitting}
        >
          {onCancel ? <Save size={16} strokeWidth={1.75} /> : <Add size={16} strokeWidth={1.75} />}
          {submitLabel}
        </Button>
      </div>
    </Card>
  );
}

const renderCategoryChip = (categoryValue: string) => {
  const cat = CATEGORY_BY_VALUE[categoryValue];
  if (!cat) {
    // Pilule -soft neutre (pattern baseline §2 : texte couleur + fond soft)
    return (
      <StatusChip tokens={{ color: 'var(--muted)', bg: 'var(--hover)' }} label={categoryValue} />
    );
  }
  return (
    <StatusChip tokens={{ color: cat.color, bg: `${cat.color}1F` }} label={cat.label} icon={React.cloneElement(
        cat.icon as React.ReactElement<{ size?: number; strokeWidth?: number; color?: string }>,
        { size: 14, strokeWidth: 1.75, color: cat.color },
      )} />
  );
};

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


  const orderedItems = useMemo(() => {
    const order = CATEGORIES.map((c) => c.value);
    return [...items].sort((a, b) => {
      const ai = order.indexOf(a.category ?? '');
      const bi = order.indexOf(b.category ?? '');
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [items]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="inline-flex text-[var(--accent)]">
          <Inventory2 size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h6 className="cn-text-subtitle1 font-semibold">
            Inventaire du logement
          </h6>
          <p className="cn-text-body2 text-muted-foreground text-[0.8rem]">
            Mobilier, electromenager et equipements presents dans la propriete
          </p>
        </div>
      </div>

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
        <Card className="gap-0 py-0 p-6 text-center bg-[var(--card)]">
          <span className="inline-flex text-muted-foreground opacity-60 mb-1.5">
            <Inventory2 size={36} strokeWidth={1.5} />
          </span>
          <p className="cn-text-body1 text-muted-foreground text-[0.875rem]">
            Aucun objet reference pour cette propriete
          </p>
          <p className="cn-text-body1 text-muted-foreground opacity-60 text-[0.75rem] mt-0.5">
            Remplis le formulaire ci-dessus pour ajouter ton premier objet
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16" />
                <TableHead>Designation</TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead className="text-center">Qte</TableHead>
                <TableHead>Notes</TableHead>
                {canEdit && <TableHead className="w-20 text-end" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedItems.map((item) => {
                const isEditing = editingId === item.id;
                if (isEditing) {
                  return (
                    <TableRow key={item.id}>
                      <TableCell colSpan={6} className="p-1.5 bg-[var(--hover)]">
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
                  <TableRow key={item.id}>
                    <TableCell className="p-[4.5px]">
                      {item.photoUrl ? (
                        <a
                          href={item.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block w-11 h-11 rounded-[8px] bg-cover bg-center border border-solid border-[var(--line)] cursor-zoom-in transition-[border-color,box-shadow] duration-[140ms] hover:border-[var(--line-2)] hover:shadow-[var(--shadow-card)]"
                          style={{ backgroundImage: `url(${item.photoUrl})` }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-[8px] border border-dashed border-[var(--line)] flex items-center justify-center text-[var(--faint)]">
                          <ImageIcon size={16} strokeWidth={1.5} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category && renderCategoryChip(item.category)}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-[var(--muted)] text-[0.8rem]">
                      {item.notes || '—'}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-end">
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
        </div>
      )}
    </div>
  );
}
