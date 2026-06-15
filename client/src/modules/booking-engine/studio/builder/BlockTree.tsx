import { useState } from 'react';
import { Box, ButtonBase, Menu, MenuItem, Tooltip } from '@mui/material';
import { Plus, ChevronUp, ChevronDown, Trash2, PanelLeftClose, PanelLeftOpen, GripVertical } from 'lucide-react';
import { BLOCK_ORDER, NESTABLE_BLOCK_ORDER, getBlockDef, columnCountOf, type BlockType } from './blockRegistry';
import type { BlockInstance, DropTarget } from './DesignBuilder';

/**
 * Arbre de blocs (pane gauche du builder F2) : liste ordonnée des blocs de la page,
 * sélection, suppression, ajout, et glisser-déposer LIBRE (2.7) — y compris dans / entre les
 * colonnes d'un conteneur `columns` et entre le niveau racine et les colonnes. Réordonnancement
 * fin aussi via ↑/↓. Réductible (`collapsed`).
 */

export interface BlockTreeProps {
  blocks: BlockInstance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: BlockType) => void;
  /** Ajoute un bloc dans la colonne `colIndex` du conteneur `parentId`. */
  onAddToColumn: (parentId: string, colIndex: number, type: BlockType) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  /** Glisser-déposer : déplace le bloc `dragId` vers la cible (racine ou colonne). */
  onMoveBlock: (dragId: string, target: DropTarget) => void;
  onRemove: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/** Cible d'ajout : null = top-level (fin de page) ; sinon une colonne d'un conteneur. */
type AddTarget = { parentId: string; colIndex: number } | null;

const LINE_TOP = 'inset 0 2px 0 0 var(--accent)';
const LINE_BOTTOM = 'inset 0 -2px 0 0 var(--accent)';

export default function BlockTree({ blocks, selectedId, onSelect, onAdd, onAddToColumn, onMove, onMoveBlock, onRemove, collapsed, onToggleCollapse }: BlockTreeProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [addTarget, setAddTarget] = useState<AddTarget>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const startDrag = (e: React.DragEvent, id: string) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const endDrag = () => { setDragId(null); setDropTarget(null); };
  // Survol d'une ligne : insère avant elle ou avant la suivante (moitié haute/basse).
  const overRow = (e: React.DragEvent, siblings: BlockInstance[], index: number, make: (beforeId: string | null) => DropTarget) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    setDropTarget(make(after ? (siblings[index + 1]?.id ?? null) : siblings[index].id));
  };
  // Survol d'une zone de colonne (vide ou marge) : ajoute en fin de colonne.
  const overColEnd = (e: React.DragEvent, parentId: string, colIndex: number) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTarget({ kind: 'col', parentId, colIndex, beforeId: null });
  };
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragId && dropTarget) onMoveBlock(dragId, dropTarget);
    endDrag();
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, target: AddTarget) => {
    setAddTarget(target);
    setAnchorEl(e.currentTarget);
  };
  const pickType = (type: BlockType) => {
    if (addTarget) onAddToColumn(addTarget.parentId, addTarget.colIndex, type);
    else onAdd(type);
    setAnchorEl(null);
  };
  const menuOrder = addTarget ? NESTABLE_BLOCK_ORDER : BLOCK_ORDER;

  return (
    <Box sx={{ width: collapsed ? 52 : 256, flexShrink: 0, borderRight: '1px solid var(--line)', bgcolor: 'var(--card)', display: 'flex', flexDirection: 'column', height: '100%', transition: 'width var(--duration-fast) var(--ease-out)' }}>
      {/* Header : titre + ajout + repli (ou juste le repli en mode réduit). */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 0.5, px: collapsed ? 0 : 1.25, height: 48, borderBottom: '1px solid var(--line)' }}>
        {!collapsed && (
          <Box sx={{ flex: 1, fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            Blocs de la page
          </Box>
        )}
        {!collapsed && (
          <Tooltip title="Ajouter un bloc">
            <ButtonBase onClick={(e) => openMenu(e, null)} aria-label="Ajouter un bloc" sx={headerBtnSx}>
              <Plus size={17} strokeWidth={2.2} />
            </ButtonBase>
          </Tooltip>
        )}
        <Tooltip title={collapsed ? 'Déplier' : 'Replier'} placement="right">
          <ButtonBase onClick={onToggleCollapse} aria-label={collapsed ? 'Déplier la colonne' : 'Replier la colonne'} sx={headerBtnSx}>
            {collapsed ? <PanelLeftOpen size={16} strokeWidth={2} /> : <PanelLeftClose size={16} strokeWidth={2} />}
          </ButtonBase>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: collapsed ? 0.75 : 1 }}>
        {blocks.length === 0 && !collapsed && (
          <Box sx={{ textAlign: 'center', px: 2, py: 4, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
            Page vide. Ajoute un premier bloc avec <Box component="span" sx={{ color: 'var(--accent)', fontWeight: 'var(--fw-semibold)' }}>+</Box>.
          </Box>
        )}
        {blocks.map((b, i) => {
          const def = getBlockDef(b.type);
          const Icon = def.icon;
          const isActive = b.id === selectedId;
          if (collapsed) {
            return (
              <Tooltip key={b.id} title={def.label} placement="right">
                <ButtonBase
                  onClick={() => onSelect(b.id)}
                  aria-label={def.label}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 38, mb: 0.25,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    color: isActive ? 'var(--accent)' : 'var(--muted)',
                    bgcolor: isActive ? 'var(--accent-soft)' : 'transparent',
                    '&:hover': { bgcolor: isActive ? 'var(--accent-soft)' : 'var(--hover)', color: isActive ? 'var(--accent)' : 'var(--ink)' },
                    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: -2 },
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                </ButtonBase>
              </Tooltip>
            );
          }
          const rootLine = dropTarget?.kind === 'root' && dropTarget.beforeId === b.id
            ? LINE_TOP
            : (dropTarget?.kind === 'root' && dropTarget.beforeId === null && i === blocks.length - 1 ? LINE_BOTTOM : 'none');
          return (
            <Box key={b.id}>
              <Box
                draggable
                onClick={() => onSelect(b.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.id); } }}
                onDragStart={(e) => startDrag(e, b.id)}
                onDragEnd={endDrag}
                onDragOver={(e) => overRow(e, blocks, i, (beforeId) => ({ kind: 'root', beforeId }))}
                onDrop={drop}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75, px: 1, height: 38, mb: 0.25,
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  bgcolor: isActive ? 'var(--accent-soft)' : 'transparent',
                  color: isActive ? 'var(--ink)' : 'var(--body)',
                  opacity: dragId === b.id ? 0.4 : 1,
                  boxShadow: rootLine,
                  transition: 'background var(--duration-fast) var(--ease-out)',
                  '&:hover': { bgcolor: isActive ? 'var(--accent-soft)' : 'var(--hover)' },
                  '&:hover .blockTreeActions': { opacity: 1 },
                  '&:hover .blockTreeGrip': { opacity: 1 },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: -2 },
                }}
              >
                <Box component="span" className="blockTreeGrip" aria-hidden="true" sx={{ display: 'inline-flex', color: 'var(--faint)', flexShrink: 0, cursor: 'grab', opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
                  <GripVertical size={14} strokeWidth={2} />
                </Box>
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

              {/* Conteneur colonnes (2.7) : colonnes + blocs enfants en retrait (drop zones). */}
              {b.type === 'columns' && (
                <Box sx={{ ml: 1.25, pl: 1, borderLeft: '1px solid var(--line)', mb: 0.5 }}>
                  {Array.from({ length: columnCountOf(b.props) }, (_, ci) => {
                    const col = b.children?.[ci] ?? [];
                    const isColTarget = dropTarget?.kind === 'col' && dropTarget.parentId === b.id && dropTarget.colIndex === ci;
                    return (
                      <Box
                        key={ci}
                        onDragOver={(e) => overColEnd(e, b.id, ci)}
                        onDrop={drop}
                        sx={{
                          mb: 0.5, borderRadius: 'var(--radius-md)',
                          outline: isColTarget ? '2px dashed var(--accent)' : '2px dashed transparent',
                          outlineOffset: 1, transition: 'outline-color var(--duration-fast) var(--ease-out)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, height: 24 }}>
                          <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                            Colonne {ci + 1}
                          </Box>
                          <Tooltip title="Ajouter dans cette colonne">
                            <ButtonBase onClick={(e) => openMenu(e, { parentId: b.id, colIndex: ci })} aria-label={`Ajouter un bloc dans la colonne ${ci + 1}`}
                              sx={{ width: 22, height: 22, borderRadius: 'var(--radius-sm)', color: 'var(--accent)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--accent-soft)' } }}>
                              <Plus size={14} strokeWidth={2.2} />
                            </ButtonBase>
                          </Tooltip>
                        </Box>
                        {col.length === 0 ? (
                          <Box sx={{ px: 0.5, py: 0.75, fontSize: 'var(--text-2xs)', color: 'var(--faint)', fontStyle: 'italic' }}>
                            {isColTarget && dragId ? 'Déposer ici' : 'Vide'}
                          </Box>
                        ) : (
                          col.map((child, chIndex) => {
                            const line = isColTarget && dropTarget?.kind === 'col' && dropTarget.beforeId === child.id
                              ? LINE_TOP
                              : (isColTarget && dropTarget?.kind === 'col' && dropTarget.beforeId === null && chIndex === col.length - 1 ? LINE_BOTTOM : 'none');
                            return (
                              <ChildRow
                                key={child.id}
                                block={child}
                                isActive={child.id === selectedId}
                                canUp={chIndex > 0}
                                canDown={chIndex < col.length - 1}
                                isDragging={dragId === child.id}
                                line={line}
                                onSelect={onSelect}
                                onMove={onMove}
                                onRemove={onRemove}
                                onDragStart={(e) => startDrag(e, child.id)}
                                onDragOver={(e) => overRow(e, col, chIndex, (beforeId) => ({ kind: 'col', parentId: b.id, colIndex: ci, beforeId }))}
                                onDrop={drop}
                                onDragEnd={endDrag}
                              />
                            );
                          })
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          );
        })}
        {collapsed && (
          <Tooltip title="Ajouter un bloc" placement="right">
            <ButtonBase onClick={(e) => openMenu(e, null)} aria-label="Ajouter un bloc"
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 38, mt: 0.5, borderRadius: 'var(--radius-md)', color: 'var(--accent)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--accent-soft)' } }}>
              <Plus size={18} strokeWidth={2.2} />
            </ButtonBase>
          </Tooltip>
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 248, bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)' } } }}
      >
        {menuOrder.map((type) => {
          const def = getBlockDef(type);
          const Icon = def.icon;
          return (
            <MenuItem
              key={type}
              onClick={() => pickType(type)}
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

/** Ligne d'un bloc enfant d'une colonne (retrait ; ↑/↓ + glisser-déposer). */
function ChildRow({ block, isActive, canUp, canDown, isDragging, line, onSelect, onMove, onRemove, onDragStart, onDragOver, onDrop, onDragEnd }: {
  block: BlockInstance; isActive: boolean; canUp: boolean; canDown: boolean; isDragging: boolean; line: string;
  onSelect: (id: string) => void; onMove: (id: string, dir: -1 | 1) => void; onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragEnd: () => void;
}) {
  const def = getBlockDef(block.type);
  const Icon = def.icon;
  return (
    <Box
      draggable
      onClick={() => onSelect(block.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(block.id); } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, height: 32, mb: 0.25,
        borderRadius: 'var(--radius-md)', cursor: 'pointer',
        bgcolor: isActive ? 'var(--accent-soft)' : 'transparent',
        color: isActive ? 'var(--ink)' : 'var(--body)',
        opacity: isDragging ? 0.4 : 1,
        boxShadow: line,
        '&:hover': { bgcolor: isActive ? 'var(--accent-soft)' : 'var(--hover)' },
        '&:hover .childRowActions': { opacity: 1 },
        '&:hover .childRowGrip': { opacity: 1 },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: -2 },
      }}
    >
      <Box component="span" className="childRowGrip" aria-hidden="true" sx={{ display: 'inline-flex', color: 'var(--faint)', flexShrink: 0, cursor: 'grab', opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
        <GripVertical size={12} strokeWidth={2} />
      </Box>
      <Box component="span" sx={{ display: 'inline-flex', color: isActive ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }}>
        <Icon size={14} strokeWidth={2} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {def.label}
      </Box>
      <Box className="childRowActions" sx={{ display: 'flex', alignItems: 'center', gap: 0.25, opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
        <TreeAction label="Monter" disabled={!canUp} onClick={(e) => { e.stopPropagation(); onMove(block.id, -1); }}>
          <ChevronUp size={13} strokeWidth={2} />
        </TreeAction>
        <TreeAction label="Descendre" disabled={!canDown} onClick={(e) => { e.stopPropagation(); onMove(block.id, 1); }}>
          <ChevronDown size={13} strokeWidth={2} />
        </TreeAction>
        <TreeAction label="Supprimer" danger onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}>
          <Trash2 size={12} strokeWidth={2} />
        </TreeAction>
      </Box>
    </Box>
  );
}

const headerBtnSx = {
  width: 28, height: 28, borderRadius: 'var(--radius-sm)', color: 'var(--accent)', cursor: 'pointer',
  '&:hover': { bgcolor: 'var(--accent-soft)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

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
