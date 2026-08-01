import React from 'react';
import { Box } from '@mui/material';
import StatusChip, { type ToneTokens } from './StatusChip';

/**
 * Actif = teinte accent pleine, inactif = fond transparent + encre discrete.
 * Pas de `outlined` : le pattern .s-subtab n'a jamais de bordure visible, meme
 * au repos.
 */
const ACTIVE_TOKENS: ToneTokens = { color: 'var(--accent)', bg: 'var(--accent-soft)' };
const IDLE_TOKENS: ToneTokens = { color: 'var(--muted)', bg: 'transparent' };

/**
 * Un filtre individuel dans FilterChipRow.
 */
export interface FilterChipOption<T extends string = string> {
  /** Identifiant unique (utilise pour l'etat actif et la cle React). */
  value: T;
  /** Libelle visible. */
  label: string;
  /** Couleur de marque (hex). Genere automatiquement bg pastel + bordure. */
  color: string;
  /** Optionnel : compteur affiche en badge dans le chip. */
  count?: number;
}

interface FilterChipRowProps<T extends string> {
  options: FilterChipOption<T>[];
  /** Option active, '' = aucun filtre. */
  value: T | '';
  /** Appele a chaque changement de filtre. Passe '' si l'option active est re-cliquee. */
  onChange: (value: T | '') => void;
  /** Si fourni, ajoute une option 'Tous' en tete avec ce libelle. */
  allLabel?: string;
  /** Compteur affiche dans l'option 'Tous'. */
  allCount?: number;
  /** Couleur du chip 'Tous'. Default : couleur neutre (gris-bleu). */
  allColor?: string;
  /** Densite visuelle. 'compact' = chip 22px (pour header), 'comfortable' = 26px (autonome). */
  size?: 'compact' | 'comfortable';
  /** Espacement entre chips (px en unites theme). Default : 0.5. */
  gap?: number;
}

/**
 * Rangee de chips de filtres avec etat actif/inactif et compteur optionnel.
 *
 * Pattern Signature .s-subtab :
 *  - Inactif : texte var(--muted), fond transparent, hover bg var(--hover)
 *  - Actif   : bg var(--accent-soft), texte var(--accent)
 *
 * La prop `color` reste acceptee (compat API) mais l'accent visuel vient des
 * tokens. Le compteur passe en pastille var(--accent) quand l'option est active.
 *
 * Usage :
 *   <FilterChipRow
 *     options={[
 *       { value: 'active',  label: 'Actif',     color: '#10b981', count: 3 },
 *       { value: 'pending', label: 'En attente', color: '#f59e0b', count: 1 },
 *     ]}
 *     value={statusFilter}
 *     onChange={setStatusFilter}
 *     allLabel="Tous"
 *     allCount={contracts.length}
 *     size="compact"
 *   />
 */
export default function FilterChipRow<T extends string>({
  options,
  value,
  onChange,
  allLabel,
  allCount,
  allColor = '#6B7280',
  size = 'comfortable',
  gap = 0.5,
}: FilterChipRowProps<T>) {
  const all: FilterChipOption<'' >[] = allLabel
    ? [{ value: '' as const, label: allLabel, color: allColor, count: allCount }]
    : [];
  const items = [...all, ...options];
  const compact = size === 'compact';

  return (
    <Box sx={{ display: 'flex', gap, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((opt) => {
        const active = value === opt.value;
        return (
          <StatusChip
            key={opt.value || '__all__'}
            tokens={active ? ACTIVE_TOKENS : IDLE_TOKENS}
            label={
              <span className="inline-flex items-center gap-0.5">
                {opt.label}
                {opt.count !== undefined && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: compact ? '0.5625rem' : '0.625rem',
                      fontWeight: 700,
                      px: 0.5,
                      py: 0.05,
                      borderRadius: 'var(--radius-pill)',
                      bgcolor: active ? 'var(--accent)' : 'var(--hover)',
                      color: active ? 'var(--on-accent)' : 'var(--muted)',
                    }}
                  >
                    {opt.count}
                  </Box>
                )}
              </span>
            }
            pressed={active}
            onClick={() => onChange(active ? '' : (opt.value as T | ''))}
            className={[
              'transition-colors',
              compact ? '' : 'h-[26px] text-[0.75rem]',
              active ? '' : 'hover:bg-[var(--hover)] hover:text-[var(--body)]',
            ].filter(Boolean).join(' ')}
          />
        );
      })}
    </Box>
  );
}
