import type { GalleryTemplate } from '../galleryTemplates';

/**
 * Template natif « Conciergerie Marrakech » — multi-page, HTML+CSS pensé POUR l'éditeur GrapesJS.
 *
 * Esthétique riad : palette chaude (terre cuite / sable / vert zellige / or), serif d'affichage
 * (Cormorant Garamond) + sans lisible (Manrope), photos d'ambiance. Aucune dépendance : polices via
 * `@import` Google Fonts dans le CSS, images via URLs absolues (éditables ensuite dans le Studio).
 *
 * MARQUEURS BOOKING = vocabulaire RUNTIME (hydraté par `BaitlyBooking.hydrate`, prévisualisé par
 * `bookingComponents`) : `search` (barre de recherche), `results` (grille des logements), `property`
 * (détail), `guest-form` + `checkout` (réservation), `confirmation`. Navigation template-driven via
 * `data-clenzy-next` / `data-clenzy-return` (chemins de pages internes).
 *
 * Chaque page porte le MÊME design system (`SHARED_CSS`) + sa nav + son footer → rendu identique
 * éditeur ↔ SSR (chaque SitePage est autonome).
 */

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap');";

/** Design system partagé par toutes les pages (tokens + nav + sections + cartes + footer + responsive). */
const SHARED_CSS = `${FONTS_IMPORT}
.cm-root {
  --cm-ink: #2b2420;
  --cm-body: #5c5046;
  --cm-muted: #8a7c6f;
  --cm-bg: #faf6ef;
  --cm-surface: #fffdf9;
  --cm-terracotta: #c2674a;
  --cm-terracotta-deep: #a8543b;
  --cm-green: #2f5d4f;
  --cm-gold: #c8a04e;
  --cm-line: #e8ddcb;
  --cm-radius: 14px;
  --cm-shadow: 0 18px 48px -28px rgba(43, 36, 32, 0.45);
  font-family: 'Manrope', system-ui, -apple-system, sans-serif;
  color: var(--cm-body);
  background: var(--cm-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.cm-root * { box-sizing: border-box; }
.cm-root h1, .cm-root h2, .cm-root h3 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  color: var(--cm-ink);
  font-weight: 600;
  line-height: 1.1;
  margin: 0;
  text-wrap: balance;
}
.cm-root p { margin: 0; }
.cm-wrap { max-width: 1140px; margin: 0 auto; padding: 0 24px; }
.cm-eyebrow {
  text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 600;
  color: var(--cm-terracotta);
}
.cm-btn {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 13px 26px; border-radius: 999px; border: 1px solid transparent;
  font: inherit; font-weight: 600; font-size: 15px; text-decoration: none;
  transition: background-color .25s ease, color .25s ease, border-color .25s ease, transform .25s ease;
}
.cm-btn--primary { background: var(--cm-terracotta); color: #fff; }
.cm-btn--primary:hover { background: var(--cm-terracotta-deep); }
.cm-btn--ghost { background: transparent; color: var(--cm-ink); border-color: var(--cm-line); }
.cm-btn--ghost:hover { border-color: var(--cm-terracotta); color: var(--cm-terracotta); }

/* Navigation */
.cm-nav { position: sticky; top: 0; z-index: 20; background: rgba(255, 253, 249, 0.9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--cm-line); }
.cm-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 76px; }
.cm-brand { display: flex; align-items: baseline; gap: 8px; font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 700; color: var(--cm-ink); text-decoration: none; letter-spacing: .02em; }
.cm-brand span { color: var(--cm-terracotta); }
.cm-nav__links { display: flex; align-items: center; gap: 30px; }
.cm-nav__link { color: var(--cm-body); text-decoration: none; font-size: 15px; font-weight: 500; transition: color .2s ease; }
.cm-nav__link:hover { color: var(--cm-terracotta); }
.cm-nav__link[aria-current="page"] { color: var(--cm-ink); }
.cm-nav__cta { margin-left: 6px; }

/* Hero */
.cm-hero { position: relative; color: #fff; }
.cm-hero__bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.cm-hero__bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(38, 28, 22, 0.30), rgba(38, 28, 22, 0.66)); }
.cm-hero__inner { position: relative; padding: 104px 0 120px; max-width: 720px; }
.cm-hero .cm-eyebrow { color: #f0c9a3; }
.cm-hero h1 { color: #fff; font-size: clamp(40px, 6vw, 68px); margin: 14px 0 18px; }
.cm-hero__sub { color: rgba(255, 255, 255, 0.92); font-size: 18px; max-width: 540px; }

/* Sections */
.cm-section { padding: 92px 0; }
.cm-section--tint { background: var(--cm-surface); }
.cm-section__head { max-width: 620px; margin-bottom: 44px; }
.cm-section__head--center { margin-left: auto; margin-right: auto; text-align: center; }
.cm-section h2 { font-size: clamp(30px, 4vw, 44px); margin: 12px 0 14px; }
.cm-lead { font-size: 17px; color: var(--cm-body); }

/* Grille de logements (enveloppe du marqueur results) */
.cm-lodgings { background: var(--cm-surface); border: 1px solid var(--cm-line); border-radius: var(--cm-radius); padding: 22px; }

/* Cartes "expérience" */
.cm-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; }
.cm-feature { padding: 30px; background: var(--cm-surface); border: 1px solid var(--cm-line); border-radius: var(--cm-radius); }
.cm-feature__k { font-family: 'Cormorant Garamond', serif; font-size: 38px; color: var(--cm-terracotta); line-height: 1; }
.cm-feature h3 { font-size: 22px; margin: 14px 0 8px; }
.cm-feature p { font-size: 15px; }

/* Split éditorial (image + texte) */
.cm-split { display: grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items: center; }
.cm-split__media { aspect-ratio: 4 / 3; border-radius: var(--cm-radius); background-size: cover; background-position: center; box-shadow: var(--cm-shadow); }
.cm-split h2 { font-size: clamp(28px, 3.4vw, 40px); }
.cm-split p + p { margin-top: 14px; }

/* Citation */
.cm-quote { text-align: center; max-width: 760px; margin: 0 auto; }
.cm-quote blockquote { font-family: 'Cormorant Garamond', serif; font-size: clamp(26px, 3.4vw, 38px); color: var(--cm-ink); line-height: 1.25; margin: 0 0 18px; }
.cm-quote cite { font-style: normal; color: var(--cm-muted); font-size: 14px; letter-spacing: .04em; text-transform: uppercase; }

/* Bandeau CTA */
.cm-cta { background: var(--cm-green); color: #fff; border-radius: var(--cm-radius); padding: 56px; text-align: center; }
.cm-cta h2 { color: #fff; font-size: clamp(28px, 3.6vw, 42px); }
.cm-cta p { color: rgba(255,255,255,.88); margin: 12px auto 26px; max-width: 480px; }
.cm-cta .cm-btn--primary { background: var(--cm-gold); color: #2b2420; }
.cm-cta .cm-btn--primary:hover { background: #b88f3d; }

/* Bloc réservation (marqueurs property / guest-form / checkout / confirmation) */
.cm-book { display: grid; grid-template-columns: 1fr 1.2fr; gap: 36px; align-items: start; }
.cm-book__aside { background: var(--cm-surface); border: 1px solid var(--cm-line); border-radius: var(--cm-radius); padding: 22px; position: sticky; top: 100px; }
.cm-panel { background: var(--cm-surface); border: 1px solid var(--cm-line); border-radius: var(--cm-radius); padding: 24px; }
.cm-panel + .cm-panel { margin-top: 20px; }
.cm-panel__title { font-family: 'Cormorant Garamond', serif; font-size: 24px; color: var(--cm-ink); margin: 0 0 16px; }

/* Contact */
.cm-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.cm-contact__item { padding: 22px 0; border-bottom: 1px solid var(--cm-line); }
.cm-contact__item span { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--cm-muted); margin-bottom: 4px; }
.cm-contact__item a, .cm-contact__item strong { color: var(--cm-ink); font-weight: 600; font-size: 17px; text-decoration: none; }
.cm-map { aspect-ratio: 1 / 1; border-radius: var(--cm-radius); background-size: cover; background-position: center; border: 1px solid var(--cm-line); }

/* Footer */
.cm-footer { background: var(--cm-ink); color: #d9cdbf; padding: 56px 0 32px; }
.cm-footer__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 36px; }
.cm-footer .cm-brand { color: #fff; }
.cm-footer h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: #b3a394; margin: 0 0 14px; }
.cm-footer a { display: block; color: #d9cdbf; text-decoration: none; font-size: 15px; padding: 4px 0; }
.cm-footer a:hover { color: #fff; }
.cm-footer__sub { margin-top: 16px; font-size: 14px; max-width: 280px; color: #b3a394; }
.cm-footer__bar { border-top: 1px solid rgba(255,255,255,.12); margin-top: 40px; padding-top: 22px; font-size: 13px; color: #9b8c7d; }

@media (max-width: 900px) {
  .cm-features, .cm-split, .cm-book, .cm-contact, .cm-footer__grid { grid-template-columns: 1fr; }
  .cm-nav__links { display: none; }
  .cm-book__aside { position: static; }
  .cm-section { padding: 64px 0; }
}`;

/** Barre de navigation (partagée). `active` = chemin de la page courante (état visuel). */
function nav(active: string): string {
  const link = (href: string, label: string) =>
    `<a class="cm-nav__link" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="cm-nav"><div class="cm-wrap cm-nav__inner">
    <a class="cm-brand" href="/">Dar<span>Atlas</span></a>
    <nav class="cm-nav__links">
      ${link('/', 'Accueil')}
      ${link('/logements', 'Nos riads')}
      ${link('/a-propos', 'La maison')}
      ${link('/contact', 'Contact')}
      <a class="cm-btn cm-btn--primary cm-nav__cta" href="/logements">Réserver</a>
    </nav>
  </div></header>`;
}

/** Pied de page (partagé). */
const FOOTER = `<footer class="cm-footer"><div class="cm-wrap">
  <div class="cm-footer__grid">
    <div>
      <a class="cm-brand" href="/">Dar<span>Atlas</span></a>
      <p class="cm-footer__sub">Conciergerie de riads d'exception au cœur de la médina de Marrakech.</p>
    </div>
    <div>
      <h4>Explorer</h4>
      <a href="/logements">Nos riads</a>
      <a href="/a-propos">La maison</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="mailto:bonjour@daratlas.ma">bonjour@daratlas.ma</a>
      <a href="tel:+212524000000">+212 524 00 00 00</a>
      <a href="#">Derb Lalla Azzouna, Médina</a>
    </div>
  </div>
  <div class="cm-footer__bar cm-wrap" style="padding-left:0;padding-right:0;">© Dar Atlas — Conciergerie Marrakech. Tous droits réservés.</div>
</div></footer>`;

const HERO_IMG = 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1600&q=70';
const ABOUT_IMG = 'https://images.unsplash.com/photo-1597211833712-5e41faa202ea?auto=format&fit=crop&w=1200&q=70';
const STORY_IMG = 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=70';
const MAP_IMG = 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1000&q=70';

/** Fonds image en classes CSS (le style inline est retiré par GrapesJS à l'import). */
const IMG_CSS = `
.cm-hero__bg { background-image: url('${HERO_IMG}'); }
.cm-img-about { background-image: url('${ABOUT_IMG}'); }
.cm-img-story { background-image: url('${STORY_IMG}'); }
.cm-map { background-image: url('${MAP_IMG}'); }`;

/* ── Pages ──────────────────────────────────────────────────────────────────────── */

const HOME = `<div class="cm-root">
  ${nav('/')}
  <section class="cm-hero">
    <div class="cm-hero__bg"></div>
    <div class="cm-wrap"><div class="cm-hero__inner">
      <p class="cm-eyebrow">Conciergerie de luxe · Marrakech</p>
      <h1>Des riads d'exception, gérés avec une attention rare</h1>
      <p class="cm-hero__sub">Séjournez dans nos demeures de la médina. Réservation directe, conciergerie 24/7, expériences sur mesure.</p>
    </div></div>
  </section>

  <section class="cm-section">
    <div class="cm-wrap">
      <div class="cm-section__head">
        <p class="cm-eyebrow">Nos demeures</p>
        <h2>Une collection de riads choisis</h2>
        <p class="cm-lead">Patios fleuris, terrasses sur l'Atlas, hammams privés — chaque riad est sélectionné pour son âme et son confort.</p>
      </div>
      <div class="cm-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>

  <section class="cm-section cm-section--tint">
    <div class="cm-wrap">
      <div class="cm-section__head cm-section__head--center">
        <p class="cm-eyebrow">L'expérience Dar Atlas</p>
        <h2>Bien plus qu'un hébergement</h2>
      </div>
      <div class="cm-features">
        <div class="cm-feature"><div class="cm-feature__k">24/7</div><h3>Conciergerie dédiée</h3><p>Un interlocuteur unique avant et pendant votre séjour, à toute heure.</p></div>
        <div class="cm-feature"><div class="cm-feature__k">100%</div><h3>Réservation directe</h3><p>Le meilleur tarif, sans intermédiaire, paiement sécurisé.</p></div>
        <div class="cm-feature"><div class="cm-feature__k">∞</div><h3>Sur mesure</h3><p>Chef à domicile, excursions, spa : nous composons votre séjour.</p></div>
      </div>
    </div>
  </section>

  <section class="cm-section">
    <div class="cm-wrap"><div class="cm-split">
      <div class="cm-split__media cm-img-about"></div>
      <div>
        <p class="cm-eyebrow">La maison</p>
        <h2>L'art de recevoir, à la marocaine</h2>
        <p>Depuis dix ans, nous veillons sur une poignée de riads de la médina comme sur des maisons de famille. Notre équipe locale conjugue exigence hôtelière et hospitalité sincère.</p>
        <p>Du thé d'accueil au dernier au revoir, chaque détail est pensé pour que vous n'ayez qu'à profiter.</p>
        <p style="margin-top:24px"><a class="cm-btn cm-btn--ghost" href="/a-propos">Découvrir la maison</a></p>
      </div>
    </div></div>
  </section>

  <section class="cm-section cm-section--tint">
    <div class="cm-wrap"><div class="cm-quote">
      <blockquote>« Le séjour parfait : un riad sublime, et une équipe qui anticipe chacun de vos désirs. »</blockquote>
      <cite>Camille R. — Paris</cite>
    </div></div>
  </section>

  <section class="cm-section">
    <div class="cm-wrap"><div class="cm-cta">
      <h2>Prêt à vivre Marrakech autrement ?</h2>
      <p>Dites-nous vos dates, nous nous occupons du reste.</p>
      <a class="cm-btn cm-btn--primary" href="/logements">Voir les disponibilités</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const LODGINGS = `<div class="cm-root">
  ${nav('/logements')}
  <section class="cm-section">
    <div class="cm-wrap">
      <div class="cm-section__head">
        <p class="cm-eyebrow">Nos riads</p>
        <h2>Choisissez votre demeure</h2>
        <p class="cm-lead">Sélectionnez vos dates pour découvrir les riads disponibles et leurs tarifs en temps réel.</p>
      </div>
      <div class="cm-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const RESERVE = `<div class="cm-root">
  ${nav('/logements')}
  <section class="cm-section">
    <div class="cm-wrap">
      <div class="cm-section__head">
        <p class="cm-eyebrow">Votre réservation</p>
        <h2>Finalisez votre séjour</h2>
      </div>
      <div class="cm-book">
        <aside class="cm-book__aside">
          <div data-clenzy-widget="property"></div>
          <div style="height:16px"></div>
          <div data-clenzy-widget="price"></div>
        </aside>
        <div>
          <div class="cm-panel">
            <h3 class="cm-panel__title">Vos coordonnées</h3>
            <div data-clenzy-widget="guest-form"></div>
          </div>
          <div class="cm-panel">
            <h3 class="cm-panel__title">Paiement</h3>
            <div data-clenzy-widget="checkout" data-clenzy-return="/confirmation"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const CONFIRMATION = `<div class="cm-root">
  ${nav('/logements')}
  <section class="cm-section">
    <div class="cm-wrap" style="max-width:680px">
      <div class="cm-panel" style="text-align:center;padding:48px">
        <div data-clenzy-widget="confirmation"></div>
        <p style="margin-top:24px"><a class="cm-btn cm-btn--ghost" href="/">Retour à l'accueil</a></p>
      </div>
    </div>
  </section>
  <section class="cm-section cm-section--tint">
    <div class="cm-wrap">
      <div class="cm-section__head cm-section__head--center">
        <p class="cm-eyebrow">Sublimez votre séjour</p>
        <h2>Services à la carte</h2>
      </div>
      <div data-clenzy-widget="upsells"></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const ABOUT = `<div class="cm-root">
  ${nav('/a-propos')}
  <section class="cm-section">
    <div class="cm-wrap">
      <div class="cm-section__head">
        <p class="cm-eyebrow">La maison</p>
        <h2>Dar Atlas, gardiens de riads depuis 2014</h2>
        <p class="cm-lead">Une conciergerie indépendante, ancrée dans la médina, qui place l'humain et le détail au cœur de chaque séjour.</p>
      </div>
      <div class="cm-split">
        <div class="cm-split__media cm-img-story"></div>
        <div>
          <h2>Notre histoire</h2>
          <p>Tout a commencé par un riad, restauré avec des artisans de la ville. Le bouche-à-oreille a fait le reste : aujourd'hui, nous veillons sur une collection confidentielle de maisons.</p>
          <p>Nous refusons la standardisation. Chaque riad garde son caractère ; notre rôle est de rendre votre séjour fluide, chaleureux et inoubliable.</p>
        </div>
      </div>
    </div>
  </section>
  <section class="cm-section cm-section--tint">
    <div class="cm-wrap">
      <div class="cm-features">
        <div class="cm-feature"><h3>Authenticité</h3><p>Des maisons habitées par l'artisanat marocain, loin des décors interchangeables.</p></div>
        <div class="cm-feature"><h3>Exigence</h3><p>Ménage hôtelier, linge de qualité, maintenance suivie. Le confort sans compromis.</p></div>
        <div class="cm-feature"><h3>Proximité</h3><p>Une équipe locale joignable, qui connaît chaque ruelle et chaque bonne adresse.</p></div>
      </div>
    </div>
  </section>
  <section class="cm-section">
    <div class="cm-wrap"><div class="cm-cta">
      <h2>Séjournez chez nous</h2>
      <p>Découvrez nos riads disponibles et réservez en direct.</p>
      <a class="cm-btn cm-btn--primary" href="/logements">Voir les riads</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const CONTACT = `<div class="cm-root">
  ${nav('/contact')}
  <section class="cm-section">
    <div class="cm-wrap">
      <div class="cm-section__head">
        <p class="cm-eyebrow">Contact</p>
        <h2>Parlons de votre séjour</h2>
        <p class="cm-lead">Une question, une demande sur mesure ? Notre conciergerie vous répond rapidement.</p>
      </div>
      <div class="cm-contact">
        <div>
          <div class="cm-contact__item"><span>Email</span><a href="mailto:bonjour@daratlas.ma">bonjour@daratlas.ma</a></div>
          <div class="cm-contact__item"><span>Téléphone</span><a href="tel:+212524000000">+212 524 00 00 00</a></div>
          <div class="cm-contact__item"><span>Adresse</span><strong>Derb Lalla Azzouna, Médina — Marrakech</strong></div>
          <div class="cm-contact__item"><span>Horaires</span><strong>Conciergerie 7j/7, 24h/24</strong></div>
          <p style="margin-top:26px"><a class="cm-btn cm-btn--primary" href="/logements">Réserver un riad</a></p>
        </div>
        <div class="cm-map"></div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

/** Concatène le design system partagé + le CSS éventuel de la page. */
const css = (pageCss = ''): string => `${SHARED_CSS}\n${IMG_CSS}\n${pageCss}`;

export const conciergerieMarrakech: GalleryTemplate = {
  id: 'conciergerie-marrakech',
  name: 'Conciergerie Marrakech',
  description: 'Riads de luxe — multi-page',
  thumbnail: HERO_IMG,
  theme: { primaryColor: '#c2674a', fontFamily: "'Manrope', system-ui, -apple-system, sans-serif", headingFontFamily: "'Cormorant Garamond', Georgia, serif" },
  pages: [
    { path: '/', type: 'HOME', title: 'Accueil', seoTitle: 'Dar Atlas — Conciergerie de riads à Marrakech', seoDescription: 'Riads d’exception dans la médina de Marrakech. Réservation directe, conciergerie 24/7, séjours sur mesure.', html: HOME, css: css() },
    { path: '/logements', type: 'PROPERTY_LIST', title: 'Nos riads', seoTitle: 'Nos riads disponibles — Dar Atlas Marrakech', seoDescription: 'Découvrez nos riads de la médina et leurs disponibilités en temps réel.', html: LODGINGS, css: css() },
    { path: '/reserver', type: 'CUSTOM', title: 'Réserver', seoTitle: 'Finaliser votre réservation — Dar Atlas', seoDescription: 'Renseignez vos coordonnées et réglez votre séjour en toute sécurité.', html: RESERVE, css: css() },
    { path: '/confirmation', type: 'CUSTOM', title: 'Confirmation', seoTitle: 'Réservation confirmée — Dar Atlas', seoDescription: 'Votre réservation est confirmée.', html: CONFIRMATION, css: css() },
    { path: '/a-propos', type: 'CUSTOM', title: 'La maison', seoTitle: 'La maison — Dar Atlas, conciergerie de riads', seoDescription: 'Une conciergerie indépendante ancrée dans la médina de Marrakech depuis 2014.', html: ABOUT, css: css() },
    { path: '/contact', type: 'CUSTOM', title: 'Contact', seoTitle: 'Contact — Dar Atlas Marrakech', seoDescription: 'Contactez notre conciergerie pour préparer votre séjour à Marrakech.', html: CONTACT, css: css() },
  ],
};
