import React from 'react';
import {
  Box, Typography, IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material';
import {
  Close, Mouse, Smartphone, Tablet, DesktopWindows, Undo, Redo, Save,
  ViewSidebar,
} from '@mui/icons-material';
import { ViewportPreset } from './types';
import { overridesToCSS } from './helpers';
import { CSSOverride } from './types';

interface ViewportToolbarProps {
  inspectMode: boolean;
  onToggleInspect: () => void;
  viewport: ViewportPreset;
  onViewportChange: (preset: ViewportPreset) => void;
  historyIdx: number;
  historyLength: number;
  onUndo: () => void;
  onRedo: () => void;
  overrides: CSSOverride[];
  onCssChange?: (css: string) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onClose?: () => void;
}

const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
  inspectMode,
  onToggleInspect,
  viewport,
  onViewportChange,
  historyIdx,
  historyLength,
  onUndo,
  onRedo,
  overrides,
  onCssChange,
  panelOpen,
  onTogglePanel,
  onClose,
}) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
    bgcolor: '#1a1d27', borderBottom: '1px solid #2a2d3a',
  }}>
    {/* Inspect toggle */}
    <Tooltip title={inspectMode ? 'Désactiver l\'inspection' : 'Activer l\'inspection'}>
      <IconButton
        size="small"
        onClick={onToggleInspect}
        sx={{
          color: inspectMode ? '#635BFF' : '#8b8fa3',
          bgcolor: inspectMode ? 'rgba(99,91,255,0.15)' : 'transparent',
          '&:hover': { bgcolor: inspectMode ? 'rgba(99,91,255,0.2)' : 'rgba(255,255,255,0.05)' },
        }}
      >
        <Mouse sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>

    <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2d3a', mx: 0.5 }} />

    {/* Responsive presets */}
    <ToggleButtonGroup
      value={viewport}
      exclusive
      onChange={(_, v) => v && onViewportChange(v)}
      size="small"
      sx={{
        '& .MuiToggleButton-root': {
          color: '#8b8fa3', border: 'none', px: 1, py: 0.5,
          '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
        },
      }}
    >
      <ToggleButton value="full"><Typography sx={{ fontSize: 11 }}>Auto</Typography></ToggleButton>
      <ToggleButton value="mobile"><Smartphone sx={{ fontSize: 16 }} /></ToggleButton>
      <ToggleButton value="tablet"><Tablet sx={{ fontSize: 16 }} /></ToggleButton>
      <ToggleButton value="desktop"><DesktopWindows sx={{ fontSize: 16 }} /></ToggleButton>
    </ToggleButtonGroup>

    <Box sx={{ flex: 1 }} />

    {/* Undo / Redo */}
    <Tooltip title="Annuler (Ctrl+Z)">
      <span>
        <IconButton size="small" onClick={onUndo} disabled={historyIdx <= 0} sx={{ color: '#8b8fa3' }}>
          <Undo sx={{ fontSize: 16 }} />
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip title="Rétablir (Ctrl+Y)">
      <span>
        <IconButton size="small" onClick={onRedo} disabled={historyIdx >= historyLength - 1} sx={{ color: '#8b8fa3' }}>
          <Redo sx={{ fontSize: 16 }} />
        </IconButton>
      </span>
    </Tooltip>

    {overrides.length > 0 && (
      <Typography sx={{ fontSize: 10, color: '#635BFF', fontWeight: 600 }}>
        {overrides.length} modification{overrides.length > 1 ? 's' : ''}
      </Typography>
    )}

    {/* Save */}
    {overrides.length > 0 && (
      <Tooltip title="Enregistrer les modifications CSS">
        <IconButton
          size="small"
          onClick={() => {
            const css = overridesToCSS(overrides);
            onCssChange?.(css);
          }}
          sx={{
            color: '#4CAF50',
            bgcolor: 'rgba(76,175,80,0.1)',
            '&:hover': { bgcolor: 'rgba(76,175,80,0.2)' },
          }}
        >
          <Save sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    )}

    <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2d3a', mx: 0.5 }} />

    {/* Toggle panel */}
    <Tooltip title={panelOpen ? 'Masquer le panneau' : 'Afficher le panneau'}>
      <IconButton
        size="small"
        onClick={onTogglePanel}
        sx={{
          color: panelOpen ? '#635BFF' : '#8b8fa3',
          bgcolor: panelOpen ? 'rgba(99,91,255,0.15)' : 'transparent',
          '&:hover': { bgcolor: panelOpen ? 'rgba(99,91,255,0.2)' : 'rgba(255,255,255,0.05)' },
        }}
      >
        <ViewSidebar sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>

    {/* Close */}
    <Tooltip title="Fermer">
      <IconButton size="small" onClick={onClose} sx={{ color: '#8b8fa3', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
        <Close sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  </Box>
);

export default ViewportToolbar;
