import type { GalleryTemplate } from '../galleryTemplates';
import { reservationFunnelHtml, RESERVATION_FUNNEL_CSS } from './parts/reservationFunnel';

/**
 * Template natif « Duplex Marrakech » — mono-bien haut de gamme, multi-page, HTML+CSS pensé POUR l'éditeur
 * GrapesJS. Reproduit un site de location courte durée d'un duplex d'exception (piscine privée + jacuzzi).
 *
 * Esthétique : palette terracotta / crème, serif d'affichage (Cormorant Garamond) + sans lisible (Lato),
 * photos d'ambiance. Aucune dépendance : polices via `@import` Google Fonts, images via URLs Unsplash
 * (éditables ensuite dans le Studio — chaque hôte remplace par ses propres photos).
 *
 * IMAGES via CLASSES CSS (`.dx-img-*`, `.dx-hero__bg`…) et NON via `style="background-image"` inline :
 * GrapesJS retire les attributs `style` inline à l'import, mais conserve le CSS de page → les fonds
 * passent par des règles dédiées dans `SHARED_CSS` (préservées).
 *
 * MARQUEURS BOOKING = vocabulaire RUNTIME (hydraté par `BaitlyBooking.hydrate`, prévisualisé par
 * `bookingComponents`) : `search` (vérif. disponibilités), `property` (détail du bien), `price`,
 * `guest-form` + `checkout` (réservation), `confirmation`, `upsells`. Navigation template-driven via
 * `data-clenzy-next` / `data-clenzy-return`.
 */

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Lato:wght@400;500;600;700&display=swap');";

const HERO_IMG = 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1600&q=70';
const POOL_IMG = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=70';
const INTERIOR_IMG = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=70';
const BEDROOM_IMG = 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=70';
const TERRACE_IMG = 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1400&q=70';
const ABOUT_IMG = 'https://images.unsplash.com/photo-1597211833712-5e41faa202ea?auto=format&fit=crop&w=1200&q=70';
const MAP_IMG = 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1000&q=70';

/** Design system partagé par toutes les pages (tokens + nav + sections + cartes + footer + responsive). */
const SHARED_CSS = `${FONTS_IMPORT}
.dx-root {
  --dx-ink: #1a1714;
  --dx-body: #4f463f;
  --dx-muted: #8a7c6f;
  --dx-bg: #f9f6f0;
  --dx-surface: #ffffff;
  --dx-terracotta: #c1622f;
  --dx-terracotta-deep: #a4501f;
  --dx-sand: #efe6d8;
  --dx-olive: #9a8f3d;
  --dx-line: #e6ddce;
  --dx-radius: 16px;
  --dx-shadow: 0 22px 60px -32px rgba(26, 23, 20, 0.5);
  font-family: 'Lato', -apple-system, system-ui, sans-serif;
  color: var(--dx-body);
  background-color: var(--dx-bg);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
.dx-root * { box-sizing: border-box; }
.dx-root h1, .dx-root h2, .dx-root h3 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  color: var(--dx-ink);
  font-weight: 600;
  line-height: 1.08;
  margin: 0;
  text-wrap: balance;
}
.dx-root p { margin: 0; }
/* width:100% indispensable : dans le hero, .dx-wrap est un FLEX-ITEM (.dx-hero est en flex) — sans
 * width il se dimensionne au contenu puis margin:auto le CENTRE. Avec width:100% il remplit (cappé a
 * max-width) et reste aligne a gauche, comme le nav. No-op en contexte bloc (sections). */
.dx-wrap { width: 100%; max-width: 1160px; margin: 0 auto; padding: 0 24px; }
.dx-center { text-align: center; }
.dx-mt { margin-top: 30px; }
.dx-btnrow { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.dx-narrow { max-width: 700px; }
.dx-sp { height: 16px; }
.dx-eyebrow {
  text-transform: uppercase; letter-spacing: 0.22em; font-size: 12px; font-weight: 700;
  color: var(--dx-terracotta);
}
/* Bouton STANDARD (CTA / hero « Vérifier » / boutons de section) = 44px, calé sur la référence GoDaddy
 * (py 12 / px 24 / font 14 / radius 4). Hauteur portée par min-height (constante quel que soit le contenu).
 * Le bouton du nav a une variante plus compacte (40px), cf. .dx-nav__cta. */
.dx-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
  min-height: 44px; padding: 0 24px; border-radius: 4px; border: 1px solid transparent;
  font: inherit; font-weight: 600; font-size: 14px; letter-spacing: .025em; text-decoration: none;
  transition: background-color .25s ease, color .25s ease, border-color .25s ease;
}
.dx-btn--block { width: 100%; }
.dx-btn--primary { background-color: var(--dx-terracotta); color: #fff; }
.dx-btn--primary:hover { background-color: var(--dx-terracotta-deep); }
.dx-btn--ghost { background: transparent; color: var(--dx-ink); border-color: var(--dx-line); }
.dx-btn--ghost:hover { border-color: var(--dx-terracotta); color: var(--dx-terracotta); }

/* Navigation */
.dx-nav { position: sticky; top: 0; z-index: 20; background: rgba(249, 246, 240, 0.92); backdrop-filter: blur(10px); border-bottom: 1px solid #e6ddce; }
.dx-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 80px; }
.dx-brand { display: flex; flex-direction: row; align-items: center; gap: 12px; line-height: 1; text-decoration: none; }
.dx-brand__txt { display: flex; flex-direction: column; line-height: 1; }
.dx-brand__logo { height: 40px; width: auto; max-width: 170px; object-fit: contain; display: block; }
.dx-brand b { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 700; color: var(--dx-ink); letter-spacing: .01em; }
.dx-brand span { font-size: 11px; letter-spacing: 0.42em; text-transform: uppercase; color: var(--dx-terracotta); margin-top: 4px; }
.dx-nav__links { display: flex; align-items: center; gap: 30px; }
.dx-nav__link { color: var(--dx-body); text-decoration: none; font-size: 15px; font-weight: 500; transition: color .2s ease; }
.dx-nav__link:hover { color: var(--dx-terracotta); }
.dx-nav__link[aria-current="page"] { color: var(--dx-terracotta); border-bottom: 2px solid #c1622f; padding-bottom: 2px; }
.dx-nav__cta { margin-left: 4px; min-height: 40px; padding: 0 20px; }

/* Hero */
.dx-hero { position: relative; color: #fff; min-height: 88vh; display: flex; align-items: center; }
.dx-hero__bg { position: absolute; inset: 0; background-size: cover; background-position: center; background-image: url('${HERO_IMG}'); }
/* Dégradé NOIR transparent, GAUCHE → DROITE : sombre sous le contenu (titre/desc/widget = lisibles),
 * s'estompe vers la droite jusqu'à transparent pour laisser voir l'image de fond. */
.dx-hero__bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.66) 44%, rgba(0, 0, 0, 0.3) 63%, rgba(0, 0, 0, 0) 85%); }
/* Contenu en COLONNE GAUCHE (titre, description, widget alignés à gauche, largeur bornée → reste dans la
 * zone sombre du dégradé). */
.dx-hero__inner { position: relative; width: 100%; max-width: 660px; padding: 80px 0; text-align: left; }
.dx-hero .dx-eyebrow { color: #f0c9a3; }
.dx-hero h1 { color: #fff; font-size: clamp(44px, 6.4vw, 76px); margin: 16px 0 20px; max-width: 100%; }
.dx-hero__sub { color: rgba(255, 255, 255, 0.92); font-size: 19px; max-width: 100%; margin-bottom: 30px; }

/* Carte de recherche (enveloppe du marqueur search) */
/* color explicite : la carte est une surface claire ; sans ça le widget hérite le blanc du hero (.dx-hero)
 * → libellés/champs blancs sur fond blanc, illisibles. Le widget reprend cette couleur via inherit. */
.dx-searchcard { background-color: #f9f6f0; border-radius: 4px; padding: clamp(24px, 4.5vw, 32px); max-width: 760px; box-shadow: var(--dx-shadow); color: #1a1714; }
.dx-searchcard__label { display: block; font-size: 12px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: #c1622f; margin-bottom: 16px; }

/* Barre de recherche du hero : structure NATIVE calquée sur la maquette (label au-dessus + champ
 * <input type="date"> avec icône calendrier + lien « Vérifier »). VALEURS EN DUR (pas de var) : le
 * parseur CSS de l'éditeur retire les var() dans les raccourcis (background/border/border-radius) a
 * l'import. Le picker NATIF est thémé via accent-color/color-scheme (jour sélectionné en terracotta). */
/* Responsive SANS media query : flex-wrap intrinsèque. En ligne quand la place suffit (dates + bouton),
 * le bloc dates passe au-dessus du bouton quand la largeur descend sous ~280px (mobile). */
.dx-sb { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.dx-sb__dates { flex: 1 1 280px; min-width: 0; position: relative; }
/* Boîtes de dates : 48px / radius 4px, calé sur la réf. Fond blanc + bordure crème (valeurs en dur →
 * indépendant de la présence du skin, et survit au parseur CSS de l'éditeur). */
.dx-sb__dates .cb-date-input { background-color: #ffffff; border: 1px solid #e6ddce; border-radius: 4px; min-height: 48px; }
.dx-sb__action { display: flex; flex: 0 0 auto; }
.dx-sb__btn { white-space: nowrap; }
/* Calendrier custom en POPOVER dans le hero (sinon il pousserait les sections suivantes). */
.dx-sb__dates .cb-calendar-wrapper { position: absolute; top: calc(100% + 8px); left: 0; z-index: 40; width: max-content; max-width: 92vw; }
.dx-sb__dates .cb-calendar-wrapper.cb-open { max-height: none; }

/* Bandeau stats */
.dx-stats { background-color: var(--dx-surface); border-top: 1px solid #e6ddce; border-bottom: 1px solid #e6ddce; }
.dx-stats__grid { display: grid; grid-template-columns: repeat(3, 1fr); }
.dx-stat { padding: 36px 24px; text-align: center; }
.dx-stat + .dx-stat { border-left: 1px solid #e6ddce; }
.dx-stat b { display: block; font-family: 'Cormorant Garamond', serif; font-size: 44px; color: var(--dx-terracotta); line-height: 1; }
.dx-stat strong { display: block; font-size: 16px; color: var(--dx-ink); font-weight: 700; margin: 8px 0 2px; }
.dx-stat span { font-size: 14px; color: var(--dx-muted); }

/* Sections */
.dx-section { padding: 96px 0; }
.dx-section--tint { background-color: var(--dx-sand); }
.dx-section__head { max-width: 640px; margin-bottom: 48px; }
.dx-section__head--center { margin-left: auto; margin-right: auto; text-align: center; }
.dx-section h2 { font-size: clamp(32px, 4.4vw, 48px); margin: 12px 0 14px; }
.dx-lead { font-size: 17px; color: var(--dx-body); }

/* Split éditorial (image + texte) */
.dx-split { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
.dx-split__media { aspect-ratio: 4 / 5; border-radius: 16px; background-size: cover; background-position: center; box-shadow: var(--dx-shadow); }
.dx-split h2 { font-size: clamp(30px, 3.6vw, 44px); }
.dx-split p + p { margin-top: 16px; }
.dx-rating { font-size: 14px; letter-spacing: .12em; color: var(--dx-olive); font-weight: 700; margin-bottom: 8px; }

/* Équipements */
.dx-amenities { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.dx-amenity { padding: 30px; background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 16px; }
.dx-amenity__ic { width: 46px; height: 46px; border-radius: 50%; background-color: var(--dx-sand); color: var(--dx-terracotta); display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 16px; }
.dx-amenity h3 { font-size: 23px; margin-bottom: 6px; }
.dx-amenity p { font-size: 15px; color: var(--dx-muted); }

/* Galerie */
.dx-gallery { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 200px; gap: 16px; }
.dx-gallery__item { border-radius: 16px; background-size: cover; background-position: center; overflow: hidden; }
.dx-gallery__item--wide { grid-column: span 2; }
.dx-gallery__item--tall { grid-row: span 2; }

/* Fonds image (classes — pas de style inline, retiré par GrapesJS à l'import) */
.dx-img-pool { background-image: url('${POOL_IMG}'); }
.dx-img-interior { background-image: url('${INTERIOR_IMG}'); }
.dx-img-bedroom { background-image: url('${BEDROOM_IMG}'); }
.dx-img-terrace { background-image: url('${TERRACE_IMG}'); }
.dx-img-about { background-image: url('${ABOUT_IMG}'); }
.dx-img-hero { background-image: url('${HERO_IMG}'); }

/* ── Avis : habillage des widgets SDK (booking-reviews / booking-rating).
 *    Scopé .dx-root pour primer sur widget-skin.css. var() en LONGHAND (background-color/color) ;
 *    couleurs LITTÉRALES dans les shorthands border (GrapesJS strippe var() en shorthand). ── */
.dx-root .cb-reviews { gap: 40px; }
.dx-root .cb-reviews__list { grid-template-columns: repeat(2, 1fr); gap: 28px; }
.dx-root .cb-reviews__item { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 16px; padding: 34px; }
.dx-root .cb-reviews__stars svg, .dx-root .cb-reviews__bar-star svg, .dx-root .cb-rating__star svg { color: var(--dx-olive); }
.dx-root .cb-reviews__text { font-family: 'Cormorant Garamond', serif; font-size: 24px; color: var(--dx-ink); line-height: 1.32; }
.dx-root .cb-reviews__author { color: var(--dx-ink); font-family: 'Lato', sans-serif; font-size: 15px; }
.dx-root .cb-reviews__date, .dx-root .cb-reviews__score-count, .dx-root .cb-reviews__bar-label, .dx-root .cb-reviews__bar-count { color: var(--dx-muted); font-size: 14px; }
.dx-root .cb-reviews__response { border-top: 1px solid #efe6d8; }
.dx-root .cb-reviews__response-label { color: var(--dx-terracotta); }
.dx-root .cb-reviews__response-text { color: var(--dx-body); }
/* Résumé (page Avis) façon carte .dx-ratesum */
.dx-root .cb-reviews__summary { grid-template-columns: 260px 1fr; gap: 40px; background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 16px; padding: 34px; }
.dx-root .cb-reviews__score-value { font-family: 'Cormorant Garamond', serif; font-size: 66px; color: var(--dx-ink); }
.dx-root .cb-reviews__bar-fill { background-color: var(--dx-terracotta); }
.dx-root .cb-reviews__bar-track { background-color: #efe6d8; }
/* Badge note compact (remplace l'ancienne ligne décorative .dx-rating) */
.dx-root .dx-rating { margin: 0 0 14px; }
.dx-root .cb-rating__star svg { color: var(--dx-olive); }
.dx-root .cb-rating__value { color: var(--dx-ink); font-weight: 700; font-size: 16px; }
.dx-root .cb-rating__count { color: var(--dx-muted); font-size: 14px; }
/* Bouton « Charger plus d'avis » (ghost Duplex) + curseur des liens vers tous les avis */
.dx-root .cb-reviews__more { border: 1px solid #e6ddce; border-radius: 8px; padding: 11px 24px; color: var(--dx-ink); background-color: transparent; }
.dx-root .cb-reviews__more:hover:not(:disabled) { border-color: var(--dx-terracotta); color: var(--dx-terracotta); }
.dx-root .cb-reviews__summary-link, .dx-root .cb-property-summary__note-link, .dx-root .cb-rating--link { cursor: pointer; }
@media (max-width: 720px) {
  .dx-root .cb-reviews__summary, .dx-root .cb-reviews__list { grid-template-columns: 1fr; }
}

/* Bandeau CTA */
.dx-cta { position: relative; overflow: hidden; border-radius: 16px; color: #fff; padding: 72px 56px; text-align: center; }
.dx-cta__bg { position: absolute; inset: 0; background-size: cover; background-position: center; background-image: url('${TERRACE_IMG}'); }
.dx-cta__bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(26,19,14,.55), rgba(26,19,14,.7)); }
.dx-cta__inner { position: relative; }
.dx-cta h2 { color: #fff; font-size: clamp(32px, 4vw, 48px); }
.dx-cta p { color: rgba(255,255,255,.9); margin: 14px auto 28px; max-width: 520px; }
.dx-cta__actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.dx-cta .dx-btn--ghost { color: #fff; border-color: rgba(255,255,255,.55); }
.dx-cta .dx-btn--ghost:hover { background: rgba(255,255,255,.12); border-color: #fff; color: #fff; }

/* Bloc réservation (marqueurs property / price / guest-form / checkout / confirmation) */
.dx-book { display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; align-items: start; }
.dx-book__aside { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 16px; padding: 24px; position: sticky; top: 104px; }
.dx-panel { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 16px; padding: 26px; }
.dx-panel + .dx-panel { margin-top: 20px; }
.dx-panel__title { font-family: 'Cormorant Garamond', serif; font-size: 25px; color: var(--dx-ink); margin: 0 0 16px; }

/* Tarifs */
.dx-pricing { display: grid; grid-template-columns: 1.1fr 1fr; gap: 36px; align-items: start; }
.dx-price-card { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 16px; padding: 34px; text-align: center; box-shadow: var(--dx-shadow); }
.dx-price-card b { font-family: 'Cormorant Garamond', serif; font-size: 56px; color: var(--dx-terracotta); line-height: 1; }
.dx-price-card sup { font-size: 18px; color: var(--dx-muted); font-family: 'Lato', sans-serif; }
.dx-price-card em { display: block; font-style: normal; color: var(--dx-muted); margin: 6px 0 22px; }
.dx-cond { list-style: none; padding: 0; margin: 0; }
.dx-cond li { padding: 14px 0; border-bottom: 1px solid #e6ddce; display: flex; justify-content: space-between; font-size: 15px; }
.dx-cond li b { color: var(--dx-ink); }

/* Contact */
.dx-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 52px; }
.dx-contact__item { padding: 22px 0; border-bottom: 1px solid #e6ddce; }
.dx-contact__item span { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: var(--dx-muted); margin-bottom: 4px; }
.dx-contact__item a, .dx-contact__item strong { color: var(--dx-ink); font-weight: 600; font-size: 17px; text-decoration: none; }
.dx-map { aspect-ratio: 1 / 1; border-radius: 16px; background-size: cover; background-position: center; border: 1px solid #e6ddce; background-image: url('${MAP_IMG}'); }

/* Footer */
.dx-footer { background-color: var(--dx-ink); color: #cabba9; padding: 60px 0 32px; }
.dx-footer__grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 36px; }
.dx-footer .dx-brand { display: flex; flex-direction: row; align-items: center; gap: 12px; }
.dx-footer .dx-brand b { color: #fff; }
.dx-footer h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color: #b3a394; margin: 0 0 14px; }
.dx-footer a { display: block; color: #cabba9; text-decoration: none; font-size: 15px; padding: 4px 0; }
.dx-footer a:hover { color: #fff; }
.dx-footer__sub { margin-top: 16px; font-size: 14px; max-width: 290px; color: #b3a394; }
.dx-footer__bar { border-top: 1px solid rgba(255,255,255,.12); margin-top: 42px; padding-top: 22px; font-size: 13px; color: #9b8c7d; }

/* ── Bannière hero des sous-pages (image + overlay + titre centré) ── */
.dx-pagehero { position: relative; min-height: 42vh; display: flex; align-items: center; justify-content: center; text-align: center; color: #fff; background-size: cover; background-position: center; }
.dx-pagehero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(18,13,10,.5), rgba(18,13,10,.66)); }
.dx-pagehero__inner { position: relative; z-index: 1; padding: 96px 24px; max-width: 760px; }
.dx-pagehero .dx-eyebrow { color: #f0c9a3; }
.dx-pagehero h1 { color: #fff; font-size: clamp(38px, 5vw, 58px); margin: 12px 0 14px; }
.dx-pagehero p { color: rgba(255,255,255,.9); font-size: 18px; margin: 0 auto; }

/* ── Stats 4 colonnes (page Duplex) ── */
.dx-stats__grid--4 { grid-template-columns: repeat(4, 1fr); }

/* ── Les espaces : cartes pièce ── */
.dx-spaces { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 8px; }
.dx-space { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 12px; overflow: hidden; }
.dx-space__media { aspect-ratio: 16 / 10; background-size: cover; background-position: center; }
.dx-space__body { padding: 22px 24px; }
.dx-space h3 { font-size: 22px; margin-bottom: 8px; }
.dx-space p { color: var(--dx-body); font-size: 15px; }

/* ── Équipements groupés par catégorie ── */
.dx-amgroups { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px 48px; margin-top: 8px; }
.dx-amgroup h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .14em; color: var(--dx-terracotta); margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #e6ddce; }
.dx-amgroup ul { list-style: none; padding: 0; margin: 0; }
.dx-amgroup li { padding: 9px 0 9px 26px; position: relative; font-size: 15px; }
.dx-amgroup li::before { content: "✓"; position: absolute; left: 0; color: var(--dx-terracotta); font-weight: 700; }
.dx-amgroup li b { display: block; color: var(--dx-ink); font-weight: 600; }
.dx-amgroup li span { font-size: 13.5px; color: var(--dx-muted); }

/* ── Galerie : filtres + grille légendée ── */
.dx-galtabs { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 32px; }
.dx-galtab { padding: 8px 18px; border: 1px solid #e6ddce; border-radius: 999px; background-color: transparent; color: var(--dx-body); font: inherit; font-size: 14px; cursor: pointer; }
.dx-galtab--active { background-color: var(--dx-terracotta); color: #fff; border-color: #c1622f; }
.dx-gallery__item { position: relative; }
.dx-gallery__item .dx-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 28px 16px 14px; color: #fff; font-size: 14px; font-weight: 600; background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.62)); }

/* ── Tarifs : grille par saison ── */
.dx-seasons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 8px; }
.dx-season { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 12px; padding: 24px; }
.dx-season h3 { font-size: 20px; margin-bottom: 2px; }
.dx-season__period { font-size: 13px; color: var(--dx-muted); margin-bottom: 14px; }
.dx-season table { width: 100%; border-collapse: collapse; font-size: 14px; }
.dx-season th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--dx-muted); padding-bottom: 8px; font-weight: 600; }
.dx-season td { padding: 7px 0; border-top: 1px solid #efe6d8; }
.dx-season td:last-child, .dx-season th:last-child { text-align: right; color: var(--dx-terracotta); font-weight: 700; }

/* ── Inclus / non inclus ── */
.dx-incl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 8px; }
.dx-incl__col { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 12px; padding: 26px; }
.dx-incl__col h3 { font-size: 17px; margin-bottom: 14px; }
.dx-incl__col ul { list-style: none; padding: 0; margin: 0; }
.dx-incl__col li { padding: 7px 0 7px 26px; position: relative; color: var(--dx-body); font-size: 15px; }
.dx-incl--yes li::before { content: "✓"; position: absolute; left: 0; color: var(--dx-olive); font-weight: 700; }
.dx-incl--no li::before { content: "+"; position: absolute; left: 0; color: var(--dx-terracotta); font-weight: 700; }

/* ── Table (conditions d'annulation) ── */
.dx-policy { width: 100%; border-collapse: collapse; margin-top: 8px; background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 12px; overflow: hidden; }
.dx-policy th, .dx-policy td { text-align: left; padding: 14px 20px; font-size: 15px; }
.dx-policy th { background-color: var(--dx-sand); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--dx-ink); }
.dx-policy tr + tr td { border-top: 1px solid #efe6d8; }
.dx-policy td:last-child { color: var(--dx-terracotta); font-weight: 600; }

/* ── Règlement intérieur ── */
.dx-rules { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 32px; margin-top: 8px; list-style: none; padding: 0; }
.dx-rules li { padding: 11px 0 11px 26px; position: relative; color: var(--dx-body); font-size: 15px; border-bottom: 1px solid #efe6d8; }
.dx-rules li::before { content: "•"; position: absolute; left: 6px; color: var(--dx-terracotta); }

/* ── Contact : formulaire + accès ── */
.dx-form { display: grid; gap: 14px; }
.dx-form label { display: block; font-size: 13px; font-weight: 600; color: var(--dx-ink); margin-bottom: 5px; }
.dx-form input, .dx-form select, .dx-form textarea { width: 100%; padding: 11px 14px; border: 1px solid #e6ddce; border-radius: 4px; font: inherit; font-size: 14px; background-color: #ffffff; color: var(--dx-ink); }
.dx-form textarea { min-height: 120px; resize: vertical; }
.dx-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.dx-access { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 8px; }
.dx-access__card { background-color: var(--dx-surface); border: 1px solid #e6ddce; border-radius: 12px; padding: 22px; }
.dx-access__card h3 { font-size: 16px; margin-bottom: 8px; color: var(--dx-terracotta); }
.dx-access__card p { font-size: 14px; color: var(--dx-body); }

/* ── Funnel de réservation : le THÈME alimente le module parts/reservationFunnel via --rf-*.
 *    (structure + mécanisme du wizard = dans le module ; ici, uniquement les valeurs de marque.) ── */
.cz-rf {
  --rf-accent: var(--dx-terracotta);
  --rf-accent-soft: rgba(193, 98, 47, 0.05);
  --rf-on-accent: #ffffff;
  --rf-surface: var(--dx-surface);
  --rf-ink: var(--dx-ink);
  --rf-body: var(--dx-body);
  --rf-muted: var(--dx-muted);
  --rf-line: var(--dx-line);
  --rf-soft: var(--dx-sand);
  --rf-radius: 12px;
}

@media (max-width: 900px) {
  .dx-split, .dx-amenities, .dx-book, .dx-pricing, .dx-contact, .dx-footer__grid, .dx-stats__grid,
  .dx-spaces, .dx-amgroups, .dx-seasons, .dx-incl, .dx-access, .dx-form__row, .dx-stats__grid--4 { grid-template-columns: 1fr; }
  .dx-rules { grid-template-columns: 1fr 1fr; }
  .dx-gallery { grid-template-columns: repeat(2, 1fr); }
  .dx-stat + .dx-stat { border-left: 0; border-top: 1px solid #e6ddce; }
  .dx-nav__links { display: none; }
  .dx-book__aside { position: static; }
  .dx-section { padding: 68px 0; }
}`;

/** Barre de navigation (partagée). `active` = chemin de la page courante (état visuel). */
function nav(active: string): string {
  const link = (href: string, label: string) =>
    `<a class="dx-nav__link" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="dx-nav"><div class="dx-wrap dx-nav__inner">
    <a class="dx-brand" href="/"><img class="dx-brand__logo" data-clenzy-logo alt="" hidden><div class="dx-brand__txt"><b>Duplex</b><span>Marrakech</span></div></a>
    <nav class="dx-nav__links">
      ${link('/', 'Accueil')}
      ${link('/duplex', 'Le Duplex')}
      ${link('/galerie', 'Galerie')}
      ${link('/tarifs', 'Tarifs')}
      ${link('/avis', 'Avis')}
      ${link('/contact', 'Contact')}
      <a class="dx-btn dx-btn--primary dx-nav__cta" href="/reservation">Réserver</a>
    </nav>
  </div></header>`;
}

/** Bannière hero de sous-page (image de fond + overlay + titre centré). imgClass = classe .dx-img-*. */
function pageHero(eyebrow: string, title: string, sub: string, imgClass: string): string {
  return `<section class="dx-pagehero ${imgClass}"><div class="dx-pagehero__inner">
    <p class="dx-eyebrow">${eyebrow}</p>
    <h1>${title}</h1>
    <p>${sub}</p>
  </div></section>`;
}

/** Section CTA de clôture (réutilisée en bas de chaque sous-page). `actions` = HTML des boutons. */
function cta(title: string, text: string, actions: string): string {
  return `<section class="dx-section"><div class="dx-wrap"><div class="dx-cta">
    <div class="dx-cta__bg"></div>
    <div class="dx-cta__inner"><h2>${title}</h2><p>${text}</p><div class="dx-cta__actions">${actions}</div></div>
  </div></div></section>`;
}

/** Pied de page (partagé). */
const FOOTER = `<footer class="dx-footer"><div class="dx-wrap">
  <div class="dx-footer__grid">
    <div>
      <a class="dx-brand" href="/"><img class="dx-brand__logo" data-clenzy-logo alt="" hidden><div class="dx-brand__txt"><b>Duplex</b><span>Marrakech</span></div></a>
      <p class="dx-footer__sub">Un duplex d'exception avec piscine privée et jacuzzi, au cœur de Marrakech. Réservation directe, sans intermédiaire.</p>
    </div>
    <div>
      <h4>Explorer</h4>
      <a href="/duplex">Le Duplex</a>
      <a href="/galerie">Galerie</a>
      <a href="/tarifs">Tarifs</a>
      <a href="/avis">Avis</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="mailto:bonjour@duplexmarrakech.com">bonjour@duplexmarrakech.com</a>
      <a href="tel:+212600000000">+212 6 00 00 00 00</a>
      <a href="#">Hivernage, Marrakech — Maroc</a>
    </div>
  </div>
  <div class="dx-footer__bar dx-wrap">© Duplex Marrakech. Tous droits réservés.</div>
</div></footer>`;

/** Section « Équipements & services » (réutilisée Accueil + Le Duplex). */
const AMENITIES = `<section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center">
        <p class="dx-eyebrow">Tout le confort</p>
        <h2>Équipements &amp; services</h2>
      </div>
      <div class="dx-amenities">
        <div class="dx-amenity"><div class="dx-amenity__ic">≈</div><h3>Piscine privée</h3><p>Baignade exclusive à toute heure, rien que pour vous.</p></div>
        <div class="dx-amenity"><div class="dx-amenity__ic">✦</div><h3>Jacuzzi</h3><p>Détente sous les étoiles marocaines, en terrasse.</p></div>
        <div class="dx-amenity"><div class="dx-amenity__ic">❄</div><h3>Climatisation</h3><p>Confort optimal dans chaque pièce, en toute saison.</p></div>
        <div class="dx-amenity"><div class="dx-amenity__ic">⌘</div><h3>Wi-Fi haut débit</h3><p>Connexion fibre dans tout le duplex.</p></div>
        <div class="dx-amenity"><div class="dx-amenity__ic">⊞</div><h3>Parking privé</h3><p>Stationnement sécurisé inclus sur place.</p></div>
        <div class="dx-amenity"><div class="dx-amenity__ic">☕</div><h3>Cuisine équipée</h3><p>Tout le nécessaire pour cuisiner comme à la maison.</p></div>
      </div>
    </div>
  </section>`;

/* ── Pages ──────────────────────────────────────────────────────────────────────── */

const HOME = `<div class="dx-root">
  ${nav('/')}
  <section class="dx-hero">
    <div class="dx-hero__bg"></div>
    <div class="dx-wrap"><div class="dx-hero__inner">
      <p class="dx-eyebrow">Marrakech · Location courte durée</p>
      <h1>Votre havre de luxe privé</h1>
      <p class="dx-hero__sub">Un duplex d'exception avec piscine privée et jacuzzi, au cœur de la magie de Marrakech. Chaque séjour est une invitation à vivre l'extraordinaire.</p>
      <div class="dx-searchcard">
        <span class="dx-searchcard__label">Vérifier les disponibilités</span>
        <div class="dx-sb">
          <div class="dx-sb__dates" data-clenzy-widget="booking-dates" data-clenzy-date-style="labeled" data-clenzy-date-placeholder="jj/mm/aaaa"></div>
          <div class="dx-sb__action">
            <a class="dx-btn dx-btn--primary dx-sb__btn" href="/reservation">Vérifier <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a>
          </div>
        </div>
      </div>
    </div></div>
  </section>

  <section class="dx-stats">
    <div class="dx-wrap"><div class="dx-stats__grid">
      <div class="dx-stat"><b>2</b><strong>Chambres</strong><span>Suites climatisées</span></div>
      <div class="dx-stat"><b>6</b><strong>Voyageurs</strong><span>Capacité maximale</span></div>
      <div class="dx-stat"><b>180</b><strong>m² de surface</strong><span>Duplex sur 2 niveaux</span></div>
    </div></div>
  </section>

  <section class="dx-section">
    <div class="dx-wrap"><div class="dx-split">
      <div class="dx-split__media dx-img-pool"></div>
      <div>
        <div class="dx-rating" data-clenzy-widget="booking-rating" data-clenzy-rating-href="/avis"></div>
        <p class="dx-eyebrow">Bienvenue chez vous</p>
        <h2>L'art de vivre à Marrakech</h2>
        <p>Niché dans l'une des plus belles adresses de Marrakech, notre duplex allie l'élégance contemporaine à l'âme chaleureuse du Maroc. Chaque espace a été pensé pour vous offrir confort, intimité et émerveillement.</p>
        <p>Plongez dans votre piscine privée, savourez un thé sur la terrasse, laissez-vous porter par le calme d'un lieu rien qu'à vous.</p>
        <p class="dx-mt"><a class="dx-btn dx-btn--ghost" href="/duplex">Découvrir le duplex</a></p>
      </div>
    </div></div>
  </section>

  ${AMENITIES}

  <section class="dx-section">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center">
        <p class="dx-eyebrow">Aperçu</p>
        <h2>Le duplex en images</h2>
      </div>
      <div class="dx-gallery">
        <div class="dx-gallery__item dx-gallery__item--wide dx-gallery__item--tall dx-img-pool"></div>
        <div class="dx-gallery__item dx-img-interior"></div>
        <div class="dx-gallery__item dx-img-bedroom"></div>
        <div class="dx-gallery__item dx-gallery__item--wide dx-img-terrace"></div>
      </div>
      <p class="dx-center dx-mt"><a class="dx-btn dx-btn--ghost" href="/galerie">Voir toute la galerie</a></p>
    </div>
  </section>

  <section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center">
        <p class="dx-eyebrow">Ce qu'ils en disent</p>
        <h2>Avis de nos voyageurs</h2>
      </div>
      <div data-clenzy-widget="booking-reviews" data-clenzy-reviews-layout="list" data-clenzy-reviews-limit="2"></div>
    </div>
  </section>

  <section class="dx-section">
    <div class="dx-wrap"><div class="dx-cta">
      <div class="dx-cta__bg"></div>
      <div class="dx-cta__inner">
        <h2>Prêt à vivre l'expérience ?</h2>
        <p>Réservez directement en ligne et profitez des meilleurs tarifs. Votre séjour de rêve à Marrakech vous attend.</p>
        <div class="dx-cta__actions">
          <a class="dx-btn dx-btn--primary" href="/reservation">Réserver maintenant</a>
          <a class="dx-btn dx-btn--ghost" href="/contact">Nous contacter</a>
        </div>
      </div>
    </div></div>
  </section>
  ${FOOTER}
</div>`;

const DUPLEX = `<div class="dx-root">
  ${nav('/duplex')}
  ${pageHero('Duplex Marrakech', 'Le Duplex', '250 m² de luxe contemporain au cœur de Marrakech — piscine privée, jacuzzi rooftop, 2 suites et hammam.', 'dx-img-interior')}

  <section class="dx-stats">
    <div class="dx-wrap"><div class="dx-stats__grid dx-stats__grid--4">
      <div class="dx-stat"><b>6</b><strong>Voyageurs</strong><span>Capacité maximale</span></div>
      <div class="dx-stat"><b>2</b><strong>Chambres</strong><span>Suites climatisées</span></div>
      <div class="dx-stat"><b>2</b><strong>Salles de bain</strong><span>Douche &amp; baignoire</span></div>
      <div class="dx-stat"><b>250</b><strong>m² de surface</strong><span>Duplex sur 2 niveaux</span></div>
    </div></div>
  </section>

  <section class="dx-section">
    <div class="dx-wrap"><div class="dx-split">
      <div class="dx-split__media dx-img-about"></div>
      <div>
        <p class="dx-eyebrow">Le logement</p>
        <h2>Un duplex d'exception à Marrakech</h2>
        <p>Niché dans le quartier résidentiel de Guéliz, ce duplex de 250 m² allie l'élégance contemporaine aux codes de l'architecture marocaine traditionnelle. Zellige artisanal, bois de cèdre sculpté et mobilier sur mesure composent un cadre d'exception.</p>
        <p>Réparti sur deux niveaux, le logement offre deux suites indépendantes, un grand salon ouvert sur la terrasse, une cuisine américaine entièrement équipée et un rooftop privatif avec piscine chauffée et jacuzzi.</p>
        <p class="dx-mt dx-btnrow"><a class="dx-btn dx-btn--primary" href="/reservation">Vérifier les disponibilités</a><a class="dx-btn dx-btn--ghost" href="/logement">Voir le logement en détail</a></p>
      </div>
    </div></div>
  </section>

  <section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">Visite</p><h2>Les espaces du duplex</h2></div>
      <div class="dx-spaces">
        <div class="dx-space"><div class="dx-space__media dx-img-bedroom"></div><div class="dx-space__body"><h3>Suite principale</h3><p>Lit king size 180×200, dressing walk-in, salle de bain privative avec douche à l'italienne et baignoire îlot. Vue sur la piscine.</p></div></div>
        <div class="dx-space"><div class="dx-space__media dx-img-interior"></div><div class="dx-space__body"><h3>Chambre 2</h3><p>Lit queen size 160×200, penderie intégrée, salle de bain attenante avec douche. Décoration chaleureuse aux tons terracotta.</p></div></div>
        <div class="dx-space"><div class="dx-space__media dx-img-about"></div><div class="dx-space__body"><h3>Salon &amp; séjour</h3><p>Grand salon de 60 m² avec canapés en cuir, cheminée décorative, Smart TV et accès direct à la terrasse.</p></div></div>
        <div class="dx-space"><div class="dx-space__media dx-img-terrace"></div><div class="dx-space__body"><h3>Cuisine ouverte</h3><p>Cuisine américaine avec îlot central, piano de cuisson 6 feux, four encastré et électroménager haut de gamme.</p></div></div>
      </div>
    </div>
  </section>

  <section class="dx-section">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">Équipements</p><h2>Tout le confort inclus</h2><p class="dx-lead">Chaque équipement a été sélectionné pour garantir un séjour sans compromis.</p></div>
      <div class="dx-amgroups">
        <div class="dx-amgroup"><h3>Espaces extérieurs</h3><ul>
          <li><b>Piscine privée chauffée</b><span>Accessible 24h/24, chauffée toute l'année</span></li>
          <li><b>Jacuzzi en terrasse</b><span>Vue panoramique sur les toits</span></li>
          <li><b>Terrasse rooftop</b><span>Transats et salon de jardin</span></li>
          <li><b>Parking privé sécurisé</b><span>Caméras de surveillance</span></li>
        </ul></div>
        <div class="dx-amgroup"><h3>Intérieur &amp; confort</h3><ul>
          <li><b>Climatisation réversible</b><span>Chaud/froid dans chaque pièce</span></li>
          <li><b>Wi-Fi fibre haut débit</b><span>Dans tout le duplex</span></li>
          <li><b>Smart TV &amp; enceintes</b><span>Netflix, Bluetooth</span></li>
          <li><b>Coffre-fort</b><span>Dans chaque chambre</span></li>
        </ul></div>
        <div class="dx-amgroup"><h3>Cuisine &amp; repas</h3><ul>
          <li><b>Cuisine équipée</b><span>Électroménager haut de gamme</span></li>
          <li><b>Lave-vaisselle &amp; lave-linge</b><span>Pour les longs séjours</span></li>
          <li><b>Vaisselle complète</b><span>Jusqu'à 6 couverts</span></li>
          <li><b>Cafetière &amp; bouilloire</b><span>Thé et café offerts</span></li>
        </ul></div>
        <div class="dx-amgroup"><h3>Services &amp; sécurité</h3><ul>
          <li><b>Accueil personnalisé</b><span>Check-in sur place</span></li>
          <li><b>Ménage de fin de séjour</b><span>Inclus</span></li>
          <li><b>Linge de maison</b><span>Draps &amp; serviettes fournis</span></li>
          <li><b>Conciergerie</b><span>Sur demande 7j/7</span></li>
        </ul></div>
      </div>
    </div>
  </section>

  ${cta('Vivez l’expérience Duplex Marrakech', 'Réservez en ligne en quelques minutes. Disponibilités en temps réel, sans frais de service.', '<a class="dx-btn dx-btn--primary" href="/reservation">Réserver maintenant</a><a class="dx-btn dx-btn--ghost" href="/tarifs">Voir les tarifs</a>')}
  ${FOOTER}
</div>`;

const GALLERY = `<div class="dx-root">
  ${nav('/galerie')}
  ${pageHero('Galerie photos', 'Galerie photos', 'Piscine privée, jacuzzi en terrasse, intérieurs contemporains : découvrez chaque espace avant votre séjour.', 'dx-img-pool')}

  <section class="dx-section">
    <div class="dx-wrap">
      <div class="dx-galtabs">
        <button class="dx-galtab dx-galtab--active">Tout voir</button>
        <button class="dx-galtab">Extérieurs</button>
        <button class="dx-galtab">Intérieurs</button>
        <button class="dx-galtab">Chambres</button>
        <button class="dx-galtab">Espaces de vie</button>
      </div>
      <div class="dx-gallery">
        <div class="dx-gallery__item dx-gallery__item--wide dx-gallery__item--tall dx-img-pool"><span class="dx-cap">Piscine privée &amp; terrasse</span></div>
        <div class="dx-gallery__item dx-img-terrace"><span class="dx-cap">Jacuzzi rooftop</span></div>
        <div class="dx-gallery__item dx-img-interior"><span class="dx-cap">Salon contemporain</span></div>
        <div class="dx-gallery__item dx-gallery__item--wide dx-img-bedroom"><span class="dx-cap">Suite principale</span></div>
        <div class="dx-gallery__item dx-gallery__item--tall dx-img-about"><span class="dx-cap">Cuisine ouverte</span></div>
        <div class="dx-gallery__item dx-img-hero"><span class="dx-cap">Vue sur Marrakech</span></div>
        <div class="dx-gallery__item dx-img-terrace"><span class="dx-cap">Terrasse panoramique</span></div>
        <div class="dx-gallery__item dx-gallery__item--wide dx-img-pool"><span class="dx-cap">Baignade au coucher du soleil</span></div>
      </div>
    </div>
  </section>

  ${cta('Prêt à vivre l’expérience ?', 'Réservez votre séjour et profitez de ce havre de luxe au cœur de Marrakech.', '<a class="dx-btn dx-btn--primary" href="/reservation">Réserver maintenant</a>')}
  ${FOOTER}
</div>`;

const TARIFS = `<div class="dx-root">
  ${nav('/tarifs')}
  ${pageHero('Tarifs &amp; Conditions', 'Tarifs &amp; Conditions', 'Réservation directe — sans frais de service ni commission.', 'dx-img-terrace')}

  <section class="dx-section">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">Tarification</p><h2>Grille tarifaire par saison</h2><p class="dx-lead">Tous les tarifs sont indiqués en euros, pour l'ensemble du duplex (jusqu'à 6 personnes).</p></div>
      <div class="dx-seasons">
        <div class="dx-season">
          <h3>Haute saison</h3><p class="dx-season__period">Juil – Août · Noël · Nouvel An</p>
          <table><thead><tr><th>Durée</th><th>Total</th><th>/ nuit</th></tr></thead><tbody>
            <tr><td>3 nuits</td><td>900 €</td><td>300 €</td></tr>
            <tr><td>5 nuits</td><td>1 375 €</td><td>275 €</td></tr>
            <tr><td>7 nuits</td><td>1 750 €</td><td>250 €</td></tr>
            <tr><td>14 nuits</td><td>2 940 €</td><td>210 €</td></tr>
          </tbody></table>
        </div>
        <div class="dx-season">
          <h3>Moyenne saison</h3><p class="dx-season__period">Avr – Juin · Sept – Oct · Fév – Mars</p>
          <table><thead><tr><th>Durée</th><th>Total</th><th>/ nuit</th></tr></thead><tbody>
            <tr><td>3 nuits</td><td>750 €</td><td>250 €</td></tr>
            <tr><td>5 nuits</td><td>1 125 €</td><td>225 €</td></tr>
            <tr><td>7 nuits</td><td>1 400 €</td><td>200 €</td></tr>
            <tr><td>14 nuits</td><td>2 380 €</td><td>170 €</td></tr>
          </tbody></table>
        </div>
        <div class="dx-season">
          <h3>Basse saison</h3><p class="dx-season__period">Nov – Janv (hors fêtes)</p>
          <table><thead><tr><th>Durée</th><th>Total</th><th>/ nuit</th></tr></thead><tbody>
            <tr><td>3 nuits</td><td>600 €</td><td>200 €</td></tr>
            <tr><td>5 nuits</td><td>875 €</td><td>175 €</td></tr>
            <tr><td>7 nuits</td><td>1 050 €</td><td>150 €</td></tr>
            <tr><td>14 nuits</td><td>1 960 €</td><td>140 €</td></tr>
          </tbody></table>
        </div>
      </div>
      <p class="dx-center dx-mt" style="font-size:14px;color:#8a7c6f">Minimum 3 nuits. Tarif dégressif à partir de 7 nuits.</p>
    </div>
  </section>

  <section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">Détail</p><h2>Ce qui est inclus</h2></div>
      <div class="dx-incl">
        <div class="dx-incl__col dx-incl--yes"><h3>Inclus dans le tarif</h3><ul>
          <li>Linge de maison (draps, serviettes)</li>
          <li>Ménage en fin de séjour</li>
          <li>Accueil personnalisé sur place</li>
          <li>Wi-Fi haut débit &amp; climatisation</li>
          <li>Piscine privée chauffée &amp; jacuzzi</li>
          <li>Cuisine entièrement équipée</li>
          <li>Parking privé sécurisé</li>
          <li>Coffre-fort dans chaque chambre</li>
        </ul></div>
        <div class="dx-incl__col dx-incl--no"><h3>Non inclus (options)</h3><ul>
          <li>Taxe de séjour (2 €/nuit/personne)</li>
          <li>Ménage en cours de séjour (+50 €)</li>
          <li>Transfert aéroport (+30 €)</li>
          <li>Petit-déjeuner (+15 €/pers/jour)</li>
        </ul></div>
      </div>
    </div>
  </section>

  <section class="dx-section">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">Politique</p><h2>Conditions d'annulation</h2></div>
      <table class="dx-policy"><thead><tr><th>Délai avant arrivée</th><th>Remboursement</th></tr></thead><tbody>
        <tr><td>Plus de 30 jours avant</td><td>Remboursement intégral</td></tr>
        <tr><td>15 à 30 jours avant</td><td>Remboursement à 50 %</td></tr>
        <tr><td>7 à 14 jours avant</td><td>Remboursement à 25 %</td></tr>
        <tr><td>Moins de 7 jours</td><td>Aucun remboursement</td></tr>
      </tbody></table>
    </div>
  </section>

  <section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">À savoir</p><h2>Règlement intérieur</h2></div>
      <ul class="dx-rules">
        <li>Arrivée à partir de 15h00</li>
        <li>Départ avant 11h00</li>
        <li>Animaux de compagnie acceptés (sous conditions)</li>
        <li>Événements familiaux acceptés (sur demande)</li>
        <li>Fêtes et soirées bruyantes interdites</li>
        <li>Fumée à l'intérieur interdite (terrasse autorisée)</li>
        <li>Sous-location strictement interdite</li>
        <li>Caution de 500 € (pré-autorisation)</li>
      </ul>
    </div>
  </section>

  ${cta('Prêt à réserver votre séjour ?', 'Réservation directe, sans intermédiaire. Disponibilités en temps réel.', '<a class="dx-btn dx-btn--primary" href="/reservation">Réserver maintenant</a><a class="dx-btn dx-btn--ghost" href="/contact">Nous contacter</a>')}
  ${FOOTER}
</div>`;

const AVIS = `<div class="dx-root">
  ${nav('/avis')}
  ${pageHero('Avis voyageurs', 'Avis voyageurs', '4,9 / 5 — la fierté d’un accueil soigné et d’un lieu unique, noté par 47 voyageurs.', 'dx-img-about')}

  <section class="dx-section">
    <div class="dx-wrap">
      <div data-clenzy-widget="booking-reviews" data-clenzy-reviews-layout="summary"></div>
    </div>
  </section>

  <section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center">
        <p class="dx-eyebrow">Témoignages</p>
        <h2>Ce que disent nos voyageurs</h2>
      </div>
      <div data-clenzy-widget="booking-reviews" data-clenzy-reviews-layout="list"></div>
    </div>
  </section>

  ${cta('Rejoignez nos voyageurs satisfaits', 'Réservez votre séjour et vivez l’expérience Duplex Marrakech à votre tour.', '<a class="dx-btn dx-btn--primary" href="/reservation">Réserver maintenant</a><a class="dx-btn dx-btn--ghost" href="/tarifs">Voir les tarifs</a>')}
  ${FOOTER}
</div>`;

const CONTACT = `<div class="dx-root">
  ${nav('/contact')}
  ${pageHero('Nous contacter', 'Nous contacter', 'Réponse garantie sous 24h — nous sommes disponibles 7j/7 pour préparer votre séjour.', 'dx-img-bedroom')}

  <section class="dx-section">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">Coordonnées</p><h2>Parlons de votre séjour</h2></div>
      <div class="dx-contact">
        <div>
          <div class="dx-contact__item"><span>Téléphone / WhatsApp</span><a href="tel:+212600000000">+212 6 00 00 00 00</a></div>
          <div class="dx-contact__item"><span>Email</span><a href="mailto:contact@duplexmarrakech.com">contact@duplexmarrakech.com</a></div>
          <div class="dx-contact__item"><span>Adresse</span><strong>Quartier Guéliz, Marrakech 40000, Maroc</strong></div>
          <div class="dx-contact__item"><span>Disponibilité</span><strong>Lun – Dim · 8h00 – 22h00</strong></div>
          <p class="dx-mt"><a class="dx-btn dx-btn--primary" href="/reservation">Voir les disponibilités</a></p>
        </div>
        <form class="dx-form">
          <div class="dx-form__row">
            <div><label>Nom complet</label><input type="text" placeholder="Jean Dupont"></div>
            <div><label>Email</label><input type="email" placeholder="jean@exemple.com"></div>
          </div>
          <div class="dx-form__row">
            <div><label>Téléphone</label><input type="tel" placeholder="+33 6 00 00 00 00"></div>
            <div><label>Sujet</label><select><option>Demande de disponibilité</option><option>Question sur le logement</option><option>Séjour sur mesure</option><option>Autre</option></select></div>
          </div>
          <div><label>Message</label><textarea placeholder="Décrivez votre demande, vos dates souhaitées, le nombre de personnes…"></textarea></div>
          <div><button type="button" class="dx-btn dx-btn--primary">Envoyer le message</button></div>
        </form>
      </div>
    </div>
  </section>

  <section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center"><p class="dx-eyebrow">Localisation</p><h2>Comment nous rejoindre</h2><p class="dx-lead">Quartier Guéliz — à 5 min à pied de l'avenue Mohammed V.</p></div>
      <div class="dx-access">
        <div class="dx-access__card"><h3>Depuis l'aéroport</h3><p>Aéroport Marrakech-Ménara (RAK) — 15 min en taxi (≈ 80 MAD). Transfert privé sur demande (+30 €).</p></div>
        <div class="dx-access__card"><h3>Depuis la gare</h3><p>Gare de Marrakech — 10 min en taxi. Liaisons directes depuis Casablanca, Rabat et Fès.</p></div>
        <div class="dx-access__card"><h3>En voiture</h3><p>Parking privé sécurisé inclus. Accès par la rue principale de Guéliz.</p></div>
      </div>
    </div>
  </section>

  ${cta('Prêt à réserver ?', 'Consultez les disponibilités et réservez directement en ligne.', '<a class="dx-btn dx-btn--primary" href="/reservation">Réserver maintenant</a>')}
  ${FOOTER}
</div>`;

/* Page Réserver = chrome du template (nav + section + footer) + funnel mono-logement RÉUTILISABLE
 * (`parts/reservationFunnel`). Le template ne fournit ici que le CONTENU spécifique au bien (équipements,
 * paliers de tarif) ; la structure, les étapes et le mécanisme de passage vivent dans le module, et le
 * thème est alimenté via les `--rf-*` posés sur `.cz-rf` dans SHARED_CSS. */
const RESERVATION = `<div class="dx-root">
  ${nav('/reservation')}
  <section class="dx-section">
    <div class="dx-wrap">
      ${reservationFunnelHtml({
        eyebrow: 'Réservation en ligne',
        headings: ['Votre séjour à Marrakech', 'Choisissez vos dates', 'Vos coordonnées', 'Paiement sécurisé'],
        steps: ['Séjour', 'Dates', 'Vos infos', 'Paiement', 'Confirmation'],
        formulasIntro: 'Choisissez votre formule',
        formulas: [
          { title: '3 nuits', note: 'Tarif de base', price: '250 €', unit: '/ nuit' },
          { title: '5 nuits', note: 'Le plus choisi', price: '225 €', unit: '/ nuit', badge: '−10 %', reco: true },
          { title: '7 nuits et +', note: 'Meilleur tarif · jusqu’à −20 %', price: '200 €', unit: '/ nuit' },
        ],
        fromPrice: '225 €',
        returnPath: '/confirmation',
      })}
    </div>
  </section>
  ${FOOTER}
</div>`;

const CONFIRMATION = `<div class="dx-root">
  ${nav('/reservation')}
  <section class="dx-section">
    <div class="dx-wrap dx-narrow">
      <div class="dx-panel dx-center" style="padding:48px">
        <div data-clenzy-widget="confirmation"></div>
        <p class="dx-mt"><a class="dx-btn dx-btn--ghost" href="/">Retour à l'accueil</a></p>
      </div>
    </div>
  </section>
  <section class="dx-section dx-section--tint">
    <div class="dx-wrap">
      <div class="dx-section__head dx-section__head--center">
        <p class="dx-eyebrow">Sublimez votre séjour</p>
        <h2>Services à la carte</h2>
      </div>
      <div data-clenzy-widget="upsells"></div>
    </div>
  </section>
  ${FOOTER}
</div>`;

/* Page « Le logement » — section Détail Variante A (handoff) : en-tête + galerie/carte réservation +
 * équipements GROUPÉS en 4 catégories. Habillée au design existant (--dx-*), widgets SDK fonctionnels
 * (property en layout `detail`, booking-dates/guests, booking-amenities groupé). CTA → funnel /reservation. */
const LOGEMENT_CSS = `.dxl-grid { display: grid; grid-template-columns: 1fr 360px; gap: 32px; align-items: start; margin-top: 26px; }
.dxl-book { background-color: #ffffff; border: 1px solid #e6ddce; border-radius: 16px; padding: 26px; box-shadow: var(--dx-shadow); position: sticky; top: 100px; }
.dxl-book__price { display: flex; align-items: baseline; gap: 8px; }
.dxl-book__price b { font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 600; color: var(--dx-ink); }
.dxl-book__price span { color: var(--dx-muted); font-size: 15px; }
.dxl-book__hint { font-size: 13px; color: var(--dx-muted); margin-top: 2px; }
.dxl-book__cta { width: 100%; justify-content: center; margin-top: 18px; }
.dxl-book__trust { display: flex; align-items: center; justify-content: center; gap: 7px; color: var(--dx-muted); font-size: 13px; margin-top: 12px; }
.dxl-book__trust svg { width: 15px; height: 15px; color: #3e8e66; flex: 0 0 auto; }
.dxl-amen { margin-top: 54px; border-top: 1px solid #e6ddce; padding-top: 38px; }
.dxl-amen__title { font-size: 27px; margin: 8px 0 30px; }
.dxl-amen .cb-amenities__group-title { font-size: 11px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--dx-muted); padding-bottom: 14px; border-bottom: 1px solid #e6ddce; margin-bottom: 18px; }
.dxl-amen .cb-amenity { color: var(--dx-ink); font-size: 15px; gap: 11px; }
.dxl-amen .cb-amenity__icon { color: var(--dx-terracotta); }
.dxl-grid .cb-property-summary__title { font-family: 'Cormorant Garamond', serif; font-size: 30px; color: var(--dx-ink); margin: 0; }
.dxl-grid .cb-property-summary__place, .dxl-grid .cb-property-summary__note, .dxl-grid .cb-property-summary__capacity { color: var(--dx-body); font-size: 15px; }
.dxl-grid .cb-property-summary__place-icon, .dxl-grid .cb-property-summary__note-star, .dxl-grid .cb-property-summary__cap-item svg { color: var(--dx-terracotta); }
.dxl-grid .cb-property-summary__note b { color: var(--dx-ink); }
.dxl-grid .cb-property-summary__main { border-radius: 16px; }
@media (max-width: 900px) { .dxl-grid { grid-template-columns: 1fr; } .dxl-book { position: static; } }`;

const LOGEMENT = `<div class="dx-root">
  ${nav('/logement')}
  <section class="dx-section">
    <div class="dx-wrap">
      <p class="dx-eyebrow">Détail du logement</p>
      <div class="dxl-grid">
        <div data-clenzy-widget="property" data-clenzy-property-layout="detail" data-clenzy-reviews-href="/avis"></div>
        <aside class="dxl-book">
          <div class="dxl-book__price"><b>120 €</b><span>/ nuit</span></div>
          <div class="dxl-book__hint">à partir de · séjour min. 3 nuits</div>
          <div class="dx-sp"></div>
          <div data-clenzy-widget="booking-dates" data-clenzy-date-style="labeled" data-clenzy-date-placeholder="jj/mm/aaaa"></div>
          <div class="dx-sp"></div>
          <div data-clenzy-widget="booking-guests"></div>
          <a class="dx-btn dx-btn--primary dxl-book__cta" href="/reservation">Réserver</a>
          <div class="dxl-book__trust"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg><span>Sans frais de service · Réservation directe</span></div>
        </aside>
      </div>
      <div class="dxl-amen">
        <p class="dx-eyebrow">Équipements</p>
        <h2 class="dxl-amen__title">Tout le confort d'un séjour d'exception</h2>
        <div data-clenzy-widget="booking-amenities" data-clenzy-amenities-layout="grouped"></div>
      </div>
    </div>
  </section>
  ${FOOTER}
</div>`;

/** Concatène le design system partagé + le CSS éventuel de la page. */
const css = (pageCss = ''): string => `${SHARED_CSS}\n${pageCss}`;

export const duplexMarrakech: GalleryTemplate = {
  id: 'duplex-marrakech',
  name: 'Duplex Marrakech',
  description: 'Bien unique de luxe — piscine & jacuzzi',
  thumbnail: HERO_IMG,
  theme: { primaryColor: '#c1622f', fontFamily: "'Lato', -apple-system, system-ui, sans-serif", headingFontFamily: "'Cormorant Garamond', Georgia, serif" },
  pages: [
    { path: '/', type: 'HOME', title: 'Accueil', seoTitle: 'Duplex Marrakech — Location de luxe avec piscine & jacuzzi', seoDescription: "Séjournez dans un duplex d'exception à Marrakech : piscine privée, jacuzzi, décoration contemporaine. Réservation en ligne directe, disponibilités immédiates.", html: HOME, css: css() },
    { path: '/duplex', type: 'CUSTOM', title: 'Le Duplex', seoTitle: 'Le Duplex — 180 m² avec piscine privée à Marrakech', seoDescription: 'Deux suites climatisées, salon contemporain, terrasse avec piscine et jacuzzi. Un duplex de 180 m² pour 6 voyageurs.', html: DUPLEX, css: css() },
    { path: '/logement', type: 'CUSTOM', title: 'Le logement', seoTitle: 'Le logement — Duplex Marrakech', seoDescription: 'Galerie, équipements et réservation directe du duplex de luxe à Marrakech.', html: LOGEMENT, css: css(LOGEMENT_CSS) },
    { path: '/galerie', type: 'CUSTOM', title: 'Galerie', seoTitle: 'Galerie photos — Duplex Marrakech', seoDescription: 'Découvrez en images la piscine privée, le jacuzzi et les intérieurs contemporains du duplex.', html: GALLERY, css: css() },
    { path: '/tarifs', type: 'CUSTOM', title: 'Tarifs', seoTitle: 'Tarifs & conditions — Duplex Marrakech', seoDescription: 'Réservation directe sans commission. Tarifs, conditions de séjour et politique d’annulation du duplex.', html: TARIFS, css: css() },
    { path: '/avis', type: 'CUSTOM', title: 'Avis', seoTitle: 'Avis des voyageurs — Duplex Marrakech', seoDescription: 'Une note moyenne de 5/5. Découvrez les témoignages de nos voyageurs.', html: AVIS, css: css() },
    { path: '/contact', type: 'CUSTOM', title: 'Contact', seoTitle: 'Contact — Duplex Marrakech', seoDescription: 'Contactez-nous pour préparer votre séjour dans notre duplex de luxe à Marrakech.', html: CONTACT, css: css() },
    { path: '/reservation', type: 'CUSTOM', title: 'Réserver', seoTitle: 'Réserver — Duplex Marrakech', seoDescription: 'Réservez votre séjour : sélection des dates, coordonnées et paiement sécurisé.', html: RESERVATION, css: css(RESERVATION_FUNNEL_CSS) },
    { path: '/confirmation', type: 'CUSTOM', title: 'Confirmation', seoTitle: 'Réservation confirmée — Duplex Marrakech', seoDescription: 'Votre réservation est confirmée.', html: CONFIRMATION, css: css() },
  ],
};
