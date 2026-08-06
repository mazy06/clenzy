import React, { useMemo, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import EmptyState from '../../../components/EmptyState';
import { Card } from '../../../components/ui';
import { Button } from '../../../components/ui';
import {
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
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
    className="flex items-center gap-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5"
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
          className="relative w-16 h-16 rounded-xl overflow-hidden border border-border bg-cover bg-center cursor-pointer transition-[border-color] duration-150 ease-out hover:border-destructive [&:hover_.photo-remove]:opacity-100"
          style={{ backgroundImage: `url(${photoUrl})` }}
          onClick={() => onChange(null)}
          title="Cliquer pour retirer la photo"
        >
          <div className="photo-remove absolute inset-0 flex items-center justify-center bg-destructive/75 text-destructive-foreground opacity-0 transition-opacity duration-150 ease-out">
            <Close size={20} strokeWidth={2} />
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-xl border-[1.5px] border-dashed border-border flex flex-col items-center justify-center gap-[1.5px] cursor-pointer text-faint transition-[border-color,color,background-color] duration-150 ease-out hover:border-primary hover:text-primary hover:bg-primary-soft"
        >
          <PhotoCamera size={20} strokeWidth={1.75} />
          <p className="text-[0.5625rem] font-semibold leading-[1]">
            Ajouter
          </p>
        </div>
      )}
      {error && (
        <p className="text-2xs text-destructive-ink mt-0.5">
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
    <Card className="gap-0 py-0 p-3 mb-3">
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
          <ToggleGroup
            type="single"
            value={value.category}
            onValueChange={(v) => onChange({ ...value, category: v ?? '' })}
            size="sm"
            spacing={0.5}
            className="flex-wrap w-full"
          >
            {CATEGORIES.map((cat) => {
              const selected = value.category === cat.value;
              return (
                <ToggleGroupItem
                  key={cat.value}
                  value={cat.value}
                  className="gap-[2.4px] rounded-[6px] border border-solid px-[4.5px] py-[1.5px] text-[0.75rem] font-medium normal-case bg-[var(--cat-bg)] hover:bg-[var(--cat-hover)]"
                  // Les teintes viennent de la donnee (couleur de categorie) :
                  // elles transitent par des variables CSS, une classe Tailwind
                  // ne pouvant pas naitre d'une valeur d'execution.
                  style={{
                    color: selected ? cat.color : 'var(--bui-muted-foreground)',
                    borderColor: selected ? cat.color : 'var(--bui-border)',
                    '--cat-bg': selected ? `${cat.color}1F` : 'transparent',
                    '--cat-hover': selected ? `${cat.color}1F` : `${cat.color}15`,
                  } as React.CSSProperties}
                >
                  {React.cloneElement(
                    cat.icon as React.ReactElement<{ size?: number; strokeWidth?: number; color?: string }>,
                    { size: 13, strokeWidth: 1.75, color: cat.color },
                  )}
                  {cat.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        {/* Quantite */}
        <div>
          <FieldLabel icon={<Numbers size={12} strokeWidth={1.75} />} htmlFor={`${uid}-quantity`}>
            Quantite
          </FieldLabel>
          <div className="flex flex-row items-center gap-[3px]">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Diminuer la quantite"
              onClick={() => incrementQty(-1)}
              disabled={value.quantity <= 1}
              className="border border-border bg-card rounded-md"
            >
              <Remove size={14} strokeWidth={1.75} />
            </Button>
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Augmenter la quantite"
              onClick={() => incrementQty(1)}
              className="border border-border bg-card rounded-md"
            >
              <Add size={14} strokeWidth={1.75} />
            </Button>
          </div>
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
    // Pilule -soft neutre : le ton « neutral » de la primitive porte deja le
    // couple fond doux / encre, inutile de composer des tokens a la main.
    return <StatusChip tone="neutral" label={categoryValue} />;
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
        <span className="inline-flex text-primary">
          <Inventory2 size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h6 className="text-sm font-semibold tracking-tight">
            Inventaire du logement
          </h6>
          <p className="text-xs text-muted-foreground">
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
        <EmptyState
          icon={<Inventory2 />}
          title="Aucun objet reference pour cette propriete"
          description="Remplis le formulaire ci-dessus pour ajouter ton premier objet"
        />
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
                      <TableCell colSpan={6} className="p-1.5 bg-muted">
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
                          className="block w-11 h-11 rounded-md bg-cover bg-center border border-border cursor-zoom-in transition-[border-color,box-shadow] duration-[140ms] ease-out hover:border-primary/40 hover:shadow-sm"
                          style={{ backgroundImage: `url(${item.photoUrl})` }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-md border border-dashed border-border flex items-center justify-center text-faint">
                          <ImageIcon size={16} strokeWidth={1.5} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category && renderCategoryChip(item.category)}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {item.notes || '—'}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-end">
                        {/* Declencheur = <span> natif : les primitives du kit ne
                            transmettent pas de ref (React 18), le tooltip
                            n'aurait pas d'ancre. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Modifier ${item.name}`}
                                onClick={() => startEdit(item)}
                              >
                                <Edit size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Modifier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Supprimer ${item.name}`}
                                onClick={() => onDelete(item.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive-soft"
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
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
