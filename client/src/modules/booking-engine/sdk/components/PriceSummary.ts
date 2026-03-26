import type { StateManager } from '../state';
import type { WidgetState, PriceBreakdown } from '../types';

interface I18n {
  t: (key: string) => string;
}

export function createPriceSummary(state: StateManager, i18n: I18n): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-price-summary';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-label', i18n.t('cart.priceBreakdown'));

  state.on('*', (s: WidgetState) => {
    render(container, s, i18n);
  });

  return container;
}

function render(container: HTMLElement, s: WidgetState, i18n: I18n): void {
  container.textContent = '';

  // Only show if dates are selected
  if (!s.checkIn || !s.checkOut) return;

  if (s.pricingLoading) {
    // Skeleton loading
    for (let i = 0; i < 3; i++) {
      const skel = document.createElement('div');
      skel.className = 'cb-price-line';
      const skelLabel = document.createElement('span');
      skelLabel.className = 'cb-price-skeleton';
      skelLabel.style.width = `${80 + i * 20}px`;
      const skelAmount = document.createElement('span');
      skelAmount.className = 'cb-price-skeleton';
      skelAmount.style.width = '50px';
      skel.appendChild(skelLabel);
      skel.appendChild(skelAmount);
      container.appendChild(skel);
    }
    return;
  }

  if (!s.pricing) return;

  const p = s.pricing;

  // Line items
  p.lines
    .filter(l => l.type !== 'total')
    .forEach(line => {
      const row = document.createElement('div');
      row.className = 'cb-price-line';

      const label = document.createElement('span');
      label.className = 'cb-price-line__label';
      label.textContent = line.label;

      const amount = document.createElement('span');
      amount.className = 'cb-price-line__amount';
      amount.textContent = formatCurrency(line.amount, p.currency);

      row.appendChild(label);
      row.appendChild(amount);
      container.appendChild(row);
    });

  // Total
  const totalRow = document.createElement('div');
  totalRow.className = 'cb-price-total';

  const totalLabel = document.createElement('span');
  totalLabel.textContent = i18n.t('cart.total');

  const totalAmount = document.createElement('span');
  totalAmount.textContent = formatCurrency(p.total, p.currency);

  totalRow.appendChild(totalLabel);
  totalRow.appendChild(totalAmount);
  container.appendChild(totalRow);
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    return `${symbol}${amount.toFixed(2)}`;
  }
}
