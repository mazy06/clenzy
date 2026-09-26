import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteLanguageProvider } from '../lib/siteLanguage';
import { CURRENCY_CYCLE_MS, SiteCurrencyProvider } from '../lib/siteCurrency';
import SiteMoney, { SiteMoneyText } from './SiteMoney';
import SiteCurrencyControl from './SiteCurrencyControl';
import PricingPage from '../pages/PricingPage';
import { RevenueCalculator } from './BaitlyResourceTools';
import type { ReactNode } from 'react';

vi.mock('../lib/siteLaunch', () => ({
  useSiteLaunch: () => ({ paused: true }),
}));
beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/?lang=fr');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const mount = (children: ReactNode) =>
  render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <SiteCurrencyProvider>
          {children}
          <SiteCurrencyControl />
        </SiteCurrencyProvider>
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
const tick = (cycles = 1) =>
  act(() => vi.advanceTimersByTime(CURRENCY_CYCLE_MS * cycles));
const amounts = (node: HTMLElement) =>
  [...node.querySelectorAll<HTMLElement>('.site-money')].map((el) =>
    Number(el.dataset.amount),
  );

describe('Site currency presentation', () => {
  it('cycles all related prices together and preserves a direct-booking saving and basket total', () => {
    const { container } = mount(
      <>
        <SiteMoney value={450} />
        <SiteMoney value={360} />
        <SiteMoney value={36} />
        <SiteMoney value={396} />
      </>,
    );
    for (const [code, expected] of [
      ['MAD', [4500, 3600, 360, 3960]],
      ['EUR', [450, 360, 36, 396]],
      ['SAR', [1800, 1440, 144, 1584]],
      ['MAD', [4500, 3600, 360, 3960]],
    ] as const) {
      expect(amounts(container)).toEqual(expected);
      expect(
        [...container.querySelectorAll('.site-money')].every(
          (el) => el.getAttribute('data-currency') === code,
        ),
      ).toBe(true);
      const [ota, direct, extra, total] = amounts(container);
      expect(direct / ota).toBe(0.8);
      expect(direct + extra).toBe(total);
      tick();
    }
  });

  it('shows PMS glyphs, lets visitors pin a currency and resume the cycle', () => {
    const { container } = mount(<SiteMoney value={25} />);
    expect(container.querySelector('.site-money svg')).toBeTruthy();
    expect(container.querySelector('.site-money')?.textContent).not.toMatch(
      /MAD|SAR/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Euro', exact: true }));
    tick(4);
    expect(amounts(container)).toEqual([25]);
    expect(container.querySelector('.site-money')?.textContent).toContain('€');
    fireEvent.click(
      screen.getByRole('button', { name: 'Reprendre la rotation des devises' }),
    );
    tick();
    expect(amounts(container)).toEqual([100]);
  });

  it('suspends the timer in a hidden tab and respects reduced motion', () => {
    const { container, unmount } = mount(<SiteMoney value={25} />);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    tick(3);
    expect(amounts(container)).toEqual([250]);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    tick();
    expect(amounts(container)).toEqual([25]);
    unmount();
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const reduced = mount(<SiteMoney value={25} />);
    tick(4);
    expect(amounts(reduced.container)).toEqual([250]);
    expect(
      screen.queryByRole('button', {
        name: 'Mettre la rotation des devises en pause',
      }),
    ).toBeNull();
  });

  it.each([
    ['Prix : 1 250 MAD / nuit, 3 nuits.', 1250],
    ['Price: MAD 1,250 per night.', 1250],
    ['Supplément : +36,50 € par séjour.', 365],
    ['المبلغ 1٬250 ر.س لليلة.', 3125],
  ])(
    'parses localized editorial amounts without changing surrounding copy: %s',
    (copy, expected) => {
      const { container } = mount(
        <p>
          <SiteMoneyText>{copy}</SiteMoneyText>
        </p>,
      );
      expect(amounts(container)).toEqual([expected]);
      expect(container.querySelector('p')?.textContent).not.toMatch(
        /MAD|SAR|ر\.س/,
      );
    },
  );

  it('uses published market grids for plans instead of illustrative conversion rates', () => {
    mount(<PricingPage />);
    const total = () => amounts(screen.getByTestId('loyalty-monthly'))[0];
    expect(total()).toBe(490);
    tick();
    expect(total()).toBe(49);
    tick();
    expect(total()).toBe(189);
    fireEvent.change(
      screen.getByRole('slider', { name: 'Nombre de logements' }),
      { target: { value: '10' } },
    );
    const pinned = total();
    tick(4);
    expect(total()).toBe(pinned);
  });

  it('converts calculator assumptions and totals, then freezes currency during editing', () => {
    mount(<RevenueCalculator language="fr" />);
    const rate = screen.getByRole('spinbutton', { name: /Prix moyen \/ nuit/ });
    expect(rate).toHaveValue(850);
    tick();
    expect(rate).toHaveValue(85);
    const result = screen.getByRole('region', { name: 'Votre estimation' });
    expect(amounts(result)).toContain(944.37);
    const [net, accommodation, extras, fees, costs] = amounts(result);
    expect(
      Math.round((accommodation + extras - fees - costs) * 100) / 100,
    ).toBe(net);
    fireEvent.focus(rate);
    fireEvent.change(rate, { target: { value: '100' } });
    tick(3);
    expect(rate).toHaveValue(100);
    expect(within(result).getAllByLabelText(/Euro/).length).toBeGreaterThan(0);
  });
});
