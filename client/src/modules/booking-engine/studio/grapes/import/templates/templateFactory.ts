import type { GalleryTemplate, TemplatePage } from '../galleryTemplates';

/**
 * Fabrique de templates natifs (catalogue de galerie) = MATRICE thème × archétype.
 *
 * Au lieu d'écrire chaque template à la main, on combine :
 *  - un THÈME ({@link TplTheme}) : marque, palette, polices, images, copy → tokens injectés dans le CSS ;
 *  - un ARCHÉTYPE de layout pour la page d'accueil ('overlay' | 'split' | 'catalogue' | 'editorial').
 * Les pages internes (logements / réserver / confirmation / la maison / contact) sont partagées et
 * thémées. Patterns de mise en page repris des bibliothèques MIT (HyperUI / Preline) réécrits dans notre
 * format scopé `.bkt-root` (aucune dépendance, 0 attribution). Marqueurs booking RUNTIME identiques aux
 * templates manuels : `search` / `results` / `property` / `price` / `guest-form` / `checkout` /
 * `confirmation` / `upsells`, navigation `data-clenzy-next` / `data-clenzy-return`.
 *
 * Un seul template est chargé par site → le scope partagé `.bkt-root` ne crée aucune collision (chaque
 * template embarque son propre CSS thémé).
 */

export type TplArchetype = 'overlay' | 'split' | 'catalogue' | 'editorial';

export interface TplTheme {
  /** Identifiant stable du thème (anglais), ex. 'urban'. */
  id: string;
  /** Nom de marque affiché (nav/footer). */
  brand: string;
  /** Couleur de marque (primaryColor de la config). */
  primary: string;
  primaryDeep: string;
  /** `@import` Google Fonts. */
  fonts: string;
  fontHeading: string;
  fontBody: string;
  /** Tokens de palette. */
  ink: string; body: string; muted: string;
  bg: string; surface: string; soft: string; line: string;
  /** Texte sur la couleur primaire (défaut #fff). */
  onPrimary?: string;
  /** Images d'ambiance (URLs absolues, éditables ensuite). */
  images: { hero: string; about: string; story: string; map: string };
  /** Vocabulaire métier (ex. 'villas', 'riads', 'chalets'). */
  category: string;
  categoryCap: string;
  /** Copy de la page d'accueil. */
  eyebrow: string;
  heroTitle: string;
  heroSub: string;
  /** Coordonnées (footer / contact). */
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerTagline: string;
}

/** Design system thémé (tokens + nav + sections + cartes + footer + responsive), scope `.bkt-root`. */
function buildCss(t: TplTheme): string {
  const onPrimary = t.onPrimary ?? '#ffffff';
  return `${t.fonts}
.bkt-root {
  --bk-ink: ${t.ink}; --bk-body: ${t.body}; --bk-muted: ${t.muted};
  --bk-bg: ${t.bg}; --bk-surface: ${t.surface}; --bk-soft: ${t.soft}; --bk-line: ${t.line};
  --bk-primary: ${t.primary}; --bk-primary-deep: ${t.primaryDeep}; --bk-on-primary: ${onPrimary};
  --bk-radius: 16px; --bk-shadow: 0 22px 60px -34px rgba(17, 24, 28, 0.45);
  font-family: ${t.fontBody}; color: var(--bk-body); background: var(--bk-bg); line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.bkt-root * { box-sizing: border-box; }
.bkt-root h1, .bkt-root h2, .bkt-root h3 { font-family: ${t.fontHeading}; color: var(--bk-ink); font-weight: 600; line-height: 1.1; margin: 0; text-wrap: balance; }
.bkt-root p { margin: 0; }
.bkt-wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
.bkt-eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 600; color: var(--bk-primary); }
.bkt-btn { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 13px 26px; border-radius: 999px; border: 1px solid transparent; font: inherit; font-weight: 600; font-size: 15px; text-decoration: none; transition: background-color .25s ease, color .25s ease, border-color .25s ease; }
.bkt-btn--primary { background: var(--bk-primary); color: var(--bk-on-primary); }
.bkt-btn--primary:hover { background: var(--bk-primary-deep); }
.bkt-btn--ghost { background: transparent; color: var(--bk-ink); border-color: var(--bk-line); }
.bkt-btn--ghost:hover { border-color: var(--bk-primary); color: var(--bk-primary); }

/* Navigation */
.bkt-nav { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--bk-bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--bk-line); }
.bkt-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 74px; }
.bkt-brand { display: flex; align-items: center; gap: 9px; font-family: ${t.fontHeading}; font-size: 24px; font-weight: 600; color: var(--bk-ink); text-decoration: none; letter-spacing: .01em; }
.bkt-brand i { width: 9px; height: 9px; border-radius: 50%; background: var(--bk-primary); display: inline-block; font-style: normal; }
.bkt-nav__links { display: flex; align-items: center; gap: 30px; }
.bkt-nav__link { color: var(--bk-body); text-decoration: none; font-size: 15px; font-weight: 500; transition: color .2s ease; }
.bkt-nav__link:hover { color: var(--bk-primary); }
.bkt-nav__link[aria-current="page"] { color: var(--bk-ink); }
.bkt-nav__cta { margin-left: 6px; }

/* Hero — overlay (image plein cadre) */
.bkt-hero--overlay { position: relative; color: #fff; }
.bkt-hero--overlay .bkt-hero__bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.bkt-hero--overlay .bkt-hero__bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(14,18,22,.28), rgba(14,18,22,.66)); }
.bkt-hero--overlay .bkt-hero__inner { position: relative; padding: 108px 0 116px; max-width: 720px; }
.bkt-hero--overlay .bkt-eyebrow { color: #fff; opacity: .92; }
.bkt-hero--overlay h1 { color: #fff; font-size: clamp(40px, 6vw, 66px); margin: 14px 0 18px; }
.bkt-hero--overlay .bkt-hero__sub { color: rgba(255,255,255,.92); font-size: 18px; max-width: 540px; margin-bottom: 24px; }

/* Hero — split (texte + recherche / image) */
.bkt-hero--split { padding: 60px 0 84px; }
.bkt-hero--split .bkt-hero__grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 56px; align-items: center; }
.bkt-hero--split h1 { font-size: clamp(40px, 5.4vw, 62px); margin: 16px 0 18px; }
.bkt-hero--split .bkt-hero__sub { font-size: 18px; color: var(--bk-body); max-width: 480px; margin-bottom: 26px; }
.bkt-hero__media { aspect-ratio: 4 / 5; border-radius: 24px; background-size: cover; background-position: center; box-shadow: var(--bk-shadow); }

/* Hero — band (catalogue-first) */
.bkt-hero--band { padding: 56px 0 12px; }
.bkt-hero--band h1 { font-size: clamp(32px, 4.4vw, 50px); margin-bottom: 12px; }
.bkt-hero--band .bkt-hero__sub { font-size: 17px; color: var(--bk-body); max-width: 560px; }

/* Hero — editorial */
.bkt-hero--editorial { padding: 84px 0 24px; }
.bkt-hero--editorial h1 { font-size: clamp(44px, 6.5vw, 82px); max-width: 12ch; margin: 18px 0 22px; }
.bkt-hero--editorial .bkt-hero__sub { font-size: 19px; color: var(--bk-body); max-width: 540px; }

/* Carte de recherche */
.bkt-searchcard { background: var(--bk-surface); border: 1px solid var(--bk-line); border-radius: var(--bk-radius); box-shadow: var(--bk-shadow); padding: 18px; }
.bkt-searchcard--light { color: var(--bk-ink); }
.bkt-searchcard__label { font-size: 12px; font-weight: 600; color: var(--bk-muted); margin: 0 0 12px; text-transform: uppercase; letter-spacing: .08em; }
.bkt-searchbar { background: var(--bk-surface); border: 1px solid var(--bk-line); border-radius: var(--bk-radius); padding: 16px; box-shadow: var(--bk-shadow); margin-bottom: 28px; }

/* Sections */
.bkt-section { padding: 90px 0; }
.bkt-section--tint { background: var(--bk-surface); }
.bkt-section--soft { background: var(--bk-soft); }
.bkt-section__head { max-width: 620px; margin-bottom: 42px; }
.bkt-section__head--center { margin-left: auto; margin-right: auto; text-align: center; }
.bkt-section h2 { font-size: clamp(30px, 4vw, 44px); margin: 12px 0 14px; }
.bkt-lead { font-size: 17px; color: var(--bk-body); }

/* Grille de logements */
.bkt-lodgings { background: var(--bk-surface); border: 1px solid var(--bk-line); border-radius: var(--bk-radius); padding: 22px; }

/* Cartes "expérience" */
.bkt-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.bkt-feature { padding: 28px; background: var(--bk-surface); border: 1px solid var(--bk-line); border-radius: var(--bk-radius); }
.bkt-feature__ic { width: 46px; height: 46px; border-radius: 12px; background: var(--bk-soft); color: var(--bk-primary); display: flex; align-items: center; justify-content: center; font-family: ${t.fontHeading}; font-size: 22px; }
.bkt-feature h3 { font-size: 21px; margin: 16px 0 8px; }
.bkt-feature p { font-size: 15px; }

/* Split éditorial */
.bkt-split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.bkt-split__media { aspect-ratio: 4 / 3; border-radius: var(--bk-radius); background-size: cover; background-position: center; box-shadow: var(--bk-shadow); }
.bkt-split p + p { margin-top: 14px; }

/* Bandeau de chiffres */
.bkt-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
.bkt-stat b { display: block; font-family: ${t.fontHeading}; font-size: clamp(32px, 4vw, 46px); color: var(--bk-primary); font-variant-numeric: tabular-nums; line-height: 1; }
.bkt-stat span { font-size: 14px; color: var(--bk-muted); margin-top: 6px; display: block; }

/* Citation */
.bkt-quote { text-align: center; max-width: 760px; margin: 0 auto; }
.bkt-quote blockquote { font-family: ${t.fontHeading}; font-size: clamp(24px, 3.2vw, 34px); color: var(--bk-ink); line-height: 1.3; margin: 0 0 18px; font-weight: 500; }
.bkt-quote cite { font-style: normal; color: var(--bk-muted); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }

/* Bandeau CTA */
.bkt-cta { background: var(--bk-primary); color: var(--bk-on-primary); border-radius: 24px; padding: 60px; text-align: center; }
.bkt-cta h2 { color: var(--bk-on-primary); font-size: clamp(28px, 3.6vw, 42px); }
.bkt-cta p { color: color-mix(in srgb, var(--bk-on-primary) 85%, transparent); margin: 12px auto 26px; max-width: 460px; }
.bkt-cta .bkt-btn--primary { background: var(--bk-on-primary); color: var(--bk-primary-deep); }
.bkt-cta .bkt-btn--primary:hover { background: color-mix(in srgb, var(--bk-on-primary) 88%, var(--bk-primary)); }

/* Bloc réservation */
.bkt-book { display: grid; grid-template-columns: 1fr 1.2fr; gap: 36px; align-items: start; }
.bkt-aside { background: var(--bk-surface); border: 1px solid var(--bk-line); border-radius: var(--bk-radius); padding: 22px; position: sticky; top: 96px; }
.bkt-panel { background: var(--bk-surface); border: 1px solid var(--bk-line); border-radius: var(--bk-radius); padding: 24px; }
.bkt-panel + .bkt-panel { margin-top: 20px; }
.bkt-panel__title { font-family: ${t.fontHeading}; font-size: 23px; color: var(--bk-ink); margin: 0 0 16px; }

/* Contact */
.bkt-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.bkt-citem { padding: 22px 0; border-bottom: 1px solid var(--bk-line); }
.bkt-citem span { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--bk-muted); margin-bottom: 4px; }
.bkt-citem a, .bkt-citem strong { color: var(--bk-ink); font-weight: 600; font-size: 17px; text-decoration: none; }
.bkt-map { aspect-ratio: 1 / 1; border-radius: var(--bk-radius); background-size: cover; background-position: center; border: 1px solid var(--bk-line); }

/* Footer */
.bkt-footer { background: var(--bk-ink); color: color-mix(in srgb, #fff 78%, var(--bk-ink)); padding: 56px 0 30px; }
.bkt-footer__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 36px; }
.bkt-footer .bkt-brand { color: #fff; }
.bkt-footer h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: color-mix(in srgb, #fff 64%, var(--bk-ink)); margin: 0 0 14px; }
.bkt-footer a { display: block; color: color-mix(in srgb, #fff 78%, var(--bk-ink)); text-decoration: none; font-size: 15px; padding: 4px 0; }
.bkt-footer a:hover { color: #fff; }
.bkt-footer__sub { margin-top: 16px; font-size: 14px; max-width: 280px; color: color-mix(in srgb, #fff 64%, var(--bk-ink)); }
.bkt-footer__bar { border-top: 1px solid rgba(255,255,255,.12); margin-top: 40px; padding-top: 22px; font-size: 13px; color: color-mix(in srgb, #fff 55%, var(--bk-ink)); }

@media (max-width: 900px) {
  .bkt-hero--split .bkt-hero__grid, .bkt-features, .bkt-split, .bkt-book, .bkt-contact, .bkt-footer__grid, .bkt-stats { grid-template-columns: 1fr; }
  .bkt-nav__links { display: none; }
  .bkt-aside { position: static; }
  .bkt-section { padding: 64px 0; }
  .bkt-hero--overlay .bkt-hero__inner { padding: 72px 0; }
}`;
}

/** Barre de navigation thémée. `active` = chemin courant. */
function nav(t: TplTheme, active: string): string {
  const link = (href: string, label: string) =>
    `<a class="bkt-nav__link" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="bkt-nav"><div class="bkt-wrap bkt-nav__inner">
    <a class="bkt-brand" href="/"><i></i>${t.brand}</a>
    <nav class="bkt-nav__links">
      ${link('/', 'Accueil')}
      ${link('/logements', `Nos ${t.categoryCap.toLowerCase()}`)}
      ${link('/a-propos', 'La maison')}
      ${link('/contact', 'Contact')}
      <a class="bkt-btn bkt-btn--primary bkt-nav__cta" href="/logements">Réserver</a>
    </nav>
  </div></header>`;
}

/** Pied de page thémé. */
function footer(t: TplTheme): string {
  return `<footer class="bkt-footer"><div class="bkt-wrap">
    <div class="bkt-footer__grid">
      <div>
        <a class="bkt-brand" href="/"><i></i>${t.brand}</a>
        <p class="bkt-footer__sub">${t.footerTagline}</p>
      </div>
      <div>
        <h4>Explorer</h4>
        <a href="/logements">Nos ${t.categoryCap.toLowerCase()}</a>
        <a href="/a-propos">La maison</a>
        <a href="/contact">Contact</a>
      </div>
      <div>
        <h4>Contact</h4>
        <a href="mailto:${t.contactEmail}">${t.contactEmail}</a>
        <a href="tel:${t.contactPhone.replace(/\s/g, '')}">${t.contactPhone}</a>
        <a href="#">${t.contactAddress}</a>
      </div>
    </div>
    <div class="bkt-footer__bar bkt-wrap" style="padding-left:0;padding-right:0;">© ${t.brand}. Tous droits réservés.</div>
  </div></footer>`;
}

/* ── Sections réutilisables (home) ─────────────────────────────────────────────── */

const searchCard = (t: TplTheme, light = false) =>
  `<div class="bkt-searchcard${light ? ' bkt-searchcard--light' : ''}">
    <p class="bkt-searchcard__label">Trouvez votre ${t.category.replace(/s$/, '')}</p>
    <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
  </div>`;

const resultsSection = (t: TplTheme) => `<section class="bkt-section">
    <div class="bkt-wrap">
      <div class="bkt-section__head">
        <p class="bkt-eyebrow">Notre collection</p>
        <h2>Des ${t.category} choisis, pas listés</h2>
        <p class="bkt-lead">Chaque ${t.category.replace(/s$/, '')} est visité et sélectionné par nos soins, pour son caractère et son confort.</p>
      </div>
      <div class="bkt-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>`;

const featuresSection = (t: TplTheme) => `<section class="bkt-section bkt-section--soft">
    <div class="bkt-wrap">
      <div class="bkt-section__head bkt-section__head--center">
        <p class="bkt-eyebrow">L'expérience ${t.brand}</p>
        <h2>Bien plus qu'une location</h2>
      </div>
      <div class="bkt-features">
        <div class="bkt-feature"><div class="bkt-feature__ic">24/7</div><h3>Conciergerie dédiée</h3><p>Un interlocuteur unique avant et pendant votre séjour, à toute heure.</p></div>
        <div class="bkt-feature"><div class="bkt-feature__ic">%</div><h3>Réservation directe</h3><p>Le meilleur tarif, sans intermédiaire, paiement sécurisé.</p></div>
        <div class="bkt-feature"><div class="bkt-feature__ic">★</div><h3>Sur mesure</h3><p>Nous composons votre séjour selon vos envies.</p></div>
      </div>
    </div>
  </section>`;

const splitSection = (t: TplTheme) => `<section class="bkt-section">
    <div class="bkt-wrap"><div class="bkt-split">
      <div class="bkt-split__media" style="background-image:url('${t.images.about}')"></div>
      <div>
        <p class="bkt-eyebrow">La maison</p>
        <h2>L'art de recevoir</h2>
        <p>Depuis dix ans, nous veillons sur une poignée de ${t.category} comme sur des maisons de famille. Notre équipe locale conjugue exigence hôtelière et hospitalité sincère.</p>
        <p>De l'arrivée au dernier au revoir, chaque détail est pensé pour que vous n'ayez qu'à profiter.</p>
        <p style="margin-top:24px"><a class="bkt-btn bkt-btn--ghost" href="/a-propos">Découvrir la maison</a></p>
      </div>
    </div></div>
  </section>`;

const statsSection = (t: TplTheme) => `<section class="bkt-section bkt-section--tint">
    <div class="bkt-wrap"><div class="bkt-stats">
      <div class="bkt-stat"><b>40+</b><span>${t.categoryCap} d'exception</span></div>
      <div class="bkt-stat"><b>4.9</b><span>Note moyenne voyageurs</span></div>
      <div class="bkt-stat"><b>10</b><span>Ans d'expérience</span></div>
    </div></div>
  </section>`;

const ctaSection = () => `<section class="bkt-section">
    <div class="bkt-wrap"><div class="bkt-cta">
      <h2>Prêt à réserver votre séjour ?</h2>
      <p>Dites-nous vos dates, nous nous occupons du reste.</p>
      <a class="bkt-btn bkt-btn--primary" href="/logements">Voir les disponibilités</a>
    </div></div>
  </section>`;

/* ── Archétypes (page d'accueil) ───────────────────────────────────────────────── */

function homeFor(t: TplTheme, archetype: TplArchetype): string {
  let hero = '';
  if (archetype === 'overlay') {
    hero = `<section class="bkt-hero--overlay">
      <div class="bkt-hero__bg" style="background-image:url('${t.images.hero}')"></div>
      <div class="bkt-wrap"><div class="bkt-hero__inner">
        <p class="bkt-eyebrow">${t.eyebrow}</p>
        <h1>${t.heroTitle}</h1>
        <p class="bkt-hero__sub">${t.heroSub}</p>
        ${searchCard(t, true)}
      </div></div>
    </section>`;
  } else if (archetype === 'split') {
    hero = `<section class="bkt-hero--split"><div class="bkt-wrap"><div class="bkt-hero__grid">
      <div>
        <p class="bkt-eyebrow">${t.eyebrow}</p>
        <h1>${t.heroTitle}</h1>
        <p class="bkt-hero__sub">${t.heroSub}</p>
        ${searchCard(t)}
      </div>
      <div class="bkt-hero__media" style="background-image:url('${t.images.hero}')"></div>
    </div></div></section>`;
  } else if (archetype === 'catalogue') {
    hero = `<section class="bkt-hero--band"><div class="bkt-wrap">
      <p class="bkt-eyebrow">${t.eyebrow}</p>
      <h1>${t.heroTitle}</h1>
      <p class="bkt-hero__sub" style="margin-bottom:24px">${t.heroSub}</p>
      <div class="bkt-searchbar"><div data-clenzy-widget="search" data-clenzy-next="/logements"></div></div>
    </div></section>
    <section class="bkt-section" style="padding-top:34px">
      <div class="bkt-wrap"><div class="bkt-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div></div>
    </section>`;
  } else {
    // editorial
    hero = `<section class="bkt-hero--editorial"><div class="bkt-wrap">
      <p class="bkt-eyebrow">${t.eyebrow}</p>
      <h1>${t.heroTitle}</h1>
      <p class="bkt-hero__sub">${t.heroSub}</p>
      <p style="margin-top:26px"><a class="bkt-btn bkt-btn--primary" href="/logements">Découvrir les ${t.category}</a></p>
    </div></section>`;
  }

  // Composition des sections selon l'archétype (ordre/variété volontairement distincts).
  const body = archetype === 'catalogue'
    ? `${featuresSection(t)}${splitSection(t)}${ctaSection()}`
    : archetype === 'editorial'
      ? `${splitSection(t)}${resultsSection(t)}${statsSection(t)}${ctaSection()}`
      : `${resultsSection(t)}${featuresSection(t)}${splitSection(t)}${statsSection(t)}${ctaSection()}`;

  return `<div class="bkt-root">
  ${nav(t, '/')}
  ${hero}
  ${body}
  ${footer(t)}
</div>`;
}

/* ── Pages internes (partagées, thémées) ───────────────────────────────────────── */

const pageLodgings = (t: TplTheme) => `<div class="bkt-root">
  ${nav(t, '/logements')}
  <section class="bkt-section">
    <div class="bkt-wrap">
      <div class="bkt-section__head">
        <p class="bkt-eyebrow">Nos ${t.category}</p>
        <h2>Choisissez votre ${t.category.replace(/s$/, '')}</h2>
        <p class="bkt-lead">Sélectionnez vos dates pour découvrir les ${t.category} disponibles et leurs tarifs en temps réel.</p>
      </div>
      <div class="bkt-searchbar"><div data-clenzy-widget="search" data-clenzy-next="/logements"></div></div>
      <div class="bkt-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>
  ${footer(t)}
</div>`;

const pageReserve = (t: TplTheme) => `<div class="bkt-root">
  ${nav(t, '/logements')}
  <section class="bkt-section">
    <div class="bkt-wrap">
      <div class="bkt-section__head"><p class="bkt-eyebrow">Votre réservation</p><h2>Finalisez votre séjour</h2></div>
      <div class="bkt-book">
        <aside class="bkt-aside">
          <div data-clenzy-widget="property"></div>
          <div style="height:16px"></div>
          <div data-clenzy-widget="price"></div>
        </aside>
        <div>
          <div class="bkt-panel"><h3 class="bkt-panel__title">Vos coordonnées</h3><div data-clenzy-widget="guest-form"></div></div>
          <div class="bkt-panel"><h3 class="bkt-panel__title">Paiement</h3><div data-clenzy-widget="checkout" data-clenzy-return="/confirmation"></div></div>
        </div>
      </div>
    </div>
  </section>
  ${footer(t)}
</div>`;

const pageConfirmation = (t: TplTheme) => `<div class="bkt-root">
  ${nav(t, '/logements')}
  <section class="bkt-section">
    <div class="bkt-wrap" style="max-width:680px">
      <div class="bkt-panel" style="text-align:center;padding:48px">
        <div data-clenzy-widget="confirmation"></div>
        <p style="margin-top:24px"><a class="bkt-btn bkt-btn--ghost" href="/">Retour à l'accueil</a></p>
      </div>
    </div>
  </section>
  <section class="bkt-section bkt-section--soft">
    <div class="bkt-wrap">
      <div class="bkt-section__head bkt-section__head--center"><p class="bkt-eyebrow">Sublimez votre séjour</p><h2>Services à la carte</h2></div>
      <div data-clenzy-widget="upsells"></div>
    </div>
  </section>
  ${footer(t)}
</div>`;

const pageAbout = (t: TplTheme) => `<div class="bkt-root">
  ${nav(t, '/a-propos')}
  <section class="bkt-section">
    <div class="bkt-wrap">
      <div class="bkt-section__head">
        <p class="bkt-eyebrow">La maison</p>
        <h2>${t.brand}, l'hospitalité comme métier</h2>
        <p class="bkt-lead">Une conciergerie indépendante qui place l'humain et le détail au cœur de chaque séjour.</p>
      </div>
      <div class="bkt-split">
        <div class="bkt-split__media" style="background-image:url('${t.images.story}')"></div>
        <div>
          <h2>Notre histoire</h2>
          <p>Tout a commencé par un ${t.category.replace(/s$/, '')}, restauré avec des artisans locaux. Le bouche-à-oreille a fait le reste : aujourd'hui, nous veillons sur une collection confidentielle de maisons.</p>
          <p>Nous refusons la standardisation. Chaque ${t.category.replace(/s$/, '')} garde son caractère ; notre rôle est de rendre votre séjour fluide et inoubliable.</p>
        </div>
      </div>
    </div>
  </section>
  ${featuresSection(t)}
  ${ctaSection()}
  ${footer(t)}
</div>`;

const pageContact = (t: TplTheme) => `<div class="bkt-root">
  ${nav(t, '/contact')}
  <section class="bkt-section">
    <div class="bkt-wrap">
      <div class="bkt-section__head">
        <p class="bkt-eyebrow">Contact</p>
        <h2>Parlons de votre séjour</h2>
        <p class="bkt-lead">Une question, une demande sur mesure ? Notre conciergerie vous répond rapidement.</p>
      </div>
      <div class="bkt-contact">
        <div>
          <div class="bkt-citem"><span>Email</span><a href="mailto:${t.contactEmail}">${t.contactEmail}</a></div>
          <div class="bkt-citem"><span>Téléphone</span><a href="tel:${t.contactPhone.replace(/\s/g, '')}">${t.contactPhone}</a></div>
          <div class="bkt-citem"><span>Adresse</span><strong>${t.contactAddress}</strong></div>
          <div class="bkt-citem"><span>Horaires</span><strong>Conciergerie 7j/7, 24h/24</strong></div>
          <p style="margin-top:26px"><a class="bkt-btn bkt-btn--primary" href="/logements">Réserver</a></p>
        </div>
        <div class="bkt-map" style="background-image:url('${t.images.map}')"></div>
      </div>
    </div>
  </section>
  ${footer(t)}
</div>`;

/* ── Fabrique ──────────────────────────────────────────────────────────────────── */

export interface TemplateSpec {
  id: string;
  name: string;
  description: string;
  theme: TplTheme;
  archetype: TplArchetype;
}

export function makeTemplate(spec: TemplateSpec): GalleryTemplate {
  const t = spec.theme;
  const cssStr = buildCss(t);
  const page = (path: string, type: TemplatePage['type'], title: string, html: string, seoTitle: string, seoDescription: string): TemplatePage =>
    ({ path, type, title, seoTitle, seoDescription, html, css: cssStr });
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    thumbnail: t.images.hero,
    theme: { primaryColor: t.primary, fontFamily: t.fontBody },
    pages: [
      page('/', 'HOME', 'Accueil', homeFor(t, spec.archetype), `${t.brand} — ${t.categoryCap} & conciergerie`, t.heroSub),
      page('/logements', 'PROPERTY_LIST', `Nos ${t.categoryCap.toLowerCase()}`, pageLodgings(t), `Nos ${t.categoryCap.toLowerCase()} disponibles — ${t.brand}`, `Découvrez nos ${t.category} et leurs disponibilités en temps réel.`),
      page('/reserver', 'CUSTOM', 'Réserver', pageReserve(t), `Finaliser votre réservation — ${t.brand}`, 'Renseignez vos coordonnées et réglez votre séjour en toute sécurité.'),
      page('/confirmation', 'CUSTOM', 'Confirmation', pageConfirmation(t), `Réservation confirmée — ${t.brand}`, 'Votre réservation est confirmée.'),
      page('/a-propos', 'CUSTOM', 'La maison', pageAbout(t), `La maison — ${t.brand}`, `${t.brand}, conciergerie indépendante de ${t.category}.`),
      page('/contact', 'CUSTOM', 'Contact', pageContact(t), `Contact — ${t.brand}`, 'Contactez notre conciergerie pour préparer votre séjour.'),
    ],
  };
}
