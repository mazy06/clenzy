import type { WidgetState } from '../types';

/** La caution est annoncée séparément et n'entre jamais dans le total du séjour. */
export function renderDepositNotice(container: HTMLElement, state: WidgetState, i18n: { t: (key: string) => string }): void {
  container.replaceChildren();
  const stays = state.cart.length ? state.cart : [{ propertyId: state.selectedPropertyId }];
  for (const stay of stays) {
    const property = state.properties.find(p => p.id === stay.propertyId);
    const amount = property?.securityDepositAmount;
    if (!property || amount == null || !Number.isFinite(amount) || amount <= 0) continue;
    const row = document.createElement('p');
    row.className = 'cb-price-line';
    const label = document.createElement('span');
    label.textContent = `${i18n.t('deposit.label')}${state.cart.length ? ` · ${property.name}` : ''}`;
    const value = document.createElement('span');
    value.className = 'cb-price-line__amount';
    const currency = property.securityDepositCurrency || property.currency;
    try { value.textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
    catch { value.textContent = `${amount} ${currency}`; }
    row.append(label, value);
    container.append(row);
  }
  container.hidden = !container.childElementCount;
  if (container.hidden) return;
  const help = document.createElement('p');
  help.className = 'cb-text-sm cb-text-secondary';
  help.textContent = i18n.t('deposit.help');
  container.append(help);
}
