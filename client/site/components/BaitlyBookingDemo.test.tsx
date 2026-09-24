import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyBookingDemo from './BaitlyBookingDemo';
import { SiteLanguageProvider } from '../lib/siteLanguage';

let intersection: IntersectionObserverCallback;

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal('navigator', {
    ...navigator,
    languages: ['fr-FR'],
    language: 'fr-FR',
  });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {
        intersection(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderDemo = () =>
  render(
    <SiteLanguageProvider>
      <BaitlyBookingDemo />
    </SiteLanguageProvider>,
  );
const total = () =>
  screen.getByTestId('booking-demo-total').textContent?.replace(/\s/g, '');
const tick = (milliseconds: number) =>
  act(() => vi.advanceTimersByTime(milliseconds));
const pointedButton = () =>
  document.querySelector('[data-demo-pointer]')?.closest('button');
const journeyDelays = [
  2400, 2400, 3000, 2600, 3200, 2600, 2600, 3800, 2400, 2400, 3200, 1600, 4800,
];

describe('Baitly booking journey', () => {
  it('gives guests time to select several properties before autoplay continues with their cart', () => {
    renderDemo();
    fireEvent.click(
      screen.getByRole('button', { name: /Conciergerie & collection/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '02 Les adresses' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Maison Zayna' }),
    );
    tick(2500);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Villa Naya' }),
    );
    tick(1000);
    expect(
      screen.getByRole('button', { name: '02 Les adresses' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(total()).toBe('1620€');
    tick(2200);
    expect(
      screen.getByRole('button', { name: '03 Les extras' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(total()).toBe('1620€');
  });

  it('selects a date range across months and carries the duration and amount through checkout', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    fireEvent.click(screen.getByRole('button', { name: '02 Les dates' }));
    fireEvent.click(screen.getByRole('button', { name: /30 octobre 2026/ }));
    expect(
      screen.getByRole('button', { name: 'Confirmer mes dates' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '04 Le paiement' }));
    expect(
      screen.getByRole('button', { name: '02 Les dates' }),
    ).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: /^3 novembre 2026/ }));
    expect(total()).toBe('480€');
    expect(
      screen.getByRole('button', { name: /31 octobre 2026/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer mes dates' }),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Dîner pour deux/ }));
    expect(total()).toBe('516€');
    fireEvent.click(screen.getByRole('button', { name: 'Passer au paiement' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Utiliser le voyageur d’exemple' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Utiliser la carte de démonstration',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Payer 516/ }));
    tick(1600);
    const ticket = document.querySelector('.bb-confirmation-ticket');
    expect(ticket?.textContent).toContain('4 nuits');
    expect(ticket?.textContent).toContain('30 oct. → 3 nov.');
    expect(total()).toBe('516€');
  });

  it('prevents unavailable ranges and lets guests correct their dates and change months', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    fireEvent.click(screen.getByRole('button', { name: '02 Les dates' }));
    expect(
      screen.getByRole('button', { name: /^8 octobre 2026/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^7 octobre 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: /^10 octobre 2026/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('nuit indisponible');
    expect(
      screen.getByRole('button', { name: 'Confirmer mes dates' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^11 octobre 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: /^14 octobre 2026/ }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(total()).toBe('360€');
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    fireEvent.click(screen.getByRole('button', { name: /^28 novembre 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: /^2 décembre 2026/ }));
    expect(total()).toBe('480€');
  });

  it('selects one room or multiple collection properties and retains each in the confirmation', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    fireEvent.click(
      screen.getByRole('radio', { name: 'Sélectionner La Suite Terrasse' }),
    );
    expect(total()).toBe('450€');
    expect(
      screen.getByRole('radio', { name: 'Sélectionner La Suite Patio' }),
    ).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(
      screen.getByRole('button', { name: /Conciergerie & collection/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '02 Les adresses' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Maison Zayna' }),
    );
    expect(total()).toBe('900€');
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Villa Naya' }),
    );
    expect(total()).toBe('1620€');
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Sélectionner La terrasse d’Agafay',
      }),
    );
    expect(total()).toBe('1080€');
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les dates' }));
    fireEvent.click(screen.getByRole('button', { name: /^12 octobre 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: /^16 octobre 2026/ }));
    expect(total()).toBe('1440€');
    fireEvent.click(screen.getByRole('button', { name: '03 Les extras' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuer sans extras' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Utiliser le voyageur d’exemple' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Utiliser la carte de démonstration',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Payer 1.440/ }));
    tick(1600);
    const tickets = document.querySelectorAll('.bb-confirmation-ticket');
    expect(tickets).toHaveLength(2);
    expect(tickets[0].textContent).toContain('Maison Zayna');
    expect(tickets[1].textContent).toContain('Villa Naya');
    expect(tickets[1].textContent).toContain('4 nuits');
    fireEvent.click(screen.getByRole('button', { name: '02 Les adresses' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Maison Zayna' }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Villa Naya' }),
    );
    expect(
      screen.getByRole('button', { name: 'Les extras', exact: true }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '04 Le paiement' }));
    expect(
      screen.getByRole('button', { name: '02 Les adresses' }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it.each([
    [/Riad & maison d’hôtes/, '360€', '450€', '90€'],
    [/Villa & séjour privé/, '720€', '900€', '180€'],
    [/Conciergerie & collection/, '540€', '675€', '135€'],
  ])(
    'shows an illustrative 20 percent accommodation advantage for %s',
    (name, direct, reference, savings) => {
      renderDemo();
      fireEvent.click(screen.getByRole('button', { name }));
      const amount = (id: string) =>
        screen.getByTestId(id).textContent?.replace(/\s/g, '');
      expect(amount('booking-direct-rate')).toBe(direct);
      expect(amount('booking-ota-rate')).toBe(reference);
      expect(amount('booking-direct-savings')).toBe(savings);
      expect(total()).toBe(direct);
      expect(
        screen.getByText(/Comparaison illustrative pour le même hébergement/),
      ).toBeTruthy();
    },
  );

  it('opens the chosen villa step from its site navigation and retains the extras when editing dates', () => {
    renderDemo();
    fireEvent.click(
      screen.getByRole('button', { name: /Villa & séjour privé/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Les attentions', exact: true }),
    );
    expect(document.activeElement?.textContent).toBe(
      'Et si vous en profitiez un peu plus ?',
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Dîner avec chef privé/ }),
    );
    expect(total()).toBe('805€');
    fireEvent.click(
      screen.getByRole('button', { name: 'Disponibilités', exact: true }),
    );
    expect(document.activeElement?.textContent).toBe('Vos dates');
    expect(total()).toBe('805€');
    expect(
      screen
        .getByRole('button', { name: '01 Les dates' })
        .getAttribute('aria-current'),
    ).toBe('step');
    fireEvent.click(
      screen.getByRole('button', { name: 'La villa', exact: true }),
    );
    expect(
      screen
        .getByRole('button', { name: '02 La villa' })
        .getAttribute('aria-current'),
    ).toBe('step');
  });

  it('recalculates optional services, lets guests remove them and resets on template change', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: '03 Les extras' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Dîner pour deux/ }));
    expect(total()).toBe('396€');
    expect(
      screen
        .getByTestId('booking-direct-savings')
        .textContent?.replace(/\s/g, ''),
    ).toBe('90€');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Transfert aéroport/ }),
    );
    expect(total()).toBe('424€');
    expect(
      screen
        .getByTestId('booking-direct-savings')
        .textContent?.replace(/\s/g, ''),
    ).toBe('90€');
    fireEvent.click(screen.getByRole('checkbox', { name: /Dîner pour deux/ }));
    expect(total()).toBe('388€');
    fireEvent.click(
      screen.getByRole('button', { name: /Villa & séjour privé/ }),
    );
    expect(total()).toBe('720€');
    expect(
      screen
        .getByRole('button', { name: '01 Les dates' })
        .getAttribute('aria-current'),
    ).toBe('step');
    fireEvent.click(
      screen.getByRole('button', { name: /Conciergerie & collection/ }),
    );
    expect(total()).toBe('540€');
    expect(
      screen
        .getByRole('button', { name: '01 Les dates' })
        .getAttribute('aria-current'),
    ).toBe('step');
  });

  it('selects the full extras catalogue, retains it through payment and can continue without extras', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    fireEvent.click(screen.getByRole('button', { name: '03 Les extras' }));
    const options = screen.getAllByRole('checkbox');
    expect(options).toHaveLength(6);
    options.forEach((option) => fireEvent.click(option));
    expect(total()).toBe('714€');
    expect(screen.getByText('6 services sélectionnés')).toBeTruthy();
    expect(
      screen
        .getByTestId('booking-extras-subtotal')
        .textContent?.replace(/\s/g, ''),
    ).toBe('+354€');
    fireEvent.click(screen.getByRole('checkbox', { name: /Dîner pour deux/ }));
    expect(total()).toBe('678€');
    expect(
      screen
        .getByTestId('booking-direct-savings')
        .textContent?.replace(/\s/g, ''),
    ).toBe('90€');
    fireEvent.click(screen.getByRole('button', { name: 'Passer au paiement' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Utiliser le voyageur d’exemple' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Utiliser la carte de démonstration',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Payer 678/ }));
    tick(1600);
    expect(screen.getByText('BT-DEMO-001')).toBeTruthy();
    expect(total()).toBe('678€');
    fireEvent.click(screen.getByRole('button', { name: '03 Les extras' }));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(5);
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuer sans extras' }),
    );
    expect(total()).toBe('360€');
    expect(screen.getByText('La dernière étape avant l’évasion.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '03 Les extras' }));
    expect(screen.getAllByRole('checkbox', { checked: false })).toHaveLength(6);
  });

  it('runs every journey in order and loops back to the first with a fresh cart', () => {
    renderDemo();
    expect(pointedButton()?.getAttribute('aria-label')).toBe(
      'Sélectionner La Suite Terrasse',
    );
    tick(2600);
    expect(total()).toBe('450€');
    tick(3200);
    expect(pointedButton()?.getAttribute('aria-label')).toContain(
      '12 octobre 2026',
    );
    tick(2400);
    expect(pointedButton()?.getAttribute('aria-label')).toContain(
      '15 octobre 2026',
    );
    tick(2400);
    expect(pointedButton()?.textContent).toContain('Confirmer mes dates');
    tick(3000);
    expect(pointedButton()?.textContent).toContain('Dîner pour deux');
    tick(2600);
    expect(total()).toBe('486€');
    expect(pointedButton()?.textContent).toContain('Départ tardif');
    tick(2600);
    expect(total()).toBe('531€');
    expect(screen.getByText('2 services sélectionnés')).toBeTruthy();
    expect(pointedButton()?.textContent).toContain('Passer au paiement');
    tick(3800);
    expect(screen.getByText('La dernière étape avant l’évasion.')).toBeTruthy();
    expect(pointedButton()?.getAttribute('aria-label')).toBe(
      'Utiliser le voyageur d’exemple',
    );
    expect(screen.getByRole('button', { name: /Payer 531/ })).toBeDisabled();
    tick(2400);
    expect(screen.getByText('Camille Martin')).toBeTruthy();
    expect(pointedButton()?.getAttribute('aria-label')).toBe(
      'Utiliser la carte de démonstration',
    );
    tick(2400);
    expect(pointedButton()?.textContent).toContain('Payer 531');
    tick(3200);
    expect(
      screen.getByRole('button', { name: 'Validation du paiement…' }),
    ).toBeDisabled();
    expect(pointedButton()).toBeUndefined();
    tick(1600);
    expect(screen.getByText('Votre réservation est confirmée.')).toBeTruthy();
    expect(screen.getByText('BT-DEMO-001')).toBeTruthy();
    expect(pointedButton()?.textContent).toContain('Découvrir Villa Naya');
    expect(
      screen.getByRole('button', { name: 'Mettre en pause' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rejouer/ })).toBeNull();
    tick(4800);
    expect(
      screen
        .getByRole('button', { name: '01 Les dates' })
        .getAttribute('aria-current'),
    ).toBe('step');
    expect(total()).toBe('720€');
    for (const delay of journeyDelays.slice(0, -1)) tick(delay);
    expect(screen.getByText('BT-DEMO-002')).toBeTruthy();
    expect(total()).toBe('833€');
    tick(4800);
    expect(
      screen
        .getByRole('button', { name: '01 Les dates' })
        .getAttribute('aria-current'),
    ).toBe('step');
    expect(total()).toBe('540€');
    for (const delay of journeyDelays.slice(0, -1)) tick(delay);
    expect(screen.getByText('BT-DEMO-003')).toBeTruthy();
    expect(total()).toBe('445€');
    tick(4800);
    expect(total()).toBe('360€');
    expect(
      screen
        .getByRole('button', { name: '01 La chambre' })
        .getAttribute('aria-current'),
    ).toBe('step');
  });

  it('suspends outside the viewport and preserves the cart when paused', () => {
    renderDemo();
    act(() =>
      intersection(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    tick(20000);
    expect(pointedButton()).toBeUndefined();
    expect(
      screen
        .getByRole('button', { name: '01 La chambre' })
        .getAttribute('aria-current'),
    ).toBe('step');
    act(() =>
      intersection(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    for (const delay of [2600, 3200, 2400, 2400, 3000, 2600]) tick(delay);
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    tick(20000);
    expect(total()).toBe('486€');
    expect(screen.queryByText('Votre réservation est confirmée.')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Reprendre le parcours' }),
    );
    expect(total()).toBe('486€');
    tick(2600);
    expect(total()).toBe('531€');
    tick(3800);
    expect(screen.getByText('La dernière étape avant l’évasion.')).toBeTruthy();
    for (const delay of [2400, 2400, 3200, 1600]) tick(delay);
    expect(screen.getByText('Votre réservation est confirmée.')).toBeTruthy();
    // Pausing on the final step also resumes there, without restarting the journey.
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    tick(20000);
    expect(total()).toBe('531€');
    fireEvent.click(
      screen.getByRole('button', { name: 'Reprendre le parcours' }),
    );
    tick(4800);
    expect(total()).toBe('720€');
  });

  it('keeps playing after manual exploration and suspends while the browser tab is hidden', () => {
    renderDemo();
    fireEvent.click(
      screen.getByRole('button', { name: /Villa & séjour privé/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '03 Les extras' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Départ tardif/ }));
    tick(2600);
    expect(total()).toBe('850€');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    tick(20000);
    expect(screen.queryByText('La dernière étape avant l’évasion.')).toBeNull();
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    tick(2600);
    tick(3800);
    expect(screen.getByText('La dernière étape avant l’évasion.')).toBeTruthy();
    expect(total()).toBe('878€');
  });

  it('keeps manual exploration available with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderDemo();
    tick(30000);
    expect(
      screen.queryByRole('button', { name: 'Mettre en pause' }),
    ).toBeNull();
    expect(
      screen
        .getByRole('button', { name: '01 La chambre' })
        .getAttribute('aria-current'),
    ).toBe('step');
    fireEvent.click(screen.getByRole('button', { name: '03 Les extras' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Dîner pour deux/ }));
    expect(total()).toBe('396€');
    expect(pointedButton()).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Passer au paiement' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Utiliser le voyageur d’exemple' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Utiliser la carte de démonstration',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Payer 396/ }));
    tick(1600);
    expect(screen.getByText('Votre réservation est confirmée.')).toBeTruthy();
    tick(10000);
    expect(screen.getByText('BT-DEMO-001')).toBeTruthy();
  });

  it('completes a manually submitted demo payment while paused, without a network request', () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    fireEvent.click(screen.getByRole('button', { name: '04 Le paiement' }));
    expect(screen.getByRole('button', { name: /Payer 360/ })).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Utiliser le voyageur d’exemple' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Utiliser la carte de démonstration',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Payer 360/ }));
    tick(1599);
    expect(screen.queryByText('Votre réservation est confirmée.')).toBeNull();
    tick(1);
    expect(screen.getByText('BT-DEMO-001')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Reprendre le parcours' }),
    ).toBeTruthy();
    expect(total()).toBe('360€');
    expect(request).not.toHaveBeenCalled();
  });
});
