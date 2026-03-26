import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { ChevronRight, ExpandMore, ContentCopy } from '@mui/icons-material';
import { DOMNode } from './types';

/** Check if any descendant of this node matches the selected path */
const hasSelectedDescendant = (node: DOMNode, selectedPath: string | null): boolean => {
  if (!selectedPath) return false;
  for (const child of node.children) {
    if (child.path === selectedPath || hasSelectedDescendant(child, selectedPath)) return true;
  }
  return false;
};

// ─── TreeItem (recursive) ───────────────────────────────────────────────────

interface TreeItemProps {
  node: DOMNode;
  selectedPath: string | null;
  onSelect: (node: DOMNode) => void;
  onHover: (node: DOMNode | null) => void;
}

const TreeItem: React.FC<TreeItemProps> = ({ node, selectedPath, onSelect, onHover }) => {
  const [expanded, setExpanded] = useState(node.depth < 2);
  const [copied, setCopied] = useState(false);
  const isSelected = selectedPath === node.path;

  // Auto-expand when a descendant is selected (e.g. user clicks an element in the preview)
  useEffect(() => {
    if (selectedPath && hasSelectedDescendant(node, selectedPath)) {
      setExpanded(true);
    }
  }, [selectedPath, node]);
  const hasChildren = node.children.length > 0;
  const selectorText = node.tag + (node.id ? `#${node.id}` : '') + (node.classes.length > 0 ? `.${node.classes.join('.')}` : '');

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(selectorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  }, [selectorText]);

  return (
    <Box>
      <Box
        onClick={() => {
          onSelect(node);
          if (hasChildren) setExpanded(!expanded);
        }}
        onMouseEnter={() => onHover(node)}
        onMouseLeave={() => onHover(null)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.25,
          pl: `${node.depth * 14}px`, pr: 0.5, py: '2px',
          cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace',
          bgcolor: isSelected ? 'rgba(99,91,255,0.1)' : 'transparent',
          color: isSelected ? '#635BFF' : 'text.secondary',
          '&:hover': { bgcolor: isSelected ? 'rgba(99,91,255,0.12)' : 'action.hover' },
          '&:hover .copy-btn': { opacity: 1 },
          borderLeft: isSelected ? '2px solid #635BFF' : '2px solid transparent',
        }}
      >
        {hasChildren ? (
          expanded ? <ExpandMore sx={{ fontSize: 14, flexShrink: 0 }} /> : <ChevronRight sx={{ fontSize: 14, flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 14, flexShrink: 0 }} />
        )}
        <Typography component="span" sx={{
          fontSize: '11px', fontFamily: '"SF Mono", "Fira Code", monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          <Box component="span" sx={{ color: '#E91E63' }}>&lt;{node.tag}</Box>
          {node.id && <Box component="span" sx={{ color: '#1565C0' }}>#{node.id}</Box>}
          {node.classes.length > 0 && (
            <Box component="span" sx={{ color: '#2E7D32' }}>.{node.classes.slice(0, 2).join('.')}</Box>
          )}
          <Box component="span" sx={{ color: '#E91E63' }}>&gt;</Box>
          {!hasChildren && <Box component="span" sx={{ color: '#9E9E9E' }}> …</Box>}
        </Typography>
        <Tooltip title={copied ? 'Copié !' : 'Copier le sélecteur'} placement="left">
          <IconButton
            className="copy-btn"
            size="small"
            onClick={handleCopy}
            sx={{ opacity: 0, p: 0.25, color: copied ? '#4CAF50' : '#8b8fa3', transition: 'opacity 0.15s' }}
          >
            <ContentCopy sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {hasChildren && expanded && node.children.map((child, i) => (
        <TreeItem
          key={`${child.path}-${i}`}
          node={child}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </Box>
  );
};
TreeItem.displayName = 'TreeItem';

// ─── DOMTreePanel ───────────────────────────────────────────────────────────

interface DOMTreePanelProps {
  domTree: DOMNode | null;
  selectedPath: string | null;
  onSelect: (node: DOMNode) => void;
  onHover: (node: DOMNode | null) => void;
}

const DOMTreePanel: React.FC<DOMTreePanelProps> = ({ domTree, selectedPath, onSelect, onHover }) => (
  <>
    <Typography sx={{
      px: 1.5, py: 0.75, fontSize: 10, fontWeight: 700, color: '#8b8fa3',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      borderBottom: '1px solid #2a2d3a', bgcolor: '#151821',
      position: 'sticky', top: 0, zIndex: 1,
    }}>
      Widgets
    </Typography>
    <Box sx={{ py: 0.5 }}>
      {domTree ? (
        <TreeItem
          node={domTree}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onHover={onHover}
        />
      ) : (
        <Typography sx={{ p: 2, fontSize: 11, color: '#8b8fa3' }}>
          Chargement…
        </Typography>
      )}
    </Box>
  </>
);

export default DOMTreePanel;
