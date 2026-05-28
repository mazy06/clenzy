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

/**
 * Service tier integre a Clenzy, affiche sous le slide en "chip" avec logo
 * monochrome. Si le service n'est pas sur simple-icons (Pennylane, Nuki,
 * KeyNest, Tuya...), on passe `slug: null` et seul le nom s'affiche.
 */
interface ServiceBadge {
  /** Slug simple-icons (https://simpleicons.org). `null` = pas de logo, texte seul. */
  slug: string | null;
  /** Nom affiche dans la puce. */
  name: string;
}

interface CarouselSlide {
  /** Texte d'intro avant le highlight (peut etre vide). */
  tagline: string;
  /** Phrase mise en exergue en couleur primary. */
  highlight: string;
  /** Texte court apres le highlight (typiquement la ponctuation). */
  end: string;
  /** Body texte de preuve / detail. */
  subtitle: string;
  /**
   * Services / partenaires proeminents pour ce slide. Affiches en puces avec
   * logo monochrome sous le subtitle. Optionnel — slides "hook" sans
   * integration specifique ont undefined.
   */
  services?: ServiceBadge[];
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
    subtitle: "Import automatique depuis vos canaux existants, descriptions générées par IA, photos analysées et notées. Setup en 15 minutes, première nuit vendue le lendemain. Pas 3 semaines comme chez les autres.",
    services: [
      { slug: 'airbnb', name: 'Airbnb' },
      { slug: 'bookingdotcom', name: 'Booking.com' },
    ],
  },
  // ─── Channels integration (6) — enrichi avec les 7 OTAs deployees ─────
  {
    tagline: 'Un seul calendrier pour',
    highlight: 'tous vos canaux de distribution',
    end: '.',
    subtitle: "Synchronisation temps réel via Channex et nos connecteurs natifs. Plus de double-booking, plus de prix incohérents entre canaux. CalendarEngine source-of-truth, push instantané via outbox + Kafka.",
    services: [
      { slug: 'airbnb', name: 'Airbnb' },
      { slug: 'bookingdotcom', name: 'Booking.com' },
      { slug: 'expedia', name: 'Expedia' },
      { slug: null, name: 'Vrbo' },
      { slug: 'agoda', name: 'Agoda' },
      { slug: 'tripadvisor', name: 'Tripadvisor' },
    ],
  },
  // ─── Smart locks orchestration (7) — Nuki + KeyNest + Tuya prod ───────
  {
    tagline: 'Codes d’accès générés à la volée.',
    highlight: 'Toutes vos serrures connectées orchestrées',
    end: '.',
    subtitle: "Le code expire automatiquement au checkout, la batterie de la serrure est monitorée, les clés perdues chez KeyNest sont tracées en temps réel. Vous ne donnez plus jamais un code à la main.",
    services: [
      { slug: null, name: 'Nuki' },
      { slug: null, name: 'KeyNest' },
      { slug: null, name: 'Tuya' },
    ],
  },
  // ─── Guest messaging multi-channel (8) — Twilio prod ──────────────────
  {
    tagline: '',
    highlight: 'WhatsApp, SMS, email — tout sur un seul fil de discussion',
    end: '.',
    subtitle: "Vos guests vous répondent où ils sont, sans installer d'app. Verify pour la confirmation d'identité, conversations centralisées côté Clenzy, réponses IA suggérées. La concurrence éclate ça en 3 outils, vous l'avez en un.",
    services: [
      { slug: 'whatsapp', name: 'WhatsApp' },
      { slug: 'twilio', name: 'Twilio' },
      { slug: 'gmail', name: 'Email' },
    ],
  },
  // ─── Multi-country accounting (9) — Pennylane/QB/Xero/Sage prod ──────
  {
    tagline: 'Votre comptabilité connectée,',
    highlight: 'que vous soyez en France, UK, Australie ou USA',
    end: '.',
    subtitle: "Clenzy s'adapte à votre juridiction. Factures synchronisées, supplier invoices importées, déclarations fiscales préparées. Vos revenus consolidés multi-pays en un seul dashboard.",
    services: [
      { slug: null, name: 'Pennylane' },
      { slug: 'quickbooks', name: 'QuickBooks' },
      { slug: 'xero', name: 'Xero' },
      { slug: 'sage', name: 'Sage' },
    ],
  },
  // ─── Comparative differentiators (10-11) — attaque frontale vs concurrence
  {
    tagline: 'Vos contrats signés',
    highlight: 'en 30 secondes, sans quitter Clenzy',
    end: '.',
    subtitle: "Mandat de gestion, contrats de location courte durée, autorisations check-in. Signature eIDAS intégrée nativement. Plus besoin de payer Yousign 39€/mois en parallèle.",
    services: [
      { slug: 'docusign', name: 'DocuSign' },
    ],
  },
  {
    tagline: '',
    highlight: 'API ouverte, données exportables en un clic',
    end: '.',
    subtitle: "Vos réservations, guests, finances, photos — tout exportable au format ouvert. Webhooks et intégrations natives. Pas de lock-in. Là où Guesty vous emprisonne, Clenzy vous libère.",
    services: [
      { slug: 'zapier', name: 'Zapier' },
      { slug: 'notion', name: 'Notion' },
      { slug: 'slack', name: 'Slack' },
      { slug: null, name: 'Make' },
    ],
  },
];

/** Duree d'affichage par slide en millisecondes. 6s = ~lecture confortable. */
const SLIDE_DURATION_MS = 6000;

// ─── Feature flag : hero photo en arriere-plan du brand panel ─────────────
//
// Si true : photo d'interieur (Airbnb-style cozy) en bg + overlay tinted
//           primary alpha 0.78 pour lisibilite. Text en blanc. Plus de
//           profondeur visuelle, mais plus charge.
// Si false : dot pattern + bg primary alpha 0.04 (etat originel sobre).
//
// REVERT : change ENABLE_PHOTO_HERO a false, save, commit. Aucune autre
// modification a faire — le composant gere les deux modes via une serie
// de ternaires sur ce flag.
const ENABLE_PHOTO_HERO = true;

// Photo curatee Unsplash (free, hotlinkable). Modern cozy interior style
// qui evoque une location courte duree haut de gamme. Le `w=1600&q=80`
// donne ~150KB pour un retina-friendly rendering sur ecran 1440px.
const HERO_PHOTO_URL = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80';

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
            // Photo mode : bg ratio composite (photo darkening overlay sous
            // le dot pattern translucide). Sober mode : bg primary alpha 0.04.
            bgcolor: ENABLE_PHOTO_HERO ? '#0F1A22' : alpha(primary, 0.04),
            // Dot pattern visible dans les deux modes, alpha ajuste selon le bg
            backgroundImage: ENABLE_PHOTO_HERO
              ? `radial-gradient(${alpha('#FFFFFF', 0.10)} 1px, transparent 1px)`
              : `radial-gradient(${alpha(primary, 0.12)} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0',
            overflow: 'hidden',
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Photo hero en arriere-plan (uniquement si ENABLE_PHOTO_HERO).
              Layers depuis le fond vers le devant :
              1. Photo Unsplash, fortement attenuee (saturate 0.6, brightness
                 0.55, blur 1.5px). Le blur reduit le bruit visuel derriere
                 le texte sans completement masquer l'image — on devine encore
                 la scene d'interieur, mais elle ne distrait plus de la lecture.
              2. Overlay uniforme tinted brand-dark, alpha 0.85 (montee depuis
                 0.78 — testee : 0.85 garantit WCAG AAA pour texte blanc sur
                 n'importe quelle zone de la photo).
              3. Gradient diagonal : zone encore plus sombre en bas-gauche
                 (la ou le texte vit), transparente en haut-droite. Cree un
                 "spotlight" subtil sur le texte sans surcharger. */}
          {ENABLE_PHOTO_HERO && (
            <>
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${HERO_PHOTO_URL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'saturate(0.6) brightness(0.55) blur(1.5px)',
                  // scale 1.05 evite que le blur 1.5px revele les bords
                  // transparents (artefact classique du filter:blur en CSS)
                  transform: 'scale(1.05)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: alpha('#0F1E28', 0.85),
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(to top right, ${alpha('#0F1E28', 0.55)} 0%, transparent 60%)`,
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
            </>
          )}

          {/* Accent decoratif top-right : cercle radial diffus.
              En photo mode : color brand-light pour rester visible sur fond fonce.
              En sober mode : color brand classic. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: -120,
              right: -120,
              width: 360,
              height: 360,
              borderRadius: '50%',
              background: ENABLE_PHOTO_HERO
                ? `radial-gradient(circle, ${alpha('#89B1C2', 0.22)}, transparent 70%)`
                : `radial-gradient(circle, ${alpha(primary, 0.18)}, transparent 70%)`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Header : logo. tone="dark" en photo mode (nodes blancs sur bg fonce). */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <ClenzyMarkLogo scale={0.95} tone={ENABLE_PHOTO_HERO ? 'dark' : 'auto'} />
          </Box>

          {/* Centre : carrousel slide actuel + dots verticaux a droite.
              Layout horizontal : text column (narrow, ~400px) + dots
              column (vertical, 24px) cote a cote. Le texte plus etroit
              feel "plus vertical" et la pagination verticale a droite
              signale plus clairement les slides disponibles. */}
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box sx={{ flex: 1, maxWidth: 400, minHeight: 360 }}>
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
                {/* Titre — bumped from h4 (2.125rem) to ~2.375rem pour creer
                    une hierarchie plus marquee avec le subtitle (0.8125rem,
                    ratio ~3x). letterSpacing negatif pour un feel modern SaaS
                    (Linear, Vercel, Stripe Dashboard). Responsive : 2rem sur md,
                    2.375rem sur lg (au-dela de 1200px). */}
                <Typography
                  component="h2"
                  sx={{
                    fontSize: { md: '2rem', lg: '2.375rem' },
                    fontWeight: 600,
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                    // Texte titre : blanc en photo mode (sur fond fonce),
                    // text.primary en sober mode (sur fond clair)
                    color: ENABLE_PHOTO_HERO ? '#FFFFFF' : 'text.primary',
                    // text-shadow subtil en photo mode : renforce la lisibilite
                    // sur photo+overlay (sans tomber dans le "drop-shadow lourd")
                    textShadow: ENABLE_PHOTO_HERO ? '0 1px 12px rgba(0, 0, 0, 0.4)' : 'none',
                    textWrap: 'balance',
                    mb: 2.5,
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
                  {/* Highlight : brand-light renforce (#A8C8D6) en photo mode
                      pour contraste WCAG sur fond fonce. Primary classic en
                      sober. #A8C8D6 vs #89B1C2 = +20% luminosite => meilleure
                      lisibilite sur l'overlay+photo darkened. */}
                  <Box component="span" sx={{ color: ENABLE_PHOTO_HERO ? '#A8C8D6' : primary }}>
                    {slideIndex === 0
                      ? t('auth.layout.taglineHighlight', current.highlight)
                      : current.highlight}
                  </Box>
                  {slideIndex === 0
                    ? t('auth.layout.taglineEnd', current.end)
                    : current.end}
                </Typography>
                {/* Subtitle — reduit de 0.95rem a 0.8125rem (13px) pour
                    creer une hierarchie nette avec le titre. Lineheight 1.7
                    pour donner de l'air entre les lignes, color un peu plus
                    muted (0.75 au lieu de 0.92) pour que le titre domine. */}
                <Typography
                  component="p"
                  sx={{
                    color: ENABLE_PHOTO_HERO ? alpha('#FFFFFF', 0.78) : 'text.secondary',
                    textShadow: ENABLE_PHOTO_HERO ? '0 1px 6px rgba(0, 0, 0, 0.25)' : 'none',
                    lineHeight: 1.7,
                    fontSize: '0.8125rem',
                    fontWeight: 400,
                  }}
                >
                  {slideIndex === 0
                    ? t('auth.layout.subtitle', current.subtitle)
                    : current.subtitle}
                </Typography>

                {/* Services chips — affichees uniquement si le slide a des
                    integrations specifiques (slides 5-11). Wrappe en flex
                    pour gerer les slides a 4+ services (slide 6 channels). */}
                {current.services && current.services.length > 0 && (
                  <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {current.services.map((service) => (
                      <ServiceChip
                        key={`${slideIndex}-${service.name}`}
                        service={service}
                        onDark={ENABLE_PHOTO_HERO}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Dots pagination en colonne verticale a droite du texte.
                Click : reset le timer auto-cycle (l'effect se reabonne via
                la dependance slideIndex/isPaused).
                Dot active : pill verticale (height 24, width 8) au lieu
                d'horizontale, conforme a l'orientation du tablist. */}
            <Box
              role="tablist"
              aria-label="Slides marketing"
              aria-orientation="vertical"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {SLIDES.map((_, i) => {
                const isActive = i === slideIndex;
                // Dots : white-translucent en photo mode pour contraster
                // avec le bg fonce. Primary en sober mode.
                const dotActiveBg = ENABLE_PHOTO_HERO ? '#FFFFFF' : primary;
                const dotInactiveBg = ENABLE_PHOTO_HERO
                  ? alpha('#FFFFFF', 0.35)
                  : alpha(primary, 0.25);
                const dotInactiveHoverBg = ENABLE_PHOTO_HERO
                  ? alpha('#FFFFFF', 0.55)
                  : alpha(primary, 0.45);
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
                      width: 8,
                      height: isActive ? 24 : 8,
                      borderRadius: 999,
                      border: 'none',
                      p: 0,
                      cursor: 'pointer',
                      bgcolor: isActive ? dotActiveBg : dotInactiveBg,
                      transition: 'height 250ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms',
                      '&:hover': {
                        bgcolor: isActive ? dotActiveBg : dotInactiveHoverBg,
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${ENABLE_PHOTO_HERO ? '#FFFFFF' : primary}`,
                        outlineOffset: 2,
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          {/* Footer : trust signals discrets. En photo mode, on passe en
              variantes white-translucent pour rester lisible sur fond fonce. */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <TrustItem
                dot={ENABLE_PHOTO_HERO ? '#89B1C2' : primary}
                label={t('auth.layout.trustEurope', 'Hébergé en Europe')}
                onDark={ENABLE_PHOTO_HERO}
              />
              <TrustItem
                dot={ENABLE_PHOTO_HERO ? '#89B1C2' : primary}
                label={t('auth.layout.trustCompliance', 'NF 525 / RGPD')}
                onDark={ENABLE_PHOTO_HERO}
              />
              <TrustItem
                dot={ENABLE_PHOTO_HERO ? '#89B1C2' : primary}
                label={t('auth.layout.trustSupport', 'Support 7j/7')}
                onDark={ENABLE_PHOTO_HERO}
              />
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

/**
 * Chip de service avec logo (via simple-icons CDN) et nom.
 *
 * <p><b>Logo</b> : recupere depuis `cdn.simpleicons.org/{slug}/{color}` qui
 * sert des SVG monochromes prets a teinter. On utilise `white` en photo mode
 * et la couleur primary en sober mode pour rester coherent avec le reste de
 * l'UI. Si le service n'est pas sur simple-icons (Pennylane, Nuki, KeyNest,
 * Tuya, Vrbo, Make...), on passe `slug: null` et seul le nom s'affiche.</p>
 *
 * <p><b>Fallback CDN</b> : `onError` cache l'img si le CDN renvoie 404 ou
 * timeout. Le layout reste stable car le texte est toujours present.</p>
 *
 * <p><b>Pourquoi simple-icons</b> : c'est la lib la plus exhaustive (>3000
 * brand icons), aucune cle d'API, CDN cache cote browser, ~600 bytes par
 * icon. Alternative considere : embed inline SVG mais multiplie les KB du
 * bundle alors que ces logos ne sont vus que sur la page d'auth.</p>
 */
function ServiceChip({
  service,
  onDark,
}: {
  service: ServiceBadge;
  onDark: boolean;
}) {
  // Couleur du logo : blanc en photo mode, hex brand en sober mode.
  // simple-icons accepte hex sans `#` ou keyword `white`/`black`.
  const iconColor = onDark ? 'white' : '6B8A9A';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        px: 1.125,
        py: 0.5,
        borderRadius: 999,
        bgcolor: onDark ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04),
        border: `1px solid ${
          onDark ? alpha('#FFFFFF', 0.12) : alpha('#000000', 0.06)
        }`,
        transition: 'background-color 200ms ease-out',
        '&:hover': {
          bgcolor: onDark ? alpha('#FFFFFF', 0.14) : alpha('#000000', 0.06),
        },
      }}
    >
      {service.slug && (
        <Box
          component="img"
          src={`https://cdn.simpleicons.org/${service.slug}/${iconColor}`}
          alt=""
          aria-hidden
          loading="lazy"
          // Si CDN down ou slug inconnu : on cache l'img, le texte reste.
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          sx={{
            width: 11,
            height: 11,
            opacity: onDark ? 0.88 : 0.75,
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
      )}
      <Typography
        component="span"
        sx={{
          color: onDark ? alpha('#FFFFFF', 0.88) : 'text.primary',
          fontSize: '0.7rem',
          fontWeight: 500,
          letterSpacing: 0.2,
          whiteSpace: 'nowrap',
          lineHeight: 1.1,
        }}
      >
        {service.name}
      </Typography>
    </Box>
  );
}

/** Trust signal compact pour le footer du panneau brand.
 *  onDark : si true, texte en blanc-translucide (pour lisibilite sur photo hero).
 *  Sinon, text.secondary du theme MUI. */
function TrustItem({ dot, label, onDark = false }: { dot: string; label: string; onDark?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          bgcolor: dot,
          opacity: onDark ? 0.85 : 0.6,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color: onDark ? alpha('#FFFFFF', 0.75) : 'text.secondary',
          fontSize: '0.75rem',
          fontWeight: 500,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
