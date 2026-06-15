import { useState } from 'react';
import { Box, ButtonBase, InputBase, Tooltip } from '@mui/material';
import { Plus, Pencil, X, House, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SitePage } from '../../../../services/api/sitesApi';

/**
 * Barre d'onglets des pages du site (multi-page 2.2). Sélection, ajout, renommage (double-clic ou
 * crayon) et suppression (sauf page d'accueil). N'apparaît qu'en mode Éditer quand le multi-page
 * est disponible (cf. DesignBuilder). Style aligné sur les segments du builder (tokens var(--*)).
 */

export interface PagesBarProps {
  pages: SitePage[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, dir: -1 | 1) => void;
  busy?: boolean;
}

export default function PagesBar({ pages, selectedId, onSelect, onAdd, onRename, onDelete, onMove, busy }: PagesBarProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const startRename = (p: SitePage) => { setEditingId(p.id); setDraft(p.title ?? ''); };
  const commitRename = () => {
    if (editingId != null) {
      const t = draft.trim();
      if (t) onRename(editingId, t);
    }
    setEditingId(null);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, height: 38, flexShrink: 0, borderBottom: '1px solid var(--line)', bgcolor: 'var(--bg)', overflowX: 'auto' }}>
      {pages.map((p, index) => {
        const active = p.id === selectedId;
        const isHome = p.type === 'HOME';
        const editing = editingId === p.id;
        const canLeft = index >= 2; // garde la page d'accueil (index 0) en tête
        const canRight = index >= 1 && index < pages.length - 1;
        return (
          <Box
            key={p.id}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.25, height: 28, pl: 1, pr: 0.5, flexShrink: 0,
              borderRadius: 'var(--radius-md)',
              bgcolor: active ? 'var(--card)' : 'transparent',
              border: active ? '1px solid var(--line)' : '1px solid transparent',
              boxShadow: active ? 'var(--shadow-card)' : 'none',
            }}
          >
            {isHome && <House size={13} strokeWidth={2} style={{ color: 'var(--muted)', marginRight: 2 }} />}
            {editing ? (
              <InputBase
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                sx={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', width: 120, '& input': { p: 0 } }}
              />
            ) : (
              <ButtonBase
                onClick={() => onSelect(p.id)}
                onDoubleClick={() => startRename(p)}
                sx={{
                  fontSize: 'var(--text-sm)', cursor: 'pointer', maxWidth: 160,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  '&:hover': { color: 'var(--ink)' },
                }}
              >
                {p.title || p.path}
              </ButtonBase>
            )}
            {active && !editing && (
              <>
                {onMove && !isHome && canLeft && (
                  <Tooltip title="Déplacer à gauche">
                    <ButtonBase onClick={() => onMove(p.id, -1)} aria-label="Déplacer la page à gauche" sx={tabIconSx}>
                      <ChevronLeft size={14} strokeWidth={2} />
                    </ButtonBase>
                  </Tooltip>
                )}
                {onMove && !isHome && canRight && (
                  <Tooltip title="Déplacer à droite">
                    <ButtonBase onClick={() => onMove(p.id, 1)} aria-label="Déplacer la page à droite" sx={tabIconSx}>
                      <ChevronRight size={14} strokeWidth={2} />
                    </ButtonBase>
                  </Tooltip>
                )}
                <Tooltip title="Renommer">
                  <ButtonBase onClick={() => startRename(p)} aria-label="Renommer la page" sx={tabIconSx}>
                    <Pencil size={12} strokeWidth={2} />
                  </ButtonBase>
                </Tooltip>
                {!isHome && (
                  <Tooltip title="Supprimer">
                    <ButtonBase onClick={() => onDelete(p.id)} aria-label="Supprimer la page" sx={tabIconSx}>
                      <X size={13} strokeWidth={2} />
                    </ButtonBase>
                  </Tooltip>
                )}
              </>
            )}
          </Box>
        );
      })}
      <Tooltip title="Ajouter une page">
        <ButtonBase onClick={onAdd} disabled={busy} aria-label="Ajouter une page" sx={{ ...tabIconSx, width: 28, height: 28, '&.Mui-disabled': { opacity: 0.4 } }}>
          <Plus size={16} strokeWidth={2} />
        </ButtonBase>
      </Tooltip>
    </Box>
  );
}

const tabIconSx = {
  width: 22, height: 22, borderRadius: 'var(--radius-sm)', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--muted)', cursor: 'pointer',
  '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
} as const;
