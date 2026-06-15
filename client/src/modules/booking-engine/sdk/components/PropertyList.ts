import type { StateManager } from '../state';
import type { WidgetState, WidgetProperty } from '../types';
import { heart } from './icons';

interface I18n {
  t: (key: string) => string;
}

/** Options compte voyageur (2.11) : activées seulement si `organizationId` est fourni au widget. */
export interface PropertyListOptions {
  /** Affiche le cœur favori sur chaque carte. */
  wishlistEnabled?: boolean;
  /** Bascule un favori (le widget ouvre le login si la session guest est absente). */
  onWishlistToggle?: (propertyId: number) => void;
}

/** Rend une URL d'image absolue : telle quelle si http(s), sinon préfixée par la base API. */
function absoluteUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${baseUrl.replace(/\/$/, '')}${url}`;
  return url;
}

/** Liste de propriétés (property-first) : sélection d'un logement avant le choix des dates. */
export function createPropertyList(
  state: StateManager,
  i18n: I18n,
  baseUrl: string,
  options: PropertyListOptions = {},
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-property-list';

  state.on('*', (s: WidgetState) => render(container, s, i18n, state, baseUrl, options));
  render(container, state.get(), i18n, state, baseUrl, options);

  return container;
}

function render(
  container: HTMLElement,
  s: WidgetState,
  i18n: I18n,
  state: StateManager,
  baseUrl: string,
  options: PropertyListOptions,
): void {
  // La wishlist entre dans la clé seulement si activée → les cœurs se rafraîchissent au toggle.
  const wishlistKey = options.wishlistEnabled ? `:w${s.wishlist.join('-')}` : '';
  const key = `${s.properties.map(p => p.id).join(',')}:${s.selectedPropertyId}:${s.displayCurrency}${wishlistKey}`;
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.textContent = '';

  if (!s.properties.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  s.properties.forEach(p => {
    const active = p.id === s.selectedPropertyId;
    container.appendChild(
      card(p, active, s.displayCurrency, i18n, state, baseUrl, options, s.wishlist.includes(p.id)),
    );
  });
}

function card(
  p: WidgetProperty,
  active: boolean,
  currency: string,
  i18n: I18n,
  state: StateManager,
  baseUrl: string,
  options: PropertyListOptions,
  isWishlisted: boolean,
): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cb-property-card${active ? ' cb-active' : ''}`;
  el.setAttribute('aria-pressed', String(active));

  if (options.wishlistEnabled && options.onWishlistToggle) {
    el.appendChild(favButton(p.id, isWishlisted, i18n, options.onWishlistToggle));
  }

  if (p.mainPhotoUrl) {
    const img = document.createElement('img');
    img.className = 'cb-property-card__img';
    img.src = absoluteUrl(p.mainPhotoUrl, baseUrl);
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

  // Preuve sociale / urgence HONNÊTES (2.9) : données réelles, seuils pour n'afficher que du signal.
  const badges: HTMLElement[] = [];
  if (p.totalBookings != null && p.totalBookings >= 3) {
    badges.push(badge(i18n.t('card.bookedTimes').replace('{count}', String(p.totalBookings)), 'cb-badge--popular'));
  }
  if (p.availableDays30 != null && p.availableDays30 > 0 && p.availableDays30 <= 8) {
    badges.push(badge(i18n.t('card.fewDatesLeft').replace('{count}', String(p.availableDays30)), 'cb-badge--urgent'));
  }
  if (badges.length) {
    const row = document.createElement('div');
    row.className = 'cb-property-card__badges';
    badges.forEach((b) => row.appendChild(b));
    body.appendChild(row);
  }

  el.appendChild(body);
  el.addEventListener('click', () => {
    // Sélection d'une propriété : reset des dates + prix, le widget recharge le calendrier.
    state.set({ selectedPropertyId: p.id, checkIn: null, checkOut: null, pricing: null }, 'stateChange');
  });

  return el;
}

function badge(text: string, variant: string): HTMLElement {
  const b = document.createElement('span');
  b.className = `cb-badge ${variant}`;
  b.textContent = text;
  return b;
}

/**
 * Cœur favori (2.11). La carte est déjà un `<button>` : un `<button>` imbriqué serait du HTML
 * invalide → on utilise un `<span role="button">` clavier-accessible avec stopPropagation pour
 * ne pas déclencher la sélection de la propriété.
 */
function favButton(
  propertyId: number,
  active: boolean,
  i18n: I18n,
  onToggle: (id: number) => void,
): HTMLElement {
  const fav = document.createElement('span');
  fav.className = `cb-property-card__fav${active ? ' cb-active' : ''}`;
  fav.setAttribute('role', 'button');
  fav.setAttribute('tabindex', '0');
  fav.setAttribute('aria-pressed', String(active));
  fav.setAttribute('aria-label', i18n.t(active ? 'wishlist.remove' : 'wishlist.add'));
  fav.appendChild(heart(active));

  const trigger = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle(propertyId);
  };
  fav.addEventListener('click', trigger);
  fav.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === 'Enter' || key === ' ') trigger(e);
  });
  return fav;
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
