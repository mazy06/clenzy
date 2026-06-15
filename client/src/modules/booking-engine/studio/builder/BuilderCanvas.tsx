import { Box } from '@mui/material';
import { getBlockDef, visibilityClassName, type BlockRenderCtx } from './blockRegistry';
import type { BlockInstance } from './DesignBuilder';
import type { Breakpoint } from '../StudioShell';
import type { DesignTokens } from '../../../../services/api/bookingEngineApi';

/**
 * Canvas WYSIWYG (pane centre du builder F2). Rend la page composée de blocs dans un cadre dont
 * la largeur reflète le breakpoint de prévisualisation. Cliquer un bloc le sélectionne ; le bloc
 * actif reçoit un halo accent. Vide → enseigne d'amorçage.
 */

export const FRAME_WIDTH: Record<Breakpoint, number | string> = {
  desktop: '100%',
  tablet: 834,
  mobile: 390,
};

export interface CanvasTheme {
  primaryColor: string;
  fontFamily: string | null;
  tokens?: DesignTokens | null;
}

export interface BuilderCanvasProps {
  blocks: BlockInstance[];
  selectedId: string | null;
  breakpoint: Breakpoint;
  onSelect: (id: string) => void;
  theme?: CanvasTheme;
}

/**
 * Surcharge les CSS vars de marque + design tokens sur le cadre pour un aperçu fidèle au thème.
 * Consommé par le canvas, l'aperçu Studio ET la page publique (rendu cohérent partout).
 */
export function themeStyle(theme?: CanvasTheme): React.CSSProperties {
  if (!theme) return {};
  const t = theme.tokens || {};
  const accent = t.primaryColor || theme.primaryColor || '#5453D6';
  const style: Record<string, string> = {
    '--accent': accent,
    '--accent-deep': `color-mix(in srgb, ${accent} 84%, #000)`,
    '--accent-soft': `color-mix(in srgb, ${accent} 12%, transparent)`,
    '--on-accent': '#ffffff',
  };
  const body = t.bodyFontFamily || theme.fontFamily;
  if (body) { style.fontFamily = body; style['--font-display'] = t.headingFontFamily || body; }
  if (t.backgroundColor) style['--bg'] = t.backgroundColor;
  if (t.surfaceColor) style['--card'] = t.surfaceColor;
  if (t.textColor) style['--ink'] = t.textColor;
  if (t.textSecondaryColor) style['--muted'] = t.textSecondaryColor;
  if (t.borderColor) style['--line'] = t.borderColor;
  if (t.cardBorderRadius || t.borderRadius) style['--radius-lg'] = (t.cardBorderRadius || t.borderRadius)!;
  if (t.borderRadius) style['--radius-md'] = t.borderRadius;
  if (t.baseFontSize) style.fontSize = t.baseFontSize;
  return style as React.CSSProperties;
}

/**
 * Bloc rendu dans le canvas avec chrome d'édition (halo + libellé au survol/sélection). Récursif :
 * un conteneur `columns` rend ses enfants via le même nœud (sélectionnables individuellement).
 */
function BlockNode({ block, selectedId, onSelect }: { block: BlockInstance; selectedId: string | null; onSelect: (id: string) => void }) {
  const def = getBlockDef(block.type);
  const isActive = block.id === selectedId;

  let ctx: BlockRenderCtx | undefined;
  if (block.type === 'columns' && block.children) {
    ctx = {
      columns: block.children.map((col) => (
        <>{col.map((child) => <BlockNode key={child.id} block={child} selectedId={selectedId} onSelect={onSelect} />)}</>
      )),
    };
  }

  return (
    <Box
      className={visibilityClassName(block.props)}
      // stopPropagation : sélectionner un bloc imbriqué ne sélectionne pas aussi le conteneur parent.
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(block.id); }}
      role="button"
      tabIndex={0}
      aria-label={`Sélectionner le bloc ${def.label}`}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSelect(block.id); } }}
      sx={{
        position: 'relative', cursor: 'pointer', outline: 'none',
        '&::after': {
          content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
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
      {def.render(block.props, ctx)}
    </Box>
  );
}

export default function BuilderCanvas({ blocks, selectedId, breakpoint, onSelect, theme }: BuilderCanvasProps) {
  const width = FRAME_WIDTH[breakpoint];

  return (
    <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', bgcolor: 'var(--bg-2, var(--bg))', display: 'flex', justifyContent: 'center', p: breakpoint === 'desktop' ? 0 : 3 }}>
      <Box
        style={themeStyle(theme)}
        sx={{
          width, maxWidth: '100%', minHeight: '100%', bgcolor: 'var(--card)',
          containerType: 'inline-size',
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
          blocks.map((b) => <BlockNode key={b.id} block={b} selectedId={selectedId} onSelect={onSelect} />)
        )}
      </Box>
    </Box>
  );
}
