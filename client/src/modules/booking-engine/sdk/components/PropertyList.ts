import type { StateManager } from '../state';
import type { WidgetState, WidgetProperty } from '../types';

interface I18n {
  t: (key: string) => string;
}

/** Liste de propriétés (property-first) : sélection d'un logement avant le choix des dates. */
export function createPropertyList(state: StateManager, i18n: I18n): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-property-list';

  state.on('*', (s: WidgetState) => render(container, s, i18n, state));
  render(container, state.get(), i18n, state);

  return container;
}

function render(container: HTMLElement, s: WidgetState, i18n: I18n, state: StateManager): void {
  const key = `${s.properties.map(p => p.id).join(',')}:${s.selectedPropertyId}:${s.displayCurrency}`;
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.textContent = '';

  if (!s.properties.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  s.properties.forEach(p => {
    container.appendChild(card(p, p.id === s.selectedPropertyId, s.displayCurrency, i18n, state));
  });
}

function card(
  p: WidgetProperty,
  active: boolean,
  currency: string,
  i18n: I18n,
  state: StateManager,
): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cb-property-card${active ? ' cb-active' : ''}`;
  el.setAttribute('aria-pressed', String(active));

  if (p.mainPhotoUrl) {
    const img = document.createElement('img');
    img.className = 'cb-property-card__img';
    img.src = p.mainPhotoUrl;
    img.alt = p.name;
    img.loading = 'lazy';
    el.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'cb-property-card__body';

  const name = document.createElement('div');
  name.className = 'cb-property-card__name cb-text-semibold';
  name.textContent = p.name;
  body.appendChild(name);

  const locParts = [p.city, p.country].filter(Boolean);
  if (locParts.length) {
    const loc = document.createElement('div');
    loc.className = 'cb-property-card__loc cb-text-sm cb-text-secondary';
    loc.textContent = locParts.join(', ');
    body.appendChild(loc);
  }

  if (p.priceFrom != null) {
    const price = document.createElement('div');
    price.className = 'cb-property-card__price';
    price.textContent = formatPrice(p.priceFrom, currency);
    body.appendChild(price);
  }

  el.appendChild(body);
  el.addEventListener('click', () => {
    // Sélection d'une propriété : reset des dates + prix, le widget recharge le calendrier.
    state.set({ selectedPropertyId: p.id, checkIn: null, checkOut: null, pricing: null }, 'stateChange');
  });

  return el;
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}
