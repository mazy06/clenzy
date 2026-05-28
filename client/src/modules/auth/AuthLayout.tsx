import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, useTheme, alpha, useMediaQuery, CssBaseline, ThemeProvider } from '@mui/material';
import { createClenzyTheme } from '../../theme/createClenzyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import ClenzyAnimatedLogo from '../../components/ClenzyAnimatedLogo';

/**
 * Layout partage par les pages d'auth (Login, Inscription, mot de passe oublie).
 *
 * <h3>Design (2026)</h3>
 * Pattern split-screen B2B SaaS modern (cf. Linear, Vercel, Stripe Dashboard) :
 * <ul>
 *   <li><b>Desktop ≥md</b> : panneau brand a gauche (40%) + zone form a droite (60%).
 *       Le panneau gauche est minimaliste (pas de gradient cyan/lavande AI-slop),
 *       juste un fond tinted subtle avec dot pattern + logo + tagline + footer
 *       discret. La zone form a droite est sur fond {@code background.paper}
 *       pour maximiser le contraste et le focus sur l'action.</li>
 *   <li><b>Mobile</b> : panneau brand disparait, seul le form reste centre avec
 *       un logo compact en haut pour preserver l'identite.</li>
 * </ul>
 *
 * <h3>Anti-patterns evites (Impeccable + Clenzy)</h3>
 * <ul>
 *   <li>Pas de linear-gradient agressif (interdit absolu : gradients cyan,
 *       purple, lavande "AI-slop")</li>
 *   <li>Pas de glassmorphism / backdrop-filter blur (interdit defaut)</li>
 *   <li>Pas de carte flottante avec ombre exageree</li>
 *   <li>Pas de side-stripe colore</li>
 *   <li>Pure brand uniquement (pas de stock photo placeholder)</li>
 * </ul>
 */
export interface AuthLayoutProps {
  /** Contenu central : form, stepper, etc. La largeur max est geree par le layout. */
  children: React.ReactNode;
  /**
   * Largeur max du form a droite. Le defaut convient au login simple ; pour
   * inscription multi-etapes wide, passer une valeur plus large.
   */
  maxFormWidth?: number | string;
}

export default function AuthLayout({ children, maxFormWidth = 440 }: AuthLayoutProps) {
  // Geo-detected language : ces pages NE respectent PAS les preferences user.
  // Logique business : pays arabes -> ar, France/Maghreb -> fr, autres -> en.
  // Hook override l'i18n au mount + restore au unmount.
  const { isRtl } = useGeoAuthLanguage();
  const theme = useMemo(() => createClenzyTheme({ isDark: false, isRtl }), [isRtl]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthLayoutInner maxFormWidth={maxFormWidth}>{children}</AuthLayoutInner>
    </ThemeProvider>
  );
}

function AuthLayoutInner({ children, maxFormWidth }: AuthLayoutProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const primary = theme.palette.primary.main;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        bgcolor: 'background.paper',
      }}
    >
      {/* ── PANNEAU BRAND (desktop) ─────────────────────────────────────── */}
      {isMdUp && (
        <Box
          sx={{
            flex: '0 0 42%',
            minWidth: 420,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 6,
            bgcolor: alpha(primary, 0.04),
            // Subtle dot pattern : texture qui apporte de la profondeur
            // sans tomber dans le "gradient AI" lavande/cyan
            backgroundImage: `radial-gradient(${alpha(primary, 0.12)} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0',
            overflow: 'hidden',
          }}
        >
          {/* Accent decoratif top-right : cercle radial diffus, brand color */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: -120,
              right: -120,
              width: 360,
              height: 360,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(primary, 0.18)}, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          {/* Header : logo */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <ClenzyAnimatedLogo scale={0.95} />
          </Box>

          {/* Centre : tagline + proof */}
          <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
                color: 'text.primary',
                textWrap: 'balance',
                mb: 2,
              }}
            >
              {t('auth.layout.tagline', 'Le PMS pensé pour les')}{' '}
              <Box component="span" sx={{ color: primary }}>
                {t('auth.layout.taglineHighlight', 'propriétaires et gestionnaires indépendants')}
              </Box>
              {t('auth.layout.taglineEnd', '.')}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.6,
                fontSize: '0.95rem',
              }}
            >
              {t(
                'auth.layout.subtitle',
                'Gestion multi-propriétés, channels, paiements, équipes et automatisations IA — dans un seul outil souverain européen.',
              )}
            </Typography>
          </Box>

          {/* Footer : trust signals discrets */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <TrustItem dot={primary} label={t('auth.layout.trustEurope', 'Hébergé en Europe')} />
              <TrustItem dot={primary} label={t('auth.layout.trustCompliance', 'NF 525 / RGPD')} />
              <TrustItem dot={primary} label={t('auth.layout.trustSupport', 'Support 7j/7')} />
            </Box>
          </Box>
        </Box>
      )}

      {/* ── ZONE FORM ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 5, md: 6 },
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: maxFormWidth,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Logo compact en haut sur mobile (le panneau brand est cache) */}
          {!isMdUp && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <ClenzyAnimatedLogo scale={0.85} />
            </Box>
          )}

          {children}
        </Box>
      </Box>
    </Box>
  );
}

/** Trust signal compact pour le footer du panneau brand. */
function TrustItem({ dot, label }: { dot: string; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          bgcolor: dot,
          opacity: 0.6,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
