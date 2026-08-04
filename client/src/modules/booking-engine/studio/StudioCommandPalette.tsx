import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui';
import { Search, CornerDownLeft, type LucideIcon } from 'lucide-react';

/**
 * Palette de commandes ⌘K du Baitly Studio (F0) : recherche + navigation clavier (↑↓, Entrée, Échap).
 * Sans dépendance externe. Tokens « Baitly Signature ».
 */

export interface StudioCommand {
  id: string;
  label: string;
  group?: string;
  keywords?: string;
  icon?: LucideIcon;
  run: () => void;
}

export interface StudioCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: StudioCommand[];
  placeholder?: string;
}

export default function StudioCommandPalette({
  open,
  onClose,
  commands,
  placeholder = 'Rechercher une commande, une section…',
}: StudioCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.keywords ?? '').toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Reset à l'ouverture + focus.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // focus différé (le Modal monte le contenu après le render)
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Clamp l'index actif quand la liste filtrée change.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[active];
      if (cmd) {
        onClose();
        cmd.run();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Ancree haut d'ecran (14 %) et non centree : on neutralise le centrage
          vertical du gabarit. Pas de bouton de fermeture — Echap suffit. */}
      <DialogContent
        showCloseButton={false}
        onKeyDown={handleKeyDown}
        className="top-[14%] translate-y-0 w-[min(560px,92vw)] max-w-none overflow-hidden rounded-[var(--radius-lg)] border border-solid border-[var(--line)] bg-[var(--card)] p-0 text-[var(--ink)] shadow-[var(--shadow-pop)]"
      >
        <DialogTitle className="sr-only">Palette de commandes</DialogTitle>
        <div className="flex items-center gap-1.5 px-2.5 h-[52px] border-b border-solid border-[var(--line)]">
          <span className="text-[var(--muted)] inline-flex"><Search size={18} strokeWidth={2} /></span>
          {/* input natif (et non le primitif Input) pour DEUX raisons : le champ
              est nu dans une rangee deja filetee, et `inputRef` porte le focus a
              l'ouverture — une fonction React 18 ne transmet pas de ref. */}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full min-w-0 flex-1 border-0 bg-transparent outline-none text-[length:var(--text-lg)] text-[var(--ink)] placeholder:text-[var(--faint)] placeholder:opacity-100"
          />
        </div>

        <div className="max-h-[340px] overflow-y-auto py-1" ref={listRef} role="listbox">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-[var(--muted)] text-[var(--text-sm)]">
              Aucun résultat
            </div>
          )}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            const isActive = i === active;
            return (
              // gap 1.25 = 7.5px, mx 0.75 = 4.5px, px 1.25 = 7.5px (theme.spacing = 6)
              <div
                key={c.id}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(i)}
                onClick={() => { onClose(); c.run(); }}
                className={cn(
                  'flex items-center gap-[7.5px] mx-[4.5px] px-[7.5px] h-[40px] rounded-[var(--radius-md)] cursor-pointer',
                  isActive ? 'bg-[var(--accent-soft)] text-[var(--ink)]' : 'bg-transparent text-[var(--body)]',
                )}
              >
                {Icon && <span className={cn('inline-flex', isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}><Icon size={16} strokeWidth={2} /></span>}
                <span className="flex-1 text-[var(--text-md)]">{c.label}</span>
                {c.group && <span className="text-[var(--text-2xs)] text-[var(--faint)]">{c.group}</span>}
                {isActive && <span className="inline-flex text-[var(--faint)]"><CornerDownLeft size={13} strokeWidth={2} /></span>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
