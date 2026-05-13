import type { SxProps, Theme } from '@mui/material';

/**
 * Génère un objet `sx` pour appliquer une entrée en stagger sur les enfants
 * d'une liste (cards, lignes de table, tuiles KPI).
 *
 * Pose une animation `clz-fade-in-up` (définie en `MuiCssBaseline` globale)
 * avec un delay incrémental — chaque item entre 30ms après le précédent,
 * avec un cap à 12 items pour éviter de dépasser ~400ms total (limite
 * perçue de "réactif").
 *
 * Respect automatique de `prefers-reduced-motion` via la règle globale du
 * theme (`animationDuration: 0.01ms`).
 *
 * @example
 * ```tsx
 * {items.map((item, idx) => (
 *   <Card key={item.id} sx={useStaggerStyle(idx)}>
 *     ...
 *   </Card>
 * ))}
 * ```
 *
 * Note : volontairement pas un Hook React (pas d'état), juste une fonction
 * pure — pas de re-render overhead, pas de règle des hooks à respecter.
 */
export function staggerStyle(index: number, opts?: {
  stepMs?: number;
  maxItems?: number;
  durationMs?: number;
  axis?: 'y' | 'fade';
}): SxProps<Theme> {
  const stepMs = opts?.stepMs ?? 30;
  const maxItems = opts?.maxItems ?? 12;
  const durationMs = opts?.durationMs ?? 280;
  const axis = opts?.axis ?? 'y';
  const cappedIndex = Math.min(index, maxItems);
  const delayMs = cappedIndex * stepMs;
  const animation = axis === 'y' ? 'clz-fade-in-up' : 'clz-fade-in';
  return {
    animation: `${animation} ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both`,
  };
}

/**
 * Alias hook-style pour les composants qui préfèrent l'API hook.
 * (Note : aucun état React, équivalent à staggerStyle().)
 */
export function useStaggerStyle(index: number, opts?: Parameters<typeof staggerStyle>[1]) {
  return staggerStyle(index, opts);
}
