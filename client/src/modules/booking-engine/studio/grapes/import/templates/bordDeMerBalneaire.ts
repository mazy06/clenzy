import type { GalleryTemplate } from '../galleryTemplates';

/**
 * Template natif « Bord de mer balnéaire » — multi-page, HTML+CSS pensé POUR l'éditeur GrapesJS.
 *
 * Ambiance balnéaire lumineuse : azur clair / bleu lagon / sable doré / blanc cassé, display serif
 * douce (Fraunces) + sans lisible (Inter). Hero plein écran sur la plage, barre de recherche posée
 * dessus, sélling points iodés, témoignages et bandeau de chiffres. Aucune dépendance : polices via
 * `@import` Google Fonts, images via URLs absolues (éditables ensuite dans le Studio).
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
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');";

/** Design system partagé par toutes les pages (tokens + nav + sections + cartes + footer + responsive). */
const SHARED_CSS = `${FONTS_IMPORT}
.bm-root {
  --bm-ink: #0f2b3d;
  --bm-body: #41606f;
  --bm-muted: #7d97a4;
  --bm-bg: #f4fafd;
  --bm-surface: #ffffff;
  --bm-azur: #1f8fc7;
  --bm-azur-deep: #166f9d;
  --bm-lagon: #3fc1c9;
  --bm-sable: #f3e3c3;
  --bm-sable-soft: #fbf3e2;
  --bm-line: #dceaf1;
  --bm-radius: 18px;
  --bm-shadow: 0 24px 60px -34px rgba(15, 43, 61, 0.42);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--bm-body);
  background: var(--bm-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.bm-root * { box-sizing: border-box; }
.bm-root h1, .bm-root h2, .bm-root h3 {
  font-family: 'Fraunces', Georgia, serif;
  color: var(--bm-ink);
  font-weight: 600;
  line-height: 1.08;
  margin: 0;
  text-wrap: balance;
}
.bm-root p { margin: 0; }
.bm-wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
.bm-eyebrow {
  text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 600;
  color: var(--bm-azur);
}
.bm-btn {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 13px 26px; border-radius: 999px; border: 1px solid transparent;
  font: inherit; font-weight: 600; font-size: 15px; text-decoration: none;
  transition: background-color .25s ease, color .25s ease, border-color .25s ease;
}
.bm-btn--primary { background: var(--bm-azur); color: #fff; }
.bm-btn--primary:hover { background: var(--bm-azur-deep); }
.bm-btn--ghost { background: transparent; color: var(--bm-ink); border-color: var(--bm-line); }
.bm-btn--ghost:hover { border-color: var(--bm-azur); color: var(--bm-azur); }

/* Navigation */
.bm-nav { position: sticky; top: 0; z-index: 20; background: rgba(244, 250, 253, 0.9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--bm-line); }
.bm-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 74px; }
.bm-brand { display: flex; align-items: center; gap: 9px; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 600; color: var(--bm-ink); text-decoration: none; letter-spacing: .01em; }
.bm-brand i { width: 10px; height: 10px; border-radius: 50%; background: var(--bm-lagon); display: inline-block; font-style: normal; }
.bm-nav__links { display: flex; align-items: center; gap: 30px; }
.bm-nav__link { color: var(--bm-body); text-decoration: none; font-size: 15px; font-weight: 500; transition: color .2s ease; }
.bm-nav__link:hover { color: var(--bm-azur); }
.bm-nav__link[aria-current="page"] { color: var(--bm-ink); }
.bm-nav__cta { margin-left: 6px; }

/* Hero plein écran */
.bm-hero { position: relative; color: #fff; }
.bm-hero__bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.bm-hero__bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8, 38, 56, 0.22), rgba(8, 38, 56, 0.58)); }
.bm-hero__inner { position: relative; padding: 108px 0 56px; max-width: 700px; }
.bm-hero .bm-eyebrow { color: #aee3f3; }
.bm-hero h1 { color: #fff; font-size: clamp(40px, 6vw, 66px); margin: 14px 0 18px; }
.bm-hero__sub { color: rgba(255, 255, 255, 0.92); font-size: 18px; max-width: 520px; }
.bm-hero__search { position: relative; margin-top: -56px; padding-bottom: 64px; z-index: 2; }
.bm-searchcard { background: var(--bm-surface); border: 1px solid var(--bm-line); border-radius: var(--bm-radius); box-shadow: var(--bm-shadow); padding: 18px; color: var(--bm-ink); }
.bm-searchcard__label { font-size: 12px; font-weight: 600; color: var(--bm-muted); margin: 0 0 12px; text-transform: uppercase; letter-spacing: .08em; }

/* Sections */
.bm-section { padding: 90px 0; }
.bm-section--tint { background: var(--bm-surface); }
.bm-section--sand { background: var(--bm-sable-soft); }
.bm-section__head { max-width: 620px; margin-bottom: 42px; }
.bm-section__head--center { margin-left: auto; margin-right: auto; text-align: center; }
.bm-section h2 { font-size: clamp(30px, 4vw, 44px); margin: 12px 0 14px; }
.bm-lead { font-size: 17px; color: var(--bm-body); }

/* Grille de logements (enveloppe du marqueur results) */
.bm-lodgings { background: var(--bm-surface); border: 1px solid var(--bm-line); border-radius: var(--bm-radius); padding: 22px; }
.bm-searchbar { background: var(--bm-surface); border: 1px solid var(--bm-line); border-radius: var(--bm-radius); padding: 16px; box-shadow: var(--bm-shadow); margin-bottom: 28px; }

/* Cartes "expérience" */
.bm-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.bm-feature { padding: 28px; background: var(--bm-surface); border: 1px solid var(--bm-line); border-radius: var(--bm-radius); }
.bm-feature__ic { width: 46px; height: 46px; border-radius: 14px; background: linear-gradient(135deg, var(--bm-lagon), var(--bm-azur)); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 20px; }
.bm-feature h3 { font-size: 21px; margin: 16px 0 8px; }
.bm-feature p { font-size: 15px; }

/* Split éditorial (image + texte) */
.bm-split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.bm-split__media { aspect-ratio: 4 / 3; border-radius: var(--bm-radius); background-size: cover; background-position: center; box-shadow: var(--bm-shadow); }
.bm-split p + p { margin-top: 14px; }

/* Bandeau de chiffres */
.bm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
.bm-stat b { display: block; font-family: 'Fraunces', serif; font-size: clamp(32px, 4vw, 46px); color: var(--bm-azur); font-variant-numeric: tabular-nums; line-height: 1; }
.bm-stat span { font-size: 14px; color: var(--bm-muted); margin-top: 6px; display: block; }

/* Citation */
.bm-quote { text-align: center; max-width: 760px; margin: 0 auto; }
.bm-quote blockquote { font-family: 'Fraunces', serif; font-size: clamp(24px, 3.2vw, 34px); color: var(--bm-ink); line-height: 1.3; margin: 0 0 18px; font-weight: 500; }
.bm-quote cite { font-style: normal; color: var(--bm-muted); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }

/* Bandeau CTA */
.bm-cta { background: linear-gradient(135deg, var(--bm-azur), var(--bm-lagon)); color: #fff; border-radius: 24px; padding: 60px; text-align: center; }
.bm-cta h2 { color: #fff; font-size: clamp(28px, 3.6vw, 42px); }
.bm-cta p { color: rgba(255, 255, 255, .9); margin: 12px auto 26px; max-width: 460px; }
.bm-cta .bm-btn--primary { background: #fff; color: var(--bm-azur-deep); }
.bm-cta .bm-btn--primary:hover { background: var(--bm-sable); }

/* Bloc réservation (marqueurs property / price / guest-form / checkout / confirmation) */
.bm-book { display: grid; grid-template-columns: 1fr 1.2fr; gap: 36px; align-items: start; }
.bm-aside { background: var(--bm-surface); border: 1px solid var(--bm-line); border-radius: var(--bm-radius); padding: 22px; position: sticky; top: 96px; }
.bm-panel { background: var(--bm-surface); border: 1px solid var(--bm-line); border-radius: var(--bm-radius); padding: 24px; }
.bm-panel + .bm-panel { margin-top: 20px; }
.bm-panel__title { font-family: 'Fraunces', serif; font-size: 23px; color: var(--bm-ink); margin: 0 0 16px; }

/* Contact */
.bm-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.bm-citem { padding: 22px 0; border-bottom: 1px solid var(--bm-line); }
.bm-citem span { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--bm-muted); margin-bottom: 4px; }
.bm-citem a, .bm-citem strong { color: var(--bm-ink); font-weight: 600; font-size: 17px; text-decoration: none; }
.bm-map { aspect-ratio: 1 / 1; border-radius: var(--bm-radius); background-size: cover; background-position: center; border: 1px solid var(--bm-line); }

/* Footer */
.bm-footer { background: var(--bm-ink); color: #c6dbe6; padding: 56px 0 30px; }
.bm-footer__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 36px; }
.bm-footer .bm-brand { color: #fff; }
.bm-footer h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: #93b3c2; margin: 0 0 14px; }
.bm-footer a { display: block; color: #c6dbe6; text-decoration: none; font-size: 15px; padding: 4px 0; }
.bm-footer a:hover { color: #fff; }
.bm-footer__sub { margin-top: 16px; font-size: 14px; max-width: 280px; color: #93b3c2; }
.bm-footer__bar { border-top: 1px solid rgba(255, 255, 255, .12); margin-top: 40px; padding-top: 22px; font-size: 13px; color: #82a3b3; }

@media (max-width: 900px) {
  .bm-features, .bm-split, .bm-book, .bm-contact, .bm-footer__grid, .bm-stats { grid-template-columns: 1fr; }
  .bm-nav__links { display: none; }
  .bm-aside { position: static; }
  .bm-section { padding: 64px 0; }
  .bm-hero__inner { padding: 72px 0 48px; }
  .bm-hero__search { margin-top: -40px; padding-bottom: 48px; }
}`;

/** Barre de navigation (partagée). `active` = chemin de la page courante (état visuel). */
function nav(active: string): string {
  const link = (href: string, label: string) =>
    `<a class="bm-nav__link" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="bm-nav"><div class="bm-wrap bm-nav__inner">
    <a class="bm-brand" href="/"><i></i>Baitly</a>
    <nav class="bm-nav__links">
      ${link('/', 'Accueil')}
      ${link('/logements', 'Nos logements')}
      ${link('/a-propos', 'La maison')}
      ${link('/contact', 'Contact')}
      <a class="bm-btn bm-btn--primary bm-nav__cta" href="/logements">Réserver</a>
    </nav>
  </div></header>`;
}

/** Pied de page (partagé). */
const FOOTER = `<footer class="bm-footer"><div class="bm-wrap">
  <div class="bm-footer__grid">
    <div>
      <a class="bm-brand" href="/"><i></i>Baitly</a>
      <p class="bm-footer__sub">Maisons et appartements pieds dans l'eau, le long du littoral. Réservation directe, séjours sans souci.</p>
    </div>
    <div>
      <h4>Explorer</h4>
      <a href="/logements">Nos logements</a>
      <a href="/a-propos">La maison</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="mailto:bonjour@baitly.fr">bonjour@baitly.fr</a>
      <a href="tel:+33240000000">+33 2 40 00 00 00</a>
      <a href="#">Quai des Pêcheurs, Front de mer</a>
    </div>
  </div>
  <div class="bm-footer__bar bm-wrap" style="padding-left:0;padding-right:0;">© Baitly — Locations en bord de mer. Tous droits réservés.</div>
</div></footer>`;

const HERO_IMG = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70';
const ABOUT_IMG = 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=70';
const STORY_IMG = 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=70';
const MAP_IMG = 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1000&q=70';

/** Fonds image en classes CSS (le style inline est retiré par GrapesJS à l'import). */
const IMG_CSS = `
.bm-hero__bg { background-image: url('${HERO_IMG}'); }
.bm-img-about { background-image: url('${ABOUT_IMG}'); }
.bm-img-story { background-image: url('${STORY_IMG}'); }
.bm-map { background-image: url('${MAP_IMG}'); }`;

/* ── Pages ──────────────────────────────────────────────────────────────────────── */

const HOME = `<div class="bm-root">
  ${nav('/')}
  <section class="bm-hero">
    <div class="bm-hero__bg"></div>
    <div class="bm-wrap"><div class="bm-hero__inner">
      <p class="bm-eyebrow">Locations balnéaires · Littoral</p>
      <h1>Réveillez-vous face à la mer, sans intermédiaire</h1>
      <p class="bm-hero__sub">Maisons de plage et appartements pieds dans l'eau, sélectionnés un par un. Réservation directe, accueil attentionné, le sel en prime.</p>
    </div></div>
  </section>
  <section class="bm-hero__search">
    <div class="bm-wrap"><div class="bm-searchcard">
      <p class="bm-searchcard__label">Trouvez votre escapade au bord de l'eau</p>
      <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
    </div></div>
  </section>

  <section class="bm-section">
    <div class="bm-wrap">
      <div class="bm-section__head">
        <p class="bm-eyebrow">Notre collection</p>
        <h2>Des adresses choisies, pas listées</h2>
        <p class="bm-lead">Terrasses sur la plage, vues sur le large, jardins de bord de mer — chaque logement est visité et retenu pour son atmosphère.</p>
      </div>
      <div class="bm-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>

  <section class="bm-section bm-section--sand">
    <div class="bm-wrap">
      <div class="bm-section__head bm-section__head--center">
        <p class="bm-eyebrow">L'expérience Baitly</p>
        <h2>Bien plus qu'une location</h2>
      </div>
      <div class="bm-features">
        <div class="bm-feature"><div class="bm-feature__ic">24/7</div><h3>Accueil dédié</h3><p>Un interlocuteur unique avant et pendant votre séjour, à toute heure.</p></div>
        <div class="bm-feature"><div class="bm-feature__ic">%</div><h3>Réservation directe</h3><p>Le meilleur tarif, sans commission d'intermédiaire, paiement sécurisé.</p></div>
        <div class="bm-feature"><div class="bm-feature__ic">★</div><h3>Sur mesure</h3><p>Sorties en mer, paniers de produits locaux, prêt de matériel de plage.</p></div>
      </div>
    </div>
  </section>

  <section class="bm-section">
    <div class="bm-wrap"><div class="bm-split">
      <div class="bm-split__media bm-img-about"></div>
      <div>
        <p class="bm-eyebrow">La maison</p>
        <h2>L'art de recevoir, au rythme des marées</h2>
        <p>Depuis dix ans, nous veillons sur une poignée de maisons du littoral comme sur des maisons de famille. Notre équipe locale conjugue exigence hôtelière et hospitalité sincère.</p>
        <p>De l'arrivée au dernier au revoir, chaque détail est pensé pour que vous n'ayez qu'à profiter de la plage.</p>
        <p style="margin-top:24px"><a class="bm-btn bm-btn--ghost" href="/a-propos">Découvrir la maison</a></p>
      </div>
    </div></div>
  </section>

  <section class="bm-section bm-section--tint">
    <div class="bm-wrap"><div class="bm-stats">
      <div class="bm-stat"><b>35+</b><span>Logements en bord de mer</span></div>
      <div class="bm-stat"><b>4.9</b><span>Note moyenne voyageurs</span></div>
      <div class="bm-stat"><b>10</b><span>Ans sur le littoral</span></div>
    </div></div>
  </section>

  <section class="bm-section">
    <div class="bm-wrap"><div class="bm-quote">
      <blockquote>« Le bruit des vagues au réveil, une équipe aux petits soins. On a tout simplement décroché. »</blockquote>
      <cite>Camille R. — Lyon</cite>
    </div></div>
  </section>

  <section class="bm-section bm-section--tint">
    <div class="bm-wrap"><div class="bm-cta">
      <h2>Prêt à poser vos valises face à la mer ?</h2>
      <p>Dites-nous vos dates, nous nous occupons du reste.</p>
      <a class="bm-btn bm-btn--primary" href="/logements">Voir les disponibilités</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const LODGINGS = `<div class="bm-root">
  ${nav('/logements')}
  <section class="bm-section">
    <div class="bm-wrap">
      <div class="bm-section__head">
        <p class="bm-eyebrow">Nos logements</p>
        <h2>Choisissez votre logement</h2>
        <p class="bm-lead">Sélectionnez vos dates pour découvrir les logements disponibles et leurs tarifs en temps réel.</p>
      </div>
      <div class="bm-searchbar"><div data-clenzy-widget="search" data-clenzy-next="/logements"></div></div>
      <div class="bm-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const RESERVE = `<div class="bm-root">
  ${nav('/logements')}
  <section class="bm-section">
    <div class="bm-wrap">
      <div class="bm-section__head">
        <p class="bm-eyebrow">Votre réservation</p>
        <h2>Finalisez votre séjour</h2>
      </div>
      <div class="bm-book">
        <aside class="bm-aside">
          <div data-clenzy-widget="property"></div>
          <div style="height:16px"></div>
          <div data-clenzy-widget="price"></div>
        </aside>
        <div>
          <div class="bm-panel">
            <h3 class="bm-panel__title">Vos coordonnées</h3>
            <div data-clenzy-widget="guest-form"></div>
          </div>
          <div class="bm-panel">
            <h3 class="bm-panel__title">Paiement</h3>
            <div data-clenzy-widget="checkout" data-clenzy-return="/confirmation"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const CONFIRMATION = `<div class="bm-root">
  ${nav('/logements')}
  <section class="bm-section">
    <div class="bm-wrap" style="max-width:680px">
      <div class="bm-panel" style="text-align:center;padding:48px">
        <div data-clenzy-widget="confirmation"></div>
        <p style="margin-top:24px"><a class="bm-btn bm-btn--ghost" href="/">Retour à l'accueil</a></p>
      </div>
    </div>
  </section>
  <section class="bm-section bm-section--sand">
    <div class="bm-wrap">
      <div class="bm-section__head bm-section__head--center">
        <p class="bm-eyebrow">Sublimez votre séjour</p>
        <h2>Services à la carte</h2>
      </div>
      <div data-clenzy-widget="upsells"></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const ABOUT = `<div class="bm-root">
  ${nav('/a-propos')}
  <section class="bm-section">
    <div class="bm-wrap">
      <div class="bm-section__head">
        <p class="bm-eyebrow">La maison</p>
        <h2>Baitly, gardiens de maisons de plage depuis 2014</h2>
        <p class="bm-lead">Une conciergerie indépendante, ancrée sur le littoral, qui place l'humain et le détail au cœur de chaque séjour.</p>
      </div>
      <div class="bm-split">
        <div class="bm-split__media bm-img-story"></div>
        <div>
          <h2>Notre histoire</h2>
          <p>Tout a commencé par une maison de pêcheur, restaurée avec des artisans de la région. Le bouche-à-oreille a fait le reste : aujourd'hui, nous veillons sur une collection confidentielle de logements de bord de mer.</p>
          <p>Nous refusons la standardisation. Chaque maison garde son caractère ; notre rôle est de rendre votre séjour fluide, iodé et inoubliable.</p>
        </div>
      </div>
    </div>
  </section>
  <section class="bm-section bm-section--sand">
    <div class="bm-wrap">
      <div class="bm-features">
        <div class="bm-feature"><h3>Authenticité</h3><p>Des maisons de caractère, loin des résidences interchangeables.</p></div>
        <div class="bm-feature"><h3>Exigence</h3><p>Ménage hôtelier, linge de qualité, maintenance suivie. Le confort sans compromis.</p></div>
        <div class="bm-feature"><h3>Proximité</h3><p>Une équipe locale joignable, qui connaît chaque crique et chaque bonne adresse.</p></div>
      </div>
    </div>
  </section>
  <section class="bm-section">
    <div class="bm-wrap"><div class="bm-cta">
      <h2>Séjournez chez nous</h2>
      <p>Découvrez nos logements disponibles et réservez en direct.</p>
      <a class="bm-btn bm-btn--primary" href="/logements">Voir les logements</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const CONTACT = `<div class="bm-root">
  ${nav('/contact')}
  <section class="bm-section">
    <div class="bm-wrap">
      <div class="bm-section__head">
        <p class="bm-eyebrow">Contact</p>
        <h2>Parlons de votre séjour</h2>
        <p class="bm-lead">Une question, une demande sur mesure ? Notre équipe vous répond rapidement.</p>
      </div>
      <div class="bm-contact">
        <div>
          <div class="bm-citem"><span>Email</span><a href="mailto:bonjour@baitly.fr">bonjour@baitly.fr</a></div>
          <div class="bm-citem"><span>Téléphone</span><a href="tel:+33240000000">+33 2 40 00 00 00</a></div>
          <div class="bm-citem"><span>Adresse</span><strong>Quai des Pêcheurs — Front de mer</strong></div>
          <div class="bm-citem"><span>Horaires</span><strong>Accueil 7j/7, 24h/24</strong></div>
          <p style="margin-top:26px"><a class="bm-btn bm-btn--primary" href="/logements">Réserver un logement</a></p>
        </div>
        <div class="bm-map"></div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

/** Vignette d'aperçu : dégradé azur → lagon (data-URI SVG, aucune dépendance externe). */
const THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%231f8fc7'/%3E%3Cstop offset='1' stop-color='%233fc1c9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='180' fill='url(%23g)'/%3E%3Crect y='128' width='320' height='52' fill='%23f3e3c3'/%3E%3C/svg%3E";

/** Concatène le design system partagé + le CSS éventuel de la page. */
const css = (pageCss = ''): string => `${SHARED_CSS}\n${IMG_CSS}\n${pageCss}`;

export const bordDeMerBalneaire: GalleryTemplate = {
  id: 'bord-de-mer-balneaire',
  name: 'Bord de mer balnéaire',
  description: 'Balnéaire lumineux — hero plein écran',
  thumbnail: THUMBNAIL,
  theme: { primaryColor: '#1f8fc7', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", headingFontFamily: "'Fraunces', Georgia, serif" },
  pages: [
    { path: '/', type: 'HOME', title: 'Accueil', seoTitle: 'Baitly — Locations en bord de mer', seoDescription: 'Maisons de plage et appartements pieds dans l’eau. Réservation directe, accueil attentionné, séjours sur mesure.', html: HOME, css: css() },
    { path: '/logements', type: 'PROPERTY_LIST', title: 'Nos logements', seoTitle: 'Nos logements disponibles — Baitly', seoDescription: 'Découvrez nos logements en bord de mer et leurs disponibilités en temps réel.', html: LODGINGS, css: css() },
    { path: '/reserver', type: 'CUSTOM', title: 'Réserver', seoTitle: 'Finaliser votre réservation — Baitly', seoDescription: 'Renseignez vos coordonnées et réglez votre séjour en toute sécurité.', html: RESERVE, css: css() },
    { path: '/confirmation', type: 'CUSTOM', title: 'Confirmation', seoTitle: 'Réservation confirmée — Baitly', seoDescription: 'Votre réservation est confirmée.', html: CONFIRMATION, css: css() },
    { path: '/a-propos', type: 'CUSTOM', title: 'La maison', seoTitle: 'La maison — Baitly, locations en bord de mer', seoDescription: 'Une conciergerie indépendante ancrée sur le littoral depuis 2014.', html: ABOUT, css: css() },
    { path: '/contact', type: 'CUSTOM', title: 'Contact', seoTitle: 'Contact — Baitly', seoDescription: 'Contactez notre équipe pour préparer votre séjour en bord de mer.', html: CONTACT, css: css() },
  ],
};
