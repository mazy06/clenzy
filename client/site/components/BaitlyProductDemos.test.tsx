import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AgentsDemo,
  DevicesDemo,
  FinanceDemo,
  OperationsDemo,
  OwnersDemo,
  RevenueDemo,
} from './BaitlyProductDemos';
import {
  demoNightlyPrices,
  demoOwnerStatement,
} from '../data/baitlyProductStories';
import { BAITLY_PRODUCT_DEMO_MESSAGES } from '../lib/messages/baitlyProductDemos';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';

afterEach(cleanup);

describe('Démonstrations des pages produit', () => {
  it('respecte le plancher dans chaque scénario et actualise les prix affichés', () => {
    for (const scenario of [0, 1, 2]) {
      for (const floor of [550, 800, 1000]) {
        expect(
          demoNightlyPrices(scenario, floor).every((price) => price >= floor),
        ).toBe(true);
      }
    }
    render(<RevenueDemo language="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Calme' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1000' } });
    const chart = screen.getByRole('group', {
      name: BAITLY_PRODUCT_DEMO_MESSAGES.fr.revenue.chart,
    });
    expect(
      within(chart).getAllByText('1 000', {
        normalizer: (text) => text.replace(/\s/g, ' '),
      }),
    ).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Calme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('recalcule le séjour et réinitialise la simulation au changement de marché', () => {
    render(<FinanceDemo language="en" />);
    expect(within(screen.getByRole('region', { name: 'Payment details' })).getByLabelText('2,550 Moroccan dirham')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate payment' }));
    expect(screen.getByText('Payment reconciled')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'France', exact: true }),
    );
    expect(within(screen.getByRole('region', { name: 'Payment details' })).getByLabelText('285 Euro')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Simulate payment' }),
    ).toBeEnabled();
    expect(screen.queryByText('Payment reconciled')).not.toBeInTheDocument();
  });

  it('conserve le règlement par dossier et par marché et actualise les indicateurs', () => {
    const { container } = render(<FinanceDemo language="en" />);
    const list = screen.getByRole('group', { name: 'Demo bookings' });
    const detail = screen.getByRole('region', { name: 'Payment details' });
    expect(container.querySelector('.site-demo-kpis')).toHaveTextContent('5,100');
    fireEvent.click(within(list).getByRole('button', { name: /BT-2410/ }));
    expect(within(detail).getByText('Payment reconciled')).toBeVisible();
    expect(within(detail).queryByRole('button', { name: 'Simulate payment' })).toBeNull();
    fireEvent.click(within(list).getByRole('button', { name: /BT-2409/ }));
    fireEvent.click(within(detail).getByRole('button', { name: 'Simulate payment' }));
    expect(container.querySelector('.site-demo-kpis')).toHaveTextContent('7,650');
    fireEvent.click(screen.getByRole('button', { name: 'France', exact: true }));
    expect(within(detail).getByRole('button', { name: 'Simulate payment' })).toBeEnabled();
    expect(within(detail).getByRole('img', { name: 'Stripe' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Morocco', exact: true }));
    expect(within(detail).getByText('Payment reconciled')).toBeVisible();
    expect(within(detail).getByText('Local provider to be selected')).toBeVisible();
    expect(container.querySelector('img[alt="Payzone"]')).toBeNull();
  });

  it.each(['fr', 'en', 'ar'] as const)(
    'exige les trois contrôles pour valider une mission en %s',
    (language) => {
      const m = BAITLY_PRODUCT_DEMO_MESSAGES[language];
      render(<OperationsDemo language={language} />);
      const action = screen.getByRole('button', { name: m.operations.action });
      expect(action).toBeDisabled();
      const checks = screen.getAllByRole('checkbox');
      fireEvent.click(checks[0]);
      fireEvent.click(checks[1]);
      expect(action).toBeDisabled();
      fireEvent.click(checks[2]);
      expect(action).toBeEnabled();
      fireEvent.click(action);
      expect(screen.getByText(m.operations.done)).toBeVisible();
      expect(checks.every((check) => check.hasAttribute('disabled'))).toBe(
        true,
      );
      fireEvent.click(screen.getByRole('button', { name: m.reset }));
      expect(
        screen.getByRole('button', { name: m.operations.action }),
      ).toBeDisabled();
      expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(
        0,
      );
    },
  );

  it('limite le pass actif à la période du séjour', () => {
    const m = BAITLY_PRODUCT_DEMO_MESSAGES.fr.devices;
    render(<DevicesDemo language="fr" />);
    expect(screen.getByRole('status')).toHaveTextContent(m.states[1]);
    for (const index of [0, 2, 1]) {
      fireEvent.click(
        screen.getByRole('button', { name: m.phases[index], exact: true }),
      );
      expect(screen.getByRole('status')).toHaveTextContent(m.states[index]);
    }
  });

  it('soustrait commission et dépenses et actualise le relevé mensuel', () => {
    expect(demoOwnerStatement(0)).toEqual({
      gross: 18400,
      commission: 3680,
      expenses: 1450,
      net: 13270,
    });
    render(<OwnersDemo language="en" />);
    expect(screen.getAllByText(/13,840/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'July' }));
    expect(screen.getAllByText(/13,270/)).toHaveLength(2);
    expect(screen.queryByText(/13,840/)).not.toBeInTheDocument();
  });

  it('demande une nouvelle validation à chaque proposition d’agent', () => {
    const m = MOCKUP_MESSAGES.fr.demo;
    render(<AgentsDemo language="fr" />);
    fireEvent.click(
      screen.getByRole('button', { name: m.scenarios[0].action }),
    );
    expect(screen.getByText(m.scenarios[0].done)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: m.scenarios[1].name, exact: true }),
    );
    expect(
      screen.getByRole('button', { name: m.scenarios[1].action }),
    ).toBeEnabled();
    expect(screen.queryByText(m.scenarios[0].done)).not.toBeInTheDocument();
  });
});
