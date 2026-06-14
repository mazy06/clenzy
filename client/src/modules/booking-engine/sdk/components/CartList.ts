import type { StateManager } from '../state';
import type { WidgetState } from '../types';

interface I18n {
  t: (key: string) => string;
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
  const key = s.cart.map(c => `${c.propertyId}:${c.checkIn}:${c.checkOut}`).join('|');
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.textContent = '';

  if (!s.cart.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;

  const title = document.createElement('div');
  title.className = 'cb-cart__title cb-text-semibold';
  title.textContent = i18n.t('cart.yourStays');
  container.appendChild(title);

  let grandTotal = 0;
  let currency = s.cart[0].currency;
  s.cart.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'cb-cart__item';

    const label = document.createElement('span');
    label.className = 'cb-cart__item-label cb-text-sm';
    label.textContent = `${item.propertyName} · ${item.checkIn} → ${item.checkOut}`;

    const right = document.createElement('span');
    right.className = 'cb-cart__item-right';
    const price = document.createElement('span');
    price.textContent = formatPrice(item.total, item.currency);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cb-cart__remove';
    remove.setAttribute('aria-label', 'remove');
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

    grandTotal += item.total;
    currency = item.currency;
  });

  const totalRow = document.createElement('div');
  totalRow.className = 'cb-cart__total';
  const tl = document.createElement('span');
  tl.textContent = i18n.t('cart.totalTTC');
  const ta = document.createElement('span');
  ta.textContent = formatPrice(grandTotal, currency);
  totalRow.appendChild(tl);
  totalRow.appendChild(ta);
  container.appendChild(totalRow);

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
