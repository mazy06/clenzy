import type { ReactNode } from 'react';
import { cn } from '../../../../utils/cn';
import { Input, Switch, Textarea } from '../../../../components/ui';
import { Check } from 'lucide-react';

/**
 * Primitives de formulaire « Baitly Signature » pour les panneaux de réglages du Studio (F3).
 * Réutilisables par les sections Réservation, Croissance, etc. Tokens var(--*), états a11y complets.
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
            <div className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-[family-name:var(--fw-bold)] text-[var(--ink)]">{title}</div>
            {description && <div className="text-[var(--text-md)] text-[var(--muted)] mt-0.5">{description}</div>}
          </div>
          {intro}
          {/* Cartes en masonry 2 colonnes au-delà de lg (1 colonne en dessous) :
              remplit la largeur + divise ~par 2 le scroll vertical. break-inside
              empêche de couper une carte entre deux colonnes. Titre / intro /
              footer restent pleine largeur. */}
          {/* Rupture MUI lg = 1200px (breakpoints non configures). */}
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
    <div className="border border-[var(--line)] rounded-[var(--radius-lg)] bg-[var(--card)] mb-3.5 overflow-hidden">
      <div className="px-3.5 pt-3 pb-2 border-b border-[var(--line)]">
        <div className="text-[var(--text-md)] font-[family-name:var(--fw-semibold)] text-[var(--ink)]">{title}</div>
        {description && <div className="text-[var(--text-sm)] text-[var(--muted)] mt-0.5">{description}</div>}
      </div>
      <div className="px-3.5 py-0.5">{children}</div>
    </div>
  );
}

export function SettingRow({ label, helper, htmlFor, control }: {
  label: string; helper?: string; htmlFor?: string; control: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-[10.5px] flex-wrap min-[600px]:flex-nowrap border-b border-solid border-[var(--line)] last-of-type:border-b-0">
      <div className="flex-1 min-w-[180px]">
        <label className="text-[var(--text-md)] font-[family-name:var(--fw-medium)] text-[var(--ink)] block" htmlFor={htmlFor}>{label}</label>
        {helper && <div className="text-[var(--text-sm)] text-[var(--muted)] mt-0.5 leading-[1.45]">{helper}</div>}
      </div>
      <div className="shrink-0 w-full min-[600px]:w-[260px] flex justify-end">{control}</div>
    </div>
  );
}

export function SaveBar({ dirty, saving, onSave, error }: { dirty: boolean; saving: boolean; onSave: () => void; error?: string | null }) {
  return (
    <div className="shrink-0 bg-[var(--card)] px-[15px] min-[900px]:px-6 py-[9px] flex items-center gap-[9px]" style={{ borderTop: '1px solid var(--line)' }}>
      <div className={cn('flex-1 text-[var(--text-sm)]', error ? 'text-[var(--err)]' : 'text-[var(--muted)]')}>
        {error ? error : dirty ? 'Modifications non enregistrées.' : 'À jour.'}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className={cn(
          'inline-flex items-center justify-center gap-[4.5px] h-[38px] px-3 shrink-0',
          'rounded-[var(--radius-md)] border-none appearance-none bg-[var(--accent)] text-[var(--on-accent)]',
          'text-[var(--text-sm)] font-semibold cursor-pointer',
          'transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'hover:bg-[var(--accent-deep)] disabled:opacity-45 disabled:cursor-default',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        )}
      >
        {!saving && <Check size={16} strokeWidth={2.4} />}
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
}

// ─── Contrôles ───────────────────────────────────────────────────────────────

// Le gabarit des champs (fond --field, lisere --line, rayon, anneau de focus)
// vient desormais des primitifs : l'ancien `fieldSx` ne faisait que le redire.

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
      className="max-w-[120px]"
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
    // `fieldSx` fusionne ici en classes ; son `&.Mui-focused` est sans objet sur
    // un <select> natif (la classe MUI n'y a jamais ete posee).
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-[7.5px] py-[4.5px] text-[var(--text-md)] text-[var(--ink)] bg-[var(--field)] border border-solid border-[var(--line)] rounded-[var(--radius-md)] appearance-none cursor-pointer transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
      style={{
        // Chevron dessine en deux degrades : valeurs multiples separees par des
        // virgules, illisibles/fragiles en classes arbitraires.
        backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%)',
        backgroundPosition: 'calc(100% - 16px) 15px, calc(100% - 11px) 15px',
        backgroundSize: '5px 5px, 5px 5px',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
