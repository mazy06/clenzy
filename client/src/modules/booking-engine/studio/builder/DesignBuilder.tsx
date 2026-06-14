import { useMemo, useRef, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { Check } from 'lucide-react';
import BlockTree from './BlockTree';
import BuilderCanvas from './BuilderCanvas';
import BlockInspector from './BlockInspector';
import ThemeInspector from './ThemeInspector';
import { getBlockDef, type BlockProps, type BlockType } from './blockRegistry';
import type { Breakpoint } from '../StudioShell';
import type { StudioConfigState } from '../useStudioConfig';

/**
 * Builder 3-pane du Baitly Studio (F2 + F2b) : arbre de blocs (gauche) · canvas WYSIWYG (centre) ·
 * pane droit à onglets Bloc / Thème. L'état de la page (liste de blocs) vit ici en mémoire
 * (persistance SitePage = Lot 1) ; le thème édite la config réelle (primaryColor/fontFamily) via cfg.
 */

export interface BlockInstance {
  id: string;
  type: BlockType;
  props: BlockProps;
}

let seedCounter = 0;
function seed(type: BlockType): BlockInstance {
  return { id: `b${++seedCounter}`, type, props: { ...getBlockDef(type).defaultProps } };
}

/** Page de démarrage : une structure crédible que l'utilisateur ajuste ensuite. */
const STARTER_PAGE: BlockInstance[] = [seed('hero'), seed('propertyGrid'), seed('amenities'), seed('cta'), seed('footer')];

type RightTab = 'block' | 'theme';

export interface DesignBuilderProps {
  breakpoint: Breakpoint;
  cfg: StudioConfigState;
}

export default function DesignBuilder({ breakpoint, cfg }: DesignBuilderProps) {
  const [blocks, setBlocks] = useState<BlockInstance[]>(STARTER_PAGE);
  const [selectedId, setSelectedId] = useState<string | null>(STARTER_PAGE[0]?.id ?? null);
  const [rightTab, setRightTab] = useState<RightTab>('block');
  const idRef = useRef(seedCounter);

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  const handleAdd = (type: BlockType) => {
    const block: BlockInstance = { id: `b${++idRef.current}`, type, props: { ...getBlockDef(type).defaultProps } };
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
    setRightTab('block');
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleRemove = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const handleChange = (id: string, key: string, value: string | number | boolean) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b)));
  };

  const onSelectBlock = (id: string) => { setSelectedId(id); setRightTab('block'); };

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <BlockTree
        blocks={blocks}
        selectedId={selectedId}
        onSelect={onSelectBlock}
        onAdd={handleAdd}
        onMove={handleMove}
        onRemove={handleRemove}
      />

      <BuilderCanvas
        blocks={blocks}
        selectedId={selectedId}
        breakpoint={breakpoint}
        onSelect={onSelectBlock}
        theme={cfg.config ? { primaryColor: cfg.config.primaryColor, fontFamily: cfg.config.fontFamily } : undefined}
      />

      {/* Pane droit : onglets Bloc / Thème + corps + barre de sauvegarde du thème. */}
      <Box sx={{ width: 296, flexShrink: 0, borderLeft: '1px solid var(--line)', bgcolor: 'var(--card)', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, height: 48, borderBottom: '1px solid var(--line)' }}>
          <Segmented
            value={rightTab}
            onChange={setRightTab}
            options={[{ value: 'block', label: 'Bloc' }, { value: 'theme', label: 'Thème' }]}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {rightTab === 'block'
            ? <BlockInspector block={selected} onChange={handleChange} />
            : <ThemeInspector config={cfg.config} patch={cfg.patch} />}
        </Box>

        {cfg.dirty && (
          <Box sx={{ flexShrink: 0, borderTop: '1px solid var(--line)', p: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, fontSize: 'var(--text-2xs)', color: cfg.error ? 'var(--err)' : 'var(--muted)' }}>
              {cfg.error ?? 'Thème modifié'}
            </Box>
            <ButtonBase
              onClick={() => { cfg.save().catch(() => { /* erreur exposée par le hook */ }); }}
              disabled={cfg.saving}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 32, px: 1.5,
                borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
                fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                '&:hover': { bgcolor: 'var(--accent-deep)' },
                '&.Mui-disabled': { opacity: 0.5 },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              }}
            >
              {!cfg.saving && <Check size={14} strokeWidth={2.4} />}
              {cfg.saving ? 'Enregistrement…' : 'Enregistrer'}
            </ButtonBase>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <Box sx={{ display: 'inline-flex', p: 0.25, gap: 0.25, bgcolor: 'var(--field)', borderRadius: 'var(--radius-md)' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            onClick={() => onChange(o.value)}
            sx={{
              height: 28, px: 1.75, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', cursor: 'pointer',
              fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
              color: active ? 'var(--ink)' : 'var(--muted)',
              bgcolor: active ? 'var(--card)' : 'transparent',
              boxShadow: active ? 'var(--shadow-card)' : 'none',
              transition: 'color var(--duration-fast) var(--ease-out)',
              '&:hover': { color: 'var(--ink)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
            }}
          >
            {o.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
