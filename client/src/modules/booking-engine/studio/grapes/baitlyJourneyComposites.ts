import type { CompositeWidget } from './compositeWidgets';
import journeySearchCSS from '../../sdk/styles/journeySearch.css?raw';
import journeyControlsCSS from '../../sdk/styles/journeyControls.css?raw';
import journeyContentCSS from '../../sdk/styles/journeyContent.css?raw';
import journeyCheckoutCSS from '../../sdk/styles/journeyCheckout.css?raw';
import journeyConfirmationCSS from '../../sdk/styles/journeyConfirmation.css?raw';

export type BaitlyBookingJourneyId = 'catalogue' | 'single' | 'inquiry' | 'extras' | 'cart' | 'express' | 'confirmation';

/** The same booking markers are consumed by Studio and the published SDK. */
export function baitlyJourneyWidget(id: string, next?: string, returnPath?: string): string {
  return `<div data-clenzy-widget="${id}"${id === 'booking-property-results' ? ' data-clenzy-props=\'{"direction":"row","columns":0}\'' : ''}${next ? ` data-clenzy-next="${next}"` : ''}${returnPath ? ` data-clenzy-return="${returnPath}"` : ''}></div>`;
}

export const BAITLY_JOURNEY_COMPOSITE_CSS = `
.bt-journey{container-type:inline-size;color:var(--bt-color-text,#263934);font-weight:400;font-size:16px;line-height:1.55;font-family:var(--bt-font-body,Arial,sans-serif);min-inline-size:0}
.bt-journey *{box-sizing:border-box;min-inline-size:0}
.bt-journey__fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));align-items:end;gap:18px}
.bt-journey__stack{display:grid;gap:24px}
.bt-journey__split{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,1fr);align-items:start;gap:40px}
.bt-journey__panel{display:grid;gap:20px;background-color:var(--bt-color-surface,#fbfaf6);padding:clamp(20px,4cqi,36px);border-width:1px;border-style:solid;border-color:var(--bt-color-border,#d7dfda);border-radius:var(--bt-radius-lg,8px)}
.bt-journey__panel h2,.bt-journey__panel h3{margin:0;font-size:1.45em;font-weight:500;font-family:var(--bt-font-heading,Georgia,serif)}
.bt-journey__intro{max-inline-size:65ch;margin:0;color:var(--bt-color-text-muted,#55665e)}
.bt-journey [data-clenzy-widget]{inline-size:100%;min-inline-size:0}
.bt-journey .cb-property-grid{grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))}
.bt-journey__stack>.cb-widget{margin:0}
.bt-journey .cb-cta{min-block-size:48px}
.bt-journey__cart-summary .cb-cart__checkout{display:none}
.bt-journey .cb-upsells__list{display:grid;gap:20px;margin-block-start:20px}
.bt-journey .cb-upsell-card{display:grid;gap:16px;padding-block:20px;border-block-end:1px solid var(--bt-color-border,#d7dfda)}
.bt-journey .cb-upsell-card__img{inline-size:100%;block-size:180px;object-fit:cover;border-radius:var(--bt-radius-md,6px)}
.bt-journey .cb-upsell-card__body{display:grid;gap:10px}
.bt-journey .cb-upsell-card__body p{margin:0}
.bt-journey .cb-upsell-card__price{font-variant-numeric:tabular-nums}
.bt-journey .cb-upsell-card__btn{justify-self:start}
.bt-journey :is(button,a,input,textarea,select):focus-visible{outline:2px solid var(--bt-color-primary,#344f43);outline-offset:3px}
.bt-journey :is(h2,h3,p,span){overflow-wrap:anywhere}
@container(max-width:700px){.bt-journey__split{grid-template-columns:minmax(0,1fr);gap:24px}}
@media(max-width:700px){.bt-journey__split{grid-template-columns:minmax(0,1fr);gap:24px}}
` + journeyControlsCSS + journeyContentCSS + journeySearchCSS + journeyCheckoutCSS + journeyConfirmationCSS;

const w = baitlyJourneyWidget;
const fields = (...ids: string[]) => `<div class="bt-journey__fields">${ids.map((id) => w(id)).join('')}</div>`;
const panel = (title: string, html: string) => `<div class="bt-journey__panel"><h2>${title}</h2>${html}</div>`;
const stack = (html: string) => `<div class="bt-journey__stack">${html}</div>`;
const recap = () => `<aside class="bt-checkout__recap"><h2>Votre séjour</h2>${w('booking-property-summary').replace('></div>', ' data-clenzy-property-layout="recap"></div>')}</aside>`;
const reserve = (extras = '') => `<div class="bt-checkout__layout"><div class="bt-checkout__form">${panel('Dates et voyageurs', fields('booking-dates', 'booking-guests'))}${extras}${panel('Vos coordonnées', w('booking-guest-form', '/confirmation', '/confirmation'))}</div>${recap()}</div>`;

function composite(id: string, journeyId: BaitlyBookingJourneyId, name: string, html: string): CompositeWidget {
  return { id: `baitly-${id}`, journeyId, name, builtin: true, html: `<section class="bt-journey" data-baitly-composite="${id}">${html}</section>`, css: BAITLY_JOURNEY_COMPOSITE_CSS };
}

/** Each group is ready to insert, with independently editable SDK widgets inside. */
export const BAITLY_JOURNEY_COMPOSITES: CompositeWidget[] = [
  composite('catalogue-search', 'catalogue', 'Catalogue · Recherche complète', `${fields('booking-city-search', 'booking-dates', 'booking-guests', 'booking-property-type')}${w('booking-search-button', '/logements')}`),
  composite('catalogue-results', 'catalogue', 'Catalogue · Filtres et résultats', stack(`${fields('booking-price', 'booking-capacity', 'booking-amenities-filter')}${w('booking-property-results', '/reserver')}`)),
  composite('single-detail', 'single', 'Logement unique · Fiche et équipements', stack(`${w('booking-property-summary')}${w('booking-amenities')}`)),
  composite('single-reserve', 'single', 'Logement unique · Réservation complète', reserve()),
  composite('inquiry-request', 'inquiry', 'Devis · Dates et demande', `<div class="bt-journey__split">${stack('<h2>Un séjour qui vous ressemble</h2><p class="bt-journey__intro">Indiquez vos dates et vos besoins. Votre hôte vous répondra avec une proposition adaptée, sans paiement à cette étape.</p>')}${panel('Votre demande', `${fields('booking-dates', 'booking-guests')}${w('booking-inquiry-form', '/merci')}`)}</div>`),
  composite('inquiry-property', 'inquiry', 'Devis · Présentation du lieu', stack(`${w('booking-property-summary')}${w('booking-amenities')}`)),
  composite('extras-search', 'extras', 'Extras · Recherche de séjour', `${fields('booking-city-search', 'booking-dates', 'booking-guests')}${w('booking-search-button', '/logements')}`),
  composite('extras-reserve', 'extras', 'Extras · Options et réservation', reserve(panel('Personnalisez votre séjour', w('booking-addons')))),
  composite('cart-build', 'cart', 'Multi-séjours · Ajouter et comparer', `<div class="bt-checkout__layout"><div class="bt-checkout__form">${recap()}${panel('Dates et voyageurs', `${fields('booking-dates', 'booking-guests')}${w('booking-add-to-cart')}`)}</div><aside class="bt-checkout__basket">${panel('Votre voyage', `${w('booking-cart', '/paiement', '/confirmation')}<a class="bt-text-link" href="/logements">Ajouter un autre séjour ↗</a>`)}</aside></div>`),
  composite('cart-checkout', 'cart', 'Multi-séjours · Coordonnées et règlement', `<div class="bt-checkout__layout"><div class="bt-checkout__form">${panel('Vos coordonnées', w('booking-guest-form', '/confirmation', '/confirmation'))}<p class="bt-checkout__note">Le montant et les modalités de règlement sont confirmés à l’étape de paiement.</p></div><aside class="bt-checkout__basket">${panel('Votre voyage en détail', `<p class="bt-journey__intro">Paiement séparé pour chaque séjour.</p><div class="bt-journey__cart-summary">${w('booking-cart', '/paiement', '/confirmation')}</div><a class="bt-text-link" href="/sejour">Modifier mon voyage ↗</a>`)}</aside></div>`),
  composite('express-reserve', 'express', 'Express · Réservation sur une page', reserve()),
  composite('express-summary', 'express', 'Express · Dates, voyageurs et total', panel('Votre séjour', `${fields('booking-dates', 'booking-guests')}${w('booking-price-summary')}`)),
  composite('confirmation-status', 'confirmation', 'Confirmation · Statut réel du séjour', w('booking-confirmation')),
  composite('confirmation-help', 'confirmation', 'Confirmation · Préparer votre arrivée', '<div class="bt-journey__split"><div><h2>La suite de votre séjour</h2><p class="bt-journey__intro">Conservez votre référence de réservation. Les informations pratiques et les instructions d’arrivée vous seront communiquées par votre hôte.</p></div><div><h3>Une question ?</h3><p>Répondez à votre confirmation de réservation pour contacter votre hôte.</p><a href="/">Revenir à l’accueil</a></div></div>'),
];

export function baitlyComposite(id: string): CompositeWidget {
  const found = BAITLY_JOURNEY_COMPOSITES.find((item) => item.id === `baitly-${id}`);
  if (!found) throw new Error(`Unknown Baitly composite: ${id}`);
  return found;
}
