import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Box, InputBase, Modal } from '@mui/material';
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
    <Modal open={open} onClose={onClose} aria-label="Palette de commandes" sx={{ '& .MuiBackdrop-root': { bgcolor: 'rgba(21,36,45,.45)' } }}>
      <Box
        sx={{
          position: 'absolute',
          top: '14%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(560px, 92vw)',
          bgcolor: 'var(--card)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-pop)',
          overflow: 'hidden',
          outline: 'none',
          animation: 'studioCmdIn .18s var(--ease-out)',
          '@keyframes studioCmdIn': {
            from: { opacity: 0, transform: 'translateX(-50%) translateY(-6px)' },
            to: { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
          },
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-1.5 px-2.5 h-[52px] border-b border-[var(--line)]">
          <span className="text-[var(--muted)] inline-flex"><Search size={18} strokeWidth={2} /></span>
          <InputBase
            inputRef={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            fullWidth
            sx={{ fontSize: 'var(--text-lg)', color: 'var(--ink)', '& input::placeholder': { color: 'var(--faint)', opacity: 1 } }}
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
              <Box
                key={c.id}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(i)}
                onClick={() => { onClose(); c.run(); }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  mx: 0.75,
                  px: 1.25,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--body)',
                  bgcolor: isActive ? 'var(--accent-soft)' : 'transparent',
                  ...(isActive && { color: 'var(--ink)' }),
                }}
              >
                {Icon && <span className={cn('inline-flex', isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}><Icon size={16} strokeWidth={2} /></span>}
                <span className="flex-1 text-[var(--text-md)]">{c.label}</span>
                {c.group && <span className="text-[var(--text-2xs)] text-[var(--faint)]">{c.group}</span>}
                {isActive && <span className="inline-flex text-[var(--faint)]"><CornerDownLeft size={13} strokeWidth={2} /></span>}
              </Box>
            );
          })}
        </div>
      </Box>
    </Modal>
  );
}
