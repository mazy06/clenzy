import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { ContentCopy, Mouse } from '../../../../icons';
import { SelectedElementInfo } from './types';

// ─── StyleRow ───────────────────────────────────────────────────────────────

interface StyleRowProps {
  property: string;
  value: string;
  isOverridden: boolean;
  onEdit: (property: string, value: string) => void;
}

const StyleRow: React.FC<StyleRowProps> = React.memo(({ property, value, isOverridden, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, py: '2px', px: 1,
      '&:hover': { bgcolor: 'action.hover' },
      '&:hover .copy-style': { opacity: 1 },
      fontSize: '11px', fontFamily: '"SF Mono", "Fira Code", monospace',
    }}>
      <Typography component="span" sx={{
        fontSize: '11px', fontFamily: 'inherit', color: '#9C27B0',
        minWidth: 130, flexShrink: 0,
      }}>
        {property}
      </Typography>
      {editing ? (
        <Box
          component="input"
          ref={inputRef}
          value={editValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (editValue !== value) onEdit(property, editValue);
          }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
              setEditing(false);
              if (editValue !== value) onEdit(property, editValue);
            }
            if (e.key === 'Escape') {
              setEditing(false);
              setEditValue(value);
            }
          }}
          sx={{
            flex: 1, border: '1px solid', borderColor: '#635BFF',
            borderRadius: '2px', px: 0.5, py: '1px',
            fontSize: '11px', fontFamily: 'inherit', color: 'text.primary',
            bgcolor: 'rgba(99,91,255,0.05)', outline: 'none',
          }}
        />
      ) : (
        <Typography
          component="span"
          onClick={() => setEditing(true)}
          sx={{
            flex: 1, fontSize: '11px', fontFamily: 'inherit',
            color: isOverridden ? '#635BFF' : '#1565C0',
            fontWeight: isOverridden ? 600 : 400,
            cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline', textDecorationStyle: 'dashed' },
          }}
        >
          {value}
        </Typography>
      )}
      {(property.includes('color') || property === 'background') && /^(#|rgb|hsl)/.test(value) && (
        <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: value, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
      )}
      <Tooltip title="Copier" placement="left">
        <IconButton
          className="copy-style"
          size="small"
          onClick={() => navigator.clipboard.writeText(`${property}: ${value};`).catch(() => {})}
          sx={{ p: 0.25, color: '#8b8fa3', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
        >
          <ContentCopy size={10} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
    </Box>
  );
});
StyleRow.displayName = 'StyleRow';

// ─── StyleInspectorPanel ────────────────────────────────────────────────────

interface StyleInspectorPanelProps {
  selectedInfo: SelectedElementInfo | null;
  overriddenProps: Set<string>;
  customCssText: string;
  onCustomCssTextChange: (text: string) => void;
  onApplyCustomCss: () => void;
  onStyleEdit: (property: string, value: string) => void;
}

const StyleInspectorPanel: React.FC<StyleInspectorPanelProps> = ({
  selectedInfo,
  overriddenProps,
  customCssText,
  onCustomCssTextChange,
  onApplyCustomCss,
  onStyleEdit,
}) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onApplyCustomCss();
    }
  }, [onApplyCustomCss]);

  return (
    <Box sx={{ flex: 1, overflow: 'auto' }}>
      <Typography sx={{
        px: 1.5, py: 0.75, fontSize: 10, fontWeight: 700, color: '#8b8fa3',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        borderBottom: '1px solid #2a2d3a', bgcolor: '#151821',
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        Styles
      </Typography>

      {selectedInfo ? (
        <>
          {/* Selected element info */}
          <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #2a2d3a' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{
                fontSize: 12, fontFamily: '"SF Mono", monospace',
                color: '#E91E63', fontWeight: 600,
              }}>
                &lt;{selectedInfo.tag}&gt;
              </Typography>
              <Tooltip title="Copier le sélecteur">
                <IconButton
                  size="small"
                  onClick={() => {
                    const sel = selectedInfo.tag + (selectedInfo.classes.length > 0 ? `.${selectedInfo.classes.join('.')}` : '');
                    navigator.clipboard.writeText(sel).catch(() => {});
                  }}
                  sx={{ p: 0.25, color: '#8b8fa3' }}
                >
                  <ContentCopy size={12} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            </Box>
            {selectedInfo.classes.length > 0 && (
              <Typography sx={{ fontSize: 10, color: '#2E7D32', fontFamily: 'monospace', mt: 0.25 }}>
                .{selectedInfo.classes.join('.')}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, '&:hover .copy-path': { opacity: 1 } }}>
              <Typography sx={{ fontSize: 9, color: '#8b8fa3', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                {selectedInfo.path}
              </Typography>
              <Tooltip title="Copier le chemin">
                <IconButton
                  className="copy-path"
                  size="small"
                  onClick={() => navigator.clipboard.writeText(selectedInfo.path).catch(() => {})}
                  sx={{ p: 0.25, color: '#8b8fa3', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                >
                  <ContentCopy size={10} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Custom CSS editor block */}
          <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #2a2d3a', bgcolor: '#151821' }}>
            <Typography sx={{ fontSize: 10, fontFamily: '"SF Mono", monospace', color: '#E91E63', mb: 0.5 }}>
              {selectedInfo.tag}{selectedInfo.classes.length > 0 ? `.${selectedInfo.classes[0]}` : ''} {'{'}
            </Typography>
            <Box
              component="textarea"
              value={customCssText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onCustomCssTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="  color: red;&#10;  padding: 16px;"
              spellCheck={false}
              sx={{
                width: '100%', minHeight: 48, maxHeight: 120, resize: 'vertical',
                bgcolor: 'transparent', border: 'none', outline: 'none',
                color: '#a5d6ff', fontSize: 11, fontFamily: '"SF Mono", "Fira Code", monospace',
                lineHeight: 1.6, px: 1, py: 0.5,
                '&::placeholder': { color: '#3a3f52' },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 10, fontFamily: '"SF Mono", monospace', color: '#E91E63' }}>
                {'}'}
              </Typography>
              <Typography
                onClick={onApplyCustomCss}
                sx={{
                  fontSize: 9, color: '#635BFF', cursor: 'pointer', fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Appliquer (Ctrl+↵)
              </Typography>
            </Box>
          </Box>

          {/* Computed styles */}
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {Object.entries(selectedInfo.computedStyles).map(([prop, val]) => (
              <StyleRow
                key={prop}
                property={prop}
                value={val}
                isOverridden={overriddenProps.has(prop)}
                onEdit={onStyleEdit}
              />
            ))}
          </Box>
        </>
      ) : (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', mb: 1 }}><Mouse size={24} strokeWidth={1.75} color='#2a2d3a' /></Box>
          <Typography sx={{ fontSize: 11, color: '#8b8fa3' }}>
            Sélectionnez un élément
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default StyleInspectorPanel;
