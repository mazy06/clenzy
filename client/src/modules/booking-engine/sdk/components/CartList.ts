import type { StateManager } from '../state';
import type { WidgetState } from '../types';

interface I18n {
  t: (key: string) => string;
  lang?: string;
}

/** Panier multi-séjours (BE-L0-6) : liste des séjours ajoutés + total + bouton de validation. */
export function createCartList(state: StateManager, i18n: I18n, onCheckoutAll: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-cart';

  state.on('*', (s: WidgetState) => render(container, s, i18n, state, onCheckoutAll));
  render(container, state.get(), i18n, state, onCheckoutAll);

  return container;
}

function render(container: HTMLElement, s: WidgetState, i18n: I18n,
                state: StateManager, onCheckoutAll: () => void): void {
  const key = JSON.stringify([s.cart, s.properties.map((p) => [p.id, p.city, p.mainPhotoUrl])]);
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.textContent = '';

  if (!s.cart.length) {
    container.hidden = false;
    const empty = document.createElement('p');
    empty.className = 'cb-cart__empty';
    empty.setAttribute('role', 'status');
    empty.textContent = i18n.t('cart.empty');
    container.appendChild(empty);
    return;
  }
  container.hidden = false;

  const title = document.createElement('div');
  title.className = 'cb-cart__title cb-text-semibold';
  title.textContent = i18n.t('cart.yourStays');
  container.appendChild(title);

  const totals = new Map<string, number>();
  s.cart.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'cb-cart__item';
    const property = s.properties.find((p) => p.id === item.propertyId);
    if (property?.mainPhotoUrl) {
      const image = document.createElement('img');
      image.className = 'cb-cart__photo';
      image.src = property.mainPhotoUrl;
      image.alt = '';
      image.loading = 'lazy';
      row.append(image);
    }

    const label = document.createElement('span');
    label.className = 'cb-cart__item-label cb-text-sm';
    const name = document.createElement('strong');
    name.className = 'cb-cart__property-name';
    name.textContent = item.propertyName;
    const dates = document.createElement('span');
    dates.className = 'cb-cart__dates';
    const formatDate = (value: string) => new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
    dates.textContent = `${formatDate(item.checkIn)} → ${formatDate(item.checkOut)}`;
    const guests = document.createElement('span');
    guests.className = 'cb-cart__guests';
    const nights = Math.round((Date.parse(item.checkOut) - Date.parse(item.checkIn)) / 86400000);
    guests.textContent = `${nights} ${i18n.t('cart.nights')} · ${item.guests} ${i18n.t('property.guests')}${item.children ? ` · ${item.children} ${i18n.t('guests.children')}` : ''}`;
    label.append(name, dates, guests);

    const right = document.createElement('span');
    right.className = 'cb-cart__item-right';
    const price = document.createElement('span');
    price.textContent = formatPrice(item.total, item.currency);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cb-cart__remove';
    remove.setAttribute('aria-label', `${i18n.t('cart.remove')} ${item.propertyName}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      const next = state.get().cart.slice();
      next.splice(idx, 1);
      state.set({ cart: next }, 'stateChange');
    });
    right.appendChild(price);
    right.appendChild(remove);

    row.appendChild(label);
    row.appendChild(right);
    container.appendChild(row);

    totals.set(item.currency, (totals.get(item.currency) || 0) + item.total);
  });

  totals.forEach((total, currency) => {
  const totalRow = document.createElement('div');
  totalRow.className = 'cb-cart__total';
  const tl = document.createElement('span');
  tl.textContent = i18n.t('cart.totalTTC');
  const ta = document.createElement('span');
  ta.textContent = formatPrice(total, currency);
  totalRow.appendChild(tl);
  totalRow.appendChild(ta);
  container.appendChild(totalRow);
  });

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'cb-cta cb-cart__checkout';
  cta.textContent = i18n.t('cart.continue');
  cta.addEventListener('click', onCheckoutAll);
  container.appendChild(cta);
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
