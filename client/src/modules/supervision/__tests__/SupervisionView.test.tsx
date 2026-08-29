// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderWithProviders as render, screen, waitFor, fireEvent } from '../../../test/renderWithProviders';
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

    // → Vue d'ensemble. Elle ne déverse PLUS toutes les cartes du parc côte à
    // côte : elle liste les logements et ouvre le premier. Compter les cartes
    // ne distingue donc plus les deux portées — c'est la liste qui le fait.
    // Libellés icône-seule → sélection par aria-label.
    fireEvent.click(screen.getByRole('button', { name: "Vue d'ensemble" }));
    // `getAllByRole` recalcule le rôle de CHAQUE nœud de l'arbre à chaque
    // sondage : sur cette vue, la boucle d'attente dépassait les 5 s de
    // délai quand la suite tourne en parallèle. L'attribut se lit directement.
    await waitFor(() => expect(container.querySelectorAll('[aria-current]').length).toBeGreaterThan(1));
    // Chaque carte porte le logement dont elle vient : hors du parc, ce serait
    // une information de trop.
    expect(screen.getAllByText(/Duplex Marais/).length).toBeGreaterThan(0);

    // → retour Par logement : plus de liste de logements, une seule carte.
    fireEvent.click(screen.getByRole('button', { name: 'Par logement' }));
    await waitFor(() => expect(container.querySelectorAll('[data-pending-action]').length).toBe(1));
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0);
  });
});
