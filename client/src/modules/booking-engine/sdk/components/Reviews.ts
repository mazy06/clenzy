import type { StateManager } from '../state';
import type { WidgetState } from '../types';
import type { BookingI18n } from '../i18n';
import type { BookingApi, ApiReviewStats, ApiReview } from '../api';
import { star } from './icons';

/** Options de la section avis (`booking-reviews`). */
export interface ReviewsListOptions {
  /** `full` = résumé + liste (défaut) · `summary` = en-tête note seule · `list` = avis seuls. */
  layout?: 'full' | 'summary' | 'list';
  /**
   * Nombre d'avis affichés SANS pagination (teaser). Si ABSENT → pagination « Charger plus » qui
   * récupère TOUS les avis page par page (taille `pageSize`).
   */
  limit?: number;
  /** Taille de page de la pagination (défaut 20, borne serveur ≤20). */
  pageSize?: number;
  /** Si défini, le RÉSUMÉ devient un lien vers cette URL (ex. `/avis` → page de tous les avis). */
  href?: string;
  /** Aperçu éditeur : jeu de démo, AUCUN appel réseau (la clé d'aperçu ne résout rien de réel). */
  demo?: boolean;
}

/** Options du badge note (`booking-rating`). */
export interface RatingBadgeOptions {
  /** Si défini, le badge devient un lien vers cette URL (ex. `/avis`). */
  href?: string;
}

/** Jeu de démo (aperçu Studio uniquement). Le site publié fetch les vrais avis. */
const DEMO_STATS: ApiReviewStats = { averageRating: 4.8, totalCount: 24, distribution: { '5': 20, '4': 3, '3': 1, '2': 0, '1': 0 } };
const DEMO_REVIEWS: ApiReview[] = [
  { guestName: 'Sophie M.', rating: 5, reviewText: 'Séjour absolument magique. Le logement est encore plus beau qu’en photos, et l’accueil était parfait. On reviendra sans hésiter.', hostResponse: 'Merci Sophie, à très bientôt !', reviewDate: '2026-06-12' },
  { guestName: 'Karim B.', rating: 5, reviewText: 'Décoration soignée, emplacement idéal et hôte très réactif. Une adresse à garder précieusement.', hostResponse: null, reviewDate: '2026-05-28' },
  { guestName: 'Laura D.', rating: 4, reviewText: 'Très bon séjour, logement conforme et confortable. Petit bémol sur le bruit le soir, sinon parfait.', hostResponse: null, reviewDate: '2026-05-09' },
  { guestName: 'Thomas R.', rating: 5, reviewText: 'Rapport qualité-prix exceptionnel pour un bien de ce standing. Propreté irréprochable, nous reviendrons.', hostResponse: null, reviewDate: '2026-04-21' },
];

/**
 * Section d'avis publics (preuve sociale, Domaine 2). Résumé via `GET /reviews/stats` (note moyenne +
 * distribution) et/ou liste via `GET /reviews` PAGINÉE (« Charger plus » → tous les avis). Le résumé
 * peut être un LIEN (`opts.href`, ex. `/avis`). En aperçu éditeur (`opts.demo`) : jeu de démo, sans réseau.
 */
export function createReviewsList(api: BookingApi, i18n: BookingI18n, opts: ReviewsListOptions = {}): HTMLElement {
  const layout = opts.layout ?? 'full';
  const container = document.createElement('div');
  container.className = `cb-section cb-reviews cb-reviews--${layout}`;

  if (layout !== 'list') {
    const summarySlot = document.createElement('div');
    container.appendChild(summarySlot);
    const paint = (stats: ApiReviewStats): void => {
      const node = renderSummary(stats, i18n);
      summarySlot.replaceChildren(opts.href ? wrapInLink(node, opts.href, i18n) : node);
    };
    if (opts.demo) paint(DEMO_STATS);
    else api.getReviewStats().then(paint).catch(() => { /* pas de stats : on n'affiche rien */ });
  }

  if (layout !== 'summary') {
    const listSlot = document.createElement('div');
    container.appendChild(listSlot);
    renderListSection(listSlot, api, i18n, opts);
  }

  return container;
}

/**
 * Badge note compact `★ 4,7 · N avis` (`booking-rating`). Lit l'ÉTAT (logement sélectionné/1er), comme
 * les autres widgets de fiche. `opts.href` → le badge devient un lien (ex. vers `/avis`). `.cb-rating--empty`
 * (display:none) si `rating==null`.
 */
export function createRatingBadge(state: StateManager, i18n: BookingI18n, opts: RatingBadgeOptions = {}): HTMLElement {
  const el = document.createElement(opts.href ? 'a' : 'span');
  el.className = 'cb-rating' + (opts.href ? ' cb-rating--link' : '');
  if (opts.href) (el as HTMLAnchorElement).href = opts.href;

  const render = (s: WidgetState): void => {
    const prop = s.properties.find((p) => p.id === s.selectedPropertyId) ?? s.properties[0];
    el.textContent = '';
    if (!prop || prop.rating == null) { el.classList.add('cb-rating--empty'); return; }
    el.classList.remove('cb-rating--empty');
    const ic = document.createElement('span');
    ic.className = 'cb-rating__star';
    ic.appendChild(star());
    const val = document.createElement('b');
    val.className = 'cb-rating__value';
    val.textContent = formatScore(prop.rating);
    const cnt = document.createElement('span');
    cnt.className = 'cb-rating__count';
    cnt.textContent = `· ${prop.reviewCount} ${i18n.t('property.reviews')}`;
    el.append(ic, val, cnt);
  };

  state.on('*', (s: WidgetState) => render(s));
  render(state.get());
  return el;
}

// ─── Helpers de rendu ────────────────────────────────────────────────────────

/**
 * Liste des avis. `limit` défini → teaser (exactement `limit` avis, pas de pagination). `limit` absent →
 * pagination : 1re page puis bouton « Charger plus » qui appelle les pages suivantes jusqu'à tout charger.
 */
function renderListSection(slot: HTMLElement, api: BookingApi, i18n: BookingI18n, opts: ReviewsListOptions): void {
  const list = document.createElement('div');
  list.className = 'cb-reviews__list';

  if (opts.demo) {
    const items = opts.limit != null ? DEMO_REVIEWS.slice(0, opts.limit) : DEMO_REVIEWS;
    items.forEach((r) => list.appendChild(reviewCard(r, i18n)));
    slot.replaceChildren(items.length ? list : emptyState(i18n));
    return;
  }

  const loading = document.createElement('p');
  loading.className = 'cb-reviews__loading cb-text-sm cb-text-secondary';
  loading.textContent = i18n.t('reviews.loading');
  slot.replaceChildren(loading);

  const paginate = opts.limit == null; // teaser (limit) = pas de bouton « Charger plus »
  const size = opts.limit ?? opts.pageSize ?? 6; // pagination par blocs de 6
  let page = 0;
  let moreBtn: HTMLButtonElement | null = null;

  const loadPage = (): void => {
    api.getReviews(page, size).then((res) => {
      if (page === 0) {
        if (res.content.length === 0) { slot.replaceChildren(emptyState(i18n)); return; }
        slot.replaceChildren(list); // retire le loading, montre la liste
      }
      res.content.forEach((r) => list.appendChild(reviewCard(r, i18n)));
      if (paginate && !res.last) {
        if (!moreBtn) {
          moreBtn = makeLoadMore(i18n, () => { page += 1; moreBtn!.disabled = true; loadPage(); });
          slot.appendChild(moreBtn);
        } else {
          moreBtn.disabled = false;
        }
      } else if (moreBtn) {
        moreBtn.remove();
        moreBtn = null;
      }
    }).catch(() => { if (page === 0) slot.replaceChildren(emptyState(i18n)); });
  };

  loadPage();
}

/** Bouton « Charger plus d'avis » (pagination). */
function makeLoadMore(i18n: BookingI18n, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cb-reviews__more';
  btn.textContent = i18n.t('reviews.loadMore');
  btn.addEventListener('click', onClick);
  return btn;
}

/** Enrobe un nœud dans un lien (le résumé devient cliquable → page de tous les avis). */
function wrapInLink(node: HTMLElement, href: string, i18n: BookingI18n): HTMLElement {
  const a = document.createElement('a');
  a.className = 'cb-reviews__summary-link';
  a.href = href;
  a.setAttribute('aria-label', i18n.t('reviews.viewAll'));
  a.appendChild(node);
  return a;
}

function emptyState(i18n: BookingI18n): HTMLElement {
  const p = document.createElement('p');
  p.className = 'cb-reviews__empty cb-text-sm cb-text-secondary';
  p.textContent = i18n.t('reviews.empty');
  return p;
}

/** Note formatée à 1 décimale, virgule décimale (« 4,7 »). */
function formatScore(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

/** Rangée de 5 étoiles (pleines jusqu'à `round(rating)`). */
function starsRow(rating: number): HTMLElement {
  const row = document.createElement('span');
  row.className = 'cb-reviews__stars';
  const filled = Math.round(rating);
  for (let i = 1; i <= 5; i++) row.appendChild(star(i <= filled));
  return row;
}

/** En-tête résumé : grosse note + étoiles + total, et barres de distribution par note. */
function renderSummary(stats: ApiReviewStats, i18n: BookingI18n): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cb-reviews__summary';

  const score = document.createElement('div');
  score.className = 'cb-reviews__score';
  const big = document.createElement('b');
  big.className = 'cb-reviews__score-value';
  big.textContent = formatScore(stats.averageRating);
  const meta = document.createElement('div');
  meta.className = 'cb-reviews__score-meta';
  meta.appendChild(starsRow(stats.averageRating));
  const cnt = document.createElement('span');
  cnt.className = 'cb-reviews__score-count';
  cnt.textContent = `${stats.totalCount} ${i18n.t('property.reviews')}`;
  meta.appendChild(cnt);
  score.append(big, meta);

  wrap.append(score, renderDistribution(stats));
  return wrap;
}

/** Barres de distribution (5★ → 1★), largeur proportionnelle au total. */
function renderDistribution(stats: ApiReviewStats): HTMLElement {
  const bars = document.createElement('div');
  bars.className = 'cb-reviews__bars';
  const total = stats.totalCount || 1;
  for (let s = 5; s >= 1; s--) {
    const count = Number(stats.distribution?.[String(s)] ?? 0);
    const row = document.createElement('div');
    row.className = 'cb-reviews__bar';

    const label = document.createElement('span');
    label.className = 'cb-reviews__bar-label';
    label.textContent = String(s);
    const labelStar = document.createElement('span');
    labelStar.className = 'cb-reviews__bar-star';
    labelStar.appendChild(star());

    const track = document.createElement('span');
    track.className = 'cb-reviews__bar-track';
    const fill = document.createElement('span');
    fill.className = 'cb-reviews__bar-fill';
    fill.style.width = `${Math.round((count / total) * 100)}%`;
    track.appendChild(fill);

    const num = document.createElement('span');
    num.className = 'cb-reviews__bar-count';
    num.textContent = String(count);

    row.append(label, labelStar, track, num);
    bars.appendChild(row);
  }
  return bars;
}

/** Une carte avis : étoiles + citation + auteur/date + éventuelle réponse hôte. */
function reviewCard(r: ApiReview, i18n: BookingI18n): HTMLElement {
  const card = document.createElement('article');
  card.className = 'cb-reviews__item';

  if (r.rating != null) card.appendChild(starsRow(r.rating));

  if (r.reviewText) {
    const quote = document.createElement('blockquote');
    quote.className = 'cb-reviews__text';
    quote.textContent = `« ${r.reviewText} »`;
    card.appendChild(quote);
  }

  const cite = document.createElement('footer');
  cite.className = 'cb-reviews__cite';
  const author = document.createElement('b');
  author.className = 'cb-reviews__author';
  author.textContent = r.guestName || '—';
  cite.appendChild(author);
  if (r.reviewDate) {
    const date = document.createElement('span');
    date.className = 'cb-reviews__date';
    date.textContent = formatDate(r.reviewDate, i18n.lang);
    cite.appendChild(date);
  }
  card.appendChild(cite);

  if (r.hostResponse) {
    const resp = document.createElement('div');
    resp.className = 'cb-reviews__response';
    const lbl = document.createElement('span');
    lbl.className = 'cb-reviews__response-label';
    lbl.textContent = i18n.t('reviews.hostResponse');
    const txt = document.createElement('p');
    txt.className = 'cb-reviews__response-text';
    txt.textContent = r.hostResponse;
    resp.append(lbl, txt);
    card.appendChild(resp);
  }
  return card;
}

/** Date « mois année » localisée (repli sur la chaîne brute si parsing impossible). */
function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(lang || undefined, { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return iso;
  }
}
