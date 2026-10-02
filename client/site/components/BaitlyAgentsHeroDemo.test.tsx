import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyAgentsHeroDemo, { agentsDemoRate } from './BaitlyAgentsHeroDemo';
import { AgentsConstellation } from '../pages/BaitlyAgentsPage';

let intersection: IntersectionObserverCallback;
let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {}
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
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const visibility = (visible: boolean) =>
  act(() =>
    intersection(
      [{ isIntersecting: visible } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
const openStock = () => {
  fireEvent.click(
    within(
      screen.getByRole('group', { name: 'Essayez une décision' }),
    ).getByRole('button', { name: 'Opérations' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Commander', exact: true }),
  );
};

describe('Agents product page decisions', () => {
  it('stops at the human decision, pauses offscreen and never approves automatically', () => {
    const { container } = render(<BaitlyAgentsHeroDemo language="fr" />);
    tick(10000);
    expect(
      container.querySelector('.bap-demo-stages [data-active]'),
    ).toHaveTextContent('Détection');
    visibility(true);
    tick(2600);
    expect(
      container.querySelector('.bap-demo-stages [data-active]'),
    ).toHaveTextContent('Proposition');
    visibility(false);
    tick(10000);
    expect(
      container.querySelector('.bap-demo-stages [data-active]'),
    ).toHaveTextContent('Proposition');
    visibility(true);
    tick(2600);
    tick(20000);
    expect(
      container.querySelector('.bap-demo-stages [data-active]'),
    ).toHaveTextContent('Votre décision');
    expect(
      screen.getByRole('button', { name: 'Ajuster les tarifs' }),
    ).toBeEnabled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(
      screen.getByText('Votre prochaine décision apparaîtra ici.'),
    ).toBeInTheDocument();
  });

  it('keeps the price floor and applies the reviewed adjustment only on confirmation', () => {
    const { container } = render(<BaitlyAgentsHeroDemo language="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajuster les tarifs' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '25' } });
    expect(agentsDemoRate(25)).toBe(680);
    expect(
      within(screen.getByRole('dialog')).getAllByLabelText(
        '680 Dirham marocain',
      ),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ajuster les tarifs' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '10' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer dans la démo' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ajustement des 3 créneaux simulé.',
    );
    expect(container.querySelectorAll('.baitly-revenue-change')).toHaveLength(
      3,
    );
    expect(
      Array.from(container.querySelectorAll('.baitly-revenue-change')).every(
        (node) => node.textContent === '−10 %',
      ),
    ).toBe(true);
  });

  it('rejects invalid order quantities and shows the confirmed quantity', () => {
    render(<BaitlyAgentsHeroDemo language="fr" />);
    openStock();
    const input = screen.getByRole('spinbutton');
    const confirm = screen.getByRole('button', {
      name: 'Confirmer dans la démo',
    });
    for (const value of ['', '0', '-1', '1.5', '1000']) {
      fireEvent.change(input, { target: { value } });
      expect(confirm).toBeDisabled();
    }
    fireEvent.change(input, { target: { value: '6' } });
    fireEvent.click(confirm);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('6 boîtes')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Envoi du bon de commande simulé.',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Rejouer ce scénario' }),
    );
    expect(screen.getByText('4 boîtes')).toBeInTheDocument();
  });

  it('requires an explicit review response and retains the edited text', () => {
    render(<BaitlyAgentsHeroDemo language="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Avis & Réputation' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Répondre', exact: true }),
    );
    expect(
      screen.getByRole('button', { name: 'Confirmer dans la démo' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Insérer le brouillon' }),
    );
    expect(
      (screen.getByRole('textbox') as HTMLTextAreaElement).value,
    ).toContain('Merci Lina');
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Merci Lina, à bientôt au riad !' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer dans la démo' }),
    );
    expect(
      screen.getByText('Merci Lina, à bientôt au riad !'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Publication de la réponse simulée.',
    );
  });

  it('keeps decisions separate across scenarios and records dismissals without running an action', () => {
    render(<BaitlyAgentsHeroDemo language="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ignorer' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Aucune action exécutée',
    );
    expect(screen.getByText('Ignoré par vous')).toBeInTheDocument();
    openStock();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Revenue', exact: true }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Aucune action exécutée',
    );
  });

  it('remains interactive with reduced motion without playing the timeline', () => {
    reduced = true;
    const { container } = render(<BaitlyAgentsHeroDemo language="fr" />);
    visibility(true);
    tick(20000);
    expect(container.querySelector('.bap-signal')).not.toHaveAttribute(
      'data-running',
    );
    expect(
      screen.getByRole('button', { name: 'Lire la démonstration' }),
    ).toBeDisabled();
    openStock();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('PMS autonomy boundaries', () => {
  it('limits each agent to the actual allowed modes and remembers demo choices', () => {
    render(<AgentsConstellation language="fr" />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: 'Automatique' }));
    const agents = within(
      screen.getByRole('group', { name: 'Choisir un agent' }),
    );
    fireEvent.click(agents.getByRole('button', { name: 'Revenue' }));
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByRole('radio', { name: 'Automatique' })).toBeNull();
    for (const name of [
      'Conformité',
      'Propriétaire',
      'Voyageur',
      'Croissance',
      'Synchronisation',
    ]) {
      fireEvent.click(agents.getByRole('button', { name }));
      expect(screen.getAllByRole('radio')).toHaveLength(1);
      expect(
        screen.getByText('Validation humaine obligatoire pour cet agent.'),
      ).toBeInTheDocument();
    }
    fireEvent.click(agents.getByRole('button', { name: 'Opérations' }));
    expect(screen.getByRole('radio', { name: 'Automatique' })).toBeChecked();
  });
});
