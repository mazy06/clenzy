import type { StateManager } from '../state';
import type { WidgetState } from '../types';
import type { createBookingI18n } from '../i18n';
import { mapPin, star, users, bedDouble } from './icons';

type I18n = ReturnType<typeof createBookingI18n>;

/** Options de présentation du détail logement. */
export interface PropertySummaryOptions {
  /** `detail` = galerie à gauche, infos à droite (prix masqué — affiché ailleurs). Défaut = empilé. */
  layout?: 'detail';
  /** Si défini, la ligne note (★ · N avis) devient un lien vers cette URL (ex. /avis → tous les avis). */
  reviewsHref?: string;
}

/**
 * Détail du logement sélectionné : GALERIE (photo principale + miniatures cliquables qui prennent la
 * place de la grande au clic), nom, lieu, prix « à partir de … / nuit ». Factory PARTAGÉE entre l'aperçu
 * éditeur (`BaitlyWidget.buildLayoutWidget`) et le runtime (`mountPrimitive`, étapes `property` et bloc
 * granulaire `booking-property-summary`). Repli sur le PREMIER logement quand aucun n'est sélectionné
 * (aperçu Studio / page mono-bien) → la fiche n'est jamais vide tant qu'un logement existe.
 */
export function createPropertySummary(state: StateManager, baseUrl: string, i18n: I18n, opts: PropertySummaryOptions = {}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-property-summary' + (opts.layout === 'detail' ? ' cb-property-summary--detail' : '');

  // La fiche ne dépend que du LOGEMENT (pas des dates) : on ne re-rend que si le bien change → la photo
  // choisie dans la galerie est préservée lors des autres changements d'état (dates, voyageurs…).
  let lastPropId: number | null | undefined;

  const render = (s: WidgetState): void => {
    const prop = s.properties.find((p) => p.id === s.selectedPropertyId) ?? s.properties[0];
    const propId = prop ? prop.id : null;
    if (propId === lastPropId) return;
    lastPropId = propId;
    container.textContent = '';

    if (!prop) {
      const empty = document.createElement('p');
      empty.className = 'cb-text-sm cb-text-secondary';
      empty.textContent = '—';
      container.appendChild(empty);
      return;
    }

    // Galerie : photo principale en premier, puis les autres (dédupliquées).
    const photos = Array.from(
      new Set([prop.mainPhotoUrl, ...(prop.photoUrls ?? [])].filter((u): u is string => Boolean(u))),
    );
    if (photos.length > 0) {
      container.appendChild(buildGallery(photos, prop.name, baseUrl));
    }

    // Bloc d'infos (à droite de la galerie en layout `detail`).
    const info = document.createElement('div');
    info.className = 'cb-property-summary__info';

    const title = document.createElement('h3');
    title.className = 'cb-text-lg cb-text-semibold cb-property-summary__title';
    title.textContent = prop.name;
    info.appendChild(title);

    const place = [prop.city, prop.country].filter(Boolean).join(', ');
    if (place) {
      const loc = document.createElement('p');
      loc.className = 'cb-text-sm cb-text-secondary cb-property-summary__place';
      const pin = document.createElement('span');
      pin.className = 'cb-property-summary__place-icon';
      pin.appendChild(mapPin());
      loc.append(pin, document.createTextNode(place));
      info.appendChild(loc);
    }

    if (prop.rating != null) {
      info.appendChild(buildNote(prop.rating, prop.reviewCount, i18n, opts.reviewsHref));
    }

    if (prop.maxGuests != null || prop.bedroomCount != null) {
      info.appendChild(buildCapacity(prop.maxGuests, prop.bedroomCount, i18n));
    }

    if (prop.description && prop.description.trim()) {
      const desc = document.createElement('p');
      desc.className = 'cb-text-sm cb-property-summary__desc';
      desc.textContent = prop.description.trim();
      info.appendChild(desc);
    }

    if (prop.priceFrom != null) {
      info.appendChild(buildPrice(prop.priceFrom, prop.currency, i18n));
    }

    container.appendChild(info);
  };

  state.on('*', (s: WidgetState) => render(s));
  render(state.get());
  return container;
}

/** Galerie photo : grande image + bande de miniatures ; cliquer une miniature la promeut en grande. */
function buildGallery(photos: string[], alt: string, baseUrl: string): HTMLElement {
  const gallery = document.createElement('div');
  gallery.className = 'cb-property-summary__gallery';

  const main = document.createElement('img');
  main.className = 'cb-property-summary__main';
  main.src = absoluteImageUrl(photos[0], baseUrl);
  main.alt = alt;
  main.loading = 'lazy';
  gallery.appendChild(main);

  if (photos.length > 1) {
    const thumbs = document.createElement('div');
    thumbs.className = 'cb-property-summary__thumbs';
    photos.forEach((url, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cb-property-summary__thumb' + (i === 0 ? ' cb-active' : '');
      btn.setAttribute('aria-label', `${alt} — ${i + 1}`);
      const timg = document.createElement('img');
      timg.src = absoluteImageUrl(url, baseUrl);
      timg.alt = '';
      timg.loading = 'lazy';
      btn.appendChild(timg);
      btn.addEventListener('click', () => {
        main.src = absoluteImageUrl(url, baseUrl);
        thumbs
          .querySelectorAll('.cb-property-summary__thumb')
          .forEach((el) => el.classList.remove('cb-active'));
        btn.classList.add('cb-active');
      });
      thumbs.appendChild(btn);
    });
    gallery.appendChild(thumbs);
  }
  return gallery;
}

/** Prix indicatif cohérent : « À partir de <montant> / nuit ». */
function buildPrice(amount: number, currency: string, i18n: I18n): HTMLElement {
  const price = document.createElement('p');
  price.className = 'cb-property-summary__price';

  const from = document.createElement('span');
  from.className = 'cb-property-summary__from';
  from.textContent = i18n.t('property.fromPrice');

  const value = document.createElement('b');
  value.textContent = formatPrice(amount, currency);

  const per = document.createElement('span');
  per.className = 'cb-property-summary__per';
  per.textContent = `/ ${i18n.t('cart.perNight')}`;

  price.append(from, ' ', value, ' ', per);
  return price;
}

/** Note + avis : « ★ 4,9 · 38 avis ». Cliquable (→ tous les avis) si `href` est fourni. */
function buildNote(rating: number, reviewCount: number, i18n: I18n, href?: string): HTMLElement {
  const note = document.createElement('p');
  note.className = 'cb-property-summary__note';
  const ic = document.createElement('span');
  ic.className = 'cb-property-summary__note-star';
  ic.appendChild(star());
  const val = document.createElement('b');
  val.textContent = rating.toFixed(1).replace('.', ',');
  const cnt = document.createElement('span');
  cnt.className = 'cb-property-summary__note-count';
  cnt.textContent = `· ${reviewCount} ${i18n.t('property.reviews')}`;
  if (href) {
    const link = document.createElement('a');
    link.className = 'cb-property-summary__note-link';
    link.href = href;
    link.setAttribute('aria-label', i18n.t('reviews.viewAll'));
    link.append(ic, val, ' ', cnt);
    note.appendChild(link);
  } else {
    note.append(ic, val, ' ', cnt);
  }
  return note;
}

/** Capacité : « 👥 8 voyageurs · 🛏 4 chambres ». */
function buildCapacity(maxGuests: number | null, bedroomCount: number | null, i18n: I18n): HTMLElement {
  const cap = document.createElement('p');
  cap.className = 'cb-property-summary__capacity';
  if (maxGuests != null) {
    const g = document.createElement('span');
    g.className = 'cb-property-summary__cap-item';
    g.appendChild(users());
    g.append(document.createTextNode(` ${maxGuests} ${i18n.t('property.guests')}`));
    cap.appendChild(g);
  }
  if (bedroomCount != null) {
    const b = document.createElement('span');
    b.className = 'cb-property-summary__cap-item';
    b.appendChild(bedDouble());
    b.append(document.createTextNode(` ${bedroomCount} ${i18n.t('property.bedrooms')}`));
    cap.appendChild(b);
  }
  return cap;
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
