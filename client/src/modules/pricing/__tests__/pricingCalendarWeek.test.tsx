// @vitest-environment jsdom
import React from 'react';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../../i18n/config';
import PricingCalendarView from '../PricingCalendarView';
import { formatWeekdayShort } from '../../../utils/localeDate';

/**
 * La semaine de la grille mensuelle des tarifs suit la LANGUE.
 *
 * <p>Elle etait calee sur lundi en dur, ses sept entetes ecrits en francais ou
 * en anglais, et son week-end n'etait pas teinte : en arabe, la grille
 * annoncait « MON TUE WED » au-dessus de colonnes decoupees comme en France,
 * quand la semaine ouvree y va du dimanche au jeudi.</p>
 */

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PricingCalendarView
        selectedPropertyId={1}
        currentMonth={at(2024, 10, 1)}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
        calendarPricing={[]}
        calendarPricingLoading={false}
        onUpdatePrice={async () => {}}
        updatePriceLoading={false}
      />
    </QueryClientProvider>,
  );
}

/** Les sept entetes de jours, dans l'ordre des colonnes. */
function headerLabels(container: HTMLElement): string[] {
  const row = container.querySelector('.grid');
  return Array.from(row?.querySelectorAll('span') ?? []).map((el) => el.textContent ?? '');
}

/** Index (0-6) des colonnes dont la cellule porte la teinte de week-end. */
function weekendColumns(container: HTMLElement): number[] {
  const cells = Array.from(
    container.querySelectorAll<HTMLElement>('.grid.flex-1 > div'),
  );
  const tinted = cells
    .map((cell, index) => (cell.className.includes('--pc-cell-we') ? index % 7 : -1))
    .filter((index) => index >= 0);
  return [...new Set(tinted)].sort((a, b) => a - b);
}

afterAll(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

describe('Semaine de la grille des tarifs', () => {
  it('part du lundi et chome samedi-dimanche en francais', async () => {
    await i18n.changeLanguage('fr');
    const { container } = mount();

    expect(headerLabels(container)[0]).toBe(formatWeekdayShort(at(2024, 10, 14), 'fr'));
    // Lundi en tete : samedi et dimanche ferment la rangee.
    expect(weekendColumns(container)).toEqual([5, 6]);
    cleanup();
  });

  it('part du dimanche et chome vendredi-samedi en arabe', async () => {
    await i18n.changeLanguage('ar');
    const { container } = mount();

    const labels = headerLabels(container);
    expect(labels[0]).toBe(formatWeekdayShort(at(2024, 10, 20), 'ar')); // dimanche
    expect(labels[5]).toBe(formatWeekdayShort(at(2024, 10, 18), 'ar')); // vendredi
    expect(labels[6]).toBe(formatWeekdayShort(at(2024, 10, 19), 'ar')); // samedi
    // Dimanche en tete : le week-end ferme la rangee, comme en francais — mais
    // sur vendredi et samedi.
    expect(weekendColumns(container)).toEqual([5, 6]);
    cleanup();
  });
});
