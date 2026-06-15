import { useMemo } from 'react';
import { Box } from '@mui/material';
import { Plus } from 'lucide-react';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import { getBlockDef, type BlockType } from './blockRegistry';
import { BLOCK_SELECTORS, WIDGET_SELECTORS, type SelectorDef } from './selectorCatalog';

/**
 * Inspecteur « CSS » (onglet 3 du pane droit — design custom, Phase C).
 * Éditeur de CSS libre persisté dans config.customCss + palette de sélecteurs ciblables
 * (« structure exposée ») : un clic insère une règle prête à remplir. Le CSS s'applique à la
 * page composée (classes `bkly-*`) ET au widget de réservation (classes `cb-*`, injecté dans
 * son Shadow DOM côté page publique).
 */

export interface CssInspectorProps {
  config: BookingEngineConfig | null;
  patch: (changes: Partial<BookingEngineConfig>) => void;
  /** Types de blocs présents dans la page (pour ne lister que les sélecteurs pertinents). */
  blockTypes: BlockType[];
}

export default function CssInspector({ config, patch, blockTypes }: CssInspectorProps) {
  // Blocs présents, dédoublonnés, dans l'ordre de la page.
  const presentTypes = useMemo(() => [...new Set(blockTypes)], [blockTypes]);

  if (!config) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
        Chargement…
      </Box>
    );
  }

  const css = config.customCss ?? '';

  // Insère une règle vide pour le sélecteur à la fin du CSS (no-code : pas de copier-coller).
  const appendRule = (sel: string) => {
    const base = css.replace(/\s*$/, '');
    patch({ customCss: `${base ? base + '\n\n' : ''}${sel} {\n  \n}` });
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.5 }}>
        CSS appliqué à la <strong>page</strong> et au <strong>widget de réservation</strong>. Clique un
        sélecteur ci-dessous pour insérer une règle, puis renseigne les propriétés.
      </Box>

      {/* Éditeur */}
      <Box>
        <Box component="label" htmlFor="custom-css" sx={{ ...labelSx, display: 'block', mb: 0.75 }}>
          CSS personnalisé
        </Box>
        <Box
          component="textarea"
          id="custom-css"
          spellCheck={false}
          value={css}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => patch({ customCss: e.target.value || null })}
          placeholder={'.bkly-hero__title {\n  font-size: 56px;\n}'}
          sx={{
            width: '100%', minHeight: 200, resize: 'vertical', display: 'block',
            p: 1.25, fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12.5, lineHeight: 1.6,
            color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
            outline: 'none', whiteSpace: 'pre', overflow: 'auto', tabSize: 2,
            '&::placeholder': { color: 'var(--faint)' },
            '&:focus': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
          }}
        />
      </Box>

      {/* Palette de sélecteurs (structure exposée) */}
      <Box>
        <Box sx={labelSx}>Sélecteurs disponibles</Box>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {presentTypes.map((t) => (
            <SelectorGroup key={t} title={getBlockDef(t).label} items={BLOCK_SELECTORS[t]} onPick={appendRule} />
          ))}
          <SelectorGroup title="Module de réservation" items={WIDGET_SELECTORS} onPick={appendRule} />
        </Box>
      </Box>
    </Box>
  );
}

function SelectorGroup({ title, items, onPick }: { title: string; items: SelectorDef[]; onPick: (sel: string) => void }) {
  return (
    <Box>
      <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--faint)', mb: 0.5 }}>
        {title}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {items.map((it) => (
          <SelectorRow key={it.sel} item={it} onPick={onPick} />
        ))}
      </Box>
    </Box>
  );
}

function SelectorRow({ item, onPick }: { item: SelectorDef; onPick: (sel: string) => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onPick(item.sel)}
      title={`Insérer une règle pour ${item.sel}`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
        p: '5px 8px', border: '1px solid transparent', borderRadius: 'var(--radius-sm)', bgcolor: 'transparent',
        cursor: 'pointer', color: 'var(--body)',
        transition: 'background-color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
        '&:hover': { bgcolor: 'var(--field)', borderColor: 'var(--line)' },
        '&:hover .css-sel-add': { opacity: 1 },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
      }}
    >
      <Box component="code" sx={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 11.5, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
        {item.sel}
      </Box>
      <Box sx={{ flex: 1, fontSize: 'var(--text-2xs)', color: 'var(--muted)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label}
      </Box>
      <Box className="css-sel-add" sx={{ display: 'inline-flex', color: 'var(--accent)', opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)', flexShrink: 0 }}>
        <Plus size={13} strokeWidth={2.5} />
      </Box>
    </Box>
  );
}

const labelSx = {
  fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)',
} as const;
