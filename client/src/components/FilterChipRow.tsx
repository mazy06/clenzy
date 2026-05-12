import React from 'react';
import { Box, Chip } from '@mui/material';

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
 * Pattern PMS soft-filled :
 *  - Inactif : bg pastel `${color}18`, bordure `${color}40`, texte `color`
 *  - Actif   : bg plein `color`, texte blanc, badge inverse
 *
 * Le compteur (chip dans le chip) reprend la couleur du parent et bascule
 * sur fond blanc translucide quand l'option est active.
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
          <Chip
            key={opt.value || '__all__'}
            label={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                {opt.label}
                {opt.count !== undefined && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: compact ? '0.5625rem' : '0.625rem',
                      fontWeight: 700,
                      px: 0.5,
                      py: 0.05,
                      borderRadius: 0.75,
                      bgcolor: active ? 'rgba(255,255,255,0.25)' : `${opt.color}28`,
                      color: active ? '#fff' : opt.color,
                    }}
                  >
                    {opt.count}
                  </Box>
                )}
              </Box>
            }
            onClick={() => onChange(active ? '' : (opt.value as T | ''))}
            size="small"
            sx={{
              height: compact ? 22 : 26,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: compact ? '0.6875rem' : '0.75rem',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              backgroundColor: active ? opt.color : `${opt.color}18`,
              color: active ? '#fff' : opt.color,
              border: `1px solid ${active ? opt.color : `${opt.color}40`}`,
              '& .MuiChip-label': { px: compact ? 0.6 : 0.75 },
              '&:hover': {
                backgroundColor: active ? opt.color : `${opt.color}28`,
              },
            }}
          />
        );
      })}
    </Box>
  );
}
