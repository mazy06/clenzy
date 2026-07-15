/**
 * Funnel de réservation MONO-LOGEMENT — unité réutilisable (structure + mécanisme).
 *
 * Refonte STRUCTURELLE calée sur le handoff « Booking Engine » : funnel à 5 pas (Séjour → Dates →
 * Vos infos → Paiement → Confirmation), stepper horizontal (états à venir / actif / complété ✓),
 * et layout par étape `1fr / 270px` (carte principale + sidebar RÉCAP). Le DESIGN reste celui du
 * template existant (couleurs/polices/radius/tailles inchangés) — alimenté via les variables `--rf-*`.
 *
 * Wizard 100 % CSS (radios + labels) : une seule étape visible à la fois, dégradation sûre (tout
 * visible si la mécanique casse). 4 étapes interactives (czrf1..4) ; le 5e pas « Confirmation » est
 * décoratif dans le stepper — la vraie confirmation est la page `/confirmation` (post-paiement Stripe).
 *
 * Fonctions SDK conservées : property, booking-amenities, booking-dates (+ calendrier inline),
 * booking-guests, price, guest-form, checkout (Stripe hébergé → redirection).
 *
 * ⚠️ ids fixes (`czrf1..4`) → UNE instance par page (suffisant pour une page Réserver).
 * ⚠️ Le titre par étape vit DANS le funnel (cz-rf-head) → la page ne doit pas re-titrer.
 */

/** CSS STRUCTURE + MÉCANISME (réutilisable). Le thème vient des `--rf-*` ; ici, uniquement layout + wizard. */
export const RESERVATION_FUNNEL_CSS = `/* Funnel de réservation — STRUCTURE + MÉCANISME (thème alimenté par le template via --rf-*). */
.cz-rf {
  --_acc: var(--rf-accent, #c1622f);
  --_accsoft: var(--rf-accent-soft, rgba(193, 98, 47, 0.06));
  --_on: var(--rf-on-accent, #ffffff);
  --_surf: var(--rf-surface, #ffffff);
  --_ink: var(--rf-ink, #1a1714);
  --_body: var(--rf-body, #4f463f);
  --_muted: var(--rf-muted, #8a7c6f);
  --_line: var(--rf-line, #e6ddce);
  --_soft: var(--rf-soft, #efe6d8);
  --_rad: var(--rf-radius, 14px);
}
/* ── En-tête (eyebrow + titre par étape, centré) ── */
.cz-rf-head { text-align: center; margin-bottom: 4px; }
.cz-rf-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--_acc); margin: 0; }
.cz-rf-title { font-size: 30px; color: var(--_ink); margin: 8px 0 0; display: none; }
.cz-rf-title:nth-of-type(1) { display: block; }
#czrf2:checked ~ .cz-rf-head .cz-rf-title:nth-of-type(1),
#czrf3:checked ~ .cz-rf-head .cz-rf-title:nth-of-type(1),
#czrf4:checked ~ .cz-rf-head .cz-rf-title:nth-of-type(1) { display: none; }
#czrf2:checked ~ .cz-rf-head .cz-rf-title:nth-of-type(2),
#czrf3:checked ~ .cz-rf-head .cz-rf-title:nth-of-type(3),
#czrf4:checked ~ .cz-rf-head .cz-rf-title:nth-of-type(4) { display: block; }
/* ── Stepper 5 pas ── */
.cz-rf-steps { display: flex; align-items: center; justify-content: center; max-width: 680px; margin: 22px auto 30px; }
.cz-rf-step { display: flex; align-items: center; gap: 8px; color: var(--_muted); font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; }
.cz-rf-dot { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #e6ddce; background: transparent; color: var(--_muted); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.cz-rf-chk { display: none; }
.cz-rf-chk svg { width: 15px; height: 15px; }
.cz-rf-seg { flex: 1; height: 1.5px; background-color: var(--_line); margin: 0 9px; min-width: 14px; }
/* étape active */
#czrf1:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(1),
#czrf2:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(2),
#czrf3:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(3),
#czrf4:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(4) { color: var(--_ink); font-weight: 700; }
#czrf1:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(1) .cz-rf-dot,
#czrf2:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(2) .cz-rf-dot,
#czrf3:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(3) .cz-rf-dot,
#czrf4:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(4) .cz-rf-dot { background-color: var(--_acc); border-color: var(--_acc); color: var(--_on); }
/* étapes complétées (avant l'étape active) */
#czrf2:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+1),
#czrf3:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+2),
#czrf4:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+3) { color: var(--_body); font-weight: 600; }
#czrf2:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+1) .cz-rf-dot,
#czrf3:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+2) .cz-rf-dot,
#czrf4:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+3) .cz-rf-dot { background-color: var(--_acc); border-color: var(--_acc); color: var(--_on); }
#czrf2:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+1) .cz-rf-num,
#czrf3:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+2) .cz-rf-num,
#czrf4:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+3) .cz-rf-num { display: none; }
#czrf2:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+1) .cz-rf-chk,
#czrf3:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+2) .cz-rf-chk,
#czrf4:checked ~ .cz-rf-steps .cz-rf-step:nth-of-type(-n+3) .cz-rf-chk { display: flex; }
/* connecteurs complétés */
#czrf2:checked ~ .cz-rf-steps .cz-rf-seg:nth-of-type(-n+1),
#czrf3:checked ~ .cz-rf-steps .cz-rf-seg:nth-of-type(-n+2),
#czrf4:checked ~ .cz-rf-steps .cz-rf-seg:nth-of-type(-n+3) { background-color: var(--_acc); }
/* ── Layout par étape : carte principale + sidebar récap ── */
.cz-rf-cards { max-width: 1100px; margin: 0 auto; }
.cz-rf-card { display: grid; grid-template-columns: 1fr 270px; gap: 22px; align-items: start; }
.cz-rf-card + .cz-rf-card { margin-top: 0; }
.cz-rf-main { background-color: var(--_surf); border: 1px solid #e6ddce; border-radius: 14px; padding: 26px; }
.cz-rf-recap { background-color: var(--_surf); border: 1px solid #e6ddce; border-radius: 14px; padding: 22px; position: sticky; top: 96px; }
.cz-rf-card__head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.cz-rf-card__num { width: 28px; height: 28px; border-radius: 50%; background-color: var(--_acc); color: var(--_on); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.cz-rf-main h2 { font-size: 22px; color: var(--_ink); margin: 0; }
.cz-rf-sp { height: 16px; }
/* ── Sidebar récap ── */
.cz-rf-recap__label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--_muted); }
.cz-rf-recap__from { display: flex; align-items: baseline; justify-content: space-between; margin-top: 14px; }
.cz-rf-recap__from span { color: var(--_muted); font-size: 14px; }
.cz-rf-recap__from b { font-size: 22px; color: var(--_ink); }
.cz-rf-recap__per { text-align: right; font-size: 12px; color: var(--_muted); margin-top: 2px; }
.cz-rf-recap__trust { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--_muted); font-size: 12px; margin-top: 12px; text-align: center; }
.cz-rf-recap__trust svg { width: 14px; height: 14px; color: #3e8e66; flex: 0 0 auto; }
.cz-rf-recap .cz-rf-btn { margin-top: 18px; }
.cz-rf-recap [data-clenzy-widget="checkout"] { margin-top: 18px; width: 100%; }
/* ── Détail du logement (widget property) — galerie + identité + prix ── */
.cz-rf .cb-property-summary { display: grid; gap: 12px; }
.cz-rf .cb-property-summary__gallery { gap: 10px; }
.cz-rf .cb-property-summary__main { aspect-ratio: 16 / 10; border-radius: 14px; box-shadow: 0 16px 38px -22px rgba(26, 23, 20, 0.55); }
.cz-rf .cb-property-summary__thumb { width: 62px; height: 46px; border-radius: 8px; opacity: 0.6; transition: opacity 0.2s ease, border-color 0.2s ease; }
.cz-rf .cb-property-summary__thumb:hover { opacity: 1; }
.cz-rf .cb-property-summary__thumb.cb-active { opacity: 1; border-color: var(--_acc); }
.cz-rf .cb-property-summary__title { font-size: 21px; line-height: 1.15; color: var(--_ink); margin: 4px 0 0; text-wrap: balance; }
.cz-rf .cb-property-summary__place { margin: 2px 0 0; font-size: 14px; color: var(--_muted); }
.cz-rf .cb-property-summary__place-icon { color: var(--_acc); }
.cz-rf .cb-property-summary__price { margin-top: 8px; padding-top: 14px; border-top: 1px solid #e6ddce; gap: 8px; }
.cz-rf .cb-property-summary__from { font-size: 11px; letter-spacing: 0.09em; color: var(--_muted); }
.cz-rf .cb-property-summary__price b { font-size: 24px; line-height: 1; color: var(--_acc); }
.cz-rf .cb-property-summary__per { font-size: 14px; color: var(--_muted); }
/* Layout DÉTAIL (étape Séjour) : galerie à gauche, infos à droite. */
.cz-rf .cb-property-summary__info { display: flex; flex-direction: column; gap: 7px; }
.cz-rf .cb-property-summary--detail { display: flex; gap: 22px; align-items: flex-start; }
.cz-rf .cb-property-summary--detail .cb-property-summary__gallery { flex: 0 0 clamp(220px, 42%, 300px); }
.cz-rf .cb-property-summary--detail .cb-property-summary__info { flex: 1; min-width: 0; }
.cz-rf .cb-property-summary--detail .cb-property-summary__price { display: none; }
.cz-rf .cb-property-summary--detail .cb-property-summary__title { font-size: 25px; margin: 0; }
.cz-rf .cb-property-summary__note { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--_body); margin: 0; }
.cz-rf .cb-property-summary__note-star { display: inline-flex; color: var(--_acc); }
.cz-rf .cb-property-summary__note-star svg { width: 15px; height: 15px; }
.cz-rf .cb-property-summary__note b { color: var(--_ink); }
.cz-rf .cb-property-summary__note-count { color: var(--_muted); }
.cz-rf .cb-property-summary__capacity { display: flex; gap: 18px; flex-wrap: wrap; font-size: 14px; color: var(--_body); margin: 2px 0 0; }
.cz-rf .cb-property-summary__cap-item { display: inline-flex; align-items: center; gap: 6px; }
.cz-rf .cb-property-summary__cap-item svg { width: 15px; height: 15px; color: var(--_acc); }
/* ── Équipements (widget booking-amenities) habillés en bandeau de chips ── */
.cz-rf .cb-amenities { margin: 18px 0 0; }
.cz-rf .cb-amenities__list { background-color: var(--_soft); border-radius: 10px; padding: 14px 18px; gap: 8px 16px; list-style: none; margin: 0; }
.cz-rf .cb-amenity { display: inline-flex; align-items: center; gap: 8px; padding: 0; background: transparent; border-radius: 0; font-size: 14px; color: var(--_ink); }
.cz-rf .cb-amenity__icon { color: var(--_acc); }
/* ── Sélecteur de formule ── */
.cz-rf-formulas__intro { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--_muted); margin: 18px 0 10px; }
.cz-rf-formulas { display: grid; gap: 8px; }
.cz-rf-formula { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid #e6ddce; border-radius: 10px; padding: 10px 12px; }
.cz-rf-formula__left { display: flex; align-items: center; gap: 9px; min-width: 0; }
.cz-rf-formula__dot { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #e6ddce; background: var(--_surf); flex: 0 0 auto; }
.cz-rf-formula b { font-size: 13px; color: var(--_ink); }
.cz-rf-formula__sub { display: block; font-size: 11px; color: var(--_muted); margin-top: 1px; }
.cz-rf-formula__badge { display: inline-block; background-color: var(--_acc); color: var(--_on); font-size: 9px; padding: 2px 6px; border-radius: 999px; margin-left: 5px; vertical-align: middle; }
.cz-rf-formula__price { text-align: right; white-space: nowrap; }
.cz-rf-formula__price b { color: var(--_acc); font-size: 15px; }
.cz-rf-formula__price span { font-size: 11px; color: var(--_muted); }
.cz-rf-formula--reco { border: 1.5px solid #c1622f; background-color: var(--_accsoft); }
.cz-rf-formula--reco .cz-rf-formula__dot { border: 5px solid #c1622f; }
/* ── Étape paiement : intro (le formulaire carte est géré par Stripe hébergé) ── */
.cz-rf-pay { display: flex; flex-direction: column; gap: 14px; }
.cz-rf-pay__row { display: flex; align-items: flex-start; gap: 12px; color: var(--_body); font-size: 14px; line-height: 1.5; }
.cz-rf-pay__row svg { width: 18px; height: 18px; color: var(--_acc); flex: 0 0 auto; margin-top: 1px; }
.cz-rf-pay__note { display: flex; align-items: center; gap: 7px; color: var(--_muted); font-size: 12px; margin-top: 6px; }
.cz-rf-pay__note svg { width: 13px; height: 13px; }
.cz-rf-pay__note b { font-weight: 800; color: #635bff; letter-spacing: -0.02em; }
/* ── Boutons (radius/tailles du design existant, inchangés) ── */
.cz-rf-nav { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.cz-rf-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 20px; border-radius: 4px; border: 1px solid transparent; font-size: 14px; font-weight: 600; letter-spacing: 0.02em; cursor: pointer; text-decoration: none; transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
.cz-rf-btn--primary { background-color: var(--_acc); color: var(--_on); }
.cz-rf-btn--ghost { background: transparent; color: var(--_ink); border-color: var(--_line); }
.cz-rf-btn svg { width: 17px; height: 17px; flex: 0 0 auto; }
/* Calendrier INLINE (toujours visible) dans le funnel, au lieu du popover. */
.cz-rf-card .cb-calendar-wrapper, .cz-rf-card .cb-calendar-wrapper.cb-open { max-height: none; overflow: visible; position: static; box-shadow: none; border: 0; padding: 0; margin-top: 14px; }
/* ── MÉCANISME wizard (CSS pur) : un radio coché masque les AUTRES cartes (défaut = tout visible → sûr). ── */
.cz-rf__r { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
#czrf1:checked ~ .cz-rf-cards > .cz-rf-card:not(:nth-of-type(1)),
#czrf2:checked ~ .cz-rf-cards > .cz-rf-card:not(:nth-of-type(2)),
#czrf3:checked ~ .cz-rf-cards > .cz-rf-card:not(:nth-of-type(3)),
#czrf4:checked ~ .cz-rf-cards > .cz-rf-card:not(:nth-of-type(4)) { display: none; }
@media (max-width: 900px) {
  .cz-rf-steps { flex-wrap: wrap; gap: 12px 16px; }
  .cz-rf-seg { display: none; }
  .cz-rf-card { grid-template-columns: 1fr; }
  .cz-rf-recap { position: static; }
}`;

/** Un palier de tarif (étape 1 — sélecteur de formule). */
export interface ReservationFunnelFormula {
  title: string;
  note: string;
  price: string;
  /** Unité affichée sous le prix (ex. "/ nuit"). */
  unit?: string;
  /** Badge optionnel à côté du titre (ex. "−10 %"). */
  badge?: string;
  /** Met en avant ce palier (bordure accent + fond léger + radio plein). */
  reco?: boolean;
}

/** Contenu SPÉCIFIQUE au bien/template injecté dans le funnel (la structure et le mécanisme sont fixes). */
export interface ReservationFunnelContent {
  /** Eyebrow au-dessus du titre. Défaut « Réservation en ligne ». */
  eyebrow?: string;
  /** Titres (H1) par étape. Défaut : Votre séjour / Choisissez vos dates / Vos coordonnées / Paiement sécurisé. */
  headings?: [string, string, string, string];
  /** Libellés courts des 5 pas du stepper. Défaut : Séjour / Dates / Vos infos / Paiement / Confirmation. */
  steps?: [string, string, string, string, string];
  /** Intro au-dessus des formules. */
  formulasIntro?: string;
  /** Paliers de tarif (étape 1). Omis si vide. */
  formulas?: ReservationFunnelFormula[];
  /** Prix « à partir de » affiché dans le récap de l'étape 1 (ex. "120 €"). */
  fromPrice?: string;
  /** Chemin de retour après paiement. Défaut '/confirmation'. */
  returnPath?: string;
  /** Présentation du widget dates ('labeled' = libellés au-dessus). Défaut 'labeled'. */
  dateStyle?: string;
  /** Placeholder des champs date. Défaut 'jj/mm/aaaa'. */
  datePlaceholder?: string;
}

const DEFAULT_EYEBROW = 'Réservation en ligne';
const DEFAULT_HEADINGS: [string, string, string, string] = ['Votre séjour', 'Choisissez vos dates', 'Vos coordonnées', 'Paiement sécurisé'];
const DEFAULT_STEPS: [string, string, string, string, string] = ['Séjour', 'Dates', 'Vos infos', 'Paiement', 'Confirmation'];

/** Icône check (SVG inline) pour les pastilles complétées du stepper. */
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const SHIELD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>';
const ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
const CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="9 15 11 17 15 13"></polyline></svg>';

/** Un pas du stepper (label cliquable, ou décoratif pour le 5e). */
function stepperStep(n: number, label: string, forId: string | null): string {
  const attr = forId ? ` for="${forId}"` : '';
  return `<label class="cz-rf-step"${attr}><span class="cz-rf-dot"><span class="cz-rf-num">${n}</span><span class="cz-rf-chk">${CHECK_SVG}</span></span><span class="cz-rf-lab">${label}</span></label>`;
}

/**
 * Markup du funnel (bloc `.cz-rf`). Le template l'insère dans sa propre page (nav + footer) et alimente
 * `--rf-*`. Les sections « équipements » et « formules » ne sont rendues que si fournies.
 */
export function reservationFunnelHtml(content: ReservationFunnelContent = {}): string {
  const eyebrow = content.eyebrow ?? DEFAULT_EYEBROW;
  const headings = content.headings ?? DEFAULT_HEADINGS;
  const steps = content.steps ?? DEFAULT_STEPS;
  const ret = content.returnPath ?? '/confirmation';
  const dateStyle = content.dateStyle ?? 'labeled';
  const datePh = content.datePlaceholder ?? 'jj/mm/aaaa';
  const fromPrice = content.fromPrice ?? '';

  const formulasHtml = content.formulas?.length
    ? `${content.formulasIntro ? `\n            <div class="cz-rf-formulas__intro">${content.formulasIntro}</div>` : ''}\n            <div class="cz-rf-formulas">${content.formulas
        .map(
          (f) =>
            `<div class="cz-rf-formula${f.reco ? ' cz-rf-formula--reco' : ''}"><div class="cz-rf-formula__left"><span class="cz-rf-formula__dot"></span><div><b>${f.title}${f.badge ? `<span class="cz-rf-formula__badge">${f.badge}</span>` : ''}</b><span class="cz-rf-formula__sub">${f.note}</span></div></div><div class="cz-rf-formula__price"><b>${f.price}</b><span> ${f.unit ?? ''}</span></div></div>`,
        )
        .join('')}</div>`
    : '';

  const trust = `<div class="cz-rf-recap__trust">${SHIELD_SVG}<span>Sans frais · Réservation directe</span></div>`;

  return `<div class="cz-rf">
        <input class="cz-rf__r" type="radio" name="czrf" id="czrf1" checked>
        <input class="cz-rf__r" type="radio" name="czrf" id="czrf2">
        <input class="cz-rf__r" type="radio" name="czrf" id="czrf3">
        <input class="cz-rf__r" type="radio" name="czrf" id="czrf4">

        <div class="cz-rf-head">
          <p class="cz-rf-eyebrow">${eyebrow}</p>
          <h1 class="cz-rf-title">${headings[0]}</h1>
          <h1 class="cz-rf-title">${headings[1]}</h1>
          <h1 class="cz-rf-title">${headings[2]}</h1>
          <h1 class="cz-rf-title">${headings[3]}</h1>
        </div>

        <div class="cz-rf-steps">
          ${stepperStep(1, steps[0], 'czrf1')}<div class="cz-rf-seg"></div>
          ${stepperStep(2, steps[1], 'czrf2')}<div class="cz-rf-seg"></div>
          ${stepperStep(3, steps[2], 'czrf3')}<div class="cz-rf-seg"></div>
          ${stepperStep(4, steps[3], 'czrf4')}<div class="cz-rf-seg"></div>
          ${stepperStep(5, steps[4], null)}
        </div>

        <div class="cz-rf-cards">
          <div class="cz-rf-card">
            <div class="cz-rf-main">
              <div data-clenzy-widget="property" data-clenzy-property-layout="detail"></div>
              <div data-clenzy-widget="booking-amenities"></div>
            </div>
            <aside class="cz-rf-recap">
              <div class="cz-rf-recap__label">Récapitulatif</div>
              <div class="cz-rf-recap__from"><span>À partir de</span><b>${fromPrice}</b></div>
              <div class="cz-rf-recap__per">par nuit</div>${formulasHtml}
              <label class="cz-rf-btn cz-rf-btn--primary" for="czrf2">Choisir les dates ${ARROW_SVG}</label>
              ${trust}
            </aside>
          </div>

          <div class="cz-rf-card">
            <div class="cz-rf-main">
              <div data-clenzy-widget="booking-dates" data-clenzy-date-style="${dateStyle}" data-clenzy-date-placeholder="${datePh}"></div>
              <div class="cz-rf-sp"></div>
              <div data-clenzy-widget="booking-guests"></div>
            </div>
            <aside class="cz-rf-recap">
              <div class="cz-rf-recap__label">Votre séjour</div>
              <div data-clenzy-widget="price"></div>
              <label class="cz-rf-btn cz-rf-btn--primary" for="czrf3">Continuer ${ARROW_SVG}</label>
              <div class="cz-rf-recap__trust">${LOCK_SVG}<span>Aucun débit à cette étape</span></div>
            </aside>
          </div>

          <div class="cz-rf-card">
            <div class="cz-rf-main">
              <div data-clenzy-widget="guest-form"></div>
            </div>
            <aside class="cz-rf-recap">
              <div class="cz-rf-recap__label">Votre séjour</div>
              <div data-clenzy-widget="price"></div>
              <label class="cz-rf-btn cz-rf-btn--primary" for="czrf4">Aller au paiement ${ARROW_SVG}</label>
            </aside>
          </div>

          <div class="cz-rf-card">
            <div class="cz-rf-main">
              <div class="cz-rf-pay">
                <div class="cz-rf-pay__row">${LOCK_SVG}<span>Vous allez être redirigé vers notre prestataire de paiement sécurisé pour finaliser votre réservation. Vos informations bancaires ne transitent jamais par notre site.</span></div>
                <div class="cz-rf-pay__row">${CAL_SVG}<span>Annulation gratuite jusqu'à 7 jours avant l'arrivée.</span></div>
                <div class="cz-rf-pay__note">${LOCK_SVG}<span>Paiement chiffré · propulsé par <b>stripe</b></span></div>
              </div>
            </div>
            <aside class="cz-rf-recap">
              <div class="cz-rf-recap__label">Votre séjour</div>
              <div data-clenzy-widget="price"></div>
              <div data-clenzy-widget="checkout" data-clenzy-return="${ret}"></div>
              <div class="cz-rf-recap__trust">${SHIELD_SVG}<span>Réservation directe · sans frais de service</span></div>
            </aside>
          </div>
        </div>
      </div>`;
}
