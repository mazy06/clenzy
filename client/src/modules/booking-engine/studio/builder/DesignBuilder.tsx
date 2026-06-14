import { useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import BlockTree from './BlockTree';
import BuilderCanvas from './BuilderCanvas';
import BlockInspector from './BlockInspector';
import { getBlockDef, type BlockProps, type BlockType } from './blockRegistry';
import type { Breakpoint } from '../StudioShell';

/**
 * Builder 3-pane du Baitly Studio (F2) : arbre de blocs (gauche) · canvas WYSIWYG (centre) ·
 * inspector (droite). L'état de la page (liste ordonnée de blocs) vit ici, en mémoire :
 * la persistance vers le modèle SitePage (backend) arrivera au Lot 1 — pas de faux « save » ici.
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

export interface DesignBuilderProps {
  breakpoint: Breakpoint;
}

export default function DesignBuilder({ breakpoint }: DesignBuilderProps) {
  const [blocks, setBlocks] = useState<BlockInstance[]>(STARTER_PAGE);
  const [selectedId, setSelectedId] = useState<string | null>(STARTER_PAGE[0]?.id ?? null);
  const idRef = useRef(seedCounter);

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  const handleAdd = (type: BlockType) => {
    const block: BlockInstance = { id: `b${++idRef.current}`, type, props: { ...getBlockDef(type).defaultProps } };
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
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

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <BlockTree
        blocks={blocks}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onMove={handleMove}
        onRemove={handleRemove}
      />
      <BuilderCanvas blocks={blocks} selectedId={selectedId} breakpoint={breakpoint} onSelect={setSelectedId} />
      <BlockInspector block={selected} onChange={handleChange} />
    </Box>
  );
}
