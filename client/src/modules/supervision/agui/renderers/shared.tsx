/* ============================================================
   Primitives partagées des renderers de Generative UI (supervision).

   Volontairement local au dossier `agui/renderers/` : ce sont des écrans
   de spike isolés, on évite tout couplage cross-module. Design system
   Clenzy via tokens CSS (var(--card), var(--ink), …) — dark/light OK.
   ============================================================ */
import React from 'react';

/** Couleurs accent Clenzy validées (réutilisées par le bar chart & les chips). */
export const CLENZY_SERIES_COLORS = ['#4A9B8E', '#D4A574', '#6B8A9A', '#C97A7A', '#7BA3C2'];

/**
 * Le prop `sx` de `SurfaceCard` / `Overline` est l'API que neuf renderers
 * voisins alimentent — dont certains avec les raccourcis d'espacement MUI
 * (`mb: 1`, `pr: 1.5`). En style inline ces raccourcis ne veulent rien dire :
 * cette traduction les convertit (spacing du projet = 6 px), et laisse passer
 * telle quelle toute propriete CSS deja valide (`borderColor`, `textAlign`…).
 * Elle disparaitra le jour ou les neuf appelants passeront a des classes.
 */
const MUI_SPACING_PX = 6;

const SPACING_SHORTHANDS: Record<string, readonly string[]> = {
  m: ['margin'],
  mt: ['marginTop'],
  mb: ['marginBottom'],
  ml: ['marginLeft'],
  mr: ['marginRight'],
  mx: ['marginLeft', 'marginRight'],
  my: ['marginTop', 'marginBottom'],
  p: ['padding'],
  pt: ['paddingTop'],
  pb: ['paddingBottom'],
  pl: ['paddingLeft'],
  pr: ['paddingRight'],
  px: ['paddingLeft', 'paddingRight'],
  py: ['paddingTop', 'paddingBottom'],
};

function sxToStyle(sx?: object): React.CSSProperties {
  if (!sx) return {};
  const style: Record<string, unknown> = {};
  Object.entries(sx as Record<string, unknown>).forEach(([key, value]) => {
    const cibles = SPACING_SHORTHANDS[key];
    if (cibles) {
      const valeur = typeof value === 'number' ? `${value * MUI_SPACING_PX}px` : value;
      cibles.forEach((cible) => { style[cible] = valeur; });
      return;
    }
    style[key] = value;
  });
  return style as React.CSSProperties;
}

/** Carte de surface standard (hairline, plate, pas d'ombre au repos). */
export const SurfaceCard: React.FC<{ children: React.ReactNode; sx?: object }> = ({
  children,
  sx,
}) => (
  <div
    className="mt-1.5 mb-[9px] p-[9px] rounded-[12px] border border-solid border-[var(--line)] bg-[var(--card)]"
    style={sxToStyle(sx)}
  >
    {children}
  </div>
);

/** Titre overline discret (10.5px, uppercase, --faint). */
export const Overline: React.FC<{ children: React.ReactNode; sx?: object }> = ({
  children,
  sx,
}) => (
  // <span> et non <p> : sans preflight Tailwind, un paragraphe porterait la
  // marge par defaut du navigateur, que le Typography MUI annulait.
  <span
    className="block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]"
    style={sxToStyle(sx)}
  >
    {children}
  </span>
);

/** Carte d'erreur discrète (le LLM explique dans son texte). */
export const ErrorCard: React.FC<{ message?: string }> = ({ message }) => (
  <div className="mt-1.5 mb-2 px-2 py-2 rounded-[10px] border border-[var(--err)] bg-[var(--err-soft)]">
    <p className="cn-text-body1 text-[12.5px] text-[var(--err)] font-medium">
      {message && message.trim() !== '' ? message : 'L’outil a échoué.'}
    </p>
  </div>
);

/** État « en cours » uniforme pendant l'exécution du tool. */
export const PendingHint: React.FC<{ label: string }> = ({ label }) => (
  <p className="cn-text-body1 text-[12.5px] text-[var(--muted)] py-0.5">{label}…</p>
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
    <span className="inline-flex items-center px-[4.5px] py-0.5 rounded-[6px] text-[11px] font-semibold whitespace-nowrap" style={{ color: map.fg, backgroundColor: map.bg }}>
      {label}
    </span>
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
