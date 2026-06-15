import { useState } from 'react';
import { Box, ButtonBase, InputBase, Switch } from '@mui/material';
import { ImagePlus } from 'lucide-react';
import { getBlockDef, type BlockProps, type FieldDef, type RenderBreakpoint } from './blockRegistry';
import type { BlockInstance } from './DesignBuilder';
import MediaPicker from './MediaPicker';

/**
 * Corps de l'inspecteur de bloc (onglet « Bloc » du pane droit, F2). Édite les props du bloc
 * sélectionné via les champs déclarés dans le registre. Aucun bloc → invite. Le chrome du pane
 * (largeur, bordure, switch Bloc/Thème) est fourni par DesignBuilder.
 *
 * Overrides responsive (2.5) : quand le canvas est en tablette/mobile, l'édition d'un champ écrit
 * une valeur DÉDIÉE à ce breakpoint (clé `key@mobile`/`key@tablet`) ; un champ non surchargé hérite
 * du desktop. Un bouton « réinitialiser » retire l'override. `columnCount` reste non-responsive.
 */

export interface BlockInspectorProps {
  block: BlockInstance | null;
  breakpoint: RenderBreakpoint;
  onChange: (id: string, key: string, value: string | number | boolean) => void;
  onClear: (id: string, key: string) => void;
}

const NON_RESPONSIVE_FIELDS = new Set(['columnCount']);

export default function BlockInspector({ block, breakpoint, onChange, onClear }: BlockInspectorProps) {
  if (!block) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3, color: 'var(--muted)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
        Sélectionne un bloc dans la page ou dans l’arbre pour modifier son contenu.
      </Box>
    );
  }

  const def = getBlockDef(block.type);
  const responsive = breakpoint !== 'desktop';
  const bpLabel = breakpoint === 'mobile' ? 'Mobile' : 'Tablette';
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
        {def.label}
      </Box>
      {responsive && (
        <Box sx={{ p: 1, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 'var(--text-2xs)', lineHeight: 1.4 }}>
          Affichage <strong>{bpLabel}</strong> — les champs modifiés ici ne s'appliquent qu'en {bpLabel.toLowerCase()} ; les autres héritent du desktop.
        </Box>
      )}
      {def.fields.map((field) => {
        const useOverride = responsive && !NON_RESPONSIVE_FIELDS.has(field.key);
        const ovKey = `${field.key}@${breakpoint}`;
        const overridden = useOverride && block.props[ovKey] !== undefined;
        const effectiveKey = useOverride ? ovKey : field.key;
        const value = overridden ? block.props[ovKey] : block.props[field.key];
        return (
          <Box key={field.key}>
            <Field field={field} value={value} onChange={(v) => onChange(block.id, effectiveKey, v)} />
            {overridden && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: 'var(--text-2xs)', color: 'var(--accent)' }}>
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--accent)', flexShrink: 0 }} />
                Spécifique {bpLabel}
                <ButtonBase onClick={() => onClear(block.id, ovKey)} sx={{ ml: 0.5, color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'var(--text-2xs)', '&:hover': { color: 'var(--ink)' } }}>
                  réinitialiser
                </ButtonBase>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Visibilité responsive (2.5) — commune à tous les blocs (props hideMobile/Tablet/Desktop). */}
      <Box sx={{ mt: 0.5, pt: 1.5, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Visibilité par écran
        </Box>
        <VisibilityToggle label="Masquer sur mobile" checked={Boolean(block.props.hideMobile)} onChange={(v) => onChange(block.id, 'hideMobile', v)} />
        <VisibilityToggle label="Masquer sur tablette" checked={Boolean(block.props.hideTablet)} onChange={(v) => onChange(block.id, 'hideTablet', v)} />
        <VisibilityToggle label="Masquer sur desktop" checked={Boolean(block.props.hideDesktop)} onChange={(v) => onChange(block.id, 'hideDesktop', v)} />
      </Box>
    </Box>
  );
}

function VisibilityToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box component="label" sx={labelSx}>{label}</Box>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        size="small"
        sx={{ '& .Mui-checked': { color: 'var(--accent)' }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: 'var(--accent) !important', opacity: 0.5 } }}
      />
    </Box>
  );
}

function Field({ field, value, onChange }: { field: FieldDef; value: BlockProps[string] | undefined; onChange: (v: string | number | boolean) => void }) {
  if (field.type === 'toggle') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box component="label" sx={labelSx}>{field.label}</Box>
        <Switch
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          size="small"
          sx={{ '& .Mui-checked': { color: 'var(--accent)' }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: 'var(--accent) !important', opacity: 0.5 } }}
        />
      </Box>
    );
  }

  if (field.type === 'select') {
    return (
      <Box>
        <Box component="label" sx={{ ...labelSx, display: 'block', mb: 0.75 }}>{field.label}</Box>
        <Box
          component="select"
          value={String(value ?? field.options?.[0]?.value ?? '')}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
          sx={{
            width: '100%', height: 36, px: 1, fontSize: 'var(--text-md)', color: 'var(--ink)',
            bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
          }}
        >
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Box>
      </Box>
    );
  }

  if (field.type === 'color') {
    const hex = typeof value === 'string' ? value : '';
    return (
      <Box>
        <Box component="label" sx={{ ...labelSx, display: 'block', mb: 0.75 }}>{field.label}</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="input" type="color" value={hex || '#ffffff'}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            sx={{ width: 38, height: 38, p: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'transparent', cursor: 'pointer', flexShrink: 0 }}
          />
          <InputBase value={hex} placeholder="hérité" onChange={(e) => onChange(e.target.value)}
            sx={{ ...inputSx, fontFamily: 'var(--font-mono, monospace)' }} />
          {hex && (
            <ButtonBase onClick={() => onChange('')} aria-label="Réinitialiser"
              sx={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', color: 'var(--muted)', flexShrink: 0, '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>×</ButtonBase>
          )}
        </Box>
      </Box>
    );
  }

  if (field.type === 'image') {
    return <ImageField label={field.label} value={typeof value === 'string' ? value : ''} onChange={onChange} />;
  }

  return (
    <Box>
      <Box component="label" sx={{ ...labelSx, display: 'block', mb: 0.75 }}>{field.label}</Box>
      <InputBase
        value={value ?? ''}
        multiline={field.type === 'textarea'}
        minRows={field.type === 'textarea' ? 3 : undefined}
        type={field.type === 'number' ? 'number' : 'text'}
        placeholder={field.placeholder}
        inputProps={field.type === 'number' ? { min: field.min, max: field.max } : undefined}
        onChange={(e) => {
          if (field.type === 'number') {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          } else {
            onChange(e.target.value);
          }
        }}
        sx={{ ...inputSx, '& textarea': { lineHeight: 1.5 } }}
      />
    </Box>
  );
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Box>
      <Box component="label" sx={{ ...labelSx, display: 'block', mb: 0.75 }}>{label}</Box>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <InputBase value={value} placeholder="https://… ou médiathèque" onChange={(e) => onChange(e.target.value)} sx={{ ...inputSx, flex: 1 }} />
        <ButtonBase
          onClick={() => setPickerOpen(true)}
          aria-label="Choisir dans la médiathèque"
          sx={{
            flexShrink: 0, width: 38, height: 38, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)',
            color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
            '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
          }}
        >
          <ImagePlus size={17} strokeWidth={2} />
        </ButtonBase>
      </Box>
      {value ? <Box component="img" src={value} alt="" sx={{ mt: 1, display: 'block', width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }} /> : null}
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={onChange} />
    </Box>
  );
}

const labelSx = {
  fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)',
} as const;

const inputSx = {
  width: '100%', px: 1.25, py: 0.75, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
  transition: 'border-color var(--duration-fast) var(--ease-out)',
  '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
} as const;
