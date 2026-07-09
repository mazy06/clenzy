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

    // Par logement (showcase) : constellation présente + 1 seule carte à valider.
    await waitFor(() => expect(container.querySelector('[data-supervision-constellation]')).toBeTruthy());
    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBe(1));

    // → Vue d'ensemble : file multi-logements (plusieurs cartes à valider).
    // Libellés icône-seule → sélection par aria-label.
    fireEvent.click(screen.getByRole('button', { name: "Vue d'ensemble" }));
    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(1));

    // → retour Par logement : de nouveau une seule carte.
    fireEvent.click(screen.getByRole('button', { name: 'Par logement' }));
    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBe(1));
  });
});
