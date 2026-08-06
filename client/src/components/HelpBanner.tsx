import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '../utils/cn';
import { Button } from './ui';
import { Close as CloseIcon } from '../icons';
import { useUserPreference } from '../hooks/useUserPreference';

/**
 * Semantic colour for a help step. Determines the icon badge tint, the title accent,
 * and the small underline beneath the step title. Lets a single banner mix several
 * statuses (e.g. PENDING/SENT/FAILED) without falling into the "3 identical cards"
 * antipattern.
 */
export type HelpStepAccent =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'primary'
  | 'secondary'
  | 'default';

export interface HelpStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Optional — when omitted the banner cycles through a 3-tone palette so steps stay distinct. */
  accent?: HelpStepAccent;
}

interface HelpBannerProps {
  storageKey: string;
  title: string;
  description: string;
  steps: HelpStep[];
  dismissLabel?: string;
}

/** Auto-cycle palette when the caller doesn't pass an explicit accent per step. */
const DEFAULT_ACCENT_CYCLE: HelpStepAccent[] = ['info', 'success', 'warning', 'primary', 'secondary'];

/**
 * Tokens sémantiques Baitly UI par accent (teinte vive + fond `-soft` assorti).
 * L'accent est résolu à l'exécution : ces valeurs alimentent des styles inline,
 * une classe Tailwind ne peut pas naître d'une variable. La teinte vive sert
 * uniquement d'aplat d'icône et de filet — jamais de couleur de texte.
 */
const ACCENT_TOKENS: Record<HelpStepAccent, { color: string; soft: string }> = {
  info: { color: 'var(--bui-info)', soft: 'var(--bui-info-soft)' },
  success: { color: 'var(--bui-success)', soft: 'var(--bui-success-soft)' },
  warning: { color: 'var(--bui-warning)', soft: 'var(--bui-warning-soft)' },
  error: { color: 'var(--bui-destructive)', soft: 'var(--bui-destructive-soft)' },
  primary: { color: 'var(--bui-primary)', soft: 'var(--bui-primary-soft)' },
  secondary: { color: 'var(--bui-primary)', soft: 'var(--bui-primary-soft)' },
  default: { color: 'var(--bui-muted-foreground)', soft: 'var(--bui-muted)' },
};

/**
 * Grille d'étapes partagée entre le bandeau ({@link HelpBanner}) et le popover
 * ({@link HelpPopover}). Chaque step a son accent sémantique (passé ou
 * auto-attribué via le cycle) — pas d'identical-card-grid, petit carré coloré
 * au lieu d'un icon-badge rond, filet 2 px sous le titre au lieu d'un
 * side-stripe. `columns` borne le nombre de colonnes md (le popover reste sur
 * une colonne pour une lecture verticale confortable).
 */
export const HelpStepsGrid: React.FC<{ steps: HelpStep[]; columns?: number }> = ({ steps, columns }) => {
  if (steps.length === 0) return null;
  const maxCols = columns ?? Math.min(steps.length, 4);
  // Le gabarit de colonnes depend du nombre d'etapes (donc de l'execution) : il
  // passe par des custom properties, les ruptures restent des variantes statiques.
  const smCols = maxCols >= 2 && steps.length === 2 ? 'repeat(2, 1fr)' : '1fr';
  const mdCols = `repeat(${Math.max(1, Math.min(steps.length, maxCols))}, 1fr)`;
  return (
    <div
      className="grid grid-cols-1 gap-[9px] min-[600px]:grid-cols-[var(--help-sm-cols)] min-[900px]:grid-cols-[var(--help-md-cols)] min-[900px]:gap-3"
      style={{ '--help-sm-cols': smCols, '--help-md-cols': mdCols } as React.CSSProperties}
    >
      {steps.map((step, i) => {
        const accentKey: HelpStepAccent
          = step.accent ?? DEFAULT_ACCENT_CYCLE[i % DEFAULT_ACCENT_CYCLE.length];
        const accent = ACCENT_TOKENS[accentKey];
        return (
          <div className="flex items-start gap-1.5 min-w-0" key={step.title}>
            {/* Small square icon — no big round badge over each heading */}
            <div className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center shrink-0 mt-[0.75px]" style={{ backgroundColor: accent.soft, color: accent.color }} aria-hidden>
              {step.icon}
            </div>
            <div className="min-w-0">
              {/* Thin colored underline keeps each step's identity without a side-stripe.
                  Le filet depend de l'accent resolu a l'execution : une classe Tailwind ne
                  peut pas en naitre, il reste donc en style inline. */}
              <p
                className="m-0 mb-[1.5px] text-[12.5px] font-bold text-foreground leading-[1.25] [text-wrap:balance] inline-block pb-[0.75px]"
                style={{ borderBottom: `2px solid color-mix(in srgb, ${accent.color} 45%, transparent)` }}
              >
                {step.title}
              </p>
              <p className="m-0 mt-0.5 text-[11.5px] text-muted-foreground leading-[1.45]">
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Inline informational banner — used on admin / accounting / sync pages to teach the
 * user what a complex feature does. Dismissable per `storageKey` via backend prefs
 * (cf. UserUiPreferencesProvider) — la decision "j'ai compris cette aide" est
 * portable cross-devices via la table `user_ui_preferences`.
 *
 * <h2>Design rules applied</h2>
 * <ul>
 *   <li>Pas d'icon-badge rond au-dessus de chaque heading (Impeccable ban) — petit carré
 *   coloré 6 px de radius à la place.</li>
 *   <li>Pas d'identical card grid — chaque step a son propre accent sémantique (passé via
 *   `accent` ou auto-attribué).</li>
 *   <li>Filet 1 px en haut (single allowed accent), pas de side-stripe.</li>
 *   <li>Soft brand wash (radial primary 4%) au lieu d'un fond cyan AI-slop.</li>
 *   <li>Chip "AIDE" en pattern soft pour signaler la nature informationnelle.</li>
 *   <li>`text-wrap: balance` sur les titres, `prefers-reduced-motion` sur les transitions.</li>
 * </ul>
 *
 * @param storageKey identifiant unique du banner (ex: `payouts_help`). Sera persiste
 *                   sous la cle `help.<storageKey>` dans user_ui_preferences. Le prefixe
 *                   legacy `clenzy_*_dismissed` est strippe automatiquement pour ne pas
 *                   polluer les cles backend.
 */
const HelpBanner: React.FC<HelpBannerProps> = ({
  storageKey,
  title,
  description,
  steps,
  dismissLabel = 'Ne plus afficher',
}) => {
  // Nettoyer le prefixe legacy `clenzy_` et le suffixe `_dismissed` pour
  // produire une cle backend lisible (ex: `clenzy_payouts_help_dismissed`
  // -> `help.payouts`). Backward-compat : on accepte les anciennes cles
  // brutes pour ne pas casser des callers eventuels.
  const normalized = storageKey
    .replace(/^clenzy_/, '')
    .replace(/_dismissed$/, '')
    .replace(/_help$/, '');
  const prefKey = `help.${normalized}`;

  const [dismissed, setDismissed, { isLoaded }] = useUserPreference<boolean>(prefKey, false);

  // Migration legacy (BUG-4) : si l'user avait dismissed le banner via
  // l'ancienne implementation localStorage (pre-deploy P3), on migre la
  // valeur vers le backend une seule fois et on cleanup la cle locale.
  //
  // Gate sur `isLoaded` pour eviter une race : si on migrate avant la reponse
  // backend, l'optimistic update peut etre ecrase par les vraies donnees
  // backend (qui pourraient contenir un dismissed=false explicite que l'user
  // a re-active sur un autre device).
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (migrationDoneRef.current || !isLoaded) return;
    if (dismissed) {
      migrationDoneRef.current = true;
      // Si backend = true mais localStorage legacy traine encore, cleanup
      try { localStorage.removeItem(storageKey); } catch { /* noop */ }
      return;
    }
    try {
      if (localStorage.getItem(storageKey) === '1') {
        migrationDoneRef.current = true;
        setDismissed(true);
        localStorage.removeItem(storageKey);
      } else {
        migrationDoneRef.current = true;
      }
    } catch {
      migrationDoneRef.current = true;
    }
  }, [isLoaded, dismissed, storageKey, setDismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, [setDismissed]);

  if (dismissed) return null;

  // before:* — le seul filet autorise, accent 1 px en haut (<=1px : pas un side-stripe).
  return (
    <div
      role="region"
      aria-label={title}
      className="relative rounded-[14px] border border-solid border-border mb-[9px] p-[10.5px] min-[600px]:p-[13.5px] overflow-hidden bg-card before:content-[''] before:absolute before:top-0 before:inset-x-0 before:h-px before:bg-primary before:opacity-50"
    >
      {/* Header row — accent chip + title + dismiss button */}
      <div className="flex items-start gap-1.5 mb-1">
        <div className="text-[10.5px] font-bold tracking-[.06em] uppercase text-primary bg-primary-soft border border-solid border-primary/25 rounded-[8px] px-[4.5px] py-[1.5px] mt-[1.5px] shrink-0 leading-[1.2]" aria-hidden>
          AIDE
        </div>
        <p className="m-0 [font-family:var(--font-display)] text-[15px] font-semibold text-foreground leading-[1.3] tracking-[-.01em] flex-1 [text-wrap:balance]">
          {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          aria-label={dismissLabel}
          className="text-faint hover:text-foreground hover:bg-muted"
        >
          <CloseIcon size={16} strokeWidth={1.75} />
        </Button>
      </div>

      {/* Description */}
      <p className={cn('m-0 text-[12.5px] text-muted-foreground leading-[1.55] max-w-[80ch]', steps.length > 0 ? 'mb-3' : 'mb-0')}>
        {description}
      </p>

      {/* Steps — responsive grid, per-step accent breaks templating */}
      <HelpStepsGrid steps={steps} />
    </div>
  );
};

export default HelpBanner;
