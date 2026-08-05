/* ============================================================
   Primitives partagées des renderers de Generative UI (supervision).

   Volontairement local au dossier `agui/renderers/` : ce sont des écrans
   de spike isolés, on évite tout couplage cross-module. Peinture Baitly UI
   (utilities sémantiques `bg-card`, `border-border`, `text-foreground`,
   `text-muted-foreground`…) — clair / sombre OK.
   ============================================================ */
import React from 'react';

import { Alert, AlertDescription, Badge, Spinner } from '../../../../components/ui';
import { Warning } from '../../../../icons';
import { cn } from '../../../../utils/cn';

/**
 * Palette de séries du bar chart. Jetons graphiques Baitly (`--bui-chart-*`)
 * plutôt que des hex figés : ils portent déjà leur variante sombre.
 */
export const CLENZY_SERIES_COLORS = [
  'var(--bui-chart-1)',
  'var(--bui-chart-2)',
  'var(--bui-chart-3)',
  'var(--bui-chart-4)',
  'var(--bui-chart-5)',
];

/** Carte de surface standard (hairline, plate, pas d'ombre au repos). */
export const SurfaceCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('mt-1.5 mb-2 rounded-xl border border-border bg-card p-3', className)}>
    {children}
  </div>
);

/** Titre overline discret (uppercase, encre secondaire). */
export const Overline: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  // <span> et non <p> : sans preflight Tailwind, un paragraphe porterait la
  // marge par defaut du navigateur, que le Typography MUI annulait.
  <span
    className={cn(
      'block text-2xs font-semibold uppercase tracking-wide text-muted-foreground',
      className,
    )}
  >
    {children}
  </span>
);

/** Carte d'erreur discrète (le LLM explique dans son texte). */
export const ErrorCard: React.FC<{ message?: string }> = ({ message }) => (
  <Alert variant="destructive" className="mt-1.5 mb-2">
    <Warning />
    <AlertDescription>
      {message && message.trim() !== '' ? message : 'L’outil a échoué.'}
    </AlertDescription>
  </Alert>
);

/** État « en cours » uniforme pendant l'exécution du tool. */
export const PendingHint: React.FC<{ label: string }> = ({ label }) => (
  <p className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
    <Spinner className="size-3" />
    {label}…
  </p>
);

/**
 * Pastille de statut colorée (réservations, interventions, jours…).
 * Couple `-soft` / `-ink` : la teinte vive en texte plafonne à ~2,2:1.
 */
const CHIP_TONE_CLASSES = {
  ok: 'bg-success-soft text-success-ink border-transparent',
  warn: 'bg-warning-soft text-warning-ink border-transparent',
  err: 'bg-destructive-soft text-destructive-ink border-transparent',
  neutral: 'bg-muted text-muted-foreground border-transparent',
} as const;

export const StatusChip: React.FC<{ label: string; tone?: 'ok' | 'warn' | 'err' | 'neutral' }> = ({
  label,
  tone = 'neutral',
}) => (
  <Badge variant="secondary" className={CHIP_TONE_CLASSES[tone]}>
    {label}
  </Badge>
);

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
