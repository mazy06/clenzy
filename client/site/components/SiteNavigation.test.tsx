import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './SiteLayout';
import { SiteLanguageProvider, type SiteLanguage } from '../lib/siteLanguage';
import { LAYOUT_MESSAGES } from '../lib/messages/layout';

vi.mock('../lib/siteLaunch', () => ({
  useSiteLaunch: () => ({ paused: true }),
}));

let desktopChange: () => void;
let desktopMatches = false;
beforeEach(() => {
  sessionStorage.clear();
  desktopMatches = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(min-width: 1200px)' && desktopMatches;
    },
    addEventListener: (_event: string, listener: () => void) => {
      if (query === '(min-width: 1200px)') desktopChange = listener;
    },
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function RouteProbe() {
  const { pathname, hash } = useLocation();
  return (
    <output data-testid="route">
      {pathname}
      {hash}
    </output>
  );
}
function renderHeader(language: SiteLanguage = 'fr', route = '/') {
  window.history.replaceState({}, '', `/?lang=${language}`);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SiteLanguageProvider>
        <div className="baitly-marketing">
          <SiteHeader />
          <main>
            <RouteProbe />
          </main>
          <footer>Footer</footer>
        </div>
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}
const destinations = (root: HTMLElement) =>
  within(root)
    .getAllByRole('link')
    .map((a) => ({
      title: a.getAttribute('aria-label') ?? a.textContent?.trim(),
      to: a.getAttribute('href'),
    }));

describe('responsive site navigation', () => {
  it('locks the background while open and restores it after closing the menu', () => {
    renderHeader();
    const root = document.documentElement;
    const body = document.body;
    const rootOverflow = root.style.overflow;
    const bodyOverflow = body.style.overflow;
    const bodyPadding = body.style.paddingRight;
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    expect(root.style.overflow).toBe('hidden');
    expect(body.style.overflow).toBe(bodyOverflow);
    expect(document.querySelector('main')?.inert).toBe(true);
    expect(document.querySelector('footer')?.inert).toBe(true);
    const close = screen.getByRole('button', { name: 'Fermer le menu' });
    close.focus();
    fireEvent.click(close);
    expect(
      screen.queryByRole('navigation', { name: 'Navigation mobile' }),
    ).toBeNull();
    expect(root.style.overflow).toBe(rootOverflow);
    expect(body.style.overflow).toBe(bodyOverflow);
    expect(body.style.paddingRight).toBe(bodyPadding);
    expect(document.querySelector('main')?.inert).toBeFalsy();
    expect(
      screen.getByRole('button', { name: 'Ouvrir le menu' }),
    ).toHaveFocus();
  });
  it.each<SiteLanguage>(['fr', 'en', 'ar'])(
    'keeps desktop groups and every destination on mobile (%s)',
    async (language) => {
      renderHeader(language);
      const m = LAYOUT_MESSAGES[language];
      const desktop = screen.getByRole('navigation', { name: m.nav.aria });
      fireEvent.click(screen.getByRole('button', { name: m.header.openMenu }));
      const mobile = screen.getByRole('navigation', { name: m.nav.mobileAria });
      expect(
        [...mobile.querySelectorAll('.site-mobile-section-label')].map(
          (el) => el.textContent,
        ),
      ).toEqual([
        m.nav.product,
        m.nav.solutions,
        m.nav.pricing,
        m.nav.migration,
        m.nav.providers,
        m.nav.resources,
      ]);
      expect(within(mobile).getAllByRole('group')).toHaveLength(3);
      expect(within(mobile).queryByRole('button')).toBeNull();
      for (const label of [m.nav.product, m.nav.solutions, m.nav.resources]) {
        fireEvent.click(within(desktop).getByRole('button', { name: label }));
        const desktopLinks = destinations(desktop).filter(
          (link) =>
            !['/tarifs', '/migration', '/prestataires'].includes(link.to ?? ''),
        );
        expect(desktopLinks.length).toBeGreaterThan(1);
        const group = within(mobile).getByRole('group', { name: label });
        expect(destinations(group)).toEqual(desktopLinks);
        fireEvent.click(within(desktop).getByRole('button', { name: label }));
      }
      for (const label of [m.nav.pricing, m.nav.migration, m.nav.providers]) {
        expect(
          within(mobile).getByRole('link', { name: label }),
        ).toHaveAttribute(
          'href',
          within(desktop)
            .getByRole('link', { name: label })
            .getAttribute('href'),
        );
      }
    },
  );

  it.each([
    ['Booking engine & sites', '/produit/booking-engine'],
    ['Conciergeries', '/solutions#conciergeries'],
    ['Académie Baitly', '/ressources/academie'],
  ])('opens %s with a single click and closes the menu', (title, route) => {
    renderHeader('fr', '/produit/agents-ia');
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const mobile = screen.getByRole('navigation', {
      name: 'Navigation mobile',
    });
    expect(mobile.querySelector('[aria-current="page"]')).toHaveAttribute(
      'href',
      '/produit/agents-ia',
    );
    fireEvent.click(within(mobile).getByRole('link', { name: title }));
    expect(screen.getByTestId('route')).toHaveTextContent(route);
    expect(
      screen.queryByRole('navigation', { name: 'Navigation mobile' }),
    ).toBeNull();
  });

  it('marks only the matching solution anchor and restores focus on Escape', () => {
    renderHeader('fr', '/solutions#maroc');
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const mobile = screen.getByRole('navigation', {
      name: 'Navigation mobile',
    });
    expect(mobile.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(mobile.querySelector('[aria-current="page"]')).toHaveAttribute(
      'href',
      '/solutions#maroc',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('navigation', { name: 'Navigation mobile' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Ouvrir le menu' }),
    ).toHaveFocus();
  });

  it('closes the mobile panel when returning to desktop', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    act(() => {
      desktopMatches = true;
      desktopChange();
    });
    expect(
      screen.queryByRole('navigation', { name: 'Navigation mobile' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Ouvrir le menu' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
