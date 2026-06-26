/* ============================================================
   Primitives partagées des renderers de Generative UI (supervision).

   Volontairement local au dossier `agui/renderers/` : ce sont des écrans
   de spike isolés, on évite tout couplage cross-module. Design system
   Clenzy via tokens CSS (var(--card), var(--ink), …) — dark/light OK.
   ============================================================ */
import React from 'react';
import { Box, Typography } from '@mui/material';

/** Couleurs accent Clenzy validées (réutilisées par le bar chart & les chips). */
export const CLENZY_SERIES_COLORS = ['#4A9B8E', '#D4A574', '#6B8A9A', '#C97A7A', '#7BA3C2'];

/** Carte de surface standard (hairline, plate, pas d'ombre au repos). */
export const SurfaceCard: React.FC<{ children: React.ReactNode; sx?: object }> = ({
  children,
  sx,
}) => (
  <Box
    sx={{
      mt: 1,
      mb: 1.5,
      p: 1.5,
      borderRadius: '12px',
      border: '1px solid var(--line)',
      bgcolor: 'var(--card)',
      ...sx,
    }}
  >
    {children}
  </Box>
);

/** Titre overline discret (10.5px, uppercase, --faint). */
export const Overline: React.FC<{ children: React.ReactNode; sx?: object }> = ({
  children,
  sx,
}) => (
  <Typography
    sx={{
      display: 'block',
      fontSize: '10.5px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '.05em',
      color: 'var(--faint)',
      ...sx,
    }}
  >
    {children}
  </Typography>
);

/** Carte d'erreur discrète (le LLM explique dans son texte). */
export const ErrorCard: React.FC<{ message?: string }> = ({ message }) => (
  <Box
    sx={{
      mt: 1,
      mb: 1.5,
      px: 1.5,
      py: 1.25,
      borderRadius: '10px',
      border: '1px solid var(--err)',
      bgcolor: 'var(--err-soft)',
    }}
  >
    <Typography sx={{ fontSize: '12.5px', color: 'var(--err)', fontWeight: 500 }}>
      {message && message.trim() !== '' ? message : 'L’outil a échoué.'}
    </Typography>
  </Box>
);

/** État « en cours » uniforme pendant l'exécution du tool. */
export const PendingHint: React.FC<{ label: string }> = ({ label }) => (
  <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', py: 0.5 }}>{label}…</Typography>
);

/** Pastille de statut colorée (réservations, interventions, jours…). */
export const StatusChip: React.FC<{ label: string; tone?: 'ok' | 'warn' | 'err' | 'neutral' }> = ({
  label,
  tone = 'neutral',
}) => {
  const map = {
    ok: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
    warn: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
    err: { fg: 'var(--err)', bg: 'var(--err-soft)' },
    neutral: { fg: 'var(--muted)', bg: 'var(--field)' },
  }[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: '2px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        color: map.fg,
        bgcolor: map.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
};

// ─── Formatters ──────────────────────────────────────────────────────────────

/** Symbole de devise compact pour les codes ISO courants. */
function currencySymbol(code?: string): string {
  switch ((code ?? '').toUpperCase()) {
    case 'EUR':
      return '€';
    case 'USD':
      return '$';
    case 'GBP':
      return '£';
    case 'MAD':
      return 'MAD';
    case 'SAR':
      return 'SAR';
    default:
      return code ?? '';
  }
}

/** Montant formaté fr-FR + symbole devise (ex: "1 200,50 €"). */
export function formatMoney(value: unknown, currency?: string): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (value === null || value === undefined || Number.isNaN(num)) return '—';
  const formatted = num.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const sym = currencySymbol(currency);
  return sym ? `${formatted} ${sym}` : formatted;
}

/** Date ISO (YYYY-MM-DD ou complète) → "JJ/MM" compact. */
export function formatDateShort(iso: unknown): string {
  if (typeof iso !== 'string' || iso.trim() === '') return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Statut technique → libellé lisible (SNAKE_CASE → "snake case"). */
export function humanizeStatus(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/_/g, ' ').toLowerCase();
}

/** Clé camelCase → libellé ("guestName" → "Guest name"). */
export function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** Mappe un statut métier à une teinte de StatusChip. */
export function statusTone(status: unknown): 'ok' | 'warn' | 'err' | 'neutral' {
  const s = String(status ?? '').toUpperCase();
  if (['OK', 'CONFIRMED', 'PAID', 'DONE', 'COMPLETED', 'AVAILABLE'].includes(s)) return 'ok';
  if (['WARNING', 'PENDING', 'IN_PROGRESS', 'PARTIAL'].includes(s)) return 'warn';
  if (['CRITICAL', 'CANCELLED', 'ERROR', 'FAILED', 'BLOCKED', 'OVERDUE'].includes(s)) return 'err';
  return 'neutral';
}
