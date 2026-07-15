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
  /** Plafond du nombre de logements affichés (0/absent = tous). Paramétrable depuis le composeur. */
  limit?: number;
  /** Taille de page : si > 0, paginer la liste (prev/next). Paramétrable depuis le composeur. */
  pageSize?: number;
  /** Disposition des cartes : `column` (défaut) ou `row` (grille en ligne, responsive). */
  direction?: 'row' | 'column';
  /** Nombre de colonnes en disposition `row` (0/absent = auto-fill responsive). */
  columns?: number;
  /** Disposition `row` : tout sur une seule ligne, défilement horizontal (pas de retour à la ligne). */
  horizontalScroll?: boolean;
  /** Disposition visuelle de chaque carte (défaut `vertical`). */
  cardStyle?: 'vertical' | 'horizontal' | 'overlay' | 'minimal';
  /** Typographie par élément de la carte (vide / 0 = hérité du thème). */
  cardText?: {
    title?: { font?: string; size?: number; weight?: string; color?: string };
    location?: { font?: string; size?: number; color?: string };
    price?: { font?: string; size?: number; weight?: string; color?: string };
  };
  /** Compléter avec des cartes vides pour atteindre le nombre cible (limite / page). */
  fillEmpty?: boolean;
  /** Éléments de carte affichables (défaut : tout). */
  showImage?: boolean;
  showLocation?: boolean;
  showPrice?: boolean;
  showBadges?: boolean;
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

  // Page courante (pagination) — conservée entre les rendus ; un clic pager force un re-render.
  let page = 0;
  const rerender = () => render(container, state.get(), i18n, state, baseUrl, options, page, (p) => { page = Math.max(0, p); rerender(); });
  state.on('*', rerender);
  rerender();

  return container;
}

function render(
  container: HTMLElement,
  s: WidgetState,
  i18n: I18n,
  state: StateManager,
  baseUrl: string,
  options: PropertyListOptions,
  page: number,
  setPage: (p: number) => void,
): void {
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : 0;
  const pageSize = options.pageSize && options.pageSize > 0 ? Math.floor(options.pageSize) : 0;
  let list = s.properties;
  // Filtre par destination (ville) saisie dans la barre de recherche : nom / ville / pays (insensible
  // à la casse). Vide = tous les logements.
  const dest = s.destination?.trim().toLowerCase();
  if (dest) {
    list = list.filter((p) => `${p.name} ${p.city ?? ''} ${p.country ?? ''}`.toLowerCase().includes(dest));
  }
  // Filtres multi-critères (widget « Filtre ») — appliqués côté client : garantit la cohérence dans
  // l'éditeur (aperçu sans réseau) et redouble le filtrage server-side (cf. PublicBookingService).
  const f = s.filters;
  if (f) {
    if (f.types.length) { const t = new Set(f.types.map((x) => x.toLowerCase())); list = list.filter((p) => p.type != null && t.has(p.type.toLowerCase())); }
    if (f.minPrice != null) { const v = f.minPrice; list = list.filter((p) => p.priceFrom != null && p.priceFrom >= v); }
    if (f.maxPrice != null) { const v = f.maxPrice; list = list.filter((p) => p.priceFrom != null && p.priceFrom <= v); }
    if (f.minBedrooms != null) { const v = f.minBedrooms; list = list.filter((p) => p.bedroomCount != null && p.bedroomCount >= v); }
    if (f.minBathrooms != null) { const v = f.minBathrooms; list = list.filter((p) => p.bathroomCount != null && p.bathroomCount >= v); }
    if (f.minGuests != null) { const v = f.minGuests; list = list.filter((p) => p.maxGuests != null && p.maxGuests >= v); }
    if (f.amenities.length) { const want = f.amenities.map((x) => x.toLowerCase()); list = list.filter((p) => { const has = new Set((p.amenities ?? []).map((x) => x.toLowerCase())); return want.every((w) => has.has(w)); }); }
  }
  if (limit > 0) list = list.slice(0, limit);
  const paginate = pageSize > 0 && list.length > pageSize;
  const pageCount = paginate ? Math.ceil(list.length / pageSize) : 1;
  const cur = Math.min(Math.max(0, page), pageCount - 1);
  const visible = paginate ? list.slice(cur * pageSize, cur * pageSize + pageSize) : list;

  // La wishlist entre dans la clé seulement si activée → les cœurs se rafraîchissent au toggle.
  const wishlistKey = options.wishlistEnabled ? `:w${s.wishlist.join('-')}` : '';
  const key = `${visible.map(p => p.id).join(',')}:${s.selectedPropertyId}:${s.displayCurrency}${wishlistKey}:p${cur}/${pageCount}`;
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.textContent = '';

  if (!s.properties.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  // Disposition : colonne (défaut), ligne en grille (wrap), ou ligne défilante (1 seule ligne).
  const cols = options.columns && options.columns > 0 ? Math.floor(options.columns) : 0;
  const scroll = options.direction === 'row' && options.horizontalScroll === true;
  const listWrap = document.createElement('div');
  listWrap.className = 'cb-property-list__items';
  if (scroll) {
    // Tout sur une ligne : flex sans retour + défilement horizontal ; cartes à largeur fixe.
    listWrap.style.cssText = 'display:flex;flex-wrap:nowrap;overflow-x:auto;gap:12px;padding-bottom:4px;-webkit-overflow-scrolling:touch;';
  } else if (options.direction === 'row') {
    // Largeur mini par carte selon la disposition (l'horizontale a besoin de place pour le texte).
    const minCard = options.cardStyle === 'horizontal' ? 260 : options.cardStyle === 'minimal' ? 180 : 200;
    // Responsive : `minmax(min(Npx, 100%), 1fr)` => les cartes rétrécissent pour tenir dans un
    // conteneur étroit au lieu de déborder ; `auto-fit` répartit la largeur restante sur les cartes.
    const tmpl = cols > 0
      ? `repeat(${cols}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(min(${minCard}px, 100%), 1fr))`;
    listWrap.style.cssText = `display:grid;grid-template-columns:${tmpl};gap:12px;width:100%;min-width:0;`;
  } else {
    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  }
  // En défilement : largeur de carte fixe (cols visibles par fenêtre si défini, sinon selon la disposition).
  const scrollBasis = options.cardStyle === 'horizontal' ? '300px' : '240px';
  const cardBasis = cols > 0 ? `calc((100% - ${(cols - 1) * 12}px) / ${cols})` : scrollBasis;
  const sizeForScroll = (el: HTMLElement) => { if (scroll) { el.style.flex = `0 0 ${cardBasis}`; el.style.minWidth = cols > 0 ? '180px' : '240px'; } };

  const wishlistSet = new Set(s.wishlist);
  visible.forEach(p => {
    const active = p.id === s.selectedPropertyId;
    const el = card(p, active, s.displayCurrency, i18n, state, baseUrl, options, wishlistSet.has(p.id));
    sizeForScroll(el);
    listWrap.appendChild(el);
  });
  // Cartes vides : compléter jusqu'au nombre cible (limite ou taille de page) si demandé.
  if (options.fillEmpty) {
    const targetCount = limit > 0 ? limit : pageSize > 0 ? pageSize : 0;
    for (let k = visible.length; k < targetCount; k++) { const e = emptyCard(i18n, options.cardStyle); sizeForScroll(e); listWrap.appendChild(e); }
  }
  container.appendChild(listWrap);

  if (paginate) container.appendChild(pager(cur, pageCount, setPage));
}

/** Pagination de la liste (prev / « X / Y » / next). Styles inline (indépendants du thème). */
function pager(cur: number, pageCount: number, setPage: (p: number) => void): HTMLElement {
  const nav = document.createElement('div');
  nav.className = 'cb-property-pager';
  nav.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;margin-top:8px;';
  const mkBtn = (text: string, target: number, disabled: boolean): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cb-property-pager__btn';
    b.textContent = text;
    b.disabled = disabled;
    b.style.cssText = `min-width:34px;height:34px;border:1px solid rgba(0,0,0,0.14);border-radius:8px;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '0.35' : '1'};`;
    if (!disabled) b.addEventListener('click', () => setPage(target));
    return b;
  };
  const label = document.createElement('span');
  label.className = 'cb-property-pager__label';
  label.textContent = `${cur + 1} / ${pageCount}`;
  label.style.cssText = 'font-size:14px;opacity:0.7;';
  nav.appendChild(mkBtn('‹', cur - 1, cur <= 0));
  nav.appendChild(label);
  nav.appendChild(mkBtn('›', cur + 1, cur >= pageCount - 1));
  return nav;
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
  const cardStyle = options.cardStyle ?? 'vertical';
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cb-property-card cb-property-card--${cardStyle}${active ? ' cb-active' : ''}`;
  el.setAttribute('aria-pressed', String(active));

  if (options.wishlistEnabled && options.onWishlistToggle) {
    el.appendChild(favButton(p.id, isWishlisted, i18n, options.onWishlistToggle));
  }

  // Minimaliste = aucune image (la disposition est centrée sur le texte).
  if (options.showImage !== false && cardStyle !== 'minimal' && p.mainPhotoUrl) {
    const img = document.createElement('img');
    img.className = 'cb-property-card__img';
    img.src = absoluteUrl(p.mainPhotoUrl, baseUrl);
    img.alt = p.name;
    img.loading = 'lazy';
    el.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'cb-property-card__body';

  // Typographie par élément (composeur) : appliquée en inline → prime sur le thème. Vide/0 = hérité.
  const ct = options.cardText;
  const applyTypo = (elx: HTMLElement, t?: { font?: string; size?: number; weight?: string; color?: string }) => {
    if (!t) return;
    if (t.font) elx.style.fontFamily = t.font;
    if (t.size && t.size > 0) elx.style.fontSize = `${t.size}px`;
    if (t.weight) elx.style.fontWeight = t.weight;
    if (t.color) elx.style.color = t.color;
  };

  const name = document.createElement('div');
  name.className = 'cb-property-card__name cb-text-semibold';
  name.textContent = p.name;
  applyTypo(name, ct?.title);
  body.appendChild(name);

  const locParts = [p.city, p.country].filter(Boolean);
  if (options.showLocation !== false && locParts.length) {
    const loc = document.createElement('div');
    loc.className = 'cb-property-card__loc cb-text-sm cb-text-secondary';
    loc.textContent = locParts.join(', ');
    applyTypo(loc, ct?.location);
    body.appendChild(loc);
  }

  if (options.showPrice !== false && p.priceFrom != null) {
    const price = document.createElement('div');
    price.className = 'cb-property-card__price';
    price.textContent = formatPrice(p.priceFrom, currency);
    applyTypo(price, ct?.price);
    body.appendChild(price);
  }

  el.appendChild(body);
  el.addEventListener('click', () => {
    // Sélection d'une propriété : reset des dates + prix, le widget recharge le calendrier.
    state.set({ selectedPropertyId: p.id, checkIn: null, checkOut: null, pricing: null }, 'stateChange');
  });

  return el;
}


/** Carte « vide » (slot non pourvu) — placeholder pour compléter une grille/limite. */
function emptyCard(i18n: I18n, cardStyle: PropertyListOptions['cardStyle']): HTMLElement {
  // Hauteur calée sur la disposition (parité avec l'aperçu du composeur).
  const minH = cardStyle === 'overlay' ? 180 : cardStyle === 'horizontal' ? 88 : cardStyle === 'minimal' ? 64 : 150;
  const el = document.createElement('div');
  el.className = 'cb-property-card cb-property-card--empty';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `display:flex;align-items:center;justify-content:center;min-height:${minH}px;border:1px dashed rgba(0,0,0,0.16);background:transparent;opacity:0.7;font-size:13px;`;
  el.textContent = i18n.t('card.comingSoon');
  return el;
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
