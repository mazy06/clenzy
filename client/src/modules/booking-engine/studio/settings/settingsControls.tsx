import type { ReactNode } from 'react';
import { cn } from '../../../../utils/cn';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '../../../../components/ui';
import { Check } from 'lucide-react';

/**
 * Primitives de formulaire Baitly UI pour les panneaux de réglages du Studio (F3).
 * Réutilisables par les sections Réservation, Croissance, etc. Composées sur le kit
 * (Card, Button, NativeSelect…), états a11y complets.
 */

// ─── Mise en page ──────────────────────────────────────────────────────────────

export function SettingsPage({ title, description, children, footer, intro }: {
  title: string; description?: string; children: ReactNode; footer?: ReactNode;
  /** Contenu pleine largeur affiché au-dessus de la grille de cartes (bandeau d'info…). */
  intro?: ReactNode;
}) {
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        {/* Conteneur élargi (vs 720 auparavant) : récupère les espaces vides
            latéraux du Studio sur écran large. */}
        <div className="max-w-[1120px] mx-auto px-[15px] min-[900px]:px-6 py-[18px] min-[900px]:py-6">
          <div className="mb-4">
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-balance text-foreground">{title}</div>
            {description && <div className="text-sm text-muted-foreground mt-0.5">{description}</div>}
          </div>
          {intro}
          {/* Cartes en masonry 2 colonnes au-delà de lg (1 colonne en dessous) :
              remplit la largeur + divise ~par 2 le scroll vertical. break-inside
              empêche de couper une carte entre deux colonnes. Titre / intro /
              footer restent pleine largeur. */}
          {/* Rupture lg = 1200px (breakpoints non configures). */}
          <div className="columns-1 min-[1200px]:columns-2 gap-x-[20px] [&>*]:break-inside-avoid">
            {children}
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}

export function SettingCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card size="sm" className="mb-3.5">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SettingRow({ label, helper, htmlFor, control }: {
  label: string; helper?: string; htmlFor?: string; control: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-[10.5px] flex-wrap min-[600px]:flex-nowrap border-b border-border last-of-type:border-b-0">
      <div className="flex-1 min-w-[180px]">
        <label className="text-sm font-medium text-foreground block" htmlFor={htmlFor}>{label}</label>
        {helper && <div className="text-xs text-muted-foreground mt-0.5 leading-[1.45]">{helper}</div>}
      </div>
      <div className="shrink-0 w-full min-[600px]:w-[260px] flex justify-end">{control}</div>
    </div>
  );
}

export function SaveBar({ dirty, saving, onSave, error }: { dirty: boolean; saving: boolean; onSave: () => void; error?: string | null }) {
  return (
    <div className="shrink-0 bg-card border-t border-border px-[15px] min-[900px]:px-6 py-[9px] flex items-center gap-[9px]">
      <div className={cn('flex-1 text-xs', error ? 'text-destructive-ink' : 'text-muted-foreground')}>
        {error ? error : dirty ? 'Modifications non enregistrées.' : 'À jour.'}
      </div>
      <Button type="button" onClick={onSave} disabled={!dirty || saving} className="shrink-0 cursor-pointer">
        {!saving && <Check size={16} strokeWidth={2.4} />}
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </div>
  );
}

// ─── Contrôles ───────────────────────────────────────────────────────────────

// Le gabarit des champs (fond, lisere, rayon, anneau de focus) vient des
// primitifs du kit : l'ancien `fieldSx` ne faisait que le redire.

export function TextControl({ id, value, onChange, placeholder, type = 'text' }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function TextAreaControl({ id, value, onChange, placeholder, rows = 3 }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <Textarea
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="leading-[1.5]"
      // Le primitif pose `field-sizing: content`, qui neutralise `rows` : la
      // hauteur minimale se garantit en lignes, et `rows` est une prop runtime.
      style={{ minHeight: `${rows}lh` }}
    />
  );
}

export function NumberControl({ id, value, onChange, min, max }: {
  id?: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <Input
      id={id}
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => { const n = Number(e.target.value); onChange(Number.isFinite(n) ? n : 0); }}
      className="max-w-[120px] tabular-nums"
    />
  );
}

export function ToggleControl({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <Switch checked={checked} onCheckedChange={onChange} />;
}

export interface SelectOption { value: string; label: string }

export function SelectControl({ id, value, onChange, options }: {
  id?: string; value: string; onChange: (v: string) => void; options: SelectOption[];
}) {
  return (
    // Le chevron était dessiné à la main en deux dégradés : le primitif le porte
    // désormais, correctement positionné en RTL.
    <NativeSelect
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full [&_select]:cursor-pointer"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </NativeSelect>
  );
}
