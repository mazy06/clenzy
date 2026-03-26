import type { StateManager } from '../state';
import type { WidgetState } from '../types';
import { createSpinner } from './Spinner';

interface I18n {
  t: (key: string) => string;
}

export function createCTAButton(state: StateManager, i18n: I18n, onClick: () => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'cb-section';

  const btn = document.createElement('button');
  btn.className = 'cb-cta';
  btn.setAttribute('type', 'button');

  const label = document.createElement('span');
  label.dataset.slot = 'label';
  btn.appendChild(label);

  btn.addEventListener('click', () => {
    if (!btn.disabled) onClick();
  });

  // Subtitle ("You won't be charged yet")
  const subtitle = document.createElement('div');
  subtitle.className = 'cb-cta__subtitle';
  subtitle.textContent = i18n.t('common.noChargeYet');

  wrapper.appendChild(btn);
  wrapper.appendChild(subtitle);

  state.on('*', (s: WidgetState) => {
    const canBook = !!s.checkIn && !!s.checkOut;
    btn.disabled = !canBook || s.loading;

    // Clear and rebuild label content
    label.textContent = '';

    if (s.loading) {
      label.appendChild(createSpinner('sm'));
      const text = document.createTextNode(` ${i18n.t('common.processing')}`);
      label.appendChild(text);
    } else if (s.pricing && canBook) {
      label.textContent = `${i18n.t('common.reserve')} · ${formatCurrency(s.pricing.total, s.pricing.currency)}`;
    } else {
      label.textContent = i18n.t('common.reserve');
    }

    // Hide subtitle when loading or no dates
    subtitle.style.display = canBook && !s.loading ? '' : 'none';
  });

  return wrapper;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    return `${symbol}${Math.round(amount)}`;
  }
}
