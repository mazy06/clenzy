import { useState } from 'react';
import { cn } from '../../../../utils/cn';
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from '../../../../components/ui';
import { Plus, Pencil, X, House, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { SitePage } from '../../../../services/api/sitesApi';

/**
 * Barre d'onglets des pages du site (multi-page 2.2). Sélection, ajout, renommage (double-clic ou
 * crayon) et suppression (sauf page d'accueil). N'apparaît qu'en mode Éditer quand le multi-page
 * est disponible. Style aligné sur les segments du Studio (Baitly UI).
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
    <div className="flex items-center gap-0.5 px-1.5 h-[38px] shrink-0 border-b border-border bg-background overflow-x-auto">
      {pages.map((p, index) => {
        const active = p.id === selectedId;
        const isHome = p.type === 'HOME';
        const editing = editingId === p.id;
        const canLeft = index >= 2; // garde la page d'accueil (index 0) en tête
        const canRight = index >= 1 && index < pages.length - 1;
        return (
          <div className={cn('inline-flex items-center gap-[1.5px] h-[28px] ps-1.5 pe-[3px] shrink-0 rounded-lg border', active ? 'bg-card border-border shadow-sm' : 'bg-transparent border-transparent shadow-none')} key={p.id}>
            {isHome && <House size={13} strokeWidth={2} className="me-0.5 shrink-0 text-muted-foreground" />}
            {editing ? (
              // Champ de renommage inline : le gabarit du primitif (bordure, hauteur,
              // fond) est neutralise, l'onglet lui-meme porte deja le cadre.
              <Input
                autoFocus
                aria-label="Renommer la page"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                className="h-[22px] w-[120px] rounded-none border-0 bg-transparent px-0 py-0 shadow-none text-xs text-foreground focus-visible:ring-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                onDoubleClick={() => startRename(p)}
                className={cn(
                  'max-w-[160px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap bg-transparent border-0 p-0',
                  'text-xs transition-colors hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm',
                  active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                )}
              >
                {p.title || p.path}
              </button>
            )}
            {active && !editing && (
              <>
                {onMove && !isHome && canLeft && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={() => onMove(p.id, -1)} aria-label="Déplacer la page à gauche" className={TAB_ICON_CLASS}>
                        <ChevronLeft size={14} strokeWidth={2} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Déplacer à gauche</TooltipContent>
                  </Tooltip>
                )}
                {onMove && !isHome && canRight && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={() => onMove(p.id, 1)} aria-label="Déplacer la page à droite" className={TAB_ICON_CLASS}>
                        <ChevronRight size={14} strokeWidth={2} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Déplacer à droite</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => startRename(p)} aria-label="Renommer la page" className={TAB_ICON_CLASS}>
                      <Pencil size={12} strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Renommer</TooltipContent>
                </Tooltip>
                {!isHome && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={() => onDelete(p.id)} aria-label="Supprimer la page" className={TAB_ICON_CLASS}>
                        <X size={13} strokeWidth={2} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Supprimer</TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        );
      })}
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Un bouton desactive n'emet pas d'evenement de survol : l'enveloppe
              porte le declencheur a sa place. */}
          <span className="inline-flex shrink-0">
            <button
              type="button"
              onClick={onAdd}
              disabled={busy}
              aria-label="Ajouter une page"
              className={cn(TAB_ICON_CLASS, 'w-[28px] h-[28px] disabled:opacity-40')}
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Ajouter une page</TooltipContent>
      </Tooltip>

      {onReset && (
        <div className="inline-flex items-center gap-0.5 shrink-0 ms-0.5 ps-0.5 border-s border-border">
          {confirmReset ? (
            <>
              <div className="text-2xs text-muted-foreground whitespace-nowrap">Tout effacer ?</div>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() => { setConfirmReset(false); onReset(); }}
                className="h-[24px] cursor-pointer whitespace-nowrap text-2xs"
              >
                Oui, effacer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setConfirmReset(false)}
                className="h-[24px] cursor-pointer text-2xs"
              >
                Annuler
              </Button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setConfirmReset(true)}
                    disabled={busy}
                    className="h-[24px] shrink-0 cursor-pointer whitespace-nowrap text-2xs font-medium text-muted-foreground hover:text-destructive-ink"
                  >
                    <RotateCcw size={12} strokeWidth={2} /> Repartir de zéro
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Supprimer toutes les pages et repartir d&apos;une page d&apos;accueil vierge</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

const TAB_ICON_CLASS =
  'w-[22px] h-[22px] shrink-0 inline-flex items-center justify-center border-0 bg-transparent p-0 ' +
  'rounded-md text-muted-foreground cursor-pointer transition-colors ' +
  'hover:bg-muted hover:text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
