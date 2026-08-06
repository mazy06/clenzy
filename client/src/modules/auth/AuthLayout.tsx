import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';

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
 * <h3>Anti-patterns evites (Impeccable + Baitly)</h3>
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
 * Service tier integre a Baitly, affiche sous le slide en "chip" avec logo
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
 * duree (cible Baitly). Validees par l'user 2026-05-28.
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
  // ─── Guest messaging multi-channel (8) — WhatsApp Business Cloud + email ──
  // Pas de SMS ni de Twilio : aucun provider SMS n'est implémenté côté serveur
  // (`MessageChannelType.SMS` existe dans le modèle mais n'a pas de canal
  // d'envoi). Annoncer le contraire promettait une capacité inexistante.
  {
    tagline: '',
    highlight: 'WhatsApp et email — tout sur un seul fil de discussion',
    end: '.',
    subtitle:
      "Vos guests vous répondent où ils sont, sans installer d'app. Conversations centralisées côté Baitly, traduction automatique et réponses IA suggérées. La concurrence éclate ça en plusieurs outils, vous l'avez en un.",
    services: [
      { slug: 'whatsapp', name: 'WhatsApp' },
      { slug: 'gmail', name: 'Email' },
    ],
  },
  // ─── Multi-country accounting (9) — Pennylane/QB/Xero/Sage prod ──────
  {
    tagline: 'Votre comptabilité connectée,',
    highlight: 'que vous soyez en France, UK, Australie ou USA',
    end: '.',
    subtitle: "Baitly s'adapte à votre juridiction. Factures synchronisées, supplier invoices importées, déclarations fiscales préparées. Vos revenus consolidés multi-pays en un seul dashboard.",
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
    highlight: 'en 30 secondes, sans quitter Baitly',
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
    subtitle: "Vos réservations, guests, finances, photos — tout exportable au format ouvert. Webhooks et intégrations natives. Pas de lock-in. Là où Guesty vous emprisonne, Baitly vous libère.",
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

/**
 * Equivalent CSS de l'ancien helper `alpha()` de MUI. `color-mix` accepte aussi
 * bien un hexadecimal qu'un `var(--…)`, la ou `alpha()` exigeait une couleur
 * deja resolue en JS.
 */
const softColor = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/** Primary Baitly UI, seule teinte du theme utilisee par ce layout. */
const PRIMARY = 'var(--bui-primary)';

/** Le point de bascule desktop de ce layout vaut 900px, pas les 768px de Tailwind. */
const MD_UP_QUERY = '(min-width: 900px)';

export default function AuthLayout({ children, maxFormWidth = 440 }: AuthLayoutProps) {
  // Geo-detected language : ces pages NE respectent PAS les preferences user.
  // Logique business : pays arabes -> ar, France/Maghreb -> fr, autres -> en.
  // Hook override l'i18n au mount + restore au unmount.
  useGeoAuthLanguage();

  // Ces pages s'affichent TOUJOURS en clair, quelle que soit la preference de
  // l'utilisateur : elles precedent la session. Un ThemeProvider local
  // l'imposait auparavant ; `AuthLayoutInner` porte deja le `data-theme="light"`
  // que lisent les jetons CSS, ainsi que le fond plein ecran — il n'y a donc
  // rien a ajouter par-dessus.
  return <AuthLayoutInner maxFormWidth={maxFormWidth}>{children}</AuthLayoutInner>;
}

function AuthLayoutInner({ children, maxFormWidth }: AuthLayoutProps) {
  const { t } = useTranslation();
  const isMdUp = useMediaQuery(MD_UP_QUERY);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const primary = PRIMARY;

  // ─── State du carrousel ──────────────────────────────────────────────
  const [slideIndex, setSlideIndex] = useState(0);
  // Pause quand l'user hover le panel : permet de lire tranquillement sans
  // que le slide change pendant la lecture.
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Pas d'auto-cycle si l'user prefere reduced-motion : on affiche
    // seulement le slide 0 (au mount). Il peut toujours cliquer les dots.
    // On inclut slideIndex dans les deps : a chaque changement manuel
    // (click dot ou fleches clavier), le timer reset et redonne 6s avant
    // le prochain auto-advance — sinon l'user voit le slide changer 2s
    // apres son interaction, ce qui est confusant.
    if (prefersReducedMotion || isPaused || !isMdUp) return;
    const id = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(id);
  }, [isPaused, prefersReducedMotion, isMdUp, slideIndex]);

  // ─── Navigation clavier ──────────────────────────────────────────────
  // Les fleches Haut/Bas/Gauche/Droite naviguent dans le carrousel. On
  // accepte les 4 directions (orientation libre) parce que :
  // - Horizontal (Left/Right) : convention historique des carrousels
  // - Vertical (Up/Down) : convention de notre tablist vertical (les dots
  //   sont en colonne)
  //
  // Guard : on ignore les events declenches depuis un champ de saisie
  // (INPUT, TEXTAREA, SELECT, contentEditable) pour ne pas casser la
  // navigation dans le form login a droite — un user qui edite son email
  // et qui appuie sur fleche-droite pour bouger le curseur ne doit pas
  // voir le carrousel changer.
  useEffect(() => {
    if (!isMdUp) return; // Carrousel cache sur mobile, no-op

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setSlideIndex((i) => (i + 1) % SLIDES.length);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setSlideIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMdUp]);

  const current = SLIDES[slideIndex];

  return (
    <div
      // Écrans auth = toujours CLAIRS, quel que soit le thème/teinte du device
      // (résidu localStorage du dernier compte). On force data-theme="light" (le
      // device peut être en data-theme="dark") pour que les jetons de surfaces et
      // de champs repassent en clair. `brand-accent` reste posée pour les rares
      // descendants encore branchés sur l'accent de marque (cf. tokens.css).
      className="brand-accent min-h-screen flex flex-col min-[900px]:flex-row bg-card"
      data-theme="light"
    >
      {/* ── PANNEAU BRAND (desktop) ─────────────────────────────────────── */}
      {isMdUp && (
        <div
          className="flex-[0_0_42%] min-w-[420px] relative flex flex-col justify-between p-9 overflow-hidden"
          style={{
            // Photo mode : bg ratio composite (photo darkening overlay sous
            // le dot pattern translucide). Sober mode : bg primary alpha 0.04.
            backgroundColor: ENABLE_PHOTO_HERO ? '#0F1A22' : softColor(primary, 4),
            // Dot pattern visible dans les deux modes, alpha ajuste selon le bg
            backgroundImage: ENABLE_PHOTO_HERO
              ? `radial-gradient(${softColor('#FFFFFF', 10)} 1px, transparent 1px)`
              : `radial-gradient(${softColor(primary, 12)} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0',
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
              <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-center z-[0] pointer-events-none"
                style={{
                  backgroundImage: `url(${HERO_PHOTO_URL})`,
                  filter: 'saturate(0.6) brightness(0.55) blur(1.5px)',
                  // scale 1.05 evite que le blur 1.5px revele les bords
                  // transparents (artefact classique du filter:blur en CSS)
                  transform: 'scale(1.05)',
                }}
              />
              <div className="absolute inset-0 z-[0] pointer-events-none" style={{ backgroundColor: softColor('#0F1E28', 85) }} aria-hidden />
              <div className="absolute inset-0 z-[0] pointer-events-none" style={{ background: `linear-gradient(to top right, ${softColor('#0F1E28', 55)} 0%, transparent 60%)` }} aria-hidden />
            </>
          )}

          {/* Accent decoratif top-right : cercle radial diffus.
              En photo mode : color brand-light pour rester visible sur fond fonce.
              En sober mode : color brand classic. */}
          <div className="absolute w-[360px] h-[360px] rounded-[50%] pointer-events-none z-[0]" style={{ top: -120, right: -120, background: ENABLE_PHOTO_HERO
                ? `radial-gradient(circle, ${softColor('#89B1C2', 22)}, transparent 70%)`
                : `radial-gradient(circle, ${softColor(primary, 18)}, transparent 70%)` }} aria-hidden />

          {/* Header : logo. tone="dark" en photo mode (nodes blancs sur bg fonce). */}
          <div className="relative z-[1]">
            <BaitlyMarkLogo scale={0.95} tone={ENABLE_PHOTO_HERO ? 'dark' : 'auto'} />
          </div>

          {/* Centre : carrousel slide actuel + dots verticaux a droite.
              Layout : `justifyContent: 'space-between'` pousse le texte au
              bord gauche et les dots au bord droit du panneau brand (qui a
              `p: 6` pour garantir une marge avec le bord vertical separant
              brand et form). Avec un texte `maxWidth` responsive, l'espace
              entre les deux s'adapte naturellement au viewport (plus large
              sur 1920px, plus serre sur 1280px). Les dots restent toujours
              dans la colonne brand. */}
          <div className="relative z-[1] flex items-center justify-between gap-4">
            <div className="flex-[0_1_auto] min-[900px]:max-w-[440px] min-[1200px]:max-w-[520px] min-[1536px]:max-w-[580px] min-h-[360px]">
              {/* key={slideIndex} force le remount a chaque slide => l'animation
                  CSS fade-in se rejoue automatiquement. Approche tres simple
                  vs framer-motion pour ce cas (1 element a la fois). */}
              {/* `key` force le remontage a chaque slide, donc le rejeu de
                  l'animation. `slide-in-from-bottom-2` vaut les 8px de l'ancien
                  keyframe, a l'identique. */}
              <div
                key={slideIndex}
                className={cn(
                  'animate-in fade-in slide-in-from-bottom-2 fill-mode-both',
                  'duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  prefersReducedMotion && 'animate-none',
                )}
              >
                {/* Titre — bumped from h4 (2.125rem) to ~2.375rem pour creer
                    une hierarchie plus marquee avec le subtitle (0.8125rem,
                    ratio ~3x). letterSpacing negatif pour un feel modern SaaS
                    (Linear, Vercel, Stripe Dashboard). Responsive : 2rem sur md,
                    2.375rem sur lg (au-dela de 1200px). */}
                <h2
                  className="text-[2rem] min-[1200px]:text-[2.375rem] font-semibold leading-[1.15] tracking-[-0.02em] text-balance mb-[15px]"
                  style={{
                    // Texte titre : blanc en photo mode (sur fond fonce),
                    // encre du theme en sober mode (sur fond clair)
                    color: ENABLE_PHOTO_HERO ? '#FFFFFF' : 'var(--bui-foreground)',
                    // text-shadow subtil en photo mode : renforce la lisibilite
                    // sur photo+overlay (sans tomber dans le "drop-shadow lourd")
                    textShadow: ENABLE_PHOTO_HERO ? '0 1px 12px rgba(0, 0, 0, 0.4)' : 'none',
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
                  <span style={{ color: ENABLE_PHOTO_HERO ? '#A8C8D6' : primary }}>
                    {slideIndex === 0
                      ? t('auth.layout.taglineHighlight', current.highlight)
                      : current.highlight}
                  </span>
                  {slideIndex === 0
                    ? t('auth.layout.taglineEnd', current.end)
                    : current.end}
                </h2>
                {/* Subtitle — reduit de 0.95rem a 0.8125rem (13px) pour
                    creer une hierarchie nette avec le titre. Lineheight 1.7
                    pour donner de l'air entre les lignes, color un peu plus
                    muted (0.75 au lieu de 0.92) pour que le titre domine. */}
                <p
                  className="text-[0.8125rem] font-normal leading-[1.7]"
                  style={{
                    color: ENABLE_PHOTO_HERO ? softColor('#FFFFFF', 78) : 'var(--bui-muted-foreground)',
                    textShadow: ENABLE_PHOTO_HERO ? '0 1px 6px rgba(0, 0, 0, 0.25)' : 'none',
                  }}
                >
                  {slideIndex === 0
                    ? t('auth.layout.subtitle', current.subtitle)
                    : current.subtitle}
                </p>

                {/* Services chips — affichees uniquement si le slide a des
                    integrations specifiques (slides 5-11). Wrappe en flex
                    pour gerer les slides a 4+ services (slide 6 channels). */}
                {current.services && current.services.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {current.services.map((service) => (
                      <ServiceChip
                        key={`${slideIndex}-${service.name}`}
                        service={service}
                        onDark={ENABLE_PHOTO_HERO}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dots pagination en colonne verticale a droite du texte.
                Click : reset le timer auto-cycle (l'effect se reabonne via
                la dependance slideIndex/isPaused).
                Dot active : pill verticale (height 24, width 8) au lieu
                d'horizontale, conforme a l'orientation du tablist. */}
            <div className="flex flex-col gap-1.5 items-center shrink-0" role="tablist" aria-label="Slides marketing" aria-orientation="vertical">
              {SLIDES.map((slide, i) => {
                const isActive = i === slideIndex;
                // Dots : white-translucent en photo mode pour contraster
                // avec le bg fonce. Primary en sober mode.
                const dotActiveBg = ENABLE_PHOTO_HERO ? '#FFFFFF' : primary;
                const dotInactiveBg = ENABLE_PHOTO_HERO
                  ? softColor('#FFFFFF', 35)
                  : softColor(primary, 25);
                const dotInactiveHoverBg = ENABLE_PHOTO_HERO
                  ? softColor('#FFFFFF', 55)
                  : softColor(primary, 45);
                return (
                  // Les 3 teintes du dot dependent du mode photo et du theme :
                  // elles passent par des custom properties, les classes qui les
                  // consomment (dont hover / focus-visible) restent statiques.
                  <button
                    // L'index, et non `slide.tagline` : deux slides ouvrent
                    // directement sur leur phrase mise en exergue et ont donc
                    // une accroche vide — leurs deux pastilles se retrouvaient
                    // avec la meme cle `""`. `SLIDES` est une constante de
                    // module, jamais reordonnee ni filtree : l'index y est
                    // stable.
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Slide ${i + 1} sur ${SLIDES.length}`}
                    onClick={() => setSlideIndex(i)}
                    className={cn(
                      'w-[8px] rounded-full border-none p-0 cursor-pointer',
                      'bg-[var(--dot-bg)] hover:bg-[var(--dot-bg-hover)]',
                      'focus-visible:outline-2 focus-visible:outline-[var(--dot-ring)] focus-visible:outline-offset-2',
                      isActive ? 'h-[24px]' : 'h-[8px]',
                    )}
                    style={{
                      '--dot-bg': isActive ? dotActiveBg : dotInactiveBg,
                      '--dot-bg-hover': isActive ? dotActiveBg : dotInactiveHoverBg,
                      '--dot-ring': ENABLE_PHOTO_HERO ? '#FFFFFF' : primary,
                      transition: 'height 250ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms',
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>
          </div>

          {/* Footer : trust signals discrets. En photo mode, on passe en
              variantes white-translucent pour rester lisible sur fond fonce. */}
          <div className="relative z-[1]">
            <div className="flex items-center gap-4 flex-wrap">
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
            </div>
          </div>
        </div>
      )}

      {/* ── ZONE FORM ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-[18px] min-[600px]:p-[30px] min-[900px]:p-9 bg-card">
        {/* Champs auth uniformisés sur la primary Baitly (bordure + remplissage
            soft au survol/focus), alignés sur le bouton primary — cohérent sur
            TOUTES les pages auth (Login, Inscription…). Le sélecteur d'erreur
            est plus spécifique que celui de repos : un champ invalide garde sa
            bordure rouge. */}
        <div
          className={cn(
            'w-full flex flex-col',
            '[&_[data-slot=input]]:border-primary [&_[data-slot=input]]:transition-colors',
            '[&_[data-slot=input]:hover]:bg-primary-soft',
            '[&_[data-slot=input]:focus]:bg-primary-soft',
            '[&_[data-slot=input][aria-invalid=true]]:border-destructive',
          )}
          style={{ maxWidth: maxFormWidth }}
        >
          {/* Logo compact en haut sur mobile (le panneau brand est cache) */}
          {!isMdUp && (
            <div className="flex justify-center mb-6">
              <BaitlyMarkLogo scale={0.85} />
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
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
  // Couleur du logo : blanc en photo mode, hex brand Baitly en sober mode.
  // simple-icons accepte hex sans `#` ou keyword `white`/`black`.
  const iconColor = onDark ? 'white' : '1B2A35';

  return (
    // Les teintes dependent du mode photo : custom properties, la variante
    // hover reste une classe statique.
    <div
      className="inline-flex items-center gap-[3.75px] px-[6.75px] py-[3px] rounded-full border border-solid border-[var(--chip-border)] bg-[var(--chip-bg)] hover:bg-[var(--chip-bg-hover)]"
      style={{
        '--chip-bg': onDark ? softColor('#FFFFFF', 8) : softColor('#000000', 4),
        '--chip-bg-hover': onDark ? softColor('#FFFFFF', 14) : softColor('#000000', 6),
        '--chip-border': onDark ? softColor('#FFFFFF', 12) : softColor('#000000', 6),
        transition: 'background-color 200ms ease-out',
      } as React.CSSProperties}
    >
      {service.slug && (
        <img
          src={`https://cdn.simpleicons.org/${service.slug}/${iconColor}`}
          alt=""
          aria-hidden
          loading="lazy"
          // Si CDN down ou slug inconnu : on cache l'img, le texte reste.
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          className={cn('w-[11px] h-[11px] object-contain shrink-0', onDark ? 'opacity-[0.88]' : 'opacity-75')}
        />
      )}
      <span
        className="text-[0.7rem] font-medium tracking-[0.2px] whitespace-nowrap leading-[1.1]"
        style={{ color: onDark ? softColor('#FFFFFF', 88) : 'var(--bui-foreground)' }}
      >
        {service.name}
      </span>
    </div>
  );
}

/** Trust signal compact pour le footer du panneau brand.
 *  onDark : si true, texte en blanc-translucide (pour lisibilite sur photo hero).
 *  Sinon, l'encre secondaire du theme Baitly UI. */
function TrustItem({ dot, label, onDark = false }: { dot: string; label: string; onDark?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn('w-[5px] h-[5px] rounded-[50%]', onDark ? 'opacity-85' : 'opacity-60')} style={{ backgroundColor: dot }} />
      <span
        className="text-xs font-medium"
        style={{ color: onDark ? softColor('#FFFFFF', 75) : 'var(--bui-muted-foreground)' }}
      >
        {label}
      </span>
    </div>
  );
}
