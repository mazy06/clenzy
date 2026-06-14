import { useEffect, useMemo, useRef, useState } from 'react';
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, height: 52, borderBottom: '1px solid var(--line)' }}>
          <Box component="span" sx={{ color: 'var(--muted)', display: 'inline-flex' }}><Search size={18} strokeWidth={2} /></Box>
          <InputBase
            inputRef={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            fullWidth
            sx={{ fontSize: 'var(--text-lg)', color: 'var(--ink)', '& input::placeholder': { color: 'var(--faint)', opacity: 1 } }}
          />
        </Box>

        <Box ref={listRef} role="listbox" sx={{ maxHeight: 340, overflowY: 'auto', py: 0.75 }}>
          {filtered.length === 0 && (
            <Box sx={{ px: 2, py: 3, textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
              Aucun résultat
            </Box>
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
                {Icon && <Box component="span" sx={{ display: 'inline-flex', color: isActive ? 'var(--accent)' : 'var(--muted)' }}><Icon size={16} strokeWidth={2} /></Box>}
                <Box component="span" sx={{ flex: 1, fontSize: 'var(--text-md)' }}>{c.label}</Box>
                {c.group && <Box component="span" sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)' }}>{c.group}</Box>}
                {isActive && <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}><CornerDownLeft size={13} strokeWidth={2} /></Box>}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Modal>
  );
}
