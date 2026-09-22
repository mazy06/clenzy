import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import { AGENT_IDS } from '../supervision/constants';
import PublicLanguagePicker from '../../components/PublicLanguagePicker';
import type { AppLanguage } from '../../utils/localeDate';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import './baitly-auth.css';

/**
 * Layout partage par les pages d'auth (Login, Inscription, mot de passe oublie).
 *
 * <h3>Design (2026)</h3>
 * Pattern split-screen B2B SaaS modern (cf. Linear, Vercel, Stripe Dashboard) :
 * <ul>
 *   <li><b>Desktop ≥md</b> : panneau brand a gauche (40%) + zone form a droite (60%).
 *       Le panneau brand contient un <b>carrousel marketing</b> qui cycle
 *       toutes les 6s — chaque slide adresse un pain point different du host
 *       courte duree (revenue, temps gagne, montee en charge, support 24/7,
 *       synchronisation des canaux, serrures, messagerie, comptabilite,
 *       signature, ouverture des donnees).</li>
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

// ─── Carrousel marketing : slides cyclant automatiquement ──────────────────

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
  id: string;
  /** Phrase mise en exergue en couleur primary. */
  /** Texte court apres le highlight (typiquement la ponctuation). */
  /** Body texte de preuve / detail. */
  /**
   * Services / partenaires proeminents pour ce slide. Affiches en puces avec
   * logo monochrome sous le subtitle. Optionnel — slides "hook" sans
   * integration specifique ont undefined.
   */
  services?: ServiceBadge[];
}

/**
 * Slides du carrousel marketing. Chaque slide adresse un pain point ou benefice
 * specifique aux hosts/gestionnaires de location courte duree (cible Baitly).
 *
 * <p>Seuls les identifiants vivent ici : le texte est en locales, sous
 * `auth.slides.<id>.{tagline,highlight,end,subtitle}`, dans les trois langues.</p>
 *
 * <p><b>Le nombre d'agents ne s'ecrit pas a la main.</b> La premiere slide
 * l'annonce, et il a vecu a « 8 » pendant que la constellation en comptait dix —
 * une promesse fausse sur le premier ecran du produit. Il est desormais
 * interpole depuis {@link AGENT_IDS}, seul endroit qui fait foi.</p>
 */
const SLIDES: CarouselSlide[] = [
  // Ce qu'est Baitly : une constellation d'agents
  { id: 's0' },
  // ARGENT — la reservation directe, sans commission
  { id: 's11' },
  // ARGENT — les ventes additionnelles
  { id: 's14' },
  // ARGENT — le prix face au marche, borne par l'hote
  { id: 's16' },
  // CONFIANCE — repond a l'objection immediate faite a l'IA
  { id: 's1' },
  // Le coeur du PMS : un calendrier, tous les canaux
  {
    id: 's5',
    services: [
      { slug: 'airbnb', name: 'Airbnb' },
      { slug: 'bookingdotcom', name: 'Booking.com' },
      { slug: 'expedia', name: 'Expedia' },
      { slug: null, name: 'Vrbo' },
      { slug: 'agoda', name: 'Agoda' },
      { slug: 'tripadvisor', name: 'Tripadvisor' },
    ],
  },
  // Differenciant — les corps de metier reunis dans le PMS
  { id: 's13' },
  // La douleur la plus concrete : le message a 3 h du matin
  { id: 's2' },
  // Experience voyageur — et support des ventes additionnelles
  { id: 's12' },
  // Exploitation — acces et serrures
  {
    id: 's6',
    services: [
      { slug: null, name: 'Nuki' },
      { slug: null, name: 'KeyNest' },
      { slug: null, name: 'Tuya' },
    ],
  },
  // Exploitation — le bruit, avant la plainte du voisin
  { id: 's15' },
  // Leve le frein a la migration
  {
    id: 's4',
    services: [
      { slug: 'airbnb', name: 'Airbnb' },
      { slug: 'bookingdotcom', name: 'Booking.com' },
    ],
  },
  // Administratif — comptabilite
  {
    id: 's8',
    services: [
      { slug: null, name: 'Pennylane' },
      { slug: 'quickbooks', name: 'QuickBooks' },
      { slug: 'xero', name: 'Xero' },
      { slug: 'sage', name: 'Sage' },
    ],
  },
  // Administratif — contrats et signature
  {
    id: 's9',
    services: [
      { slug: 'docusign', name: 'DocuSign' },
    ],
  },
];

/**
 * Identifiants des slides, dans l'ordre d'affichage.
 *
 * <p>Expose pour que la suite de tests verifie qu'AUCUNE slide ne part sans son
 * texte : un identifiant sans cles affiche `auth.slides.sN.highlight` en clair
 * sur la premiere page du produit, et rien dans le typage ne le signale.</p>
 */
export const SLIDE_IDS: readonly string[] = SLIDES.map((slide) => slide.id);

/** Duree d'affichage par slide en millisecondes. 6s = ~lecture confortable. */
const SLIDE_DURATION_MS = 6000;

// ─── Feature flag : hero photo en arriere-plan du brand panel ─────────────
//
// Si true : photo d'interieur en fond, teintee par le bleu nuit de la landing.
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
const BRAND_PAPER = 'var(--bl-paper)';
const BRAND_BLUE = 'var(--bl-blue)';

/** Le point de bascule desktop de ce layout vaut 900px, pas les 768px de Tailwind. */
const MD_UP_QUERY = '(min-width: 900px)';

export default function AuthLayout({ children, maxFormWidth = 440 }: AuthLayoutProps) {
  // Geo-detected language : ces pages NE respectent PAS les preferences user.
  // Logique business : pays arabes -> ar, France/Maghreb -> fr, autres -> en.
  // Hook override l'i18n au mount + restore au unmount.
  // La geolocalisation DEVINE la langue ; le selecteur permet d'en sortir.
  const { language, chooseLanguage } = useGeoAuthLanguage();

  // Ces pages s'affichent TOUJOURS en clair, quelle que soit la preference de
  // l'utilisateur : elles precedent la session. Un ThemeProvider local
  // l'imposait auparavant ; `AuthLayoutInner` porte deja le `data-theme="light"`
  // que lisent les jetons CSS, ainsi que le fond plein ecran — il n'y a donc
  // rien a ajouter par-dessus.
  return (
    <AuthLayoutInner
      maxFormWidth={maxFormWidth}
      language={language}
      onChooseLanguage={chooseLanguage}
    >
      {children}
    </AuthLayoutInner>
  );
}

/** Le choix de langue descend du parent : c'est lui qui porte l'effet i18n. */
interface AuthLayoutInnerProps extends AuthLayoutProps {
  language: AppLanguage;
  onChooseLanguage: (language: AppLanguage) => void;
}

function AuthLayoutInner({ children, maxFormWidth, language, onChooseLanguage }: AuthLayoutInnerProps) {
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
      className="brand-accent baitly-auth relative min-h-dvh flex flex-col min-[900px]:flex-row bg-card"
      data-theme="light"
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* ── PANNEAU BRAND (desktop) ─────────────────────────────────────── */}
      {isMdUp && (
        <div
          className="flex-[0_0_42%] min-w-[420px] relative flex flex-col justify-between p-9 overflow-hidden"
          style={{
            // Photo mode : bg ratio composite (photo darkening overlay sous
            // le dot pattern translucide). Sober mode : bg primary alpha 0.04.
            backgroundColor: ENABLE_PHOTO_HERO ? primary : softColor(primary, 4),
            // Dot pattern visible dans les deux modes, alpha ajuste selon le bg
            backgroundImage: ENABLE_PHOTO_HERO
              ? `radial-gradient(${softColor(BRAND_PAPER, 10)} 1px, transparent 1px)`
              : `radial-gradient(${softColor(primary, 12)} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0',
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Photo attenuee sous un voile bleu nuit a 93 % : la teinte reste
              celle de la landing, meme sur les parties claires de l'image. */}
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
              <div className="absolute inset-0 z-[0] pointer-events-none" style={{ backgroundColor: softColor(primary, 93) }} aria-hidden />
            </>
          )}

          {/* Memes proportions que le header de la landing : mark 30, mot 27. */}
          <div className="relative z-[1]">
            <AuthBrandLogo onDark={ENABLE_PHOTO_HERO} />
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
                    color: ENABLE_PHOTO_HERO ? BRAND_PAPER : 'var(--bui-foreground)',
                  }}
                >
                  {t('auth.slides.' + current.id + '.tagline') && (
                    <>
                      {t('auth.slides.' + current.id + '.tagline')}{' '}
                    </>
                  )}
                  {/* Encre marron du planning sur fond sombre, reste du titre blanc. */}
                  <span style={{ color: ENABLE_PHOTO_HERO ? 'var(--baitly-auth-highlight)' : primary }}>
                    {t('auth.slides.' + current.id + '.highlight', { agentCount: AGENT_IDS.length })}
                  </span>
                  {t('auth.slides.' + current.id + '.end')}
                </h2>
                {/* Subtitle — reduit de 0.95rem a 0.8125rem (13px) pour
                    creer une hierarchie nette avec le titre. Lineheight 1.7
                    pour donner de l'air entre les lignes, color un peu plus
                    muted (0.75 au lieu de 0.92) pour que le titre domine. */}
                <p
                  className="text-[0.8125rem] font-normal leading-[1.7]"
                  style={{
                    color: ENABLE_PHOTO_HERO ? softColor(BRAND_PAPER, 82) : 'var(--bui-muted-foreground)',
                  }}
                >
                  {t('auth.slides.' + current.id + '.subtitle')}
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
                const dotActiveBg = ENABLE_PHOTO_HERO ? BRAND_PAPER : primary;
                const dotInactiveBg = ENABLE_PHOTO_HERO
                  ? softColor(BRAND_PAPER, 55)
                  : softColor(primary, 25);
                const dotInactiveHoverBg = ENABLE_PHOTO_HERO
                  ? softColor(BRAND_PAPER, 75)
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
                      '--dot-ring': ENABLE_PHOTO_HERO ? BRAND_PAPER : primary,
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
                dot={ENABLE_PHOTO_HERO ? BRAND_BLUE : primary}
                label={t('auth.layout.trustEurope', 'Hébergé en Europe')}
                onDark={ENABLE_PHOTO_HERO}
              />
              <TrustItem
                dot={ENABLE_PHOTO_HERO ? BRAND_BLUE : primary}
                label={t('auth.layout.trustCompliance', 'NF 525 / RGPD')}
                onDark={ENABLE_PHOTO_HERO}
              />
              <TrustItem
                dot={ENABLE_PHOTO_HERO ? BRAND_BLUE : primary}
                label={t('auth.layout.trustSupport', 'Support 7j/7')}
                onDark={ENABLE_PHOTO_HERO}
              />
            </div>
          </div>
        </div>
      )}

      {/* Choix de langue : au-dessus des deux panneaux, donc atteignable que
          le panneau de marque soit affiche ou non (il disparait sur mobile). */}
      <div className="absolute top-3 end-3 z-[2] min-[600px]:top-4 min-[600px]:end-4">
        <PublicLanguagePicker
          value={language}
          onChange={onChooseLanguage}
          label={t('navigation.language')}
        />
      </div>

      {/* ── ZONE FORM ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex items-center justify-center px-[18px] pt-20 pb-9 min-[600px]:px-[30px] min-[900px]:p-9 bg-card">
        {/* Les champs simples et groupes partagent la peinture de baitly-auth.css. */}
        <div
          className="baitly-auth-form w-full flex flex-col"
          style={{ maxWidth: maxFormWidth }}
        >
          {/* Logo compact en haut sur mobile (le panneau brand est cache) */}
          {!isMdUp && (
            <div className="flex justify-center mb-6">
              <AuthBrandLogo />
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

/** Assemblage du logo identique a la landing, sans modifier celui du PMS. */
function AuthBrandLogo({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="baitly-auth-logo" data-on-dark={onDark}>
      <BaitlyMarkLogo variant="mark" size={30} colorMode="inherit" />
      <span className="baitly-auth-wordmark">baitly</span>
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
  const iconColor = onDark ? 'F5FAFC' : '25406E';

  return (
    // Les teintes dependent du mode photo : custom properties, la variante
    // hover reste une classe statique.
    <div
      className="inline-flex items-center gap-[3.75px] px-[6.75px] py-[3px] rounded-full border border-solid border-[var(--chip-border)] bg-[var(--chip-bg)] hover:bg-[var(--chip-bg-hover)]"
      style={{
        '--chip-bg': onDark ? softColor(BRAND_PAPER, 8) : softColor(PRIMARY, 4),
        '--chip-bg-hover': onDark ? softColor(BRAND_PAPER, 14) : softColor(PRIMARY, 6),
        '--chip-border': onDark ? softColor(BRAND_PAPER, 12) : softColor(PRIMARY, 6),
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
        className="text-xs font-medium tracking-[0.2px] whitespace-nowrap leading-[1.1]"
        style={{ color: onDark ? softColor(BRAND_PAPER, 88) : 'var(--bui-foreground)' }}
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
        style={{ color: onDark ? softColor(BRAND_PAPER, 82) : 'var(--bui-muted-foreground)' }}
      >
        {label}
      </span>
    </div>
  );
}
