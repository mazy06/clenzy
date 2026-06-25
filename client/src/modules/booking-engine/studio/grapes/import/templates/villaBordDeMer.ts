import type { GalleryTemplate } from '../galleryTemplates';

/**
 * Template natif « Villa bord de mer » — multi-page, HTML+CSS pensé POUR l'éditeur GrapesJS.
 *
 * Archétype de layout : HERO SPLIT (texte + widget de recherche à gauche / visuel à droite), puis
 * catalogue. Thème côtier : teal profond / sable / blanc cassé, display serif (Fraunces) + sans lisible
 * (Inter). Patterns de mise en page repris des bibliothèques MIT (HyperUI / Preline), réécrits dans notre
 * format scopé (aucune dépendance Tailwind) → 100 % réutilisable commercialement, sans attribution.
 *
 * MARQUEURS BOOKING = vocabulaire RUNTIME (hydraté par `BaitlyBooking.hydrate`, prévisualisé par
 * `bookingComponents`) : `search` (barre de recherche ville+dates+voyageurs), `results` (grille des
 * logements), `property` (détail), `price`, `guest-form` + `checkout` (réservation), `confirmation`,
 * `upsells`. Navigation template-driven via `data-clenzy-next` / `data-clenzy-return`.
 *
 * Chaque page porte le MÊME design system (`SHARED_CSS`) + sa nav + son footer → rendu identique
 * éditeur ↔ SSR (chaque SitePage est autonome).
 */

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');";

/** Design system partagé par toutes les pages (tokens + nav + sections + cartes + footer + responsive). */
const SHARED_CSS = `${FONTS_IMPORT}
.az-root {
  --az-ink: #14302e;
  --az-body: #46615d;
  --az-muted: #7e928e;
  --az-bg: #f7f5ef;
  --az-surface: #ffffff;
  --az-teal: #0e6b78;
  --az-teal-deep: #0a5662;
  --az-sand: #e8d9bf;
  --az-sand-soft: #f2e9d8;
  --az-line: #e7e1d4;
  --az-radius: 16px;
  --az-shadow: 0 22px 60px -34px rgba(20, 48, 46, 0.5);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--az-body);
  background: var(--az-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.az-root * { box-sizing: border-box; }
.az-root h1, .az-root h2, .az-root h3 {
  font-family: 'Fraunces', Georgia, serif;
  color: var(--az-ink);
  font-weight: 600;
  line-height: 1.08;
  margin: 0;
  text-wrap: balance;
}
.az-root p { margin: 0; }
.az-wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
.az-eyebrow {
  text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 600;
  color: var(--az-teal);
}
.az-btn {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 13px 26px; border-radius: 999px; border: 1px solid transparent;
  font: inherit; font-weight: 600; font-size: 15px; text-decoration: none;
  transition: background-color .25s ease, color .25s ease, border-color .25s ease;
}
.az-btn--primary { background: var(--az-teal); color: #fff; }
.az-btn--primary:hover { background: var(--az-teal-deep); }
.az-btn--ghost { background: transparent; color: var(--az-ink); border-color: var(--az-line); }
.az-btn--ghost:hover { border-color: var(--az-teal); color: var(--az-teal); }

/* Navigation */
.az-nav { position: sticky; top: 0; z-index: 20; background: rgba(247, 245, 239, 0.88); backdrop-filter: blur(10px); border-bottom: 1px solid var(--az-line); }
.az-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 74px; }
.az-brand { display: flex; align-items: center; gap: 9px; font-family: 'Fraunces', serif; font-size: 24px; font-weight: 600; color: var(--az-ink); text-decoration: none; letter-spacing: .01em; }
.az-brand i { width: 9px; height: 9px; border-radius: 50%; background: var(--az-teal); display: inline-block; font-style: normal; }
.az-nav__links { display: flex; align-items: center; gap: 30px; }
.az-nav__link { color: var(--az-body); text-decoration: none; font-size: 15px; font-weight: 500; transition: color .2s ease; }
.az-nav__link:hover { color: var(--az-teal); }
.az-nav__link[aria-current="page"] { color: var(--az-ink); }
.az-nav__cta { margin-left: 6px; }

/* Hero split */
.az-hero { padding: 60px 0 84px; }
.az-hero__grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 56px; align-items: center; }
.az-hero h1 { font-size: clamp(40px, 5.4vw, 64px); margin: 16px 0 18px; }
.az-hero__sub { font-size: 18px; color: var(--az-body); max-width: 480px; margin-bottom: 26px; }
.az-hero__media { aspect-ratio: 4 / 5; border-radius: 24px; background-size: cover; background-position: center; box-shadow: var(--az-shadow); }
.az-searchcard { background: var(--az-surface); border: 1px solid var(--az-line); border-radius: var(--az-radius); box-shadow: var(--az-shadow); padding: 18px; }
.az-searchcard__label { font-size: 12px; font-weight: 600; color: var(--az-muted); margin: 0 0 12px; text-transform: uppercase; letter-spacing: .08em; }

/* Sections */
.az-section { padding: 90px 0; }
.az-section--tint { background: var(--az-surface); }
.az-section--sand { background: var(--az-sand-soft); }
.az-section__head { max-width: 620px; margin-bottom: 42px; }
.az-section__head--center { margin-left: auto; margin-right: auto; text-align: center; }
.az-section h2 { font-size: clamp(30px, 4vw, 44px); margin: 12px 0 14px; }
.az-lead { font-size: 17px; color: var(--az-body); }

/* Grille de logements (enveloppe du marqueur results) */
.az-lodgings { background: var(--az-surface); border: 1px solid var(--az-line); border-radius: var(--az-radius); padding: 22px; }
.az-searchbar { background: var(--az-surface); border: 1px solid var(--az-line); border-radius: var(--az-radius); padding: 16px; box-shadow: var(--az-shadow); margin-bottom: 28px; }

/* Cartes "expérience" */
.az-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.az-feature { padding: 28px; background: var(--az-surface); border: 1px solid var(--az-line); border-radius: var(--az-radius); }
.az-feature__ic { width: 46px; height: 46px; border-radius: 12px; background: var(--az-sand-soft); color: var(--az-teal); display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 22px; }
.az-feature h3 { font-size: 21px; margin: 16px 0 8px; }
.az-feature p { font-size: 15px; }

/* Split éditorial (image + texte) */
.az-split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.az-split__media { aspect-ratio: 4 / 3; border-radius: var(--az-radius); background-size: cover; background-position: center; box-shadow: var(--az-shadow); }
.az-split p + p { margin-top: 14px; }

/* Bandeau de chiffres */
.az-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
.az-stat b { display: block; font-family: 'Fraunces', serif; font-size: clamp(32px, 4vw, 46px); color: var(--az-teal); font-variant-numeric: tabular-nums; line-height: 1; }
.az-stat span { font-size: 14px; color: var(--az-muted); margin-top: 6px; display: block; }

/* Citation */
.az-quote { text-align: center; max-width: 760px; margin: 0 auto; }
.az-quote blockquote { font-family: 'Fraunces', serif; font-size: clamp(24px, 3.2vw, 34px); color: var(--az-ink); line-height: 1.3; margin: 0 0 18px; font-weight: 500; }
.az-quote cite { font-style: normal; color: var(--az-muted); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }

/* Bandeau CTA */
.az-cta { background: var(--az-teal); color: #fff; border-radius: 24px; padding: 60px; text-align: center; }
.az-cta h2 { color: #fff; font-size: clamp(28px, 3.6vw, 42px); }
.az-cta p { color: rgba(255, 255, 255, .85); margin: 12px auto 26px; max-width: 460px; }
.az-cta .az-btn--primary { background: #fff; color: var(--az-teal-deep); }
.az-cta .az-btn--primary:hover { background: var(--az-sand); }

/* Bloc réservation (marqueurs property / price / guest-form / checkout / confirmation) */
.az-book { display: grid; grid-template-columns: 1fr 1.2fr; gap: 36px; align-items: start; }
.az-aside { background: var(--az-surface); border: 1px solid var(--az-line); border-radius: var(--az-radius); padding: 22px; position: sticky; top: 96px; }
.az-panel { background: var(--az-surface); border: 1px solid var(--az-line); border-radius: var(--az-radius); padding: 24px; }
.az-panel + .az-panel { margin-top: 20px; }
.az-panel__title { font-family: 'Fraunces', serif; font-size: 23px; color: var(--az-ink); margin: 0 0 16px; }

/* Contact */
.az-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.az-citem { padding: 22px 0; border-bottom: 1px solid var(--az-line); }
.az-citem span { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--az-muted); margin-bottom: 4px; }
.az-citem a, .az-citem strong { color: var(--az-ink); font-weight: 600; font-size: 17px; text-decoration: none; }
.az-map { aspect-ratio: 1 / 1; border-radius: var(--az-radius); background-size: cover; background-position: center; border: 1px solid var(--az-line); }

/* Footer */
.az-footer { background: var(--az-ink); color: #cdd9d6; padding: 56px 0 30px; }
.az-footer__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 36px; }
.az-footer .az-brand { color: #fff; }
.az-footer h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: #9fb2ae; margin: 0 0 14px; }
.az-footer a { display: block; color: #cdd9d6; text-decoration: none; font-size: 15px; padding: 4px 0; }
.az-footer a:hover { color: #fff; }
.az-footer__sub { margin-top: 16px; font-size: 14px; max-width: 280px; color: #9fb2ae; }
.az-footer__bar { border-top: 1px solid rgba(255, 255, 255, .12); margin-top: 40px; padding-top: 22px; font-size: 13px; color: #8aa09b; }

@media (max-width: 900px) {
  .az-hero__grid, .az-features, .az-split, .az-book, .az-contact, .az-footer__grid, .az-stats { grid-template-columns: 1fr; }
  .az-nav__links { display: none; }
  .az-aside { position: static; }
  .az-section { padding: 64px 0; }
  .az-hero { padding: 40px 0 56px; }
  .az-hero__media { aspect-ratio: 16 / 10; }
}`;

/** Barre de navigation (partagée). `active` = chemin de la page courante (état visuel). */
function nav(active: string): string {
  const link = (href: string, label: string) =>
    `<a class="az-nav__link" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="az-nav"><div class="az-wrap az-nav__inner">
    <a class="az-brand" href="/"><i></i>Azura</a>
    <nav class="az-nav__links">
      ${link('/', 'Accueil')}
      ${link('/logements', 'Nos villas')}
      ${link('/a-propos', 'La maison')}
      ${link('/contact', 'Contact')}
      <a class="az-btn az-btn--primary az-nav__cta" href="/logements">Réserver</a>
    </nav>
  </div></header>`;
}

/** Pied de page (partagé). */
const FOOTER = `<footer class="az-footer"><div class="az-wrap">
  <div class="az-footer__grid">
    <div>
      <a class="az-brand" href="/"><i></i>Azura</a>
      <p class="az-footer__sub">Villas et conciergerie sur la côte méditerranéenne. Réservation directe, séjours sur mesure.</p>
    </div>
    <div>
      <h4>Explorer</h4>
      <a href="/logements">Nos villas</a>
      <a href="/a-propos">La maison</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="mailto:bonjour@azura-villas.com">bonjour@azura-villas.com</a>
      <a href="tel:+33490000000">+33 4 90 00 00 00</a>
      <a href="#">Port de plaisance, Côte d'Azur</a>
    </div>
  </div>
  <div class="az-footer__bar az-wrap" style="padding-left:0;padding-right:0;">© Azura — Villas & Conciergerie. Tous droits réservés.</div>
</div></footer>`;

const HERO_IMG = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=70';
const ABOUT_IMG = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=70';
const STORY_IMG = 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=70';
const MAP_IMG = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=70';

/* ── Pages ──────────────────────────────────────────────────────────────────────── */

const HOME = `<div class="az-root">
  ${nav('/')}
  <section class="az-hero">
    <div class="az-wrap"><div class="az-hero__grid">
      <div>
        <p class="az-eyebrow">Villas & conciergerie · Méditerranée</p>
        <h1>Des villas face à la mer, réservées en quelques clics</h1>
        <p class="az-hero__sub">Maisons d'exception sélectionnées le long de la côte. Réservation directe, conciergerie attentionnée, séjours sans souci.</p>
        <div class="az-searchcard">
          <p class="az-searchcard__label">Trouvez votre villa</p>
          <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
        </div>
      </div>
      <div class="az-hero__media" style="background-image:url('${HERO_IMG}')"></div>
    </div></div>
  </section>

  <section class="az-section">
    <div class="az-wrap">
      <div class="az-section__head">
        <p class="az-eyebrow">Notre collection</p>
        <h2>Des villas choisies, pas listées</h2>
        <p class="az-lead">Piscines à débordement, terrasses sur la mer, jardins méditerranéens — chaque villa est visitée et sélectionnée par nos soins.</p>
      </div>
      <div class="az-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>

  <section class="az-section az-section--sand">
    <div class="az-wrap">
      <div class="az-section__head az-section__head--center">
        <p class="az-eyebrow">L'expérience Azura</p>
        <h2>Bien plus qu'une location</h2>
      </div>
      <div class="az-features">
        <div class="az-feature"><div class="az-feature__ic">24/7</div><h3>Conciergerie dédiée</h3><p>Un interlocuteur unique avant et pendant votre séjour, à toute heure.</p></div>
        <div class="az-feature"><div class="az-feature__ic">%</div><h3>Réservation directe</h3><p>Le meilleur tarif, sans intermédiaire, paiement sécurisé.</p></div>
        <div class="az-feature"><div class="az-feature__ic">★</div><h3>Sur mesure</h3><p>Chef à domicile, sorties en mer, spa : nous composons votre séjour.</p></div>
      </div>
    </div>
  </section>

  <section class="az-section">
    <div class="az-wrap"><div class="az-split">
      <div class="az-split__media" style="background-image:url('${ABOUT_IMG}')"></div>
      <div>
        <p class="az-eyebrow">La maison</p>
        <h2>L'art de recevoir, face à la mer</h2>
        <p>Depuis dix ans, nous veillons sur une poignée de villas de la côte comme sur des maisons de famille. Notre équipe locale conjugue exigence hôtelière et hospitalité sincère.</p>
        <p>De l'arrivée au dernier au revoir, chaque détail est pensé pour que vous n'ayez qu'à profiter.</p>
        <p style="margin-top:24px"><a class="az-btn az-btn--ghost" href="/a-propos">Découvrir la maison</a></p>
      </div>
    </div></div>
  </section>

  <section class="az-section az-section--tint">
    <div class="az-wrap"><div class="az-stats">
      <div class="az-stat"><b>40+</b><span>Villas d'exception</span></div>
      <div class="az-stat"><b>4.9</b><span>Note moyenne voyageurs</span></div>
      <div class="az-stat"><b>10</b><span>Ans sur la côte</span></div>
    </div></div>
  </section>

  <section class="az-section">
    <div class="az-wrap"><div class="az-quote">
      <blockquote>« Une villa sublime, une équipe qui anticipe le moindre désir. Le séjour parfait. »</blockquote>
      <cite>Camille R. — Paris</cite>
    </div></div>
  </section>

  <section class="az-section az-section--tint">
    <div class="az-wrap"><div class="az-cta">
      <h2>Prêt à vivre la côte autrement ?</h2>
      <p>Dites-nous vos dates, nous nous occupons du reste.</p>
      <a class="az-btn az-btn--primary" href="/logements">Voir les disponibilités</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const LODGINGS = `<div class="az-root">
  ${nav('/logements')}
  <section class="az-section">
    <div class="az-wrap">
      <div class="az-section__head">
        <p class="az-eyebrow">Nos villas</p>
        <h2>Choisissez votre villa</h2>
        <p class="az-lead">Sélectionnez vos dates pour découvrir les villas disponibles et leurs tarifs en temps réel.</p>
      </div>
      <div class="az-searchbar"><div data-clenzy-widget="search" data-clenzy-next="/logements"></div></div>
      <div class="az-lodgings"><div data-clenzy-widget="results" data-clenzy-next="/reserver"></div></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const RESERVE = `<div class="az-root">
  ${nav('/logements')}
  <section class="az-section">
    <div class="az-wrap">
      <div class="az-section__head">
        <p class="az-eyebrow">Votre réservation</p>
        <h2>Finalisez votre séjour</h2>
      </div>
      <div class="az-book">
        <aside class="az-aside">
          <div data-clenzy-widget="property"></div>
          <div style="height:16px"></div>
          <div data-clenzy-widget="price"></div>
        </aside>
        <div>
          <div class="az-panel">
            <h3 class="az-panel__title">Vos coordonnées</h3>
            <div data-clenzy-widget="guest-form"></div>
          </div>
          <div class="az-panel">
            <h3 class="az-panel__title">Paiement</h3>
            <div data-clenzy-widget="checkout" data-clenzy-return="/confirmation"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const CONFIRMATION = `<div class="az-root">
  ${nav('/logements')}
  <section class="az-section">
    <div class="az-wrap" style="max-width:680px">
      <div class="az-panel" style="text-align:center;padding:48px">
        <div data-clenzy-widget="confirmation"></div>
        <p style="margin-top:24px"><a class="az-btn az-btn--ghost" href="/">Retour à l'accueil</a></p>
      </div>
    </div>
  </section>
  <section class="az-section az-section--sand">
    <div class="az-wrap">
      <div class="az-section__head az-section__head--center">
        <p class="az-eyebrow">Sublimez votre séjour</p>
        <h2>Services à la carte</h2>
      </div>
      <div data-clenzy-widget="upsells"></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

const ABOUT = `<div class="az-root">
  ${nav('/a-propos')}
  <section class="az-section">
    <div class="az-wrap">
      <div class="az-section__head">
        <p class="az-eyebrow">La maison</p>
        <h2>Azura, gardiens de villas depuis 2014</h2>
        <p class="az-lead">Une conciergerie indépendante, ancrée sur la côte, qui place l'humain et le détail au cœur de chaque séjour.</p>
      </div>
      <div class="az-split">
        <div class="az-split__media" style="background-image:url('${STORY_IMG}')"></div>
        <div>
          <h2>Notre histoire</h2>
          <p>Tout a commencé par une villa, restaurée avec des artisans de la région. Le bouche-à-oreille a fait le reste : aujourd'hui, nous veillons sur une collection confidentielle de maisons.</p>
          <p>Nous refusons la standardisation. Chaque villa garde son caractère ; notre rôle est de rendre votre séjour fluide, chaleureux et inoubliable.</p>
        </div>
      </div>
    </div>
  </section>
  <section class="az-section az-section--sand">
    <div class="az-wrap">
      <div class="az-features">
        <div class="az-feature"><h3>Authenticité</h3><p>Des maisons de caractère, loin des décors interchangeables.</p></div>
        <div class="az-feature"><h3>Exigence</h3><p>Ménage hôtelier, linge de qualité, maintenance suivie. Le confort sans compromis.</p></div>
        <div class="az-feature"><h3>Proximité</h3><p>Une équipe locale joignable, qui connaît chaque crique et chaque bonne adresse.</p></div>
      </div>
    </div>
  </section>
  <section class="az-section">
    <div class="az-wrap"><div class="az-cta">
      <h2>Séjournez chez nous</h2>
      <p>Découvrez nos villas disponibles et réservez en direct.</p>
      <a class="az-btn az-btn--primary" href="/logements">Voir les villas</a>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const CONTACT = `<div class="az-root">
  ${nav('/contact')}
  <section class="az-section">
    <div class="az-wrap">
      <div class="az-section__head">
        <p class="az-eyebrow">Contact</p>
        <h2>Parlons de votre séjour</h2>
        <p class="az-lead">Une question, une demande sur mesure ? Notre conciergerie vous répond rapidement.</p>
      </div>
      <div class="az-contact">
        <div>
          <div class="az-citem"><span>Email</span><a href="mailto:bonjour@azura-villas.com">bonjour@azura-villas.com</a></div>
          <div class="az-citem"><span>Téléphone</span><a href="tel:+33490000000">+33 4 90 00 00 00</a></div>
          <div class="az-citem"><span>Adresse</span><strong>Port de plaisance — Côte d'Azur</strong></div>
          <div class="az-citem"><span>Horaires</span><strong>Conciergerie 7j/7, 24h/24</strong></div>
          <p style="margin-top:26px"><a class="az-btn az-btn--primary" href="/logements">Réserver une villa</a></p>
        </div>
        <div class="az-map" style="background-image:url('${MAP_IMG}')"></div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

/** Concatène le design system partagé + le CSS éventuel de la page. */
const css = (pageCss = ''): string => `${SHARED_CSS}\n${pageCss}`;

export const villaBordDeMer: GalleryTemplate = {
  id: 'villa-bord-de-mer',
  name: 'Villa bord de mer',
  description: 'Côtier épuré — hero split + recherche',
  thumbnail: HERO_IMG,
  theme: { primaryColor: '#0e6b78', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  pages: [
    { path: '/', type: 'HOME', title: 'Accueil', seoTitle: 'Azura — Villas & conciergerie sur la côte', seoDescription: 'Villas d’exception face à la mer. Réservation directe, conciergerie 24/7, séjours sur mesure.', html: HOME, css: css() },
    { path: '/logements', type: 'PROPERTY_LIST', title: 'Nos villas', seoTitle: 'Nos villas disponibles — Azura', seoDescription: 'Découvrez nos villas de la côte et leurs disponibilités en temps réel.', html: LODGINGS, css: css() },
    { path: '/reserver', type: 'CUSTOM', title: 'Réserver', seoTitle: 'Finaliser votre réservation — Azura', seoDescription: 'Renseignez vos coordonnées et réglez votre séjour en toute sécurité.', html: RESERVE, css: css() },
    { path: '/confirmation', type: 'CUSTOM', title: 'Confirmation', seoTitle: 'Réservation confirmée — Azura', seoDescription: 'Votre réservation est confirmée.', html: CONFIRMATION, css: css() },
    { path: '/a-propos', type: 'CUSTOM', title: 'La maison', seoTitle: 'La maison — Azura, conciergerie de villas', seoDescription: 'Une conciergerie indépendante ancrée sur la côte méditerranéenne depuis 2014.', html: ABOUT, css: css() },
    { path: '/contact', type: 'CUSTOM', title: 'Contact', seoTitle: 'Contact — Azura', seoDescription: 'Contactez notre conciergerie pour préparer votre séjour sur la côte.', html: CONTACT, css: css() },
  ],
};
