// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SupervisionView } from '../components/SupervisionView';
import { MockSupervisionProvider, MockPortfolioProvider } from '../provider/MockSupervisionProvider';

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

describe('<SupervisionView> — bascule de portée', () => {
  it('par logement par défaut, bascule vers la vue d’ensemble puis revient', async () => {
    const { container } = render(
      <SupervisionView
        propertyId="demo"
        createPropertyProvider={() => new MockSupervisionProvider('demo', { latencyMs: 0 })}
        createPortfolioProvider={() => new MockPortfolioProvider({ latencyMs: 0 })}
      />,
    );

    // Par logement : constellation, pas de journal portefeuille.
    await waitFor(() => expect(container.querySelector('[data-supervision-constellation]')).toBeTruthy());
    expect(container.querySelector('[data-activity-feed]')).toBeNull();

    // → Vue d'ensemble : journal portefeuille + file multi-logements.
    fireEvent.click(screen.getByText("Vue d'ensemble"));
    await waitFor(() => expect(container.querySelector('[data-activity-feed]')).toBeTruthy());
    expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(1);

    // → retour Par logement.
    fireEvent.click(screen.getByText('Par logement'));
    await waitFor(() => expect(container.querySelector('[data-activity-feed]')).toBeNull());
  });
});
