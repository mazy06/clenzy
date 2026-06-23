import type { StateManager } from '../state';
import type { WidgetState } from '../types';

/**
 * Détail du logement sélectionné : photo principale, nom, lieu, prix indicatif. Factory PARTAGÉE entre
 * l'aperçu éditeur (`BaitlyWidget.buildLayoutWidget`) et le runtime (`mountPrimitive`, étapes `property`
 * et bloc granulaire `booking-property-summary`). Repli sur le PREMIER logement quand aucun n'est
 * sélectionné (aperçu Studio / page mono-bien) → la fiche n'est jamais vide tant qu'un logement existe.
 */
export function createPropertySummary(state: StateManager, baseUrl: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-property-summary';

  const render = (s: WidgetState): void => {
    const prop = s.properties.find((p) => p.id === s.selectedPropertyId) ?? s.properties[0];
    container.textContent = '';

    if (!prop) {
      const empty = document.createElement('p');
      empty.className = 'cb-text-sm cb-text-secondary';
      empty.textContent = '—';
      container.appendChild(empty);
      return;
    }

    if (prop.mainPhotoUrl) {
      const img = document.createElement('img');
      img.className = 'cb-property-summary__image';
      img.src = absoluteImageUrl(prop.mainPhotoUrl, baseUrl);
      img.alt = prop.name;
      img.loading = 'lazy';
      container.appendChild(img);
    }

    const title = document.createElement('h3');
    title.className = 'cb-text-lg cb-text-semibold';
    title.textContent = prop.name;
    container.appendChild(title);

    const place = [prop.city, prop.country].filter(Boolean).join(', ');
    if (place) {
      const loc = document.createElement('p');
      loc.className = 'cb-text-sm cb-text-secondary';
      loc.textContent = place;
      container.appendChild(loc);
    }

    if (prop.priceFrom != null) {
      const price = document.createElement('p');
      price.className = 'cb-text-sm cb-text-semibold';
      price.textContent = formatPrice(prop.priceFrom, prop.currency);
      container.appendChild(price);
    }
  };

  state.on('*', (s: WidgetState) => render(s));
  render(state.get());
  return container;
}

/** Rend une URL d'image absolue : telle quelle si http(s), sinon préfixée par la base API. */
function absoluteImageUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${baseUrl.replace(/\/$/, '')}${url}`;
  return url;
}

/** Formatte un montant en devise (parité avec `PropertyList.formatPrice`, non exporté). */
function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}
