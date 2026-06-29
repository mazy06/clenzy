import type { GalleryTemplate } from '../galleryTemplates';

/**
 * Template natif « Maison de campagne » — multi-page, HTML+CSS pensé POUR l'éditeur GrapesJS.
 *
 * Ambiance nature chaleureuse : palette verte et terreuse (vert sauge / vert forêt / terre cuite douce /
 * avoine), display serif accueillante (Cormorant Garamond) + sans lisible (Nunito Sans), formes rondes et
 * généreuses, photos de campagne. Aucune dépendance : polices via `@import` Google Fonts, images via URLs
 * absolues (éditables ensuite dans le Studio).
 *
 * MARQUEURS BOOKING = vocabulaire RUNTIME (hydraté par `BaitlyBooking.hydrate`, prévisualisé par
 * `bookingComponents`) : `search` (barre de recherche), `results` (grille des logements), `property`
 * (détail), `price`, `guest-form` + `checkout` (réservation), `confirmation`, `upsells`. Navigation
 * template-driven via `data-clenzy-next` / `data-clenzy-return` (chemins de pages internes).
 *
 * Chaque page porte le MÊME design system (`SHARED_CSS`) + sa nav + son footer → rendu identique
 * éditeur ↔ SSR (chaque SitePage est autonome).
 */

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Nunito+Sans:wght@400;500;600;700&display=swap');";

/** Design system partagé par toutes les pages (tokens + nav + sections + cartes + footer + responsive). */
const SHARED_CSS = `${FONTS_IMPORT}
.mc-root {
  --mc-ink: #2a3327;
  --mc-body: #51604c;
  --mc-muted: #899080;
  --mc-bg: #f6f4ec;
  --mc-surface: #fffdf7;
  --mc-sauge: #6e8b62;
  --mc-foret: #3f5a3a;
  --mc-foret-deep: #324b2e;
  --mc-terre: #c08457;
  --mc-avoine: #efe8d6;
  --mc-line: #e3ddca;
  --mc-radius: 20px;
  --mc-shadow: 0 22px 56px -32px rgba(42, 51, 39, 0.4);
  font-family: 'Nunito Sans', system-ui, -apple-system, sans-serif;
  color: var(--mc-body);
  background: var(--mc-bg);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
.mc-root * { box-sizing: border-box; }
.mc-root h1, .mc-root h2, .mc-root h3 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  color: var(--mc-ink);
  font-weight: 600;
  line-height: 1.1;
  margin: 0;
  text-wrap: balance;
}
.mc-root p { margin: 0; }
.mc-wrap { max-width: 1140px; margin: 0 auto; padding: 0 24px; }
.mc-eyebrow {
  text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 700;
  color: var(--mc-sauge);
}
.mc-btn {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 13px 28px; border-radius: 999px; border: 1px solid transparent;
  font: inherit; font-weight: 700; font-size: 15px; text-decoration: none;
  transition: background-color .25s ease, color .25s ease, border-color .25s ease;
}
.mc-btn--primary { background: var(--mc-foret); color: #fff; }
.mc-btn--primary:hover { background: var(--mc-foret-deep); }
.mc-btn--ghost { background: transparent; color: var(--mc-ink); border-color: var(--mc-line); }
.mc-btn--ghost:hover { border-color: var(--mc-foret); color: var(--mc-foret); }

/* Navigation */
.mc-nav { position: sticky; top: 0; z-index: 20; background: rgba(246, 244, 236, 0.9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--mc-line); }
.mc-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 78px; }
.mc-brand { display: flex; align-items: center; gap: 9px; font-family: 'Cormorant Garamond', serif; font-size: 27px; font-weight: 700; color: var(--mc-ink); text-decoration: none; letter-spacing: .01em; }
.mc-brand i { width: 11px; height: 11px; border-radius: 50%; background: var(--mc-terre); display: inline-block; font-style: normal; }
.mc-nav__links { display: flex; align-items: center; gap: 30px; }
.mc-nav__link { color: var(--mc-body); text-decoration: none; font-size: 15px; font-weight: 600; transition: color .2s ease; }
.mc-nav__link:hover { color: var(--mc-foret); }
.mc-nav__link[aria-current="page"] { color: var(--mc-ink); }
.mc-nav__cta { margin-left: 6px; }

/* Hero plein écran */
.mc-hero { position: relative; color: #fff; }
.mc-hero__bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.mc-hero__bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(34, 44, 30, 0.28), rgba(34, 44, 30, 0.62)); }
.mc-hero__inner { position: relative; padding: 110px 0 56px; max-width: 700px; }
.mc-hero .mc-eyebrow { color: #cfe0bd; }
.mc-hero h1 { color: #fff; font-size: clamp(42px, 6vw, 68px); margin: 14px 0 18px; }
.mc-hero__sub { color: rgba(255, 255, 255, 0.92); font-size: 18px; max-width: 520px; }
.mc-hero__search { position: relative; margin-top: -56px; padding-bottom: 64px; z-index: 2; }
.mc-searchcard { background: var(--mc-surface); border: 1px solid var(--mc-line); border-radius: var(--mc-radius); box-shadow: var(--mc-shadow); padding: 18px; color: var(--mc-ink); }
.mc-searchcard__label { font-size: 12px; font-weight: 700; color: var(--mc-muted); margin: 0 0 12px; text-transform: uppercase; letter-spacing: .08em; }

/* Sections */
.mc-section { padding: 92px 0; }
.mc-section--tint { background: var(--mc-surface); }
.mc-section--avoine { background: var(--mc-avoine); }
.mc-section__head { max-width: 620px; margin-bottom: 44px; }
.mc-section__head--center { margin-left: auto; margin-right: auto; text-align: center; }
.mc-section h2 { font-size: clamp(32px, 4vw, 46px); margin: 12px 0 14px; }
.mc-lead { font-size: 17px; color: var(--mc-body); }

/* Grille de logements (enveloppe du marqueur results) */
.mc-lodgings { background: var(--mc-surface); border: 1px solid var(--mc-line); border-radius: var(--mc-radius); padding: 22px; }

/* Cartes "expérience" */
.mc-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; }
.mc-feature { padding: 32px; background: var(--mc-surface); border: 1px solid var(--mc-line); border-radius: var(--mc-radius); }
.mc-feature__ic { width: 50px; height: 50px; border-radius: 16px; background: var(--mc-avoine); color: var(--mc-foret); display: flex; align-items: center; justify-content: center; font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 700; }
.mc-feature h3 { font-size: 24px; margin: 16px 0 8px; }
.mc-feature p { font-size: 15px; }

/* Split éditorial (image + texte) */
.mc-split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.mc-split__media { aspect-ratio: 4 / 3; border-radius: var(--mc-radius); background-size: cover; background-position: center; box-shadow: var(--mc-shadow); }
.mc-split p + p { margin-top: 14px; }

/* Bandeau de chiffres */
.mc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
.mc-stat b { display: block; font-family: 'Cormorant Garamond', serif; font-size: clamp(36px, 4vw, 50px); color: var(--mc-foret); font-variant-numeric: tabular-nums; line-height: 1; }
.mc-stat span { font-size: 14px; color: var(--mc-muted); margin-top: 6px; display: block; }

/* Citation */
.mc-quote { text-align: center; max-width: 760px; margin: 0 auto; }
.mc-quote blockquote { font-family: 'Cormorant Garamond', serif; font-size: clamp(26px, 3.4vw, 38px); color: var(--mc-ink); line-height: 1.25; margin: 0 0 18px; }
.mc-quote cite { font-style: normal; color: var(--mc-muted); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }

/* Bandeau CTA */
.mc-cta { background: var(--mc-foret); color: #fff; border-radius: var(--mc-radius); padding: 60px; text-align: center; }
.mc-cta h2 { color: #fff; font-size: clamp(28px, 3.6vw, 42px); }
.mc-cta p { color: rgba(255, 255, 255, .88); margin: 12px auto 26px; max-width: 460px; }
.mc-cta .mc-btn--primary { background: var(--mc-terre); color: #fff; }
.mc-cta .mc-btn--primary:hover { background: #a76f45; }

/* Bloc réservation (marqueurs property / price / guest-form / checkout / confirmation) */
.mc-book { display: grid; grid-template-columns: 1fr 1.2fr; gap: 36px; align-items: start; }
.mc-aside { background: var(--mc-surface); border: 1px solid var(--mc-line); border-radius: var(--mc-radius); padding: 22px; position: sticky; top: 100px; }
.mc-panel { background: var(--mc-surface); border: 1px solid var(--mc-line); border-radius: var(--mc-radius); padding: 24px; }
.mc-panel + .mc-panel { margin-top: 20px; }
.mc-panel__title { font-family: 'Cormorant Garamond', serif; font-size: 26px; color: var(--mc-ink); margin: 0 0 16px; }

/* Contact */
.mc-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.mc-citem { padding: 22px 0; border-bottom: 1px solid var(--mc-line); }
.mc-citem span { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--mc-muted); margin-bottom: 4px; }
.mc-citem a, .mc-citem strong { color: var(--mc-ink); font-weight: 700; font-size: 17px; text-decoration: none; }
.mc-map { aspect-ratio: 1 / 1; border-radius: var(--mc-radius); background-size: cover; background-position: center; border: 1px solid var(--mc-line); }

/* Footer */
.mc-footer { background: var(--mc-ink); color: #cdd3c2; padding: 56px 0 32px; }
.mc-footer__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 36px; }
.mc-footer .mc-brand { color: #fff; }
.mc-footer h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: #a7af9b; margin: 0 0 14px; }
.mc-footer a { display: block; color: #cdd3c2; text-decoration: none; font-size: 15px; padding: 4px 0; }
.mc-footer a:hover { color: #fff; }
.mc-footer__sub { margin-top: 16px; font-size: 14px; max-width: 280px; color: #a7af9b; }
.mc-footer__bar { border-top: 1px solid rgba(255, 255, 255, .12); margin-top: 40px; padding-top: 22px; font-size: 13px; color: #939a86; }

@media (max-width: 900px) {
  .mc-features, .mc-split, .mc-book, .mc-contact, .mc-footer__grid, .mc-stats { grid-template-columns: 1fr; }
  .mc-nav__links { display: none; }
  .mc-aside { position: static; }
  .mc-section { padding: 64px 0; }
  .mc-hero__inner { padding: 72px 0 48px; }
  .mc-hero__search { margin-top: -40px; padding-bottom: 48px; }
}`;

/** Barre de navigation (partagée). `active` = chemin de la page courante (état visuel). */
function nav(active: string): string {
  const link = (href: string, label: string) =>
    `<a class="mc-nav__link" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="mc-nav"><div class="mc-wrap mc-nav__inner">
    <a class="mc-brand" href="/"><i></i>Baitly</a>
    <nav class="mc-nav__links">
      ${link('/', 'Accueil')}
      ${link('/logements', 'Nos gîtes')}
      ${link('/a-propos', 'La maison')}
      ${link('/contact', 'Contact')}
      <a class="mc-btn mc-btn--primary mc-nav__cta" href="/logements">Réserver</a>
    </nav>
  </div></header>`;
}

/** Pied de page (partagé). */
const FOOTER = `<footer class="mc-footer"><div class="mc-wrap">
  <div class="mc-footer__grid">
    <div>
      <a class="mc-brand" href="/"><i></i>Baitly</a>
      <p class="mc-footer__sub">Gîtes et maisons de campagne au cœur de la nature. Réservation directe, accueil chaleureux, retour à l'essentiel.</p>
    </div>
    <div>
      <h4>Explorer</h4>
      <a href="/logements">Nos gîtes</a>
      <a href="/a-propos">La maison</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="mailto:bonjour@baitly.fr">bonjour@baitly.fr</a>
      <a href="tel:+33555000000">+33 5 55 00 00 00</a>
      <a href="#">Chemin des Vergers, En pleine campagne</a>
    </div>
  </div>
  <div class="mc-footer__bar mc-wrap" style="padding-left:0;padding-right:0;">© Baitly — Gîtes & maisons de campagne. Tous droits réservés.</div>
</div></footer>`;

const HERO_IMG = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=70';
const ABOUT_IMG = 'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1200&q=70';
const STORY_IMG = 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=70';
const MAP_IMG = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=70';

/** Fonds image en classes CSS (le style inline est retiré par GrapesJS à l'import). */
const IMG_CSS = `
.mc-hero__bg { background-image: url('${HERO_IMG}'); }
.mc-img-about { background-image: url('${ABOUT_IMG}'); }
.mc-img-story { background-image: url('${STORY_IMG}'); }
.mc-map { background-image: url('${MAP_IMG}'); }`;

/* ── Pages ──────────────────────────────────────────────────────────────────────── */

const HOME = `<div class="mc-root">
  ${nav('/')}
  <section class="mc-hero">
    <div class="mc-hero__bg"></div>
    <div class="mc-wrap"><div class="mc-hero__inner">
      <p class="mc-eyebrow">Gîtes & maisons de campagne · Nature</p>
      <h1>Respirez : la campagne vous attend, en direct</h1>
      <p class="mc-hero__sub">Gîtes de caractère et maisons à la campagne, choisis un par un. Réservation directe, accueil chaleureux, et le silence en prime.</p>
    </div></div>
  </section>
  <section class="mc-hero__search">
    <div class="mc-wrap"><div class="mc-searchcard">
      <p class="mc-searchcard__label">Trouvez votre coin de campagne</p>
      <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
    </div></div>
  </section>

  <section class="mc-section">
    <div class="mc-wrap">
      <div class="mc-section__head">
        <p class="mc-eyebrow">Notre collection</p>
        <h2>Des maisons choisies, pas listées</h2>
        <p class="mc-lead">Cheminées, potagers, terrasses sur les prés et grands jardins — chaque gîte est visité et retenu pour son âme et son calme.</p>
      </div>
      <div class="mc-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>

  <section class="mc-section mc-section--avoine">
    <div class="mc-wrap">
      <div class="mc-section__head mc-section__head--center">
        <p class="mc-eyebrow">L'expérience Baitly</p>
        <h2>Bien plus qu'une location</h2>
      </div>
      <div class="mc-features">
        <div class="mc-feature"><div class="mc-feature__ic">✦</div><h3>Accueil chaleureux</h3><p>Un panier de bienvenue de produits du coin et une équipe locale aux petits soins.</p></div>
        <div class="mc-feature"><div class="mc-feature__ic">%</div><h3>Réservation directe</h3><p>Le meilleur tarif, sans commission d'intermédiaire, paiement sécurisé.</p></div>
        <div class="mc-feature"><div class="mc-feature__ic">♥</div><h3>Sur mesure</h3><p>Balades guidées, table d'hôtes, prêt de vélos : nous composons votre séjour.</p></div>
      </div>
    </div>
  </section>

  <section class="mc-section">
    <div class="mc-wrap"><div class="mc-split">
      <div class="mc-split__media mc-img-about"></div>
      <div>
        <p class="mc-eyebrow">La maison</p>
        <h2>L'art de recevoir, au grand air</h2>
        <p>Depuis dix ans, nous veillons sur une poignée de gîtes de campagne comme sur des maisons de famille. Notre équipe locale conjugue exigence du confort et hospitalité sincère.</p>
        <p>De l'arrivée au dernier au revoir, chaque détail est pensé pour que vous n'ayez qu'à profiter de la nature.</p>
        <p style="margin-top:24px"><a class="mc-btn mc-btn--ghost" href="/a-propos">Découvrir la maison</a></p>
      </div>
    </div></div>
  </section>

  <section class="mc-section mc-section--tint">
    <div class="mc-wrap"><div class="mc-stats">
      <div class="mc-stat"><b>28+</b><span>Gîtes à la campagne</span></div>
      <div class="mc-stat"><b>4.9</b><span>Note moyenne voyageurs</span></div>
      <div class="mc-stat"><b>10</b><span>Ans au cœur de la nature</span></div>
    </div></div>
  </section>

  <section class="mc-section">
    <div class="mc-wrap"><div class="mc-quote">
      <blockquote>« Le chant des oiseaux au réveil, une maison pleine de charme, un accueil comme à la maison. On reviendra. »</blockquote>
      <cite>Camille R. — Nantes</cite>
    </div></div>
  </section>

  <section class="mc-section mc-section--tint">
    <div class="mc-wrap"><div class="mc-cta">
      <h2>Prêt à ralentir, le temps d'un séjour ?</h2>
      <p>Dites-nous vos dates, nous nous occupons du reste.</p>
      <a class="mc-btn mc-btn--primary" href="/logements">Voir les disponibilités</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const LODGINGS = `<div class="mc-root">
  ${nav('/logements')}
  <section class="mc-section">
    <div class="mc-wrap">
      <div class="mc-section__head">
        <p class="mc-eyebrow">Nos gîtes</p>
        <h2>Choisissez votre gîte</h2>
        <p class="mc-lead">Sélectionnez vos dates pour découvrir les gîtes disponibles et leurs tarifs en temps réel.</p>
      </div>
      <div class="mc-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const RESERVE = `<div class="mc-root">
  ${nav('/logements')}
  <section class="mc-section">
    <div class="mc-wrap">
      <div class="mc-section__head">
        <p class="mc-eyebrow">Votre réservation</p>
        <h2>Finalisez votre séjour</h2>
      </div>
      <div class="mc-book">
        <aside class="mc-aside">
          <div data-clenzy-widget="property"></div>
          <div style="height:16px"></div>
          <div data-clenzy-widget="price"></div>
        </aside>
        <div>
          <div class="mc-panel">
            <h3 class="mc-panel__title">Vos coordonnées</h3>
            <div data-clenzy-widget="guest-form"></div>
          </div>
          <div class="mc-panel">
            <h3 class="mc-panel__title">Paiement</h3>
            <div data-clenzy-widget="checkout" data-clenzy-return="/confirmation"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const CONFIRMATION = `<div class="mc-root">
  ${nav('/logements')}
  <section class="mc-section">
    <div class="mc-wrap" style="max-width:680px">
      <div class="mc-panel" style="text-align:center;padding:48px">
        <div data-clenzy-widget="confirmation"></div>
        <p style="margin-top:24px"><a class="mc-btn mc-btn--ghost" href="/">Retour à l'accueil</a></p>
      </div>
    </div>
  </section>
  <section class="mc-section mc-section--avoine">
    <div class="mc-wrap">
      <div class="mc-section__head mc-section__head--center">
        <p class="mc-eyebrow">Sublimez votre séjour</p>
        <h2>Services à la carte</h2>
      </div>
      <div data-clenzy-widget="upsells"></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const ABOUT = `<div class="mc-root">
  ${nav('/a-propos')}
  <section class="mc-section">
    <div class="mc-wrap">
      <div class="mc-section__head">
        <p class="mc-eyebrow">La maison</p>
        <h2>Baitly, gardiens de gîtes de campagne depuis 2014</h2>
        <p class="mc-lead">Une conciergerie indépendante, ancrée à la campagne, qui place l'humain et le détail au cœur de chaque séjour.</p>
      </div>
      <div class="mc-split">
        <div class="mc-split__media mc-img-story"></div>
        <div>
          <h2>Notre histoire</h2>
          <p>Tout a commencé par une vieille ferme, restaurée avec des artisans du village. Le bouche-à-oreille a fait le reste : aujourd'hui, nous veillons sur une collection confidentielle de gîtes et de maisons de campagne.</p>
          <p>Nous refusons la standardisation. Chaque maison garde son caractère ; notre rôle est de rendre votre séjour fluide, chaleureux et ressourçant.</p>
        </div>
      </div>
    </div>
  </section>
  <section class="mc-section mc-section--avoine">
    <div class="mc-wrap">
      <div class="mc-features">
        <div class="mc-feature"><h3>Authenticité</h3><p>Des maisons de caractère, loin des décors interchangeables.</p></div>
        <div class="mc-feature"><h3>Exigence</h3><p>Ménage soigné, linge de qualité, maintenance suivie. Le confort sans compromis.</p></div>
        <div class="mc-feature"><h3>Proximité</h3><p>Une équipe locale joignable, qui connaît chaque sentier et chaque bonne adresse.</p></div>
      </div>
    </div>
  </section>
  <section class="mc-section">
    <div class="mc-wrap"><div class="mc-cta">
      <h2>Séjournez chez nous</h2>
      <p>Découvrez nos gîtes disponibles et réservez en direct.</p>
      <a class="mc-btn mc-btn--primary" href="/logements">Voir les gîtes</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const CONTACT = `<div class="mc-root">
  ${nav('/contact')}
  <section class="mc-section">
    <div class="mc-wrap">
      <div class="mc-section__head">
        <p class="mc-eyebrow">Contact</p>
        <h2>Parlons de votre séjour</h2>
        <p class="mc-lead">Une question, une demande sur mesure ? Notre équipe vous répond rapidement.</p>
      </div>
      <div class="mc-contact">
        <div>
          <div class="mc-citem"><span>Email</span><a href="mailto:bonjour@baitly.fr">bonjour@baitly.fr</a></div>
          <div class="mc-citem"><span>Téléphone</span><a href="tel:+33555000000">+33 5 55 00 00 00</a></div>
          <div class="mc-citem"><span>Adresse</span><strong>Chemin des Vergers — En pleine campagne</strong></div>
          <div class="mc-citem"><span>Horaires</span><strong>Accueil 7j/7, 24h/24</strong></div>
          <p style="margin-top:26px"><a class="mc-btn mc-btn--primary" href="/logements">Réserver un gîte</a></p>
        </div>
        <div class="mc-map"></div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

/** Vignette d'aperçu : dégradé sauge → forêt avec liseré terre (data-URI SVG, aucune dépendance externe). */
const THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%236e8b62'/%3E%3Cstop offset='1' stop-color='%233f5a3a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='180' fill='url(%23g)'/%3E%3Crect y='150' width='320' height='30' fill='%23c08457'/%3E%3C/svg%3E";

/** Concatène le design system partagé + le CSS éventuel de la page. */
const css = (pageCss = ''): string => `${SHARED_CSS}\n${IMG_CSS}\n${pageCss}`;

export const maisonCampagne: GalleryTemplate = {
  id: 'maison-campagne',
  name: 'Maison de campagne',
  description: 'Nature chaleureuse — hero plein écran',
  thumbnail: THUMBNAIL,
  theme: { primaryColor: '#3f5a3a', fontFamily: "'Nunito Sans', system-ui, -apple-system, sans-serif", headingFontFamily: "'Cormorant Garamond', Georgia, serif" },
  pages: [
    { path: '/', type: 'HOME', title: 'Accueil', seoTitle: 'Baitly — Gîtes & maisons de campagne', seoDescription: 'Gîtes de caractère et maisons à la campagne. Réservation directe, accueil chaleureux, séjours ressourçants.', html: HOME, css: css() },
    { path: '/logements', type: 'PROPERTY_LIST', title: 'Nos gîtes', seoTitle: 'Nos gîtes disponibles — Baitly', seoDescription: 'Découvrez nos gîtes de campagne et leurs disponibilités en temps réel.', html: LODGINGS, css: css() },
    { path: '/reserver', type: 'CUSTOM', title: 'Réserver', seoTitle: 'Finaliser votre réservation — Baitly', seoDescription: 'Renseignez vos coordonnées et réglez votre séjour en toute sécurité.', html: RESERVE, css: css() },
    { path: '/confirmation', type: 'CUSTOM', title: 'Confirmation', seoTitle: 'Réservation confirmée — Baitly', seoDescription: 'Votre réservation est confirmée.', html: CONFIRMATION, css: css() },
    { path: '/a-propos', type: 'CUSTOM', title: 'La maison', seoTitle: 'La maison — Baitly, gîtes de campagne', seoDescription: 'Une conciergerie indépendante ancrée à la campagne depuis 2014.', html: ABOUT, css: css() },
    { path: '/contact', type: 'CUSTOM', title: 'Contact', seoTitle: 'Contact — Baitly', seoDescription: 'Contactez notre équipe pour préparer votre séjour à la campagne.', html: CONTACT, css: css() },
  ],
};
