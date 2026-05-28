import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, useTheme, alpha, useMediaQuery, CssBaseline, ThemeProvider } from '@mui/material';
import { createClenzyTheme } from '../../theme/createClenzyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import ClenzyMarkLogo from '../../components/ClenzyMarkLogo';

/**
 * Layout partage par les pages d'auth (Login, Inscription, mot de passe oublie).
 *
 * <h3>Design (2026)</h3>
 * Pattern split-screen B2B SaaS modern (cf. Linear, Vercel, Stripe Dashboard) :
 * <ul>
 *   <li><b>Desktop ≥md</b> : panneau brand a gauche (40%) + zone form a droite (60%).
 *       Le panneau brand contient un <b>carrousel marketing 8 slides</b> qui
 *       cycle toutes les 6s — chaque slide adresse un pain point different du
 *       host courte duree (revenue, time saved, scaling, 24/7 support, multi-
 *       channel sync, anomaly detection, compliance, sentiment proactif).</li>
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

// ─── Carrousel marketing : 8 slides cyclant automatiquement ────────────────

interface CarouselSlide {
  /** Texte d'intro avant le highlight (peut etre vide). */
  tagline: string;
  /** Phrase mise en exergue en couleur primary. */
  highlight: string;
  /** Texte court apres le highlight (typiquement la ponctuation). */
  end: string;
  /** Body texte de preuve / detail. */
  subtitle: string;
}

/**
 * Liste des 8 slides du carrousel marketing. Chaque slide adresse un pain
 * point ou benefice specifique aux hosts/gestionnaires de location courte
 * duree (cible Clenzy). Validees par l'user 2026-05-28.
 *
 * <p><b>TODO i18n</b> : actuellement hardcode en FR. Les utilisateurs hors-FR
 * voient le francais (acceptable V1, le marche prioritaire est FR/MAGHREB).
 * A migrer vers i18n keys auth.layout.slides[0..7].{tagline,highlight,end,subtitle}
 * quand les traductions EN/AR seront validees par un native speaker.</p>
 */
const SLIDES: CarouselSlide[] = [
  // ─── Hook benefit (1-2) ────────────────────────────────────────────────
  {
    tagline: 'Pendant que vous dormez,',
    highlight: '8 agents IA optimisent votre revenue par nuit',
    end: '.',
    subtitle: 'Pricing dynamique, messagerie guests multilingue, briefings quotidiens, sentiment analysis. La seule chose que vous gardez en main : la stratégie.',
  },
  {
    tagline: 'Récupérez',
    highlight: '12h par semaine. Sans embaucher',
    end: '.',
    subtitle: 'Vos agents IA pricent vos nuits, répondent aux guests, génèrent vos briefings du matin et alertent sur les anomalies. Vous reprenez le contrôle de votre temps.',
  },
  // ─── Emotional / 24/7 (3-4) ────────────────────────────────────────────
  {
    tagline: 'Vos guests servis à 3h du matin.',
    highlight: 'Sans vous réveiller',
    end: '.',
    subtitle: "Messagerie IA multilingue qui répond aux questions check-in, codes wifi, recommandations resto. Vous gérez les exceptions, l'IA gère la routine.",
  },
  {
    tagline: 'De 1 à 100 propriétés,',
    highlight: 'sans embaucher un seul gestionnaire',
    end: '.',
    subtitle: 'Architecture multi-agents qui scale linéairement. Pricing, messaging, analytics, briefings, sentiment — tout reste fluide quand votre portefeuille grossit.',
  },
  // ─── Onboarding speed (5) ──────────────────────────────────────────────
  {
    tagline: 'De zéro à',
    highlight: '1ère réservation en 24 heures',
    end: '.',
    subtitle: "Import automatique depuis Airbnb et Booking, descriptions générées par IA, photos analysées et notées. Setup en 15 minutes, première nuit vendue le lendemain. Pas 3 semaines comme chez les autres.",
  },
  // ─── Technical capability (6-7) ────────────────────────────────────────
  {
    tagline: 'Un seul calendrier.',
    highlight: 'Airbnb, Booking, Vrbo synchronisés en temps réel',
    end: '.',
    subtitle: 'Plus de double-booking. Plus de prix incohérents entre canaux. CalendarEngine source-of-truth, push instantané via outbox + Kafka. Robuste, fiable, prouvé.',
  },
  {
    tagline: '',
    highlight: "Anomalies détectées avant qu'elles ne coûtent",
    end: '.',
    subtitle: "Bruit dépassant les seuils, locker non rendu, lit non refait, prix sous la concurrence locale. L'IA scanne en continu, vous alerte avant que le guest le voie.",
  },
  // ─── Comparative differentiators (8-9) — attaque frontale vs concurrence
  {
    tagline: 'Vos contrats signés',
    highlight: 'en 30 secondes, sans quitter Clenzy',
    end: '.',
    subtitle: "Mandat de gestion, contrats de location courte durée, autorisations check-in. Signature électronique eIDAS intégrée nativement. Plus besoin de payer Yousign 39€/mois en parallèle.",
  },
  {
    tagline: '',
    highlight: 'API ouverte, données exportables en un clic',
    end: '.',
    subtitle: "Vos réservations, guests, finances, photos — tout exportable au format ouvert. Pas de lock-in. Connectez Notion, Slack, Make, Zapier. Là où Guesty vous emprisonne, Clenzy vous libère.",
  },
];

/** Duree d'affichage par slide en millisecondes. 6s = ~lecture confortable. */
const SLIDE_DURATION_MS = 6000;

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
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const primary = theme.palette.primary.main;

  // ─── State du carrousel ──────────────────────────────────────────────
  const [slideIndex, setSlideIndex] = useState(0);
  // Pause quand l'user hover le panel : permet de lire tranquillement sans
  // que le slide change pendant la lecture.
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Pas d'auto-cycle si l'user prefere reduced-motion : on affiche
    // seulement le slide 0 (au mount). Il peut toujours cliquer les dots.
    if (prefersReducedMotion || isPaused || !isMdUp) return;
    const id = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(id);
  }, [isPaused, prefersReducedMotion, isMdUp]);

  const current = SLIDES[slideIndex];

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
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
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
            <ClenzyMarkLogo scale={0.95} />
          </Box>

          {/* Centre : carrousel slide actuel + dots */}
          <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
            {/* Zone reservee de hauteur fixe pour eviter le layout shift
                quand on passe d'un slide court a un slide long. min-height
                calee sur le slide le plus haut (subtitle ~3 lignes). */}
            <Box sx={{ minHeight: 220 }}>
              {/* key={slideIndex} force le remount a chaque slide => l'animation
                  CSS fade-in se rejoue automatiquement. Approche tres simple
                  vs framer-motion pour ce cas (1 element a la fois). */}
              <Box
                key={slideIndex}
                sx={{
                  animation: prefersReducedMotion
                    ? 'none'
                    : 'auth-slide-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both',
                  '@keyframes auth-slide-in': {
                    from: { opacity: 0, transform: 'translateY(8px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
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
                  {current.tagline && (
                    <>
                      {/* Fallback i18n sur le slide 0 (les autres slides
                          sont hardcodes FR — cf. TODO sur SLIDES ci-dessus) */}
                      {slideIndex === 0
                        ? t('auth.layout.tagline', current.tagline)
                        : current.tagline}{' '}
                    </>
                  )}
                  <Box component="span" sx={{ color: primary }}>
                    {slideIndex === 0
                      ? t('auth.layout.taglineHighlight', current.highlight)
                      : current.highlight}
                  </Box>
                  {slideIndex === 0
                    ? t('auth.layout.taglineEnd', current.end)
                    : current.end}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.6,
                    fontSize: '0.95rem',
                  }}
                >
                  {slideIndex === 0
                    ? t('auth.layout.subtitle', current.subtitle)
                    : current.subtitle}
                </Typography>
              </Box>
            </Box>

            {/* Dots pagination : cliquables pour naviguer manuellement.
                Au click : reset le timer auto-cycle (l'effect se reabonne via
                la dependance slideIndex/isPaused). */}
            <Box
              role="tablist"
              aria-label="Slides marketing"
              sx={{
                display: 'flex',
                gap: 1,
                mt: 3,
                alignItems: 'center',
              }}
            >
              {SLIDES.map((_, i) => {
                const isActive = i === slideIndex;
                return (
                  <Box
                    key={i}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Slide ${i + 1} sur ${SLIDES.length}`}
                    onClick={() => setSlideIndex(i)}
                    sx={{
                      width: isActive ? 24 : 8,
                      height: 8,
                      borderRadius: 999,
                      border: 'none',
                      p: 0,
                      cursor: 'pointer',
                      bgcolor: isActive ? primary : alpha(primary, 0.25),
                      transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms',
                      '&:hover': {
                        bgcolor: isActive ? primary : alpha(primary, 0.45),
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${primary}`,
                        outlineOffset: 2,
                      },
                    }}
                  />
                );
              })}
            </Box>
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
              <ClenzyMarkLogo scale={0.85} />
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
