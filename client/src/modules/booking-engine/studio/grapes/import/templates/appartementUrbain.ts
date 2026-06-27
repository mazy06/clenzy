import type { GalleryTemplate } from '../galleryTemplates';

/**
 * Template natif « Appartement urbain » — multi-page, HTML+CSS pensé POUR l'éditeur GrapesJS.
 *
 * Ambiance city / voyage d'affaires : palette sobre et contrastée (encre quasi-noire, gris froid, blanc
 * pur, accent indigo électrique), typographie 100 % sans-serif géométrique (Space Grotesk en titres,
 * Inter en corps), mise en page dense et carrée (peu d'arrondis, lignes nettes). Aucune dépendance :
 * polices via `@import` Google Fonts, images via URLs absolues (éditables ensuite dans le Studio).
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
  "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');";

/** Design system partagé par toutes les pages (tokens + nav + sections + cartes + footer + responsive). */
const SHARED_CSS = `${FONTS_IMPORT}
.ub-root {
  --ub-ink: #121417;
  --ub-body: #4a4f57;
  --ub-muted: #868d97;
  --ub-bg: #f6f7f9;
  --ub-surface: #ffffff;
  --ub-indigo: #3f3df0;
  --ub-indigo-deep: #2f2dc4;
  --ub-line: #e4e7ec;
  --ub-line-strong: #cfd4dc;
  --ub-radius: 8px;
  --ub-shadow: 0 20px 52px -32px rgba(18, 20, 23, 0.4);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--ub-body);
  background: var(--ub-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.ub-root * { box-sizing: border-box; }
.ub-root h1, .ub-root h2, .ub-root h3 {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  color: var(--ub-ink);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0;
  text-wrap: balance;
}
.ub-root p { margin: 0; }
.ub-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
.ub-eyebrow {
  text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; font-weight: 600;
  color: var(--ub-indigo);
}
.ub-btn {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 13px 24px; border-radius: var(--ub-radius); border: 1px solid transparent;
  font: inherit; font-weight: 600; font-size: 15px; text-decoration: none;
  transition: background-color .2s ease, color .2s ease, border-color .2s ease;
}
.ub-btn--primary { background: var(--ub-ink); color: #fff; }
.ub-btn--primary:hover { background: var(--ub-indigo); }
.ub-btn--ghost { background: transparent; color: var(--ub-ink); border-color: var(--ub-line-strong); }
.ub-btn--ghost:hover { border-color: var(--ub-ink); }

/* Navigation */
.ub-nav { position: sticky; top: 0; z-index: 20; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ub-line); }
.ub-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 70px; }
.ub-brand { display: flex; align-items: center; gap: 9px; font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: var(--ub-ink); text-decoration: none; letter-spacing: -0.02em; }
.ub-brand i { width: 22px; height: 22px; border-radius: 6px; background: var(--ub-ink); display: inline-flex; align-items: center; justify-content: center; color: #fff; font-style: normal; font-size: 13px; font-weight: 700; }
.ub-nav__links { display: flex; align-items: center; gap: 30px; }
.ub-nav__link { color: var(--ub-body); text-decoration: none; font-size: 15px; font-weight: 500; transition: color .2s ease; }
.ub-nav__link:hover { color: var(--ub-ink); }
.ub-nav__link[aria-current="page"] { color: var(--ub-ink); }
.ub-nav__cta { margin-left: 6px; }

/* Hero split (texte + recherche / visuel) */
.ub-hero { padding: 64px 0 80px; background: var(--ub-surface); border-bottom: 1px solid var(--ub-line); }
.ub-hero__grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 52px; align-items: center; }
.ub-hero h1 { font-size: clamp(40px, 5.4vw, 62px); margin: 16px 0 18px; }
.ub-hero__sub { font-size: 18px; color: var(--ub-body); max-width: 460px; margin-bottom: 26px; }
.ub-hero__media { aspect-ratio: 4 / 5; border-radius: var(--ub-radius); background-size: cover; background-position: center; box-shadow: var(--ub-shadow); }
.ub-searchcard { background: var(--ub-surface); border: 1px solid var(--ub-line-strong); border-radius: var(--ub-radius); padding: 18px; }
.ub-searchcard__label { font-size: 12px; font-weight: 600; color: var(--ub-muted); margin: 0 0 12px; text-transform: uppercase; letter-spacing: .1em; }

/* Sections */
.ub-section { padding: 88px 0; }
.ub-section--tint { background: var(--ub-surface); }
.ub-section--dark { background: var(--ub-ink); }
.ub-section__head { max-width: 620px; margin-bottom: 42px; }
.ub-section__head--center { margin-left: auto; margin-right: auto; text-align: center; }
.ub-section h2 { font-size: clamp(30px, 4vw, 44px); margin: 12px 0 14px; }
.ub-lead { font-size: 17px; color: var(--ub-body); }

/* Grille de logements (enveloppe du marqueur results) */
.ub-lodgings { background: var(--ub-surface); border: 1px solid var(--ub-line); border-radius: var(--ub-radius); padding: 22px; }
.ub-searchbar { background: var(--ub-surface); border: 1px solid var(--ub-line-strong); border-radius: var(--ub-radius); padding: 16px; margin-bottom: 28px; }

/* Cartes "avantage" */
.ub-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--ub-line); border: 1px solid var(--ub-line); border-radius: var(--ub-radius); overflow: hidden; }
.ub-feature { padding: 32px; background: var(--ub-surface); }
.ub-feature__k { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: var(--ub-indigo); letter-spacing: .04em; }
.ub-feature h3 { font-size: 21px; margin: 12px 0 8px; }
.ub-feature p { font-size: 15px; }

/* Split éditorial (image + texte) */
.ub-split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.ub-split__media { aspect-ratio: 4 / 3; border-radius: var(--ub-radius); background-size: cover; background-position: center; box-shadow: var(--ub-shadow); }
.ub-split p + p { margin-top: 14px; }

/* Bandeau de chiffres (sur fond sombre) */
.ub-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
.ub-stat b { display: block; font-family: 'Space Grotesk', sans-serif; font-size: clamp(34px, 4vw, 48px); color: #fff; font-variant-numeric: tabular-nums; line-height: 1; }
.ub-stat span { font-size: 14px; color: #9aa1ab; margin-top: 6px; display: block; }
.ub-section--dark h2 { color: #fff; }
.ub-section--dark .ub-eyebrow { color: #8d8bff; }

/* Citation */
.ub-quote { text-align: center; max-width: 760px; margin: 0 auto; }
.ub-quote blockquote { font-family: 'Space Grotesk', sans-serif; font-size: clamp(24px, 3.2vw, 34px); color: var(--ub-ink); line-height: 1.25; margin: 0 0 18px; font-weight: 500; letter-spacing: -0.02em; }
.ub-quote cite { font-style: normal; color: var(--ub-muted); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }

/* Bandeau CTA */
.ub-cta { background: var(--ub-indigo); color: #fff; border-radius: var(--ub-radius); padding: 60px; text-align: center; }
.ub-cta h2 { color: #fff; font-size: clamp(28px, 3.6vw, 42px); }
.ub-cta p { color: rgba(255, 255, 255, .85); margin: 12px auto 26px; max-width: 460px; }
.ub-cta .ub-btn--primary { background: #fff; color: var(--ub-indigo-deep); }
.ub-cta .ub-btn--primary:hover { background: var(--ub-bg); }

/* Bloc réservation (marqueurs property / price / guest-form / checkout / confirmation) */
.ub-book { display: grid; grid-template-columns: 1fr 1.2fr; gap: 36px; align-items: start; }
.ub-aside { background: var(--ub-surface); border: 1px solid var(--ub-line); border-radius: var(--ub-radius); padding: 22px; position: sticky; top: 92px; }
.ub-panel { background: var(--ub-surface); border: 1px solid var(--ub-line); border-radius: var(--ub-radius); padding: 24px; }
.ub-panel + .ub-panel { margin-top: 20px; }
.ub-panel__title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: var(--ub-ink); margin: 0 0 16px; letter-spacing: -0.02em; }

/* Contact */
.ub-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.ub-citem { padding: 22px 0; border-bottom: 1px solid var(--ub-line); }
.ub-citem span { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--ub-muted); margin-bottom: 4px; }
.ub-citem a, .ub-citem strong { color: var(--ub-ink); font-weight: 600; font-size: 17px; text-decoration: none; }
.ub-map { aspect-ratio: 1 / 1; border-radius: var(--ub-radius); background-size: cover; background-position: center; border: 1px solid var(--ub-line); }

/* Footer */
.ub-footer { background: var(--ub-ink); color: #b9bfc8; padding: 56px 0 30px; }
.ub-footer__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 36px; }
.ub-footer .ub-brand { color: #fff; }
.ub-footer .ub-brand i { background: #fff; color: var(--ub-ink); }
.ub-footer h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: #868d97; margin: 0 0 14px; }
.ub-footer a { display: block; color: #b9bfc8; text-decoration: none; font-size: 15px; padding: 4px 0; }
.ub-footer a:hover { color: #fff; }
.ub-footer__sub { margin-top: 16px; font-size: 14px; max-width: 280px; color: #868d97; }
.ub-footer__bar { border-top: 1px solid rgba(255, 255, 255, .12); margin-top: 40px; padding-top: 22px; font-size: 13px; color: #757c86; }

@media (max-width: 900px) {
  .ub-hero__grid, .ub-features, .ub-split, .ub-book, .ub-contact, .ub-footer__grid, .ub-stats { grid-template-columns: 1fr; }
  .ub-nav__links { display: none; }
  .ub-aside { position: static; }
  .ub-section { padding: 60px 0; }
  .ub-hero { padding: 44px 0 56px; }
  .ub-hero__media { aspect-ratio: 16 / 10; }
}`;

/** Barre de navigation (partagée). `active` = chemin de la page courante (état visuel). */
function nav(active: string): string {
  const link = (href: string, label: string) =>
    `<a class="ub-nav__link" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="ub-nav"><div class="ub-wrap ub-nav__inner">
    <a class="ub-brand" href="/"><i>B</i>Baitly</a>
    <nav class="ub-nav__links">
      ${link('/', 'Accueil')}
      ${link('/logements', 'Nos appartements')}
      ${link('/a-propos', 'L’agence')}
      ${link('/contact', 'Contact')}
      <a class="ub-btn ub-btn--primary ub-nav__cta" href="/logements">Réserver</a>
    </nav>
  </div></header>`;
}

/** Pied de page (partagé). */
const FOOTER = `<footer class="ub-footer"><div class="ub-wrap">
  <div class="ub-footer__grid">
    <div>
      <a class="ub-brand" href="/"><i>B</i>Baitly</a>
      <p class="ub-footer__sub">Appartements meublés en centre-ville, pensés pour les voyageurs d'affaires et les séjours productifs.</p>
    </div>
    <div>
      <h4>Explorer</h4>
      <a href="/logements">Nos appartements</a>
      <a href="/a-propos">L'agence</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="mailto:bonjour@baitly.fr">bonjour@baitly.fr</a>
      <a href="tel:+33180000000">+33 1 80 00 00 00</a>
      <a href="#">Quartier d'affaires, Centre-ville</a>
    </div>
  </div>
  <div class="ub-footer__bar ub-wrap" style="padding-left:0;padding-right:0;">© Baitly — Appartements urbains. Tous droits réservés.</div>
</div></footer>`;

const HERO_IMG = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=70';
const ABOUT_IMG = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=70';
const STORY_IMG = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=70';
const MAP_IMG = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1000&q=70';

/* ── Pages ──────────────────────────────────────────────────────────────────────── */

const HOME = `<div class="ub-root">
  ${nav('/')}
  <section class="ub-hero">
    <div class="ub-wrap"><div class="ub-hero__grid">
      <div>
        <p class="ub-eyebrow">Appartements meublés · Centre-ville</p>
        <h1>Un pied-à-terre prêt à travailler, en plein cœur de la ville</h1>
        <p class="ub-hero__sub">Appartements équipés à deux pas des affaires, des gares et des transports. Réservation directe, check-in autonome, facturation claire.</p>
        <div class="ub-searchcard">
          <p class="ub-searchcard__label">Trouvez votre appartement</p>
          <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
        </div>
      </div>
      <div class="ub-hero__media" style="background-image:url('${HERO_IMG}')"></div>
    </div></div>
  </section>

  <section class="ub-section">
    <div class="ub-wrap">
      <div class="ub-section__head">
        <p class="ub-eyebrow">Notre sélection</p>
        <h2>Des adresses pensées pour le travail</h2>
        <p class="ub-lead">Bureau dédié, wifi fibré, cuisine équipée et emplacement central — chaque appartement est calibré pour les séjours professionnels comme les week-ends en ville.</p>
      </div>
      <div class="ub-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>

  <section class="ub-section ub-section--tint">
    <div class="ub-wrap">
      <div class="ub-section__head ub-section__head--center">
        <p class="ub-eyebrow">L'expérience Baitly</p>
        <h2>Conçu pour les déplacements efficaces</h2>
      </div>
      <div class="ub-features">
        <div class="ub-feature"><div class="ub-feature__k">CHECK-IN 24/7</div><h3>Arrivée autonome</h3><p>Boîte à clés connectée et instructions claires : arrivez quand vous voulez, sans attendre personne.</p></div>
        <div class="ub-feature"><div class="ub-feature__k">FACTURATION</div><h3>Note pro en un clic</h3><p>Facture détaillée et conforme, prête pour votre note de frais après chaque séjour.</p></div>
        <div class="ub-feature"><div class="ub-feature__k">CONNECTÉ</div><h3>Bureau & fibre</h3><p>Espace de travail dédié, wifi haut débit, écran sur demande : restez productif.</p></div>
      </div>
    </div>
  </section>

  <section class="ub-section">
    <div class="ub-wrap"><div class="ub-split">
      <div class="ub-split__media" style="background-image:url('${ABOUT_IMG}')"></div>
      <div>
        <p class="ub-eyebrow">L'agence</p>
        <h2>L'efficacité, sans rien sacrifier au confort</h2>
        <p>Depuis dix ans, nous gérons un parc d'appartements en centre-ville pensés pour les voyageurs exigeants. Notre équipe locale conjugue réactivité et standards hôteliers.</p>
        <p>De la réservation à la facture, chaque étape est fluide pour que vous restiez concentré sur l'essentiel.</p>
        <p style="margin-top:24px"><a class="ub-btn ub-btn--ghost" href="/a-propos">Découvrir l'agence</a></p>
      </div>
    </div></div>
  </section>

  <section class="ub-section ub-section--dark">
    <div class="ub-wrap"><div class="ub-stats">
      <div class="ub-stat"><b>60+</b><span>Appartements en centre-ville</span></div>
      <div class="ub-stat"><b>4.8</b><span>Note moyenne voyageurs</span></div>
      <div class="ub-stat"><b>15 min</b><span>Du quartier d'affaires</span></div>
    </div></div>
  </section>

  <section class="ub-section">
    <div class="ub-wrap"><div class="ub-quote">
      <blockquote>« Arrivée à 23 h sans souci, bureau impeccable, facture reçue le lendemain. Exactement ce qu'il me faut en déplacement. »</blockquote>
      <cite>Julien M. — Consultant</cite>
    </div></div>
  </section>

  <section class="ub-section ub-section--tint">
    <div class="ub-wrap"><div class="ub-cta">
      <h2>Votre prochain déplacement, déjà réglé</h2>
      <p>Dites-nous vos dates, nous nous occupons du reste.</p>
      <a class="ub-btn ub-btn--primary" href="/logements">Voir les disponibilités</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const LODGINGS = `<div class="ub-root">
  ${nav('/logements')}
  <section class="ub-section">
    <div class="ub-wrap">
      <div class="ub-section__head">
        <p class="ub-eyebrow">Nos appartements</p>
        <h2>Choisissez votre appartement</h2>
        <p class="ub-lead">Sélectionnez vos dates pour découvrir les appartements disponibles et leurs tarifs en temps réel.</p>
      </div>
      <div class="ub-searchbar"><div data-clenzy-widget="search" data-clenzy-next="/logements"></div></div>
      <div class="ub-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const RESERVE = `<div class="ub-root">
  ${nav('/logements')}
  <section class="ub-section">
    <div class="ub-wrap">
      <div class="ub-section__head">
        <p class="ub-eyebrow">Votre réservation</p>
        <h2>Finalisez votre séjour</h2>
      </div>
      <div class="ub-book">
        <aside class="ub-aside">
          <div data-clenzy-widget="property"></div>
          <div style="height:16px"></div>
          <div data-clenzy-widget="price"></div>
        </aside>
        <div>
          <div class="ub-panel">
            <h3 class="ub-panel__title">Vos coordonnées</h3>
            <div data-clenzy-widget="guest-form"></div>
          </div>
          <div class="ub-panel">
            <h3 class="ub-panel__title">Paiement</h3>
            <div data-clenzy-widget="checkout" data-clenzy-return="/confirmation"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const CONFIRMATION = `<div class="ub-root">
  ${nav('/logements')}
  <section class="ub-section">
    <div class="ub-wrap" style="max-width:680px">
      <div class="ub-panel" style="text-align:center;padding:48px">
        <div data-clenzy-widget="confirmation"></div>
        <p style="margin-top:24px"><a class="ub-btn ub-btn--ghost" href="/">Retour à l'accueil</a></p>
      </div>
    </div>
  </section>
  <section class="ub-section ub-section--tint">
    <div class="ub-wrap">
      <div class="ub-section__head ub-section__head--center">
        <p class="ub-eyebrow">Optimisez votre séjour</p>
        <h2>Services à la carte</h2>
      </div>
      <div data-clenzy-widget="upsells"></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const ABOUT = `<div class="ub-root">
  ${nav('/a-propos')}
  <section class="ub-section">
    <div class="ub-wrap">
      <div class="ub-section__head">
        <p class="ub-eyebrow">L'agence</p>
        <h2>Baitly, l'hôtellerie urbaine en mode appartement depuis 2014</h2>
        <p class="ub-lead">Une agence indépendante, ancrée au cœur de la ville, qui place la fiabilité et le détail au cœur de chaque séjour.</p>
      </div>
      <div class="ub-split">
        <div class="ub-split__media" style="background-image:url('${STORY_IMG}')"></div>
        <div>
          <h2>Notre histoire</h2>
          <p>Tout a commencé par un appartement loué à des consultants de passage. Le bouche-à-oreille a fait le reste : aujourd'hui, nous gérons un parc d'adresses choisies en centre-ville.</p>
          <p>Nous refusons l'impersonnel. Chaque appartement garde son caractère ; notre rôle est de rendre votre séjour fluide, efficace et confortable.</p>
        </div>
      </div>
    </div>
  </section>
  <section class="ub-section ub-section--tint">
    <div class="ub-wrap">
      <div class="ub-features">
        <div class="ub-feature"><h3>Fiabilité</h3><p>Des logements vérifiés avant chaque arrivée, sans mauvaise surprise.</p></div>
        <div class="ub-feature"><h3>Exigence</h3><p>Ménage hôtelier, linge de qualité, équipements suivis. Le confort sans compromis.</p></div>
        <div class="ub-feature"><h3>Réactivité</h3><p>Une équipe locale joignable, qui répond vite et connaît son quartier.</p></div>
      </div>
    </div>
  </section>
  <section class="ub-section">
    <div class="ub-wrap"><div class="ub-cta">
      <h2>Séjournez chez nous</h2>
      <p>Découvrez nos appartements disponibles et réservez en direct.</p>
      <a class="ub-btn ub-btn--primary" href="/logements">Voir les appartements</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const CONTACT = `<div class="ub-root">
  ${nav('/contact')}
  <section class="ub-section">
    <div class="ub-wrap">
      <div class="ub-section__head">
        <p class="ub-eyebrow">Contact</p>
        <h2>Parlons de votre séjour</h2>
        <p class="ub-lead">Une question, une demande pour un séjour long ou une note de frais ? Notre équipe vous répond rapidement.</p>
      </div>
      <div class="ub-contact">
        <div>
          <div class="ub-citem"><span>Email</span><a href="mailto:bonjour@baitly.fr">bonjour@baitly.fr</a></div>
          <div class="ub-citem"><span>Téléphone</span><a href="tel:+33180000000">+33 1 80 00 00 00</a></div>
          <div class="ub-citem"><span>Adresse</span><strong>Quartier d'affaires — Centre-ville</strong></div>
          <div class="ub-citem"><span>Horaires</span><strong>Assistance 7j/7, 24h/24</strong></div>
          <p style="margin-top:26px"><a class="ub-btn ub-btn--primary" href="/logements">Réserver un appartement</a></p>
        </div>
        <div class="ub-map" style="background-image:url('${MAP_IMG}')"></div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

/** Vignette d'aperçu : bandeau encre + accent indigo (data-URI SVG, aucune dépendance externe). */
const THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23f6f7f9'/%3E%3Crect width='320' height='112' fill='%23121417'/%3E%3Crect x='24' y='128' width='150' height='14' rx='3' fill='%23cfd4dc'/%3E%3Crect x='24' y='150' width='90' height='12' rx='3' fill='%233f3df0'/%3E%3C/svg%3E";

/** Concatène le design system partagé + le CSS éventuel de la page. */
const css = (pageCss = ''): string => `${SHARED_CSS}\n${pageCss}`;

export const appartementUrbain: GalleryTemplate = {
  id: 'appartement-urbain',
  name: 'Appartement urbain',
  description: 'City & affaires — sobre et contrasté',
  thumbnail: THUMBNAIL,
  theme: { primaryColor: '#3f3df0', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  pages: [
    { path: '/', type: 'HOME', title: 'Accueil', seoTitle: 'Baitly — Appartements urbains meublés', seoDescription: 'Appartements meublés en centre-ville pour les voyageurs d’affaires. Réservation directe, check-in autonome, facturation claire.', html: HOME, css: css() },
    { path: '/logements', type: 'PROPERTY_LIST', title: 'Nos appartements', seoTitle: 'Nos appartements disponibles — Baitly', seoDescription: 'Découvrez nos appartements en centre-ville et leurs disponibilités en temps réel.', html: LODGINGS, css: css() },
    { path: '/reserver', type: 'CUSTOM', title: 'Réserver', seoTitle: 'Finaliser votre réservation — Baitly', seoDescription: 'Renseignez vos coordonnées et réglez votre séjour en toute sécurité.', html: RESERVE, css: css() },
    { path: '/confirmation', type: 'CUSTOM', title: 'Confirmation', seoTitle: 'Réservation confirmée — Baitly', seoDescription: 'Votre réservation est confirmée.', html: CONFIRMATION, css: css() },
    { path: '/a-propos', type: 'CUSTOM', title: 'L’agence', seoTitle: 'L’agence — Baitly, appartements urbains', seoDescription: 'Une agence indépendante ancrée au cœur de la ville depuis 2014.', html: ABOUT, css: css() },
    { path: '/contact', type: 'CUSTOM', title: 'Contact', seoTitle: 'Contact — Baitly', seoDescription: 'Contactez notre équipe pour préparer votre séjour en ville.', html: CONTACT, css: css() },
  ],
};
