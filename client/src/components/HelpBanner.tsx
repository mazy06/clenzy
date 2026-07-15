import React, { useCallback, useEffect, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
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

/** Tokens sémantiques Signature par accent (couleur + fond -soft assorti). */
const ACCENT_TOKENS: Record<HelpStepAccent, { color: string; soft: string }> = {
  info: { color: 'var(--info)', soft: 'var(--info-soft)' },
  success: { color: 'var(--ok)', soft: 'var(--ok-soft)' },
  warning: { color: 'var(--warn)', soft: 'var(--warn-soft)' },
  error: { color: 'var(--err)', soft: 'var(--err-soft)' },
  primary: { color: 'var(--accent)', soft: 'var(--accent-soft)' },
  secondary: { color: 'var(--accent)', soft: 'var(--accent-soft)' },
  default: { color: 'var(--muted)', soft: 'var(--hover)' },
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

  return (
    <Box
      role="region"
      aria-label={title}
      sx={{
        position: 'relative',
        borderRadius: '14px',
        border: '1px solid var(--line)',
        mb: 1.5,
        p: { xs: 1.75, sm: 2.25 },
        overflow: 'hidden',
        bgcolor: 'var(--card)',
        // Single allowed filet — 1 px top accent (≤1px : pas un side-stripe).
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '1px',
          bgcolor: 'var(--accent)',
          opacity: 0.5,
        },
      }}
    >
      {/* Header row — accent chip + title + dismiss button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          mb: 0.75,
        }}
      >
        <Box
          sx={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            bgcolor: 'var(--accent-soft)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            borderRadius: '8px',
            px: 0.75,
            py: 0.25,
            mt: 0.25,
            flexShrink: 0,
            lineHeight: 1.2,
          }}
          aria-hidden
        >
          AIDE
        </Box>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.3,
            letterSpacing: '-.01em',
            flex: 1,
            textWrap: 'balance',
          }}
        >
          {title}
        </Typography>
        <IconButton
          size="small"
          onClick={handleDismiss}
          aria-label={dismissLabel}
          sx={{
            color: 'var(--faint)',
            p: 0.5,
            flexShrink: 0,
            '&:hover': { color: 'var(--ink)', bgcolor: 'var(--hover)' },
          }}
        >
          <CloseIcon size={16} strokeWidth={1.75} />
        </IconButton>
      </Box>

      {/* Description */}
      <Typography
        sx={{
          fontSize: '12.5px',
          color: 'var(--muted)',
          lineHeight: 1.55,
          mb: steps.length > 0 ? 2 : 0,
          maxWidth: '80ch',
        }}
      >
        {description}
      </Typography>

      {/* Steps — responsive grid, per-step accent breaks templating */}
      {steps.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: steps.length === 2 ? 'repeat(2, 1fr)' : '1fr',
              md: `repeat(${Math.min(steps.length, 4)}, 1fr)`,
            },
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {steps.map((step, i) => {
            const accentKey: HelpStepAccent
              = step.accent ?? DEFAULT_ACCENT_CYCLE[i % DEFAULT_ACCENT_CYCLE.length];
            const accent = ACCENT_TOKENS[accentKey];
            return (
              <Box
                key={step.title}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.125,
                  minWidth: 0,
                }}
              >
                {/* Small square icon — no big round badge over each heading */}
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: accent.soft,
                    color: accent.color,
                    flexShrink: 0,
                    mt: 0.125,
                  }}
                  aria-hidden
                >
                  {step.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: 'var(--ink)',
                      lineHeight: 1.25,
                      mb: 0.25,
                      textWrap: 'balance',
                      // Thin colored underline keeps each step's identity without a side-stripe.
                      display: 'inline-block',
                      borderBottom: `2px solid color-mix(in srgb, ${accent.color} 45%, transparent)`,
                      pb: 0.125,
                    }}
                  >
                    {step.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '11.5px',
                      color: 'var(--muted)',
                      lineHeight: 1.45,
                      mt: 0.25,
                    }}
                  >
                    {step.description}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default HelpBanner;
