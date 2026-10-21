import type { BaitlyTemplateProperty } from './baitlyJourneyTemplates';
import { baitlyJourneyWidget as widget } from '../baitlyJourneyComposites';

interface PropertyDetailContext {
  style: string;
  property: BaitlyTemplateProperty;
  photos: string[];
  reservationPath: string;
  escape: (value: string) => string;
}

/** Native, independently editable property pages. Booking widgets share the selected property's core. */
export function buildBaitlyPropertyDetail({ style, property, photos, reservationPath, escape }: PropertyDetailContext): string {
  const name = escape(property.name || 'Votre logement');
  const currency = /^[A-Z]{3}$/.test(property.currency || '') ? property.currency! : 'EUR';
  const money = (amount: number) => escape(new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount));
  const facts = [
    [property.maxGuests, 'voyageur', 'voyageurs'], [property.bedroomCount, 'chambre', 'chambres'],
    [property.bathroomCount, 'salle de bain', 'salles de bain'], [property.squareMeters, 'm²', 'm²'],
  ].filter(([value]) => typeof value === 'number' && value > 0);
  const factsHtml = `<dl class="bt-detail-facts">${facts.map(([value, singular, plural]) => `<div><dt>${value}</dt><dd>${value === 1 ? singular : plural}</dd></div>`).join('')}</dl>`;
  const heading = `<header class="bt-detail-heading"><a class="bt-detail-back" href="/logements">← Tous les logements</a><p class="bt-kicker">${escape(property.city || '')}</p><h1>${name}</h1>${factsHtml}</header>`;
  const photo = (url: string, index: number) => `<a class="bt-detail-photo" href="${url}" data-baitly-image="true"><img src="${url}" alt="${name}, photo ${index + 1}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async"/>${style === 'itinerance' ? `<span>${String(index + 1).padStart(2, '0')}</span>` : ''}</a>`;
  const initialCount = style === 'itinerance' ? photos.length : style === 'horizon' ? 3 : 5;
  const gallery = `<section id="photos" class="bt-detail-gallery" aria-label="Photos de ${name}"><div class="bt-detail-gallery__images" data-photo-count="${Math.min(initialCount, photos.length)}">${photos.slice(0, initialCount).map(photo).join('')}</div><div class="bt-detail-gallery__caption"><span>${photos.length} photo${photos.length > 1 ? 's' : ''} du logement</span><span>${escape(property.city || '')}</span></div>${photos.length > initialCount ? `<details class="bt-detail-more-photos"><summary>Voir les ${photos.length} photos</summary><div>${photos.slice(initialCount).map((url, index) => photo(url, index + initialCount)).join('')}</div></details>` : ''}</section>`;
  const description = `<section class="bt-detail-description" aria-labelledby="presentation-title"><p class="bt-kicker">${style === 'itinerance' ? 'Votre prochaine étape' : 'Le lieu'}</p><h2 id="presentation-title">${style === 'destinations' ? 'Prenez le temps de vous installer.' : style === 'horizon' ? 'Tout pour préparer votre séjour.' : style === 'itinerance' ? 'Une adresse dans votre voyage.' : 'L’esprit de cette adresse.'}</h2>${property.description ? `<p>${escape(property.description)}</p>` : ''}<h3>Les équipements</h3><div class="bt-journey bt-detail-amenities">${widget('booking-amenities')}</div><h3>Les repères du séjour</h3><ul class="bt-detail-conditions">${property.defaultCheckInTime ? `<li>Arrivée à partir de ${escape(property.defaultCheckInTime.slice(0, 5))}</li>` : ''}${property.defaultCheckOutTime ? `<li>Départ avant ${escape(property.defaultCheckOutTime.slice(0, 5))}</li>` : ''}${property.minimumNights ? `<li>${property.minimumNights} nuit${property.minimumNights > 1 ? 's' : ''} minimum</li>` : ''}${property.cleaningBasePrice ? `<li>Ménage : ${money(property.cleaningBasePrice)}</li>` : ''}<li>Conditions et montant final présentés avant confirmation.</li></ul></section>`;
  const booking = `<aside id="votre-sejour" class="bt-detail-booking" aria-labelledby="sejour-title"><div class="bt-detail-booking__intro"><p class="bt-kicker">${style === 'itinerance' ? 'Composez votre voyage' : 'Réservation en direct'}</p><h2 id="sejour-title">${style === 'itinerance' ? 'Votre étape, à vos dates.' : 'Votre séjour'}</h2><p class="bt-detail-from">${property.nightlyPrice && property.nightlyPrice > 0 ? `<span>À partir de</span><strong>${money(property.nightlyPrice)}</strong><span>/ nuit</span>` : 'Tarif selon vos dates'}</p></div><section class="bt-journey bt-detail-booking__form"><div class="bt-detail-booking__fields">${widget('booking-dates')}${widget('booking-guests')}</div>${widget('booking-price-summary')}<a class="bt-button bt-detail-continue" href="${reservationPath}">${style === 'itinerance' || style === 'destinations' ? 'Préparer cette étape' : 'Continuer la réservation'} ↗</a><p class="bt-detail-booking__note">Choisissez vos dates pour connaître le tarif du séjour.</p></section></aside>`;
  const body = style === 'horizon'
    ? `${heading}<div class="bt-detail-top">${gallery}${booking}</div>${description}`
    : style === 'destinations'
      ? `${heading}${gallery}${booking}${description}`
      : `${heading}${gallery}<div class="bt-detail-content">${description}${booking}</div>`;
  return `<article class="bt-container bt-property-detail" data-detail-style="${style}" data-baitly-property-id="${Number(property.id)}">${body}</article>`;
}
