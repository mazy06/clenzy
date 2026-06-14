import { Box } from '@mui/material';
import { getBlockDef } from './blockRegistry';
import type { BlockInstance } from './DesignBuilder';
import type { Breakpoint } from '../StudioShell';

/**
 * Canvas WYSIWYG (pane centre du builder F2). Rend la page composée de blocs dans un cadre dont
 * la largeur reflète le breakpoint de prévisualisation. Cliquer un bloc le sélectionne ; le bloc
 * actif reçoit un halo accent. Vide → enseigne d'amorçage.
 */

const FRAME_WIDTH: Record<Breakpoint, number | string> = {
  desktop: '100%',
  tablet: 834,
  mobile: 390,
};

export interface BuilderCanvasProps {
  blocks: BlockInstance[];
  selectedId: string | null;
  breakpoint: Breakpoint;
  onSelect: (id: string) => void;
}

export default function BuilderCanvas({ blocks, selectedId, breakpoint, onSelect }: BuilderCanvasProps) {
  const width = FRAME_WIDTH[breakpoint];

  return (
    <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', bgcolor: 'var(--bg-2, var(--bg))', display: 'flex', justifyContent: 'center', p: breakpoint === 'desktop' ? 0 : 3 }}>
      <Box
        sx={{
          width, maxWidth: '100%', minHeight: '100%', bgcolor: 'var(--card)',
          ...(breakpoint !== 'desktop' && {
            my: 'auto', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)', minHeight: 'auto',
          }),
        }}
      >
        {blocks.length === 0 ? (
          <Box sx={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--text-md)', p: 4 }}>
            Ajoute des blocs depuis le panneau de gauche pour composer ta page.
          </Box>
        ) : (
          blocks.map((b) => {
            const def = getBlockDef(b.type);
            const isActive = b.id === selectedId;
            return (
              <Box
                key={b.id}
                onClick={() => onSelect(b.id)}
                role="button"
                tabIndex={0}
                aria-label={`Sélectionner le bloc ${def.label}`}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSelect(b.id); } }}
                sx={{
                  position: 'relative', cursor: 'pointer', outline: 'none',
                  '&::after': {
                    content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
                    border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'border-color var(--duration-fast) var(--ease-out)',
                  },
                  '&:hover::after': { borderColor: isActive ? 'var(--accent)' : 'var(--accent-soft)' },
                  '&:focus-visible::after': { borderColor: 'var(--accent)' },
                }}
              >
                {isActive && (
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, zIndex: 2, px: 1, height: 20,
                    display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)',
                    bgcolor: 'var(--accent)', color: 'var(--on-accent)', borderBottomRightRadius: 'var(--radius-sm)',
                  }}>
                    {def.label}
                  </Box>
                )}
                {def.render(b.props)}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
