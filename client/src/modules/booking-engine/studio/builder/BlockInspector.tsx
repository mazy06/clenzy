import { Box, InputBase, Switch } from '@mui/material';
import { SlidersHorizontal } from 'lucide-react';
import { getBlockDef, type BlockProps, type FieldDef } from './blockRegistry';
import type { BlockInstance } from './DesignBuilder';

/**
 * Inspector (pane droite du builder F2). Édite les props du bloc sélectionné via les champs
 * déclarés dans le registre. Aucun bloc sélectionné → enseigne d'invite.
 */

export interface BlockInspectorProps {
  block: BlockInstance | null;
  onChange: (id: string, key: string, value: string | number | boolean) => void;
}

export default function BlockInspector({ block, onChange }: BlockInspectorProps) {
  return (
    <Box sx={{ width: 296, flexShrink: 0, borderLeft: '1px solid var(--line)', bgcolor: 'var(--card)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 48, borderBottom: '1px solid var(--line)' }}>
        <SlidersHorizontal size={15} strokeWidth={2} color="var(--muted)" />
        <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          {block ? getBlockDef(block.type).label : 'Inspecteur'}
        </Box>
      </Box>

      {!block ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3, color: 'var(--muted)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
          Sélectionne un bloc dans la page ou dans l’arbre pour modifier son contenu.
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {getBlockDef(block.type).fields.map((field) => (
            <Field key={field.key} field={field} value={block.props[field.key]} onChange={(v) => onChange(block.id, field.key, v)} />
          ))}
        </Box>
      )}
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
        sx={{
          width: '100%', px: 1.25, py: 0.75, fontSize: 'var(--text-md)', color: 'var(--ink)',
          bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
          transition: 'border-color var(--duration-fast) var(--ease-out)',
          '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
          '& textarea': { lineHeight: 1.5 },
        }}
      />
    </Box>
  );
}

const labelSx = {
  fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)',
} as const;
