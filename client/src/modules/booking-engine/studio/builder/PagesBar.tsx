import { useState } from 'react';
import { cn } from '../../../../utils/cn';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  Input, Tooltip, TooltipContent, TooltipTrigger,
} from '../../../../components/ui';
import { Plus, Pencil, X, House, ChevronLeft, ChevronRight, RotateCcw, Check, Files, ChevronDown } from 'lucide-react';
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

  const selected = pages.find((p) => p.id === selectedId) ?? pages[0];

  return (
    <div className="flex items-center gap-0.5 px-1.5 h-[38px] shrink-0 border-b border-border bg-background overflow-x-auto">
      {/* Sous 900 px : un SEUL declencheur en icone, qui deplie la liste des
          pages. La rangee d'onglets demandait la largeur d'un ecran de bureau —
          elle debordait, et les onglets se faisaient couper par son defilement.
          Renommer, deplacer et supprimer restent des gestes de bureau : ils
          vivent sur les onglets, que cette liste ne remplace qu'a l'etroit. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Page — ${selected?.title ?? 'Accueil'}`}
            className={cn(
              'inline-flex h-[28px] max-w-[46vw] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border',
              'bg-card px-2 text-xs font-semibold text-foreground shadow-sm transition-colors duration-150',
              'hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'min-[900px]:hidden',
            )}
          >
            <Files size={14} strokeWidth={2} className="shrink-0 text-muted-foreground" />
            {/* Le nom de la page COURANTE : une icone seule ne dit pas ou l'on est,
                et c'est la seule chose que la rangee d'onglets disait encore ici. */}
            <span className="min-w-0 truncate">{selected?.title || selected?.path || 'Accueil'}</span>
            <ChevronDown size={14} strokeWidth={2} className="shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52 max-w-[min(18rem,90vw)]">
          {pages.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => onSelect(p.id)}
              className={cn('min-h-9 cursor-pointer gap-2', p.id === selectedId && 'font-medium text-foreground')}
            >
              {p.type === 'HOME'
                ? <House size={14} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                : <span aria-hidden className="size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{p.title || p.path}</span>
              {p.id === selectedId && <Check size={14} strokeWidth={2} className="shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => onAdd()} disabled={busy} className="min-h-9 cursor-pointer gap-2 text-muted-foreground">
            <Plus size={14} strokeWidth={2} className="shrink-0" />
            Ajouter une page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden items-center gap-0.5 min-[900px]:flex">
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
      </div>

      {/* Ajouter / repartir de zero : gestes de bureau. Sur telephone, « Ajouter
          une page » vit dans la liste deroulante ci-dessus ; « Repartir de zero »
          est destructif et n'a rien a faire a portee de pouce dans une barre. */}
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Un bouton desactive n'emet pas d'evenement de survol : l'enveloppe
              porte le declencheur a sa place. */}
          <span className="hidden shrink-0 min-[900px]:inline-flex">
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
        <div className="hidden items-center gap-0.5 shrink-0 ms-0.5 ps-0.5 border-s border-border min-[900px]:inline-flex">
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
