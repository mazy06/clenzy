import type { ReactNode } from 'react';
import { Box, ButtonBase, InputBase, Switch } from '@mui/material';
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
        <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2.5, md: 4 }, py: { xs: 3, md: 4 } }}>
          <div className="mb-4">
            <div className="font-[var(--font-display)] text-[var(--text-2xl)] font-[var(--fw-bold)] text-[var(--ink)]">{title}</div>
            {description && <div className="text-[var(--text-md)] text-[var(--muted)] mt-0.5">{description}</div>}
          </div>
          {intro}
          {/* Cartes en masonry 2 colonnes au-delà de lg (1 colonne en dessous) :
              remplit la largeur + divise ~par 2 le scroll vertical. break-inside
              empêche de couper une carte entre deux colonnes. Titre / intro /
              footer restent pleine largeur. */}
          <Box
            sx={{
              columnCount: { xs: 1, lg: 2 },
              columnGap: '20px',
              '& > *': { breakInside: 'avoid' },
            }}
          >
            {children}
          </Box>
        </Box>
      </div>
      {footer}
    </div>
  );
}

export function SettingCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="border border-[var(--line)] rounded-[var(--radius-lg)] bg-[var(--card)] mb-3.5 overflow-hidden">
      <div className="px-3.5 pt-3 pb-2 border-b border-[var(--line)]">
        <div className="text-[var(--text-md)] font-[var(--fw-semibold)] text-[var(--ink)]">{title}</div>
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
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.75,
      borderBottom: '1px solid var(--line)', '&:last-of-type': { borderBottom: 'none' },
      flexWrap: { xs: 'wrap', sm: 'nowrap' },
    }}>
      <div className="flex-1 min-w-[180px]">
        <label className="text-[var(--text-md)] font-[var(--fw-medium)] text-[var(--ink)] block" htmlFor={htmlFor}>{label}</label>
        {helper && <div className="text-[var(--text-sm)] text-[var(--muted)] mt-0.5 leading-[1.45]">{helper}</div>}
      </div>
      <Box sx={{ flexShrink: 0, width: { xs: '100%', sm: 260 }, display: 'flex', justifyContent: 'flex-end' }}>{control}</Box>
    </Box>
  );
}

export function SaveBar({ dirty, saving, onSave, error }: { dirty: boolean; saving: boolean; onSave: () => void; error?: string | null }) {
  return (
    <Box sx={{
      flexShrink: 0, borderTop: '1px solid var(--line)', bgcolor: 'var(--card)',
      px: { xs: 2.5, md: 4 }, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
    }}>
      <Box sx={{ flex: 1, fontSize: 'var(--text-sm)', color: error ? 'var(--err)' : 'var(--muted)' }}>
        {error ? error : dirty ? 'Modifications non enregistrées.' : 'À jour.'}
      </Box>
      <ButtonBase
        onClick={onSave}
        disabled={!dirty || saving}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 38, px: 2,
          borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
          fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
          transition: 'background var(--duration-fast) var(--ease-out)',
          '&:hover': { bgcolor: 'var(--accent-deep)' },
          '&.Mui-disabled': { opacity: 0.45, cursor: 'default' },
          '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
        }}
      >
        {!saving && <Check size={16} strokeWidth={2.4} />}
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </ButtonBase>
    </Box>
  );
}

// ─── Contrôles ───────────────────────────────────────────────────────────────

const fieldSx = {
  width: '100%', px: 1.25, py: 0.75, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
  transition: 'border-color var(--duration-fast) var(--ease-out)',
  '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
} as const;

export function TextControl({ id, value, onChange, placeholder, type = 'text' }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return <InputBase id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} sx={fieldSx} />;
}

export function TextAreaControl({ id, value, onChange, placeholder, rows = 3 }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return <InputBase id={id} multiline minRows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} sx={{ ...fieldSx, '& textarea': { lineHeight: 1.5 } }} />;
}

export function NumberControl({ id, value, onChange, min, max }: {
  id?: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <InputBase
      id={id}
      type="number"
      value={Number.isFinite(value) ? value : 0}
      inputProps={{ min, max }}
      onChange={(e) => { const n = Number(e.target.value); onChange(Number.isFinite(n) ? n : 0); }}
      sx={{ ...fieldSx, maxWidth: 120 }}
    />
  );
}

export function ToggleControl({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      sx={{ '& .Mui-checked': { color: 'var(--accent)' }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: 'var(--accent) !important', opacity: 0.5 } }}
    />
  );
}

export interface SelectOption { value: string; label: string }

export function SelectControl({ id, value, onChange, options }: {
  id?: string; value: string; onChange: (v: string) => void; options: SelectOption[];
}) {
  return (
    <Box
      component="select"
      id={id}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      sx={{
        ...fieldSx, appearance: 'none', cursor: 'pointer', height: 36,
        backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%)',
        backgroundPosition: 'calc(100% - 16px) 15px, calc(100% - 11px) 15px',
        backgroundSize: '5px 5px, 5px 5px',
        backgroundRepeat: 'no-repeat',
        '&:focus-visible': { borderColor: 'var(--accent)', outline: 'none', boxShadow: '0 0 0 3px var(--accent-soft)' },
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Box>
  );
}
