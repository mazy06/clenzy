import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { Check } from 'lucide-react';
import BlockTree from './BlockTree';
import BuilderCanvas from './BuilderCanvas';
import PagePreview from './PagePreview';
import BlockInspector from './BlockInspector';
import ThemeInspector from './ThemeInspector';
import { BLOCK_REGISTRY, getBlockDef, type BlockProps, type BlockType } from './blockRegistry';
import type { Breakpoint } from '../StudioShell';
import type { StudioConfigState } from '../useStudioConfig';

/**
 * Builder 3-pane du Baitly Studio (F2 + F2b) : arbre de blocs (gauche) · canvas WYSIWYG (centre) ·
 * pane droit à onglets Bloc / Thème. La page composée (liste de blocs) est PERSISTÉE dans
 * config.pageLayout (JSON) : hydratée au chargement, ré-injectée dans la config à chaque mutation
 * → enregistrée avec le reste de la config (PUT). Le thème édite primaryColor/fontFamily.
 */

export interface BlockInstance {
  id: string;
  type: BlockType;
  props: BlockProps;
}

let blockIdSeq = 0;
const nextBlockId = () => `b${++blockIdSeq}`;

function makeBlock(type: BlockType): BlockInstance {
  return { id: nextBlockId(), type, props: { ...getBlockDef(type).defaultProps } };
}

/** Page de démarrage : structure crédible proposée si aucune page n'a encore été composée. */
function makeStarter(): BlockInstance[] {
  return (['hero', 'propertyGrid', 'amenities', 'cta', 'footer'] as BlockType[]).map(makeBlock);
}

/** Sérialise les blocs pour la persistance (type + props, sans les ids éphémères). */
function serializeLayout(blocks: BlockInstance[]): string {
  return JSON.stringify(blocks.map((b) => ({ type: b.type, props: b.props })));
}

/** Parse un layout persisté. null si absent/invalide ; [] si page sauvegardée vide. */
function parseLayout(json: string | null | undefined): BlockInstance[] | null {
  if (!json) return null;
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((b): b is { type: BlockType; props?: BlockProps } =>
        !!b && typeof (b as { type?: unknown }).type === 'string' && (b as { type: string }).type in BLOCK_REGISTRY)
      .map((b) => ({ id: nextBlockId(), type: b.type, props: { ...getBlockDef(b.type).defaultProps, ...(b.props ?? {}) } }));
  } catch {
    return null;
  }
}

type RightTab = 'block' | 'theme';

export interface DesignBuilderProps {
  breakpoint: Breakpoint;
  cfg: StudioConfigState;
}

export default function DesignBuilder({ breakpoint, cfg }: DesignBuilderProps) {
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('block');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [hydrated, setHydrated] = useState(false);

  const { patch } = cfg;

  // Hydratation unique : depuis config.pageLayout, sinon page de démarrage.
  useEffect(() => {
    if (hydrated || cfg.loading) return;
    const parsed = parseLayout(cfg.config?.pageLayout);
    const initial = parsed ?? makeStarter();
    setBlocks(initial);
    setSelectedId(initial[0]?.id ?? null);
    setHydrated(true);
  }, [hydrated, cfg.loading, cfg.config]);

  // Réinjecte la page dans la config → la barre d'enregistrement persiste tout (PUT).
  const commit = useCallback((next: BlockInstance[]) => {
    setBlocks(next);
    patch({ pageLayout: serializeLayout(next) });
  }, [patch]);

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  const onSelectBlock = (id: string) => { setSelectedId(id); setRightTab('block'); };

  const handleAdd = (type: BlockType) => {
    const block = makeBlock(type);
    commit([...blocks, block]);
    setSelectedId(block.id);
    setRightTab('block');
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const handleRemove = (id: string) => {
    commit(blocks.filter((b) => b.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const handleChange = (id: string, key: string, value: string | number | boolean) => {
    commit(blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b)));
  };

  if (!hydrated) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 'var(--text-md)' }}>
        Chargement de l’éditeur…
      </Box>
    );
  }

  const theme = cfg.config ? { primaryColor: cfg.config.primaryColor, fontFamily: cfg.config.fontFamily } : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Barre : bascule Éditer / Aperçu. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1.5, height: 44, flexShrink: 0, borderBottom: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[{ value: 'edit', label: 'Éditer' }, { value: 'preview', label: 'Aperçu' }]}
        />
      </Box>

      {mode === 'preview' ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <PagePreview blocks={blocks} theme={theme} breakpoint={breakpoint} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
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
            theme={theme}
          />

          {/* Pane droit : onglets Bloc / Thème + corps + barre de sauvegarde. */}
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
              {cfg.error ?? 'Modifications non enregistrées'}
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
      )}
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
