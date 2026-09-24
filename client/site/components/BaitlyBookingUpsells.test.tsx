import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SiteLanguageProvider } from '../lib/siteLanguage';
import BaitlyBookingUpsells from './BaitlyBookingUpsells';

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('navigator', {
    ...navigator,
    languages: ['fr-FR'],
    language: 'fr-FR',
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderUpsells() {
  render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <BaitlyBookingUpsells />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}
const total = () =>
  screen
    .getByRole('status')
    .querySelector('strong')
    ?.textContent?.replace(/\s/g, '');

describe('Baitly booking upsell showcase', () => {
  it('retains optional extras across categories and calculates their combined value', () => {
    renderUpsells();
    expect(total()).toBe('0€');
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ajouter au séjour : Le lever du soleil/,
      }),
    );
    expect(total()).toBe('120€');
    fireEvent.click(screen.getByRole('button', { name: /Confort du séjour/ }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ajouter au séjour : Prendre son temps/,
      }),
    );
    expect(total()).toBe('165€');
    fireEvent.click(screen.getByRole('button', { name: /Services privés/ }));
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter au séjour : Un chef/ }),
    );
    expect(total()).toBe('250€');
    const selection = screen.getByRole('complementary');
    expect(within(selection).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(
      within(selection).getByRole('button', {
        name: /Retirer : Le lever du soleil/,
      }),
    );
    expect(total()).toBe('130€');
    fireEvent.click(
      screen.getByRole('button', { name: /Activités & expériences/ }),
    );
    expect(
      screen
        .getByRole('button', { name: /Ajouter au séjour : Le lever du soleil/ })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('can empty the selection and links to the welcome guide in the active language', () => {
    renderUpsells();
    fireEvent.click(
      screen.getByRole('button', { name: /Ajouter au séjour : Une escapade/ }),
    );
    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: /Retirer : Une escapade/,
      }),
    );
    expect(total()).toBe('0€');
    expect(screen.getByText('Essayez d’ajouter une option')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/produit/livret-accueil?lang=fr',
    );
  });
});
