import { describe, expect, it } from 'vitest';
import { renderDepositNotice } from './DepositNotice';
import { createInitialState } from '../state';
import type { WidgetProperty, CartStay } from '../types';
import { createBookingI18n } from '../i18n';

describe('Baitly deposit disclosure', () => {
  it('shows the deposit for each stay in its original currency without changing the cart total', () => {
    const state = createInitialState({ properties: [
      { id: 1, name: '<img src=x>', securityDepositAmount: 300, securityDepositCurrency: 'EUR', currency: 'USD' },
      { id: 2, name: 'Riad', securityDepositAmount: 1200, securityDepositCurrency: 'MAD', currency: 'USD' },
    ] as WidgetProperty[], cart: [{ propertyId: 1, total: 200 }, { propertyId: 2, total: 400 }] as CartStay[] });
    const container = document.createElement('div');
    renderDepositNotice(container, state, createBookingI18n('fr'));
    expect(container.hidden).toBe(false);
    expect(container.querySelectorAll('.cb-price-line')).toHaveLength(2);
    expect(container.textContent).toContain('300');
    expect(container.textContent).toContain('MAD');
    expect(container.textContent).toContain('<img src=x>');
    expect(container.querySelector('img')).toBeNull();
    expect(state.cart.reduce((total, stay) => total + stay.total, 0)).toBe(600);
  });
  it('does not display an invented deposit when the property has none', () => {
    const state = createInitialState({ properties: [{ id: 1, name: 'Studio', securityDepositAmount: 0 }] as WidgetProperty[], selectedPropertyId: 1 });
    const container = document.createElement('div');
    renderDepositNotice(container, state, createBookingI18n('fr'));
    expect(container.hidden).toBe(true);
    expect(container.textContent).toBe('');
  });
});
