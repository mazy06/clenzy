/* ============================================================================
 * Template « Recherche Catalogue » — Direction « Premium Conciergerie »
 * Généré depuis l'aperçu Claude Design (les blocs <!-- DEMO --> ont été retirés :
 * chaque <div data-clenzy-widget> est laissé VIDE, le SDK l'hydrate au runtime).
 *
 * À placer dans :
 *   client/src/modules/booking-engine/studio/grapes/import/templates/recherche-catalogue-premium.ts
 * puis l'ajouter à GALLERY_TEMPLATES dans import/galleryTemplates.ts
 * (ajuster l'import de type GalleryTemplate / SitePageType au chemin réel du repo).
 * ========================================================================== */
import type { GalleryTemplate } from '../galleryTemplates';

const css = `/* ============================================================================
   TEMPLATE « RECHERCHE CATALOGUE » — Direction « Premium Conciergerie »
   Booking Engine Clenzy/Baitly · feuille de style commune (toutes pages)
   ----------------------------------------------------------------------------
   Esprit Haute Conciergerie : charbon profond + or champagne + ivoire,
   serif chic (Cormorant Garamond) + sans tracé en capitales (Jost),
   photographie plein cadre, filets dorés, beaucoup de souffle.
     .lx-*  → habillage du template (marketing, layout, nav, footer)
     .cb-*  → contrat widgets headless (§6) — le SDK injecte le DOM,
              ce fichier l'habille. Piloté par variables --cb-*.
   ============================================================================ */

/* ============================================================
   1. TOKENS DE THÈME
   primaryColor : #C6A867 (or champagne)  ·  fond : #14110E (charbon)
   fontFamily   : "Jost" (UI) · "Cormorant Garamond" (display serif)
   ============================================================ */
:root {
  /* --- Charbon & encres --- */
  --ink:        #14110E;   /* charbon profond — fonds sombres */
  --ink-2:      #1E1A15;   /* surface sombre surélevée */
  --ink-3:      #2A2520;
  --ink-line:   rgba(245,240,230,.12);

  /* --- Or champagne --- */
  --gold:       #C6A867;
  --gold-d:     #A8884C;   /* sur fond clair (contraste) */
  --gold-l:     #DDC892;
  --gold-soft:  rgba(198,168,103,.14);
  --gold-line:  rgba(168,136,76,.32);

  /* --- Ivoire & clairs --- */
  --ivory:      #F5F0E6;   /* page claire */
  --ivory-2:    #EFE8D9;   /* bande alternée */
  --paper:      #FCFAF5;   /* cartes / contrôles */
  --ink-on-ivory:  #221E18;
  --body-ivory:    #4A4338;
  --muted-ivory:   #837962;
  --line-ivory:    #E2D8C4;

  /* --- Texte sur sombre --- */
  --on-dark:      #F1EBDD;
  --on-dark-mut:  rgba(241,235,221,.62);

  /* --- Rythme & rayons (luxe = quasi droit) --- */
  --lx-r:    2px;
  --lx-maxw: 1240px;
  --lx-gut:  32px;

  /* --- Typo --- */
  --lx-serif: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --lx-sans:  "Jost", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* --- Motion --- */
  --lx-ease:  cubic-bezier(.16,1,.3,1);

  /* --- Ombres (très discrètes, teintées) --- */
  --lx-sh: 0 24px 60px -30px rgba(20,17,14,.45);

  /* =========================================================
     CONTRAT WIDGETS — variables --cb-* (§6)
     ========================================================= */
  --cb-accent:     #C6A867;   /* or — action */
  --cb-on-accent:  #14110E;   /* texte sombre sur or */
  --cb-font:       "Jost", system-ui, sans-serif;
  --cb-text:       #221E18;
  --cb-muted:      #837962;
  --cb-surface:    #FCFAF5;
  --cb-border:     #DAD0BD;
  --cb-radius:     2px;
  --cb-control-h:  56px;
}

/* ============================================================
   2. BASE
   ============================================================ */
*, *::before, *::after { box-sizing: border-box; }
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-variant-numeric: tabular-nums;
  scroll-behavior: smooth;
}
body {
  margin: 0;
  font-family: var(--lx-sans);
  font-weight: 400;
  font-size: 16px;
  line-height: 1.7;
  color: var(--body-ivory);
  background: var(--ivory);
}
img { max-width: 100%; display: block; }
h1,h2,h3,h4 { margin: 0; color: var(--ink-on-ivory); font-family: var(--lx-serif); font-weight: 500; line-height: 1.06; letter-spacing: 0; text-wrap: balance; }
p { margin: 0; }
a { color: var(--gold-d); text-decoration: none; transition: color .25s var(--lx-ease); }
a:hover { color: var(--ink-on-ivory); }
button { font-family: inherit; cursor: pointer; }
::selection { background: rgba(198,168,103,.3); }

a:focus-visible, button:focus-visible, [tabindex]:focus-visible,
input:focus-visible, .cb-input:focus-visible {
  outline: none; box-shadow: 0 0 0 2px var(--gold); border-radius: var(--lx-r);
}
.lx-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* ============================================================
   3. LAYOUT & TYPO PRIMITIVES
   ============================================================ */
.lx-container { max-width: var(--lx-maxw); margin: 0 auto; padding: 0 var(--lx-gut); }
.lx-section { padding: 120px 0; }
.lx-section--tight { padding: 80px 0; }
.lx-section--alt { background: var(--ivory-2); }
.lx-section--ink { background: var(--ink); color: var(--on-dark); }

/* Eyebrow doré, capitales espacées, filet centré optionnel */
.lx-eyebrow {
  font-family: var(--lx-sans); font-size: 11px; font-weight: 500;
  letter-spacing: .32em; text-transform: uppercase; color: var(--gold-d);
  margin: 0 0 22px; display: inline-flex; align-items: center; gap: 14px;
}
.lx-eyebrow::before { content: ""; width: 30px; height: 1px; background: var(--gold-line); }
.lx-eyebrow--center { justify-content: center; }
.lx-eyebrow--center::after { content: ""; width: 30px; height: 1px; background: var(--gold-line); }
.lx-section--ink .lx-eyebrow { color: var(--gold); }
.lx-section--ink .lx-eyebrow::before, .lx-section--ink .lx-eyebrow::after { background: var(--gold-line); }

.lx-h1 { font-size: clamp(46px, 6.6vw, 92px); line-height: 1.0; font-weight: 500; }
.lx-h2 { font-size: clamp(34px, 4.6vw, 58px); line-height: 1.04; font-weight: 500; }
.lx-h3 { font-size: 26px; line-height: 1.12; font-weight: 500; }
.lx-lead { font-family: var(--lx-sans); font-weight: 300; color: var(--muted-ivory); font-size: 18px; line-height: 1.75; max-width: 56ch; margin-top: 22px; }
.lx-section--ink .lx-lead { color: var(--on-dark-mut); }
.lx-head { margin-bottom: 56px; }
.lx-head--center { text-align: center; margin-inline: auto; max-width: 760px; }
.lx-head--center .lx-lead { margin-inline: auto; }

/* ============================================================
   4. BOUTONS & LIENS  (rectangulaires, capitales tracées)
   ============================================================ */
.lx-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 12px;
  font-family: var(--lx-sans); font-size: 12px; font-weight: 500;
  letter-spacing: .2em; text-transform: uppercase;
  height: 56px; padding: 0 34px; border-radius: var(--lx-r);
  border: 1px solid var(--gold); color: var(--ink-on-ivory); background: transparent;
  transition: all .3s var(--lx-ease); white-space: nowrap;
}
.lx-btn svg { width: 15px; height: 15px; transition: transform .3s var(--lx-ease); }
.lx-btn:hover { background: var(--gold); color: var(--ink); border-color: var(--gold); }
.lx-btn:hover svg { transform: translateX(4px); }
.lx-btn--solid { background: var(--gold); color: var(--ink); }
.lx-btn--solid:hover { background: var(--gold-l); border-color: var(--gold-l); color: var(--ink); }
.lx-btn--ondark { color: var(--on-dark); }
.lx-btn--ondark:hover { color: var(--ink); }

.lx-link {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--lx-sans); font-size: 12px; font-weight: 500;
  letter-spacing: .2em; text-transform: uppercase; color: var(--gold-d);
}
.lx-link svg { width: 15px; height: 15px; transition: transform .3s var(--lx-ease); }
.lx-link:hover { color: var(--ink-on-ivory); }
.lx-link:hover svg { transform: translateX(4px); }
.lx-section--ink .lx-link { color: var(--gold); }
.lx-section--ink .lx-link:hover { color: var(--on-dark); }

/* ============================================================
   5. NAV + FOOTER
   ============================================================ */
.lx-nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 36px;
  padding: 20px var(--lx-gut); background: rgba(20,17,14,.72);
  backdrop-filter: blur(14px); border-bottom: 1px solid var(--ink-line);
}
.lx-brand {
  display: inline-flex; align-items: center; gap: 12px;
  font-family: var(--lx-serif); font-weight: 500; font-size: 25px;
  color: var(--on-dark); letter-spacing: .02em;
}
.lx-brand b { color: var(--gold); font-weight: 500; }
.lx-brand__mark { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border: 1px solid var(--gold-line); border-radius: 50%; }
.lx-brand__mark svg { width: 15px; height: 15px; stroke: var(--gold); }
.lx-nav__links { display: flex; gap: 30px; margin-left: auto; align-items: center; }
.lx-nav__links a {
  font-family: var(--lx-sans); font-size: 11.5px; font-weight: 400;
  letter-spacing: .18em; text-transform: uppercase; color: var(--on-dark-mut);
}
.lx-nav__links a:hover, .lx-nav__links a.is-active { color: var(--gold); }
.lx-nav__cta {
  display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--lx-sans); font-size: 11px; font-weight: 500;
  letter-spacing: .18em; text-transform: uppercase; color: var(--ink);
  background: var(--gold); padding: 12px 20px; border-radius: var(--lx-r); margin-left: 6px; white-space: nowrap;
}
.lx-nav__cta:hover { background: var(--gold-l); color: var(--ink); }

.lx-footer { background: var(--ink); color: var(--on-dark); padding: 88px 0 36px; border-top: 1px solid var(--gold-line); }
.lx-footer__grid { display: grid; grid-template-columns: 1.7fr 1fr 1fr 1fr; gap: 48px; }
.lx-footer__brand { font-family: var(--lx-serif); font-size: 30px; color: var(--on-dark); margin-bottom: 16px; }
.lx-footer__brand b { color: var(--gold); font-weight: 500; }
.lx-footer p { color: var(--on-dark-mut); font-size: 14.5px; max-width: 36ch; font-weight: 300; }
.lx-footer h4 { font-family: var(--lx-sans); font-size: 11px; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); margin-bottom: 20px; }
.lx-footer ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.lx-footer ul a { color: var(--on-dark-mut); font-size: 14px; letter-spacing: .02em; }
.lx-footer ul a:hover { color: var(--gold); }
.lx-footer__bar { margin-top: 60px; padding-top: 28px; border-top: 1px solid var(--ink-line); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: rgba(241,235,221,.4); }

/* ============================================================
   6. HERO PLEIN CADRE
   ============================================================ */
.lx-hero { position: relative; color: var(--on-dark); overflow: hidden; }
.lx-hero__media { position: absolute; inset: 0; background-size: cover; background-position: center; }
/* Placeholder photographique sombre & chaud (remplacer par photo réelle) */
.lx-hero__media--ph {
  background:
    radial-gradient(100% 90% at 50% 18%, rgba(198,168,103,.16), transparent 55%),
    linear-gradient(180deg, #28221b 0%, #1b1712 55%, #14110e 100%),
    linear-gradient(120deg, #322a20, #1a1712);
}
.lx-hero__overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,17,14,.45) 0%, rgba(20,17,14,.25) 40%, rgba(20,17,14,.78) 100%); }
.lx-hero__inner { position: relative; max-width: 960px; margin: 0 auto; padding: 168px var(--lx-gut) 120px; text-align: center; }
.lx-hero__inner--short { padding: 116px var(--lx-gut) 88px; }
.lx-hero h1 { color: var(--on-dark); font-size: clamp(48px, 7vw, 96px); line-height: .98; font-weight: 500; }
.lx-hero h1 em { font-style: italic; color: var(--gold-l); }
.lx-hero__sub { font-family: var(--lx-sans); font-weight: 300; font-size: 19px; line-height: 1.7; color: rgba(241,235,221,.84); max-width: 46ch; margin: 26px auto 0; }
.lx-hero__eyebrow { color: var(--gold); }

/* Barre de recherche : filet doré sur verre sombre (le widget est dedans) */
.lx-hero__search { max-width: 980px; margin: 44px auto -52px; position: relative; z-index: 3; }
.lx-searchcard {
  background: rgba(20,17,14,.66); backdrop-filter: blur(10px);
  border: 1px solid var(--gold-line); border-radius: var(--lx-r); padding: 16px;
  box-shadow: var(--lx-sh);
}
.lx-searchcard--solid { background: var(--paper); border-color: var(--line-ivory); backdrop-filter: none; }

/* ============================================================
   7. COMPOSANTS ÉDITORIAUX
   ============================================================ */
/* Valeurs numérotées (01–04) */
.lx-values { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid var(--line-ivory); }
.lx-section--ink .lx-values { border-color: var(--ink-line); }
.lx-value { padding: 40px 28px 8px; border-right: 1px solid var(--line-ivory); }
.lx-value:last-child { border-right: 0; }
.lx-section--ink .lx-value { border-color: var(--ink-line); }
.lx-value__num { font-family: var(--lx-serif); font-size: 30px; font-weight: 500; color: var(--gold-d); font-variant-numeric: tabular-nums; }
.lx-section--ink .lx-value__num { color: var(--gold); }
.lx-value h3 { font-size: 23px; margin: 16px 0 12px; }
.lx-section--ink .lx-value h3 { color: var(--on-dark); }
.lx-value p { font-size: 14.5px; font-weight: 300; color: var(--muted-ivory); }
.lx-section--ink .lx-value p { color: var(--on-dark-mut); }

/* Services éditoriaux numérotés avec image */
.lx-editorial { display: grid; gap: 1px; background: var(--line-ivory); }
.lx-edito { display: grid; grid-template-columns: 90px 1fr 1.1fr; align-items: center; gap: 0; background: var(--ivory); transition: background .3s var(--lx-ease); }
.lx-edito:hover { background: var(--paper); }
.lx-edito__num { font-family: var(--lx-serif); font-size: 22px; color: var(--gold-d); padding: 0 0 0 var(--lx-gut); font-variant-numeric: tabular-nums; }
.lx-edito__txt { padding: 44px 40px 44px 0; }
.lx-edito__txt h3 { font-size: 34px; margin-bottom: 12px; }
.lx-edito__txt p { font-weight: 300; color: var(--muted-ivory); max-width: 46ch; }
.lx-edito__txt .lx-link { margin-top: 22px; }
.lx-edito__img { align-self: stretch; min-height: 280px; background: linear-gradient(150deg,#2c2419,#7a6a4f); }

/* Bande de chiffres-clés (sur charbon) */
.lx-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
.lx-stat { text-align: center; padding: 20px; border-left: 1px solid var(--ink-line); }
.lx-stat:first-child { border-left: 0; }
.lx-stat__n { font-family: var(--lx-serif); font-size: clamp(44px, 5vw, 68px); font-weight: 500; color: var(--gold); line-height: 1; font-variant-numeric: tabular-nums; }
.lx-stat__l { font-family: var(--lx-sans); font-size: 12px; font-weight: 300; letter-spacing: .14em; text-transform: uppercase; color: var(--on-dark-mut); margin-top: 14px; }

/* Citations / avis (serif italique) */
.lx-quotes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--line-ivory); border: 1px solid var(--line-ivory); }
.lx-quote { background: var(--ivory); padding: 40px 34px; }
.lx-quote__stars { display: flex; gap: 4px; margin-bottom: 18px; }
.lx-quote__stars svg { width: 15px; height: 15px; fill: var(--gold); stroke: var(--gold); }
.lx-quote p { font-family: var(--lx-serif); font-style: italic; font-size: 22px; line-height: 1.4; color: var(--ink-on-ivory); }
.lx-quote__who { margin-top: 22px; font-family: var(--lx-sans); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted-ivory); }
.lx-quote__who b { color: var(--gold-d); font-weight: 500; }

/* Logos presse / partenaires (filet doré, sobre) */
.lx-logos { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 18px 48px; }
.lx-logos span { font-family: var(--lx-serif); font-size: 22px; font-style: italic; color: var(--muted-ivory); opacity: .75; }
.lx-section--ink .lx-logos span { color: var(--on-dark-mut); }

/* Galerie fiche logement */
.lx-gallery { display: grid; grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 6px; }
.lx-gallery > div { background: linear-gradient(150deg,#9c8a6f,#cdbf9f); min-height: 130px; }
.lx-gallery > div:first-child { grid-row: 1 / 3; min-height: 380px; }
.lx-gallery > div:nth-child(3){ background: linear-gradient(150deg,#7e8a7a,#c2cab6); }
.lx-gallery > div:nth-child(5){ background: linear-gradient(150deg,#a08a7e,#d6c4b4); }

/* Disposition fiche + réservation */
.lx-detail { display: grid; grid-template-columns: 1.6fr .92fr; gap: 56px; align-items: start; }
.lx-detail__aside { position: sticky; top: 100px; }
.lx-checkout { display: grid; grid-template-columns: 1.4fr .9fr; gap: 48px; align-items: start; }
.lx-checkout__aside { position: sticky; top: 100px; }
.lx-results-layout { display: grid; grid-template-columns: 264px 1fr; gap: 48px; align-items: start; }

.lx-card { background: var(--paper); border: 1px solid var(--line-ivory); border-radius: var(--lx-r); padding: 30px; }
.lx-card--dark { background: var(--ink-2); border-color: var(--gold-line); color: var(--on-dark); }

/* Skeleton / empty */
.lx-skeleton { background: linear-gradient(100deg,#e8dfce 30%,#f3ecdd 50%,#e8dfce 70%); background-size: 200% 100%; animation: lx-shimmer 1.4s infinite linear; }
@keyframes lx-shimmer { to { background-position: -200% 0; } }
.lx-empty { text-align: center; padding: 72px 24px; color: var(--muted-ivory); }
.lx-empty svg { width: 38px; height: 38px; stroke: var(--gold-d); margin-bottom: 16px; }

/* ============================================================
   8. SKIN WIDGETS HEADLESS  (.cb-*)  — contrat §6
   ============================================================ */
.cb-widget { font-family: var(--cb-font); color: var(--cb-text); }
.cb-widget *, .cb-widget *::before, .cb-widget *::after { box-sizing: border-box; }

/* --- Champs --- */
.cb-input, .cb-textarea, .cb-date-input, .cb-guests-toggle {
  width: 100%; min-height: var(--cb-control-h);
  font-family: var(--cb-font); font-size: 15px; color: var(--cb-text);
  background: var(--cb-surface); border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius); padding: 0 16px;
  transition: border-color .25s var(--lx-ease), box-shadow .25s var(--lx-ease);
  appearance: none;
}
.cb-textarea { padding: 14px 16px; min-height: 130px; resize: vertical; line-height: 1.6; }
.cb-input::placeholder, .cb-textarea::placeholder { color: #A99E88; }
.cb-input:hover, .cb-date-input:hover, .cb-guests-toggle:hover { border-color: var(--gold); }
.cb-input:focus, .cb-textarea:focus, .cb-date-input:focus, .cb-guests-toggle:focus-visible {
  outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-soft);
}
.cb-guests-toggle { display: inline-flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; text-align: left; }
.cb-guests-toggle.cb-open { border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-soft); }

/* --- CTA action (or, texte charbon) --- */
.cb-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 11px;
  min-height: var(--cb-control-h); padding: 0 30px;
  font-family: var(--cb-font); font-size: 12px; font-weight: 500;
  letter-spacing: .2em; text-transform: uppercase;
  color: var(--cb-on-accent); background: var(--cb-accent);
  border: 1px solid var(--cb-accent); border-radius: var(--cb-radius); cursor: pointer;
  transition: background .25s var(--lx-ease), border-color .25s, opacity .25s;
}
.cb-cta:hover { background: var(--gold-l); border-color: var(--gold-l); }
.cb-cta:disabled { opacity: .45; cursor: not-allowed; }
.cb-cta--block { width: 100%; }

/* --- Composite recherche : rangée responsive --- */
.cb-widget--composed { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
.cb-widget--composed > * { flex: 1 1 180px; }
.cb-widget--composed .cb-cta { flex: 0 0 auto; }
.cb-field { display: flex; flex-direction: column; gap: 8px; }
.cb-field__label {
  font-family: var(--cb-font); font-size: 10px; font-weight: 500;
  letter-spacing: .2em; text-transform: uppercase; color: var(--cb-muted); padding-left: 2px;
}
/* labels clairs quand la barre est sur verre sombre */
.lx-searchcard:not(.lx-searchcard--solid) .cb-field__label { color: var(--gold); }

/* --- Voyageurs --- */
.cb-guests-panel { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: var(--cb-radius); box-shadow: var(--lx-sh); padding: 10px; min-width: 270px; }
.cb-guests-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 10px; }
.cb-guests-row + .cb-guests-row { border-top: 1px solid var(--line-ivory); }
.cb-guests-row__label { font-size: 14.5px; color: var(--cb-text); }
.cb-guests-row__sub { font-size: 12.5px; color: var(--cb-muted); }
.cb-counter { display: inline-flex; align-items: center; gap: 16px; }
.cb-counter__btn {
  width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--cb-border);
  background: var(--cb-surface); color: var(--gold-d); font-size: 18px; line-height: 1;
  display: grid; place-items: center; cursor: pointer; transition: border-color .2s, background .2s;
}
.cb-counter__btn:hover { border-color: var(--gold); background: var(--gold-soft); }
.cb-counter__btn:disabled { opacity: .4; cursor: not-allowed; }
.cb-counter__val { min-width: 22px; text-align: center; font-weight: 500; font-variant-numeric: tabular-nums; }

/* --- Calendrier --- */
.cb-calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.cb-calendar-nav button { width: 36px; height: 36px; border-radius: var(--cb-radius); border: 1px solid var(--cb-border); background: var(--cb-surface); cursor: pointer; color: var(--cb-text); }
.cb-calendar-nav button:hover { border-color: var(--gold); color: var(--gold-d); }
.cb-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cb-calendar-weekday { text-align: center; font-size: 10px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: var(--cb-muted); padding: 7px 0; }
.cb-calendar-day {
  aspect-ratio: 1; display: grid; place-items: center; border: 0; background: transparent;
  border-radius: var(--cb-radius); font-size: 14px; color: var(--cb-text); cursor: pointer; font-variant-numeric: tabular-nums;
  transition: background .15s var(--lx-ease), color .15s;
}
.cb-calendar-day:hover { background: var(--gold-soft); }
.cb-calendar-day.cb-today { box-shadow: inset 0 0 0 1px var(--gold); }
.cb-calendar-day.cb-in-range { background: var(--gold-soft); }
.cb-calendar-day.cb-selected { background: var(--gold); color: var(--cb-on-accent); font-weight: 500; }
.cb-calendar-day.cb-disabled { color: #BBB09A; text-decoration: line-through; cursor: not-allowed; }
.cb-calendar-day.cb-disabled:hover { background: transparent; }

/* --- Grille de résultats --- */
.cb-widget:has(> .cb-property-card),
.cb-property-results, .cb-property-list, .cb-results-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 6px;
}
.cb-property-card {
  background: var(--ivory); border: 1px solid var(--line-ivory); border-radius: var(--lx-r);
  overflow: hidden; cursor: pointer; display: flex; flex-direction: column;
  transition: border-color .3s var(--lx-ease), background .3s;
}
.cb-property-card:hover { border-color: var(--gold); background: var(--paper); }
.cb-property-card.cb-selected { border-color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold); }
.cb-property-card__img { position: relative; aspect-ratio: 3/2; background: linear-gradient(150deg,#9c8a6f,#cdbf9f); }
.cb-property-card__body { padding: 24px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.cb-property-card__body h3, .cb-property-card__title { font-family: var(--lx-serif); font-weight: 500; font-size: 25px; color: var(--ink-on-ivory); margin: 0; line-height: 1.1; }

.cb-property-summary { display: flex; flex-direction: column; gap: 10px; }
.cb-property-summary h2, .cb-property-summary h3 { font-family: var(--lx-serif); color: var(--ink-on-ivory); }

/* Équipements */
.cb-amenities__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 24px; }
.cb-amenity { display: flex; align-items: center; gap: 11px; font-size: 14.5px; font-weight: 300; color: var(--cb-text); }
.cb-amenity svg, .cb-amenity .cb-icon { width: 18px; height: 18px; stroke: var(--gold-d); flex: none; }
.cb-property-card .cb-amenities__list { display: flex; flex-wrap: wrap; gap: 8px; }
.cb-property-card .cb-amenity { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted-ivory); gap: 6px; }
.cb-property-card .cb-amenity svg { width: 13px; height: 13px; }

/* Badge */
.cb-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--lx-sans); font-size: 10px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase;
  color: var(--ink); background: var(--gold); border-radius: var(--lx-r); padding: 6px 12px;
}
.cb-badge svg { width: 12px; height: 12px; }
.cb-badge--ghost { background: rgba(20,17,14,.78); color: var(--gold-l); backdrop-filter: blur(4px); }
.cb-property-card__img .cb-badge { position: absolute; top: 14px; left: 14px; }

/* --- Prix --- */
.cb-price-line { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 11px 0; font-size: 14.5px; font-weight: 300; color: var(--cb-text); }
.cb-price-line + .cb-price-line { border-top: 1px solid var(--line-ivory); }
.cb-price-line .cb-price-line__label { color: var(--cb-muted); }
.cb-price-line__val, .cb-price-total__val { font-variant-numeric: tabular-nums; font-weight: 400; }
.cb-price-total {
  display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  margin-top: 10px; padding-top: 18px; border-top: 1px solid var(--gold-line);
  font-family: var(--lx-serif); font-size: 26px; color: var(--ink-on-ivory);
}
.cb-price-total__val { font-weight: 500; font-variant-numeric: tabular-nums; color: var(--gold-d); }
.cb-property-card__price, .cb-property-card .cb-price { font-family: var(--lx-serif); font-size: 26px; font-weight: 500; color: var(--ink-on-ivory); font-variant-numeric: tabular-nums; }
.cb-property-card__price small { font-family: var(--lx-sans); font-size: 11px; font-weight: 400; letter-spacing: .1em; text-transform: uppercase; color: var(--cb-muted); }

/* --- Stepper --- */
.cb-stepper { display: flex; align-items: center; gap: 0; flex-wrap: wrap; counter-reset: cb-step; }
.cb-step { display: inline-flex; align-items: center; gap: 12px; color: var(--muted-ivory); font-size: 11px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; }
.cb-step::before {
  content: counter(cb-step, decimal-leading-zero); counter-increment: cb-step;
  width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
  border: 1px solid var(--line-ivory); color: var(--muted-ivory);
  font-family: var(--lx-serif); font-size: 15px; font-weight: 500; flex: none;
}
.cb-step:not(:last-child)::after { content: ""; width: 44px; height: 1px; background: var(--line-ivory); margin: 0 16px; }
.cb-step.cb-active { color: var(--ink-on-ivory); }
.cb-step.cb-active::before { border-color: var(--gold); background: var(--gold); color: var(--ink); }
.cb-step.cb-done::before { border-color: var(--gold); color: var(--gold-d); }

/* --- Confirmation --- */
.cb-confirmation { text-align: center; max-width: 600px; margin: 0 auto; }
.cb-confirmation__icon { width: 92px; height: 92px; border-radius: 50%; margin: 0 auto 28px; display: grid; place-items: center; border: 1px solid var(--gold); background: var(--gold-soft); }
.cb-confirmation__icon svg { width: 42px; height: 42px; stroke: var(--gold-d); stroke-width: 1.6; }
.cb-confirmation h1, .cb-confirmation h2 { font-family: var(--lx-serif); color: var(--ink-on-ivory); margin-bottom: 14px; }
.cb-confirmation p { color: var(--muted-ivory); font-size: 16px; font-weight: 300; }

/* --- Utilitaires --- */
.cb-text-sm { font-size: 13px; }
.cb-text-lg { font-size: 18px; }
.cb-text-muted { color: var(--cb-muted); }
.cb-row { display: flex; gap: 12px; align-items: center; }
.cb-col { display: flex; flex-direction: column; gap: 12px; }
.cb-widget:empty { min-height: var(--cb-control-h); border-radius: var(--cb-radius); }

/* ============================================================
   9. RESPONSIVE  (1440 → 1024 → 768 → 375)
   ============================================================ */
@media (max-width: 1024px) {
  .lx-section { padding: 88px 0; }
  .lx-detail, .lx-checkout, .lx-results-layout { grid-template-columns: 1fr; }
  .lx-detail__aside, .lx-checkout__aside { position: static; }
  .lx-results-layout aside { position: static !important; }
  .lx-values { grid-template-columns: 1fr 1fr; }
  .lx-value { border-bottom: 1px solid var(--line-ivory); }
  .lx-value:nth-child(2n) { border-right: 0; }
  .lx-stats { grid-template-columns: 1fr 1fr; gap: 36px 0; }
  .lx-stat:nth-child(2n+1) { border-left: 0; }
  .lx-quotes { grid-template-columns: 1fr; }
  .lx-footer__grid { grid-template-columns: 1fr 1fr; }
  .lx-edito { grid-template-columns: 60px 1fr; }
  .lx-edito__img { display: none; }
  .lx-edito__txt { padding: 36px 28px 36px 0; }
}
@media (max-width: 768px) {
  .lx-nav__links { display: none; }
  .lx-hero__inner { padding: 120px 22px 96px; }
  .cb-widget--composed > * { flex: 1 1 100%; }
  .cb-widget--composed .cb-cta { width: 100%; }
  .cb-amenities__list { grid-template-columns: 1fr; }
  .lx-gallery { grid-template-columns: 1fr 1fr; grid-template-rows: auto; }
  .lx-gallery > div:first-child { grid-column: 1 / 3; grid-row: auto; min-height: 240px; }
}
@media (max-width: 480px) {
  .lx-container { padding: 0 20px; }
  .lx-values, .lx-stats, .lx-footer__grid { grid-template-columns: 1fr; }
  .lx-value { border-right: 0; }
  .lx-stat { border-left: 0; }
}

/* ============================================================
   10. ACCESSIBILITÉ — mouvement réduit
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
`;

/**
 * Vignette de galerie : ce template est sans photo (visuels en dégradés charbon + or), donc on
 * génère une vignette SVG inline fidèle à sa palette (3 cartes « catalogue » + wordmark serif).
 * Auto-suffisante (data-URI, aucune dépendance réseau).
 */
const THUMB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 192">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A150F"/><stop offset="1" stop-color="#0F0C09"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9C089"/><stop offset="1" stop-color="#B6924E"/></linearGradient>
  </defs>
  <rect width="360" height="192" fill="url(#bg)"/>
  <text x="24" y="36" fill="#C6A867" font-family="Georgia, 'Cormorant Garamond', serif" font-size="22" font-style="italic">Maison</text>
  <text x="26" y="51" fill="#8E8576" font-family="Georgia, serif" font-size="8" letter-spacing="4">CONCIERGERIE</text>
  <g>
    <g transform="translate(24,66)"><rect width="96" height="108" rx="7" fill="#221B13" stroke="#3A2F22"/><rect x="8" y="8" width="80" height="52" rx="5" fill="url(#gold)" opacity="0.85"/><rect x="8" y="70" width="58" height="6" rx="3" fill="#E7DFD0"/><rect x="8" y="82" width="38" height="5" rx="2.5" fill="#7C7466"/><rect x="8" y="93" width="24" height="8" rx="3" fill="none" stroke="#C6A867"/></g>
    <g transform="translate(132,66)"><rect width="96" height="108" rx="7" fill="#221B13" stroke="#3A2F22"/><rect x="8" y="8" width="80" height="52" rx="5" fill="url(#gold)" opacity="0.7"/><rect x="8" y="70" width="58" height="6" rx="3" fill="#E7DFD0"/><rect x="8" y="82" width="38" height="5" rx="2.5" fill="#7C7466"/><rect x="8" y="93" width="24" height="8" rx="3" fill="none" stroke="#C6A867"/></g>
    <g transform="translate(240,66)"><rect width="96" height="108" rx="7" fill="#221B13" stroke="#3A2F22"/><rect x="8" y="8" width="80" height="52" rx="5" fill="url(#gold)" opacity="0.55"/><rect x="8" y="70" width="58" height="6" rx="3" fill="#E7DFD0"/><rect x="8" y="82" width="38" height="5" rx="2.5" fill="#7C7466"/><rect x="8" y="93" width="24" height="8" rx="3" fill="none" stroke="#C6A867"/></g>
  </g>
</svg>`;
const THUMB = `data:image/svg+xml,${encodeURIComponent(THUMB_SVG)}`;

export const rechercheCataloguePremium: GalleryTemplate = {
  id: 'recherche-catalogue-premium',
  name: 'Recherche Catalogue — Premium Conciergerie',
  description: 'Multi-logements — charbon & or champagne',
  thumbnail: THUMB,
  theme: {
    primaryColor: '#C6A867',
    fontFamily: 'Jost',
  },
  pages: [
  {
    path: '/',
    type: 'HOME',
    title: "Accueil",
    seoTitle: "Maison — Haute conciergerie de séjour · Marrakech",
    seoDescription: "Une sélection confidentielle de riads, villas et appartements d'exception à Marrakech, orchestrée par notre conciergerie privée.",
    css,
    html: `<!-- ============ NAV (répétée) ============ -->
<header class="lx-nav">
  <a class="lx-brand" href="/" aria-label="Accueil">
    <span class="lx-brand__mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span>
    Maison
  </a>
  <nav class="lx-nav__links" aria-label="Navigation principale">
    <a href="/" class="is-active">Accueil</a>
    <a href="/logements">Logements</a>
    <a href="/a-propos">Maison</a>
    <a href="/contact">Contact</a>
  </nav>
  <a class="lx-nav__cta" href="/contact">Nous contacter</a>
</header>

<main>
  <!-- ============ HERO PLEIN CADRE + RECHERCHE ============ -->
  <section class="lx-hero">
    <div class="lx-hero__media lx-hero__media--ph" role="img" aria-label="Riad de luxe baigné de lumière à Marrakech"></div>
    <div class="lx-hero__overlay"></div>
    <div class="lx-hero__inner">
      <p class="lx-eyebrow lx-eyebrow--center lx-hero__eyebrow">Conciergerie privée · Marrakech</p>
      <h1>L'art de séjourner<br><em>autrement</em>.</h1>
      <p class="lx-hero__sub">Une sélection confidentielle de maisons d'exception, orchestrée par notre conciergerie. Vous choisissez ; nous veillons sur tout le reste.</p>

      <div class="lx-hero__search">
        <div class="lx-searchcard">
          <!-- MARQUEUR · barre de recherche → /logements
               Le SDK remplace le contenu de ce <div>. À l'export, laisser le div VIDE. -->
          <div data-clenzy-widget="search" data-clenzy-next="/logements">
            
            <!-- widget injecté par le SDK -->
          
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ VALEURS NUMÉROTÉES ============ -->
  <section class="lx-section" style="padding-top:128px;">
    <div class="lx-container">
      <div class="lx-head lx-head--center">
        <p class="lx-eyebrow lx-eyebrow--center">Facilitateur de séjours</p>
        <h2 class="lx-h2">Une présence discrète, une exigence constante</h2>
      </div>
      <div class="lx-values">
        <div class="lx-value"><div class="lx-value__num">01</div><h3>Sélection</h3><p>Chaque maison est visitée et choisie une à une. Jamais de volume, seulement l'exception.</p></div>
        <div class="lx-value"><div class="lx-value__num">02</div><h3>Réactivité</h3><p>Une conciergerie joignable 7j/7, qui répond à la moindre demande avant et pendant le séjour.</p></div>
        <div class="lx-value"><div class="lx-value__num">03</div><h3>Accompagnement</h3><p>Accueil sur place, recommandations confidentielles, chauffeur, chef privé sur simple mot.</p></div>
        <div class="lx-value"><div class="lx-value__num">04</div><h3>Sérénité</h3><p>Tarifs clairs, paiement sécurisé, et une équipe qui anticipe pour vous offrir du temps.</p></div>
      </div>
    </div>
  </section>

  <!-- ============ LOGEMENTS EN VEDETTE ============ -->
  <section class="lx-section lx-section--alt">
    <div class="lx-container">
      <div class="lx-head" style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;">
        <div><p class="lx-eyebrow">La sélection</p><h2 class="lx-h2">Maisons en vedette</h2></div>
        <a class="lx-link" href="/logements">Toute la collection <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>

      <!-- MARQUEUR · grille de logements → /logement -->
      <div data-clenzy-widget="results" data-clenzy-next="/logement">
        
            <!-- widget injecté par le SDK -->
          
      </div>
    </div>
  </section>

  <!-- ============ COLLECTIONS ÉDITORIALES ============ -->
  <section class="lx-section">
    <div class="lx-container">
      <div class="lx-head"><p class="lx-eyebrow">Nos collections</p><h2 class="lx-h2">Trois manières de vivre Marrakech</h2></div>
      <div class="lx-editorial">
        <article class="lx-edito">
          <div class="lx-edito__num">01</div>
          <div class="lx-edito__txt"><h3>Riads</h3><p>Patios secrets, zelliges et terrasses sur les toits de la médina, à deux pas des souks.</p><a class="lx-link" href="/logements">Découvrir <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
          <div class="lx-edito__img" style="background:linear-gradient(150deg,#2c2419,#7a6a4f)"></div>
        </article>
        <article class="lx-edito">
          <div class="lx-edito__num">02</div>
          <div class="lx-edito__txt"><h3>Villas</h3><p>Domaines à la Palmeraie, piscines à débordement et jardins d'oliviers, loin de l'agitation.</p><a class="lx-link" href="/logements">Découvrir <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
          <div class="lx-edito__img" style="background:linear-gradient(150deg,#283021,#6d7a55)"></div>
        </article>
        <article class="lx-edito">
          <div class="lx-edito__num">03</div>
          <div class="lx-edito__txt"><h3>Appartements</h3><p>Adresses contemporaines à Guéliz et Hivernage, pour un séjour citadin tout confort.</p><a class="lx-link" href="/logements">Découvrir <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
          <div class="lx-edito__img" style="background:linear-gradient(150deg,#2b2218,#806b50)"></div>
        </article>
      </div>
    </div>
  </section>

  <!-- ============ CHIFFRES-CLÉS (charbon) ============ -->
  <section class="lx-section lx-section--ink lx-section--tight">
    <div class="lx-container">
      <div class="lx-stats">
        <div class="lx-stat"><div class="lx-stat__n">40</div><div class="lx-stat__l">Maisons d'exception</div></div>
        <div class="lx-stat"><div class="lx-stat__n">7/7</div><div class="lx-stat__l">Conciergerie dédiée</div></div>
        <div class="lx-stat"><div class="lx-stat__n">4,9</div><div class="lx-stat__l">Note moyenne voyageurs</div></div>
        <div class="lx-stat"><div class="lx-stat__n">100%</div><div class="lx-stat__l">Logements vérifiés</div></div>
      </div>
    </div>
  </section>

  <!-- ============ AVIS ============ -->
  <section class="lx-section">
    <div class="lx-container">
      <div class="lx-head lx-head--center"><p class="lx-eyebrow lx-eyebrow--center">Confidences</p><h2 class="lx-h2">Ce que l'on retient</h2></div>
      <div class="lx-quotes">
        <figure class="lx-quote">
          <div class="lx-quote__stars" aria-label="5 sur 5"><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg></div>
          <blockquote><p>« Un riad d'une rare élégance, et une équipe qui devançait chacune de nos envies. »</p></blockquote>
          <figcaption class="lx-quote__who"><b>Camille R.</b> · Paris</figcaption>
        </figure>
        <figure class="lx-quote">
          <div class="lx-quote__stars" aria-label="5 sur 5"><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg></div>
          <blockquote><p>« Réservation limpide, conseils précieux. On s'est sentis attendus, pas accueillis. »</p></blockquote>
          <figcaption class="lx-quote__who"><b>Thomas L.</b> · Genève</figcaption>
        </figure>
        <figure class="lx-quote">
          <div class="lx-quote__stars" aria-label="5 sur 5"><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg><svg viewBox="0 0 24 24"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg></div>
          <blockquote><p>« La villa dépassait les photos. Un séjour sans la moindre fausse note. »</p></blockquote>
          <figcaption class="lx-quote__who"><b>Inès B.</b> · Bruxelles</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <!-- ============ APPEL FINAL ============ -->
  <section class="lx-section lx-section--ink" style="text-align:center;">
    <div class="lx-container">
      <p class="lx-eyebrow lx-eyebrow--center">Votre prochain séjour</p>
      <h2 class="lx-h2" style="color:var(--on-dark);margin-inline:auto;max-width:18ch;">Composons ensemble une parenthèse rare</h2>
      <div style="margin-top:36px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
        <a class="lx-btn lx-btn--solid" href="/logements">Voir les maisons <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        <a class="lx-btn lx-btn--ondark" href="/contact">Nous écrire</a>
      </div>
    </div>
  </section>
</main>

<!-- ============ FOOTER (répété) ============ -->
<footer class="lx-footer">
  <div class="lx-container">
    <div class="lx-footer__grid">
      <div>
        <div class="lx-footer__brand">Maison</div>
        <p>Haute conciergerie de séjour à Marrakech. Une collection confidentielle de maisons d'exception.</p>
      </div>
      <div><h4>Collections</h4><ul><li><a href="/logements">Riads</a></li><li><a href="/logements">Villas</a></li><li><a href="/logements">Appartements</a></li></ul></div>
      <div><h4>Maison</h4><ul><li><a href="/a-propos">La maison</a></li><li><a href="/logements">La collection</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+212524000000">+212 524 00 00 00</a></li><li><a href="mailto:bonjour@maison-marrakech.com">bonjour@maison-marrakech.com</a></li><li>Médina, Marrakech</li></ul></div>
    </div>
    <div class="lx-footer__bar"><span>© 2026 Maison · Conciergerie Marrakech</span><span>Mentions légales · Confidentialité · CGV</span></div>
  </div>
</footer>`,
  },
  {
    path: '/logements',
    type: 'PROPERTY_LIST',
    title: "Nos logements",
    seoTitle: "La collection — Maisons d'exception à Marrakech",
    seoDescription: "Parcourez et comparez notre collection confidentielle de riads, villas et appartements à Marrakech.",
    css,
    html: `<header class="lx-nav">
  <a class="lx-brand" href="/" aria-label="Accueil"><span class="lx-brand__mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span> Maison</a>
  <nav class="lx-nav__links" aria-label="Navigation principale">
    <a href="/">Accueil</a>
    <a href="/logements" class="is-active">Logements</a>
    <a href="/a-propos">Maison</a>
    <a href="/contact">Contact</a>
  </nav>
  <a class="lx-nav__cta" href="/contact">Nous contacter</a>
</header>

<main>
  <!-- ============ EN-TÊTE SOMBRE + RECHERCHE (affiner) ============ -->
  <section class="lx-section--ink" style="padding:84px 0 0;">
    <div class="lx-container">
      <p class="lx-eyebrow">La collection · Marrakech</p>
      <h1 class="lx-h2" style="color:var(--on-dark);">Trouvez votre maison</h1>
      <p class="lx-lead">Une sélection confidentielle, à comparer en toute quiétude.</p>
      <div class="lx-hero__search" style="margin:36px 0 0;transform:translateY(36px);">
        <div class="lx-searchcard lx-searchcard--solid">
          <!-- MARQUEUR · recherche (affiner) → /logements -->
          <div data-clenzy-widget="search" data-clenzy-next="/logements">
            
            <!-- widget injecté par le SDK -->
          
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ RÉSULTATS ============ -->
  <section class="lx-section" style="padding-top:80px;">
    <div class="lx-container">
      <div class="lx-results-layout">
        <!-- Filtres -->
        <aside style="position:sticky;top:100px;">
          <!-- MARQUEUR · filtres -->
          <div data-clenzy-widget="booking-filter">
            
            <!-- widget injecté par le SDK -->
          
          </div>
        </aside>

        <!-- Grille -->
        <div>
          <div class="cb-row" style="justify-content:space-between;align-items:baseline;margin-bottom:28px;flex-wrap:wrap;gap:14px;">
            <div style="font-family:var(--lx-serif);font-size:26px;color:var(--ink-on-ivory);">24 maisons <span style="font-size:15px;color:var(--muted-ivory);font-family:var(--lx-sans);letter-spacing:.1em;text-transform:uppercase;">· Marrakech</span></div>
            <div class="cb-input cb-row" style="width:auto;min-height:auto;padding:11px 16px;cursor:pointer;font-size:12px;letter-spacing:.12em;text-transform:uppercase;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#A8884C" stroke-width="1.8"><path d="M3 6h18M6 12h12M10 18h4"/></svg> Tri : Signature</div>
          </div>

          <!-- MARQUEUR · grille → /logement -->
          <div data-clenzy-widget="results" data-clenzy-next="/logement">
            
            <!-- widget injecté par le SDK -->
          
          </div>
        </div>
      </div>
    </div>
  </section>
</main>

<footer class="lx-footer">
  <div class="lx-container">
    <div class="lx-footer__grid">
      <div><div class="lx-footer__brand">Maison</div><p>Haute conciergerie de séjour à Marrakech. Une collection confidentielle de maisons d'exception.</p></div>
      <div><h4>Collections</h4><ul><li><a href="/logements">Riads</a></li><li><a href="/logements">Villas</a></li><li><a href="/logements">Appartements</a></li></ul></div>
      <div><h4>Maison</h4><ul><li><a href="/a-propos">La maison</a></li><li><a href="/logements">La collection</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+212524000000">+212 524 00 00 00</a></li><li><a href="mailto:bonjour@maison-marrakech.com">bonjour@maison-marrakech.com</a></li><li>Médina, Marrakech</li></ul></div>
    </div>
    <div class="lx-footer__bar"><span>© 2026 Maison · Conciergerie Marrakech</span><span>Mentions légales · Confidentialité · CGV</span></div>
  </div>
</footer>`,
  },
  {
    path: '/logement',
    type: 'CUSTOM',
    title: "Fiche logement",
    seoTitle: "Riad Al Foundouk — Maison · Marrakech",
    seoDescription: "Riad Al Foundouk, médina de Marrakech : piscine, patio, terrasse sur les toits, 6 voyageurs. Disponibilités et réservation.",
    css,
    html: `<header class="lx-nav">
  <a class="lx-brand" href="/" aria-label="Accueil"><span class="lx-brand__mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span> Maison</a>
  <nav class="lx-nav__links" aria-label="Navigation principale">
    <a href="/">Accueil</a>
    <a href="/logements" class="is-active">Logements</a>
    <a href="/a-propos">Maison</a>
    <a href="/contact">Contact</a>
  </nav>
  <a class="lx-nav__cta" href="/contact">Nous contacter</a>
</header>

<main class="lx-section" style="padding-top:40px;">
  <div class="lx-container">
    <a class="lx-link" href="/logements" style="margin-bottom:24px;"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> La collection</a>

    <!-- galerie (placeholders — remplacer par photos du logement) -->
    <div class="lx-gallery" role="img" aria-label="Photographies du Riad Al Foundouk" style="margin:22px 0 48px;">
      <div></div><div></div><div></div><div></div><div></div>
    </div>

    <div class="lx-detail">
      <!-- ===== Colonne contenu ===== -->
      <div>
        <!-- MARQUEUR · résumé du logement -->
        <div data-clenzy-widget="booking-property-summary">
          
            <!-- widget injecté par le SDK -->
          
        </div>

        <p style="font-size:18px;font-weight:300;color:var(--body-ivory);margin:28px 0 0;max-width:60ch;line-height:1.8;">
          Au cœur de la médina, ce riad restauré dans les règles de l'art ouvre sur un patio planté d'orangers et une piscine
          rafraîchissante. Terrasse sur les toits avec vue sur les minarets, salons en zellige, et le calme absolu à deux pas des souks.
          Notre conciergerie reste à votre disposition 7j/7 pendant tout le séjour.
        </p>

        <!-- MARQUEUR · équipements -->
        <h2 class="lx-h3" style="margin:48px 0 24px;">Équipements</h2>
        <div data-clenzy-widget="booking-amenities">
          
            <!-- widget injecté par le SDK -->
          
        </div>
      </div>

      <!-- ===== Colonne réservation (sticky) ===== -->
      <aside class="lx-detail__aside">
        <div class="lx-card">
          <div class="cb-row" style="justify-content:space-between;align-items:baseline;margin-bottom:22px;padding-bottom:20px;border-bottom:1px solid var(--gold-line);">
            <span style="font-family:var(--lx-serif);font-size:30px;color:var(--ink-on-ivory);font-variant-numeric:tabular-nums;">1 450 <span style="font-size:12px;color:var(--muted-ivory);font-family:var(--lx-sans);letter-spacing:.1em;text-transform:uppercase;">MAD / nuit</span></span>
            <span class="cb-row" style="gap:5px;font-family:var(--lx-serif);font-size:19px;font-variant-numeric:tabular-nums;"><svg viewBox="0 0 24 24" width="14" height="14" fill="#C6A867" stroke="#C6A867"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg> 4,9</span>
          </div>

          <!-- MARQUEUR · dates -->
          <div data-clenzy-widget="dates" style="margin-bottom:12px;">
            
            <!-- widget injecté par le SDK -->
          
          </div>

          <!-- MARQUEUR · voyageurs -->
          <div data-clenzy-widget="guests" style="margin-bottom:18px;">
            
            <!-- widget injecté par le SDK -->
          
          </div>

          <!-- MARQUEUR · récap prix (le récap ne navigue pas → CTA explicite ci-dessous) -->
          <div data-clenzy-widget="price">

            <!-- widget injecté par le SDK -->

          </div>
          <!-- CTA vers la page réservation (lien standard ; le SDK ne navigue pas depuis le récap prix) -->
          <a href="/reserver" class="lx-btn lx-btn--solid" style="width:100%;margin-top:16px;justify-content:center;">Réserver ce séjour</a>
        </div>
      </aside>
    </div>
  </div>
</main>

<footer class="lx-footer">
  <div class="lx-container">
    <div class="lx-footer__grid">
      <div><div class="lx-footer__brand">Maison</div><p>Haute conciergerie de séjour à Marrakech. Une collection confidentielle de maisons d'exception.</p></div>
      <div><h4>Collections</h4><ul><li><a href="/logements">Riads</a></li><li><a href="/logements">Villas</a></li><li><a href="/logements">Appartements</a></li></ul></div>
      <div><h4>Maison</h4><ul><li><a href="/a-propos">La maison</a></li><li><a href="/logements">La collection</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+212524000000">+212 524 00 00 00</a></li><li><a href="mailto:bonjour@maison-marrakech.com">bonjour@maison-marrakech.com</a></li><li>Médina, Marrakech</li></ul></div>
    </div>
    <div class="lx-footer__bar"><span>© 2026 Maison · Conciergerie Marrakech</span><span>Mentions légales · Confidentialité · CGV</span></div>
  </div>
</footer>`,
  },
  {
    path: '/reserver',
    type: 'CUSTOM',
    title: "Réservation",
    seoTitle: "Finaliser votre séjour — Maison · Marrakech",
    seoDescription: "Renseignez vos coordonnées et réglez votre séjour en toute sécurité.",
    css,
    html: `<header class="lx-nav">
  <a class="lx-brand" href="/" aria-label="Accueil"><span class="lx-brand__mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span> Maison</a>
  <nav class="lx-nav__links" aria-label="Navigation principale">
    <a href="/">Accueil</a>
    <a href="/logements">Logements</a>
    <a href="/a-propos">Maison</a>
    <a href="/contact">Contact</a>
  </nav>
  <a class="lx-nav__cta" href="/contact">Nous contacter</a>
</header>

<main class="lx-section" style="padding-top:48px;">
  <div class="lx-container">
    <a class="lx-link" href="/logement" style="margin-bottom:22px;"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> Retour au logement</a>
    <h1 class="lx-h2" style="margin:16px 0 30px;">Finaliser votre séjour</h1>

    <!-- étapes -->
    <div class="cb-stepper" style="margin-bottom:48px;">
      <span class="cb-step cb-done">Logement</span>
      <span class="cb-step cb-active">Coordonnées &amp; paiement</span>
      <span class="cb-step">Confirmation</span>
    </div>

    <div class="lx-checkout">
      <!-- ===== Colonne formulaire + paiement ===== -->
      <div class="cb-col" style="gap:28px;">
        <!-- MARQUEUR · coordonnées voyageur -->
        <div class="lx-card" data-clenzy-widget="guest-form">
          
            <!-- widget injecté par le SDK -->
          
        </div>

        <!-- MARQUEUR · paiement (Stripe) → /confirmation -->
        <div class="lx-card" data-clenzy-widget="checkout" data-clenzy-return="/confirmation">
          
            <!-- widget injecté par le SDK -->
          
        </div>
      </div>

      <!-- ===== Colonne récap (sticky) ===== -->
      <aside class="lx-checkout__aside">
        <div class="lx-card">
          <!-- MARQUEUR · résumé du logement -->
          <div data-clenzy-widget="booking-property-summary">
            
            <!-- widget injecté par le SDK -->
          
          </div>

          <div class="cb-row" style="gap:12px;margin:22px 0;padding:16px 0;border-top:1px solid var(--line-ivory);border-bottom:1px solid var(--line-ivory);font-size:13px;font-weight:300;">
            <span class="cb-row" style="gap:7px;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#A8884C" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> 12 – 16 mai</span>
            <span class="cb-text-muted">·</span>
            <span class="cb-row" style="gap:7px;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#A8884C" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> 2 voyageurs</span>
          </div>

          <!-- MARQUEUR · récap prix -->
          <div data-clenzy-widget="price">
            
            <!-- widget injecté par le SDK -->
          
          </div>
        </div>
      </aside>
    </div>
  </div>
</main>

<footer class="lx-footer">
  <div class="lx-container">
    <div class="lx-footer__grid">
      <div><div class="lx-footer__brand">Maison</div><p>Haute conciergerie de séjour à Marrakech. Une collection confidentielle de maisons d'exception.</p></div>
      <div><h4>Collections</h4><ul><li><a href="/logements">Riads</a></li><li><a href="/logements">Villas</a></li><li><a href="/logements">Appartements</a></li></ul></div>
      <div><h4>Maison</h4><ul><li><a href="/a-propos">La maison</a></li><li><a href="/logements">La collection</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+212524000000">+212 524 00 00 00</a></li><li><a href="mailto:bonjour@maison-marrakech.com">bonjour@maison-marrakech.com</a></li><li>Médina, Marrakech</li></ul></div>
    </div>
    <div class="lx-footer__bar"><span>© 2026 Maison · Conciergerie Marrakech</span><span>Mentions légales · Confidentialité · CGV</span></div>
  </div>
</footer>`,
  },
  {
    path: '/confirmation',
    type: 'CUSTOM',
    title: "Confirmation",
    seoTitle: "Séjour confirmé — Maison · Marrakech",
    seoDescription: "Votre séjour est confirmé. Récapitulatif et prochaines étapes.",
    css,
    html: `<header class="lx-nav">
  <a class="lx-brand" href="/" aria-label="Accueil"><span class="lx-brand__mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span> Maison</a>
  <nav class="lx-nav__links" aria-label="Navigation principale">
    <a href="/">Accueil</a>
    <a href="/logements">Logements</a>
    <a href="/a-propos">Maison</a>
    <a href="/contact">Contact</a>
  </nav>
  <a class="lx-nav__cta" href="/contact">Nous contacter</a>
</header>

<main class="lx-section">
  <div class="lx-container" style="max-width:720px;">
    <!-- MARQUEUR · confirmation (lit le retour de paiement) -->
    <div data-clenzy-widget="confirmation">
      
            <!-- widget injecté par le SDK -->
          
    </div>
  </div>
</main>

<footer class="lx-footer">
  <div class="lx-container">
    <div class="lx-footer__grid">
      <div><div class="lx-footer__brand">Maison</div><p>Haute conciergerie de séjour à Marrakech. Une collection confidentielle de maisons d'exception.</p></div>
      <div><h4>Collections</h4><ul><li><a href="/logements">Riads</a></li><li><a href="/logements">Villas</a></li><li><a href="/logements">Appartements</a></li></ul></div>
      <div><h4>Maison</h4><ul><li><a href="/a-propos">La maison</a></li><li><a href="/logements">La collection</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+212524000000">+212 524 00 00 00</a></li><li><a href="mailto:bonjour@maison-marrakech.com">bonjour@maison-marrakech.com</a></li><li>Médina, Marrakech</li></ul></div>
    </div>
    <div class="lx-footer__bar"><span>© 2026 Maison · Conciergerie Marrakech</span><span>Mentions légales · Confidentialité · CGV</span></div>
  </div>
</footer>`,
  },
  {
    path: '/a-propos',
    type: 'CUSTOM',
    title: "La maison",
    seoTitle: "La maison — Une décennie au service du séjour d'exception",
    seoDescription: "Depuis plus de dix ans, notre conciergerie veille sur une collection confidentielle de maisons d'exception à Marrakech.",
    css,
    html: `<header class="lx-nav">
  <a class="lx-brand" href="/" aria-label="Accueil"><span class="lx-brand__mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span> Maison</a>
  <nav class="lx-nav__links" aria-label="Navigation principale">
    <a href="/">Accueil</a>
    <a href="/logements">Logements</a>
    <a href="/a-propos" class="is-active">Maison</a>
    <a href="/contact">Contact</a>
  </nav>
  <a class="lx-nav__cta" href="/contact">Nous contacter</a>
</header>

<main>
  <!-- Hero éditorial sombre -->
  <section class="lx-hero">
    <div class="lx-hero__media lx-hero__media--ph" role="img" aria-label="Patio d'un riad au crépuscule"></div>
    <div class="lx-hero__overlay"></div>
    <div class="lx-hero__inner lx-hero__inner--short">
      <p class="lx-eyebrow lx-eyebrow--center lx-hero__eyebrow">La maison</p>
      <h1 style="font-size:clamp(40px,5.5vw,72px);">Une décennie au service<br>du séjour d'exception</h1>
    </div>
  </section>

  <!-- Manifeste -->
  <section class="lx-section">
    <div class="lx-container" style="max-width:780px;text-align:center;">
      <p style="font-family:var(--lx-serif);font-size:clamp(24px,2.6vw,32px);line-height:1.45;color:var(--ink-on-ivory);font-weight:400;">
        Nous ne sommes pas une plateforme, mais une conciergerie. Un nombre volontairement limité de maisons,
        choisies une à une, et une équipe présente à Marrakech pour veiller sur chaque séjour comme s'il était le nôtre.
      </p>
    </div>
  </section>

  <!-- Chiffres-clés -->
  <section class="lx-section lx-section--ink lx-section--tight">
    <div class="lx-container">
      <div class="lx-stats">
        <div class="lx-stat"><div class="lx-stat__n">10</div><div class="lx-stat__l">Ans d'expérience</div></div>
        <div class="lx-stat"><div class="lx-stat__n">40</div><div class="lx-stat__l">Maisons d'exception</div></div>
        <div class="lx-stat"><div class="lx-stat__n">7/7</div><div class="lx-stat__l">Conciergerie dédiée</div></div>
        <div class="lx-stat"><div class="lx-stat__n">4,9</div><div class="lx-stat__l">Note moyenne</div></div>
      </div>
    </div>
  </section>

  <!-- Engagements -->
  <section class="lx-section">
    <div class="lx-container">
      <div class="lx-head lx-head--center"><p class="lx-eyebrow lx-eyebrow--center">Nos engagements</p><h2 class="lx-h2">Ce qui ne se négocie pas</h2></div>
      <div class="lx-values">
        <div class="lx-value"><div class="lx-value__num">01</div><h3>Sélection</h3><p>Chaque maison visitée, photographiée et contrôlée avant d'entrer dans la collection.</p></div>
        <div class="lx-value"><div class="lx-value__num">02</div><h3>Discrétion</h3><p>Une relation privilégiée et confidentielle avec chacun de nos voyageurs.</p></div>
        <div class="lx-value"><div class="lx-value__num">03</div><h3>Présence</h3><p>Une équipe sur place, joignable 7j/7, qui anticipe avant même la demande.</p></div>
        <div class="lx-value"><div class="lx-value__num">04</div><h3>Transparence</h3><p>Tarifs clairs, conditions limpides, paiement sécurisé. Sans surprise.</p></div>
      </div>
    </div>
  </section>

  <!-- Appel -->
  <section class="lx-section lx-section--ink" style="text-align:center;">
    <div class="lx-container">
      <h2 class="lx-h2" style="color:var(--on-dark);margin-inline:auto;max-width:18ch;">Découvrez la collection</h2>
      <div style="margin-top:34px;"><a class="lx-btn lx-btn--solid" href="/logements">Voir les maisons <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
    </div>
  </section>
</main>

<footer class="lx-footer">
  <div class="lx-container">
    <div class="lx-footer__grid">
      <div><div class="lx-footer__brand">Maison</div><p>Haute conciergerie de séjour à Marrakech. Une collection confidentielle de maisons d'exception.</p></div>
      <div><h4>Collections</h4><ul><li><a href="/logements">Riads</a></li><li><a href="/logements">Villas</a></li><li><a href="/logements">Appartements</a></li></ul></div>
      <div><h4>Maison</h4><ul><li><a href="/a-propos">La maison</a></li><li><a href="/logements">La collection</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+212524000000">+212 524 00 00 00</a></li><li><a href="mailto:bonjour@maison-marrakech.com">bonjour@maison-marrakech.com</a></li><li>Médina, Marrakech</li></ul></div>
    </div>
    <div class="lx-footer__bar"><span>© 2026 Maison · Conciergerie Marrakech</span><span>Mentions légales · Confidentialité · CGV</span></div>
  </div>
</footer>`,
  },
  {
    path: '/contact',
    type: 'CUSTOM',
    title: "Contact",
    seoTitle: "Contact — Maison · Conciergerie Marrakech",
    seoDescription: "Une question sur une maison ou votre séjour ? Notre conciergerie vous répond 7j/7.",
    css,
    html: `<header class="lx-nav">
  <a class="lx-brand" href="/" aria-label="Accueil"><span class="lx-brand__mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span> Maison</a>
  <nav class="lx-nav__links" aria-label="Navigation principale">
    <a href="/">Accueil</a>
    <a href="/logements">Logements</a>
    <a href="/a-propos">Maison</a>
    <a href="/contact" class="is-active">Contact</a>
  </nav>
  <a class="lx-nav__cta" href="tel:+212524000000">Nous appeler</a>
</header>

<main class="lx-section">
  <div class="lx-container">
    <div class="lx-detail">
      <!-- Colonne formulaire -->
      <div>
        <p class="lx-eyebrow">Contact</p>
        <h1 class="lx-h2">Parlons de votre séjour</h1>
        <p class="lx-lead" style="margin-bottom:36px;">Une question sur une maison, une demande particulière, un séjour de groupe ? Écrivez-nous, nous répondons dans la journée.</p>

        <form class="lx-card" onsubmit="return false">
          <div class="cb-col" style="gap:18px;">
            <div class="cb-row" style="gap:18px;">
              <div class="cb-field" style="flex:1;"><label class="cb-field__label" for="cn">Nom</label><input class="cb-input" id="cn" type="text" placeholder="Votre nom"></div>
              <div class="cb-field" style="flex:1;"><label class="cb-field__label" for="ce">E-mail</label><input class="cb-input" id="ce" type="email" placeholder="vous@exemple.fr"></div>
            </div>
            <div class="cb-field"><label class="cb-field__label" for="csub">Sujet</label><input class="cb-input" id="csub" type="text" placeholder="Disponibilité, séjour sur-mesure…"></div>
            <div class="cb-field"><label class="cb-field__label" for="cmsg">Message</label><textarea class="cb-textarea" id="cmsg" placeholder="Dites-nous tout…"></textarea></div>
            <button class="cb-cta" type="submit" style="align-self:flex-start;">Envoyer</button>
          </div>
        </form>
      </div>

      <!-- Colonne coordonnées -->
      <aside class="lx-detail__aside">
        <div class="lx-card cb-col" style="gap:26px;">
          <div class="cb-row" style="gap:14px;align-items:flex-start;">
            <span style="width:46px;height:46px;flex:none;border:1px solid var(--gold-line);border-radius:50%;display:grid;place-items:center;"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#A8884C" stroke-width="1.6"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg></span>
            <div class="cb-col" style="gap:3px;"><span class="cb-field__label">Téléphone</span><a href="tel:+212524000000" style="font-family:var(--lx-serif);font-size:20px;color:var(--ink-on-ivory);">+212 524 00 00 00</a></div>
          </div>
          <div class="cb-row" style="gap:14px;align-items:flex-start;">
            <span style="width:46px;height:46px;flex:none;border:1px solid var(--gold-line);border-radius:50%;display:grid;place-items:center;"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#A8884C" stroke-width="1.6"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg></span>
            <div class="cb-col" style="gap:3px;"><span class="cb-field__label">E-mail</span><a href="mailto:bonjour@maison-marrakech.com" style="font-family:var(--lx-serif);font-size:20px;color:var(--ink-on-ivory);">bonjour@maison-marrakech.com</a></div>
          </div>
          <div class="cb-row" style="gap:14px;align-items:flex-start;">
            <span style="width:46px;height:46px;flex:none;border:1px solid var(--gold-line);border-radius:50%;display:grid;place-items:center;"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#A8884C" stroke-width="1.6"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
            <div class="cb-col" style="gap:3px;"><span class="cb-field__label">Adresse</span><span style="font-family:var(--lx-serif);font-size:20px;color:var(--ink-on-ivory);">Médina, Marrakech</span></div>
          </div>
          <div style="border-top:1px solid var(--line-ivory);padding-top:20px;">
            <span class="cb-text-sm cb-row" style="gap:8px;letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:var(--muted-ivory);"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#A8884C" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Conciergerie disponible 7j/7</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</main>

<footer class="lx-footer">
  <div class="lx-container">
    <div class="lx-footer__grid">
      <div><div class="lx-footer__brand">Maison</div><p>Haute conciergerie de séjour à Marrakech. Une collection confidentielle de maisons d'exception.</p></div>
      <div><h4>Collections</h4><ul><li><a href="/logements">Riads</a></li><li><a href="/logements">Villas</a></li><li><a href="/logements">Appartements</a></li></ul></div>
      <div><h4>Maison</h4><ul><li><a href="/a-propos">La maison</a></li><li><a href="/logements">La collection</a></li><li><a href="/contact">Contact</a></li></ul></div>
      <div><h4>Contact</h4><ul><li><a href="tel:+212524000000">+212 524 00 00 00</a></li><li><a href="mailto:bonjour@maison-marrakech.com">bonjour@maison-marrakech.com</a></li><li>Médina, Marrakech</li></ul></div>
    </div>
    <div class="lx-footer__bar"><span>© 2026 Maison · Conciergerie Marrakech</span><span>Mentions légales · Confidentialité · CGV</span></div>
  </div>
</footer>`,
  }
  ],
};

export default rechercheCataloguePremium;
