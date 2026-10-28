import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import PricingPage from '../pages/PricingPage';
import { SiteLanguageProvider } from '../lib/siteLanguage';

vi.mock('../lib/siteLaunch', () => ({
  useSiteLaunch: () => ({ paused: true }),
}));
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('navigator', {
    ...navigator,
    language: 'fr-FR',
    languages: ['fr-FR'],
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const mount = () =>
  render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <PricingPage />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
const text = (id: string) =>
  `${screen.getByTestId(id).querySelector('.site-money')?.getAttribute('data-amount')?.replace('.', ',')}${screen.getByTestId(id).querySelector('.site-money')?.getAttribute('data-currency')}`;
const amount = () => text('loyalty-monthly');
const stage = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

describe('Baitly loyalty simulator', () => {
  it('recalculates seniority, properties, plans and markets without creating a subscription', () => {
    mount();
    expect(amount()).toBe('490MAD');
    stage('Mois 7 à 12 : −20 %');
    fireEvent.change(
      screen.getByRole('slider', { name: 'Nombre de logements' }),
      { target: { value: '3' } },
    );
    expect(amount()).toBe('1176MAD');
    expect(
      screen
        .getByTestId('loyalty-year')
        .querySelector('.site-money')
        ?.getAttribute('data-amount'),
    ).toBe('15435');
    stage('Dès le mois 13 : −30 %');
    expect(amount()).toBe('1029MAD');
    fireEvent.click(
      screen.getByRole('button', { name: 'Gérer et vendre en direct' }),
    );
    expect(amount()).toBe('609MAD');
    fireEvent.change(screen.getByRole('combobox', { name: 'Votre marché' }), {
      target: { value: 'EU' },
    });
    expect(amount()).toBe('60,9EUR');
    expect(
      screen
        .getAllByRole('link', { name: /Rejoindre le pré-lancement/ })
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/bientot-disponible?lang=fr&plan=essential&market=EU&properties=3',
      '/bientot-disponible?lang=fr&plan=pro&market=EU&properties=3',
      '/bientot-disponible?lang=fr&plan=custom&market=EU',
      '/bientot-disponible?lang=fr&plan=essential&market=EU&properties=3',
    ]);
  });
  it('walks the four loyalty stages and marks the current one', () => {
    mount();
    stage('Mois 4 à 6 : −10 %');
    expect(amount()).toBe('441MAD');
    stage('Mois 7 à 12 : −20 %');
    expect(amount()).toBe('392MAD');
    stage('Dès le mois 13 : −30 %');
    expect(amount()).toBe('343MAD');
    expect(
      screen
        .getByRole('button', { name: 'Dès le mois 13 : −30 %' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    stage('Mois 1 à 3 : 0 %');
    expect(amount()).toBe('490MAD');
  });
  it('updates volume, loyalty, plan averages and exact monthly totals together', () => {
    mount();
    fireEvent.click(
      screen.getByRole('button', { name: '10–19 logements : −15 %' }),
    );
    expect(amount()).toBe('4581,5MAD');
    stage('Dès le mois 13 : −30 %');
    expect(amount()).toBe('3207,05MAD');
    expect(text('plan-pro-unit')).toBe('320,71MAD');
    expect(text('plan-pro-total')).toBe('3207,05MAD');
    expect(text('loyalty-year')).toBe('48105,75MAD');
    fireEvent.change(screen.getByRole('combobox', { name: 'Votre marché' }), {
      target: { value: 'EU' },
    });
    expect(amount()).toBe('320,71EUR');
    expect(text('plan-pro-unit')).toBe('32,07EUR');
    expect(text('plan-pro-total')).toBe('320,71EUR');
    fireEvent.click(
      screen.getByRole('button', { name: '1–4 logements : 0 %' }),
    );
    expect(amount()).toBe('34,3EUR');
  });
});
