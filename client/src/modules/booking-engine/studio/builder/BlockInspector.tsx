import { Box, ButtonBase, InputBase, Switch } from '@mui/material';
import { getBlockDef, type BlockProps, type FieldDef } from './blockRegistry';
import type { BlockInstance } from './DesignBuilder';

/**
 * Corps de l'inspecteur de bloc (onglet « Bloc » du pane droit, F2). Édite les props du bloc
 * sélectionné via les champs déclarés dans le registre. Aucun bloc → invite. Le chrome du pane
 * (largeur, bordure, switch Bloc/Thème) est fourni par DesignBuilder.
 */

export interface BlockInspectorProps {
  block: BlockInstance | null;
  onChange: (id: string, key: string, value: string | number | boolean) => void;
}

export default function BlockInspector({ block, onChange }: BlockInspectorProps) {
  if (!block) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3, color: 'var(--muted)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
        Sélectionne un bloc dans la page ou dans l’arbre pour modifier son contenu.
      </Box>
    );
  }

  const def = getBlockDef(block.type);
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
        {def.label}
      </Box>
      {def.fields.map((field) => (
        <Field key={field.key} field={field} value={block.props[field.key]} onChange={(v) => onChange(block.id, field.key, v)} />
      ))}
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
    const src = typeof value === 'string' ? value : '';
    return (
      <Box>
        <Box component="label" sx={{ ...labelSx, display: 'block', mb: 0.75 }}>{field.label}</Box>
        <InputBase value={src} placeholder="https://…" onChange={(e) => onChange(e.target.value)} sx={inputSx} />
        {src ? <Box component="img" src={src} alt="" sx={{ mt: 1, display: 'block', width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }} /> : null}
      </Box>
    );
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

const labelSx = {
  fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)',
} as const;

const inputSx = {
  width: '100%', px: 1.25, py: 0.75, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
  transition: 'border-color var(--duration-fast) var(--ease-out)',
  '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
} as const;
