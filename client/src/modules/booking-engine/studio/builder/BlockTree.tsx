import { useState } from 'react';
import { Box, ButtonBase, Menu, MenuItem } from '@mui/material';
import { Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { BLOCK_ORDER, getBlockDef, type BlockType } from './blockRegistry';
import type { BlockInstance } from './DesignBuilder';

/**
 * Arbre de blocs (pane gauche du builder F2) : liste ordonnée des blocs de la page,
 * sélection, réordonnancement (↑/↓), suppression, et ajout via la bibliothèque.
 */

export interface BlockTreeProps {
  blocks: BlockInstance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: BlockType) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}

export default function BlockTree({ blocks, selectedId, onSelect, onAdd, onMove, onRemove }: BlockTreeProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Box sx={{ width: 256, flexShrink: 0, borderRight: '1px solid var(--line)', bgcolor: 'var(--card)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, height: 48, borderBottom: '1px solid var(--line)' }}>
        <Box sx={{ flex: 1, fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          Blocs de la page
        </Box>
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Ajouter un bloc"
          sx={{
            width: 28, height: 28, borderRadius: 'var(--radius-sm)', color: 'var(--accent)', cursor: 'pointer',
            '&:hover': { bgcolor: 'var(--accent-soft)' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
          }}
        >
          <Plus size={17} strokeWidth={2.2} />
        </ButtonBase>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {blocks.length === 0 && (
          <Box sx={{ textAlign: 'center', px: 2, py: 4, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
            Page vide. Ajoute un premier bloc avec <Box component="span" sx={{ color: 'var(--accent)', fontWeight: 'var(--fw-semibold)' }}>+</Box>.
          </Box>
        )}
        {blocks.map((b, i) => {
          const def = getBlockDef(b.type);
          const Icon = def.icon;
          const isActive = b.id === selectedId;
          return (
            <Box
              key={b.id}
              onClick={() => onSelect(b.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.id); } }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1, height: 38, mb: 0.25,
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                bgcolor: isActive ? 'var(--accent-soft)' : 'transparent',
                color: isActive ? 'var(--ink)' : 'var(--body)',
                transition: 'background var(--duration-fast) var(--ease-out)',
                '&:hover': { bgcolor: isActive ? 'var(--accent-soft)' : 'var(--hover)' },
                '&:hover .blockTreeActions': { opacity: 1 },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: -2 },
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: isActive ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }}>
                <Icon size={16} strokeWidth={2} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, fontSize: 'var(--text-md)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {def.label}
              </Box>
              <Box
                className="blockTreeActions"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.25, opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)' }}
              >
                <TreeAction label="Monter" disabled={i === 0} onClick={(e) => { e.stopPropagation(); onMove(b.id, -1); }}>
                  <ChevronUp size={14} strokeWidth={2} />
                </TreeAction>
                <TreeAction label="Descendre" disabled={i === blocks.length - 1} onClick={(e) => { e.stopPropagation(); onMove(b.id, 1); }}>
                  <ChevronDown size={14} strokeWidth={2} />
                </TreeAction>
                <TreeAction label="Supprimer" danger onClick={(e) => { e.stopPropagation(); onRemove(b.id); }}>
                  <Trash2 size={13} strokeWidth={2} />
                </TreeAction>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 248, bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)' } } }}
      >
        {BLOCK_ORDER.map((type) => {
          const def = getBlockDef(type);
          const Icon = def.icon;
          return (
            <MenuItem
              key={type}
              onClick={() => { onAdd(type); setAnchorEl(null); }}
              sx={{ gap: 1.25, py: 1, px: 1.5, alignItems: 'flex-start', '&:hover': { bgcolor: 'var(--hover)' } }}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mt: 0.25 }}><Icon size={17} strokeWidth={2} /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>{def.label}</Box>
                <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', whiteSpace: 'normal' }}>{def.description}</Box>
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}

function TreeAction({ children, label, onClick, disabled = false, danger = false }: {
  children: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      sx={{
        width: 22, height: 22, borderRadius: 'var(--radius-sm)', color: 'var(--muted)', cursor: 'pointer',
        '&:hover': { bgcolor: danger ? 'var(--err-soft)' : 'var(--active)', color: danger ? 'var(--err)' : 'var(--ink)' },
        '&.Mui-disabled': { opacity: 0.3 },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
      }}
    >
      {children}
    </ButtonBase>
  );
}
