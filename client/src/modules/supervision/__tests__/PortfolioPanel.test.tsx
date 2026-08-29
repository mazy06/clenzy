// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderWithProviders as render, screen, waitFor, fireEvent } from '../../../test/renderWithProviders';
import { PortfolioPanel } from '../components/PortfolioPanel';
import { MockPortfolioProvider } from '../provider/MockSupervisionProvider';

/**
 * La vue d'ensemble répond à « où dois-je agir ? ».
 *
 * <p>Elle ne déverse plus toutes les cartes du parc côte à côte : à gauche les
 * logements, triés par ce qui presse ; à droite, celui qui est ouvert. Ces
 * tests décrivaient l'écran d'avant cette refonte et échouaient depuis —
 * ils affirmaient trois cartes visibles là où le parc en montre une par
 * logement.</p>
 */

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

const open = () => {
  const provider = new MockPortfolioProvider({ latencyMs: 0 });
  return render(<PortfolioPanel createProvider={() => provider} deps={['portfolio']} />);
};

describe('<PortfolioPanel>', () => {
  it('rend la liste des logements et, sous son onglet, le journal', async () => {
    // Deux choses ont changé avec la refonte : la constellation a quitté cet
    // écran — le parc y est un tableau de bord, pas un diagramme — et le
    // journal est passé derrière un onglet. L'ancienne version les cherchait
    // toutes deux au premier rendu.
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    expect(container.querySelectorAll('[aria-current]').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: 'Activité' }));
    await waitFor(() => expect(container.querySelector('[data-activity-feed]')).toBeTruthy());
  });

  it('n’ouvre qu’un logement à la fois, et montre SES cartes', async () => {
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    // Le parc a trois décisions sur trois logements distincts. En afficher
    // trois ensemble reviendrait à ne plus savoir laquelle concerne quoi.
    expect(container.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });

  it('ouvrir un autre logement change les cartes affichées', async () => {
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    const first = container.querySelector('[data-pending-action]')!.getAttribute('data-pending-action');

    fireEvent.click(container.querySelector('[aria-current="false"]')!);

    await waitFor(() => {
      const next = container.querySelector('[data-pending-action]')?.getAttribute('data-pending-action');
      expect(next).not.toBe(first);
    });
  });

  it('filtrer par agent ne garde que les logements où il a quelque chose', async () => {
    const { container } = open();

    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBeGreaterThan(0));
    const before = container.querySelectorAll('[aria-current]').length;

    // « Revenue » n'a de décisions que sur deux des trois logements en attente.
    fireEvent.click(screen.getByRole('button', { name: /Revenue/ }));

    await waitFor(() => expect(container.querySelectorAll('[aria-current]').length).toBeLessThan(before));
  });
});
