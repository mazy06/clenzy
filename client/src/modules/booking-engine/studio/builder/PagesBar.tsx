import { useState } from 'react';
import { cn } from '../../../../utils/cn';
import { ButtonBase, InputBase, Tooltip } from '@mui/material';
import { Plus, Pencil, X, House, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { SitePage } from '../../../../services/api/sitesApi';

/**
 * Barre d'onglets des pages du site (multi-page 2.2). Sélection, ajout, renommage (double-clic ou
 * crayon) et suppression (sauf page d'accueil). N'apparaît qu'en mode Éditer quand le multi-page
 * est disponible. Style aligné sur les segments du Studio (tokens var(--*)).
 */

export interface PagesBarProps {
  pages: SitePage[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onMove?: (id: number, dir: -1 | 1) => void;
  /** Repartir de zéro : supprime toutes les pages sauf une accueil vierge (confirmation inline). */
  onReset?: () => void;
  busy?: boolean;
}

export default function PagesBar({ pages, selectedId, onSelect, onAdd, onRename, onDelete, onMove, onReset, busy }: PagesBarProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const startRename = (p: SitePage) => { setEditingId(p.id); setDraft(p.title ?? ''); };
  const commitRename = () => {
    if (editingId != null) {
      const t = draft.trim();
      if (t) onRename(editingId, t);
    }
    setEditingId(null);
  };

  return (
    <div className="flex items-center gap-0.5 px-1.5 h-[38px] shrink-0 border-b border-[var(--line)] bg-[var(--bg)] overflow-x-auto">
      {pages.map((p, index) => {
        const active = p.id === selectedId;
        const isHome = p.type === 'HOME';
        const editing = editingId === p.id;
        const canLeft = index >= 2; // garde la page d'accueil (index 0) en tête
        const canRight = index >= 1 && index < pages.length - 1;
        return (
          <div className={cn('inline-flex items-center gap-[1.5px] h-[28px] ps-1.5 pe-[3px] shrink-0 rounded-[var(--radius-md)]', active ? 'bg-[var(--card)]' : 'bg-[transparent]', active ? 'border border-solid border-[var(--line)]' : 'border border-solid border-[transparent]')} style={{ boxShadow: active ? 'var(--shadow-card)' : 'none' }} key={p.id}>
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
          </div>
        );
      })}
      <Tooltip title="Ajouter une page">
        <ButtonBase onClick={onAdd} disabled={busy} aria-label="Ajouter une page" sx={{ ...tabIconSx, width: 28, height: 28, '&.Mui-disabled': { opacity: 0.4 } }}>
          <Plus size={16} strokeWidth={2} />
        </ButtonBase>
      </Tooltip>

      {onReset && (
        <div className="inline-flex items-center gap-0.5 shrink-0 ms-0.5 ps-0.5 border-s border-[var(--line)]">
          {confirmReset ? (
            <>
              <div className="text-[var(--text-2xs)] text-[var(--muted)] whitespace-nowrap">Tout effacer ?</div>
              <ButtonBase
                onClick={() => { setConfirmReset(false); onReset(); }}
                sx={{ height: 24, px: 1, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--on-accent)', bgcolor: 'var(--err, #C97A7A)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Oui, effacer
              </ButtonBase>
              <ButtonBase
                onClick={() => setConfirmReset(false)}
                sx={{ height: 24, px: 1, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-2xs)', color: 'var(--body)', border: '1px solid var(--line)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)' } }}
              >
                Annuler
              </ButtonBase>
            </>
          ) : (
            <Tooltip title="Supprimer toutes les pages et repartir d'une page d'accueil vierge">
              <ButtonBase
                onClick={() => setConfirmReset(true)}
                disabled={busy}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 24, px: 1, flexShrink: 0,
                  borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-medium)',
                  color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap',
                  '&:hover': { color: 'var(--err, #C97A7A)', bgcolor: 'var(--hover)' },
                  '&.Mui-disabled': { opacity: 0.4 },
                }}
              >
                <RotateCcw size={12} strokeWidth={2} /> Repartir de zéro
              </ButtonBase>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

const tabIconSx = {
  width: 22, height: 22, borderRadius: 'var(--radius-sm)', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--muted)', cursor: 'pointer',
  '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
} as const;
