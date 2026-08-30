// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { renderWithProviders as render, screen, waitFor, act, fireEvent } from '../../../test/renderWithProviders';
import { SupervisionPanel } from '../components/SupervisionPanel';
import { MockSupervisionProvider } from '../provider/MockSupervisionProvider';
import { MOCK_RESERVATION_LEA_MARCHAND } from '../provider/mockData';

// jsdom n'implémente pas getTotalLength (rendu SVG framer-motion).
beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

// Les comètes sont ajoutées à document.body hors React → nettoyage explicite.
afterEach(() => {
  document.querySelectorAll('.supervision-comet').forEach((n) => n.remove());
});

describe('<SupervisionPanel>', () => {
  it('affiche le skeleton de chargement puis la constellation', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 40 });
    const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
    expect(container.querySelector('[data-supervision-skeleton]')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('[data-supervision-constellation]')).toBeTruthy());
  });

  it('affiche le chip de reconnexion en cas de perte de connexion', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
    await waitFor(() => expect(container.querySelector('[data-supervision-constellation]')).toBeTruthy());
    act(() => provider.simulateConnection(false));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy());
  });

  it('affiche la file HITL et la valide (la carte disparaît)', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
    await waitFor(() => expect(container.querySelector('[data-pending-action]')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(container.querySelector('[data-pending-action]')).toBeNull());
  });

  it('action traitée par un autre opérateur → bandeau de conflit', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
    await waitFor(() => expect(container.querySelector('[data-pending-action]')).toBeTruthy());
    const id = container.querySelector('[data-pending-action]')!.getAttribute('data-pending-action')!;
    act(() => provider.simulateResolvedByOther(id, 'Alex'));
    await waitFor(() => expect(screen.getByText(/Alex/)).toBeTruthy());
    expect(container.querySelector('[data-pending-action]')).toBeNull();
  });

  it('valider lance une comète vers la cellule de planning (data-reservation-id)', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    // cellule cible présente dans le document (comme une brique du planning)
    const cell = document.createElement('div');
    cell.setAttribute('data-reservation-id', MOCK_RESERVATION_LEA_MARCHAND);
    document.body.appendChild(cell);

    const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
    await waitFor(() => expect(container.querySelector('[data-pending-action]')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(document.querySelector('.supervision-comet')).toBeTruthy();

    cell.remove();
  });

  /**
   * Le tiroir d'agent est une affordance de l'affichage ÉTROIT : en large, les
   * cartes de l'agent vivent déjà dans la colonne de droite, et cliquer un
   * satellite ne fait que le désigner dans le diagramme.
   *
   * <p>Ce test rendait à la largeur par défaut — donc en large — et attendait
   * le tiroir. Il ne pouvait pas passer : jsdom ne mesure rien, `clientWidth`
   * vaut 0, et le panneau retombe sur l'affichage large. Il faut donner une
   * largeur au panneau pour atteindre l'étroit.</p>
   */
  const withPanelWidth = (px: number) => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => px });
    return () => {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    };
  };

  it('étroit — clic satellite → tiroir de l’agent (métriques)', async () => {
    const restore = withPanelWidth(480);
    try {
      const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
      const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
      await waitFor(() => expect(container.querySelector('[data-agent="com"]')).toBeTruthy());
      fireEvent.click(container.querySelector('[data-agent="com"]')!);
      await waitFor(() => expect(screen.getByText('messages traités')).toBeTruthy());
    } finally {
      restore();
    }
  });

  it('large — clic satellite : pas de tiroir, l’agent est désigné dans le diagramme', async () => {
    const onSelectAgent = vi.fn();
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const { container } = render(
      <SupervisionPanel createProvider={() => provider} deps={['1']} onSelectAgent={onSelectAgent} />,
    );
    await waitFor(() => expect(container.querySelector('[data-agent="com"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-agent="com"]')!);

    await waitFor(() => expect(onSelectAgent).toHaveBeenCalledWith('com'));
    // La file de l'agent est déjà à l'écran, en colonne : un tiroir par-dessus
    // ne montrerait rien de plus.
    expect(screen.queryByText('messages traités')).toBeNull();
  });

  it('chaîne complète : interruption → validation → reprise (rev agit) → comète', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const cell = document.createElement('div');
    cell.setAttribute('data-reservation-id', MOCK_RESERVATION_LEA_MARCHAND);
    document.body.appendChild(cell);

    const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['1']} />);
    // interruption : une action attend, l'agent rev est en attente
    await waitFor(() => expect(container.querySelector('[data-pending-action]')).toBeTruthy());
    expect(container.querySelector('[data-agent="rev"]')?.getAttribute('data-status')).toBe('wait');

    // validation
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
    // comète émise de façon synchrone vers la cellule
    expect(document.querySelector('.supervision-comet')).toBeTruthy();

    // reprise : l'action quitte la file, rev passe « agit »
    await waitFor(() => expect(container.querySelector('[data-pending-action]')).toBeNull());
    expect(container.querySelector('[data-agent="rev"]')?.getAttribute('data-status')).toBe('act');

    cell.remove();
  });

  it('état repos (aucune action en attente) : pas de carte de validation', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 }, 'calm');
    const { container } = render(<SupervisionPanel createProvider={() => provider} deps={['calm']} />);
    await waitFor(() => expect(container.querySelector('[data-supervision-constellation]')).toBeTruthy());
    expect(container.querySelector('[data-pending-action]')).toBeNull();
  });
});
