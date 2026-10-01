// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { renderWithProviders as render, screen, act, fireEvent } from '../../../test/renderWithProviders';
import { OrbitDiagram } from '../renderers/OrbitDiagram';
import type { ConstellationAgentView } from '../renderers/ConstellationRenderer';

/**
 * Le compte d'actions se lit sur la PASTILLE du nœud, jamais en texte.
 *
 * <p>La légende affichait « 6 à valider » sous un nœud qui portait déjà « 6 » :
 * la même information deux fois, et surtout à la place de l'état de l'agent —
 * la seule chose que la pastille ne sait pas dire.</p>
 */

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const agents: ConstellationAgentView[] = [
  { id: 'ops', status: 'wait', autonomy: 'notify', task: null, pendingCount: 6 },
  { id: 'rev', status: 'act', autonomy: 'notify', task: null, pendingCount: 0 },
];

const open = (selected: 'ops' | null = 'ops') =>
  render(
    <OrbitDiagram agents={agents} selected={selected} onSelect={() => {}} flowEnabled={false} />,
  );

describe('<OrbitDiagram> — le compte des actions', () => {
  it('n’écrit jamais « N à valider » sous un agent', () => {
    open();
    expect(screen.queryByText(/à valider/)).toBeNull();
  });

  it('porte le compte en pastille sur le nœud', () => {
    const { container } = open();
    const node = container.querySelector('[data-agent="ops"]')!;
    expect(node.textContent).toContain('6');
  });

  it('n’écrit pas non plus « Attend ta validation » : la pastille le dit', () => {
    open();
    // Deux façons d'écrire le même nombre sous un nœud qui l'affiche déjà.
    expect(screen.queryByText('Attend ta validation')).toBeNull();
  });

  it('nomme les états que la pastille ne sait pas dire', () => {
    render(
      <OrbitDiagram
        agents={[{ id: 'rev', status: 'act', autonomy: 'notify', task: null, pendingCount: 0 }]}
        selected="rev"
        onSelect={() => {}}
        flowEnabled={false}
      />,
    );
    expect(screen.getAllByText('Agit').length).toBeGreaterThan(0);
  });

  it('donne le compte au lecteur d’écran, qui ne voit pas la pastille', () => {
    const { container } = open();
    const node = container.querySelector('[data-agent="ops"]')!;
    expect(node.getAttribute('aria-label')).toContain('6 à valider');
  });

  it('ne pose aucune pastille sur un agent sans action', () => {
    const { container } = open();
    const node = container.querySelector('[data-agent="rev"]')!;
    expect(node.textContent).not.toContain('0');
  });

  it('distingue les logements du portefeuille et conserve le compte exact accessible', () => {
    const { container } = render(
      <OrbitDiagram agents={[{ ...agents[0], badge: 125 }]} selected="ops" onSelect={() => {}} flowEnabled />,
    );
    const node = container.querySelector('[data-agent="ops"]')!;
    expect(node.querySelector('[data-kind="properties"]')?.textContent).toBe('99+');
    expect(node.getAttribute('aria-label')).toContain('125 logements');
    expect(node.getAttribute('aria-label')).toContain('6 à valider');
  });

  it('garde les agents sélectionnables quand les transmissions sont en pause', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <OrbitDiagram agents={agents} selected="ops" onSelect={onSelect} flowEnabled={false} />,
    );
    fireEvent.click(container.querySelector('[data-agent="rev"]')!);
    expect(onSelect).toHaveBeenCalledWith('rev');
    expect(container.querySelector('[data-animating]')).toBeNull();
    expect(container.querySelector('.oc-flow[data-selected]')).toBeNull();
  });

  it('termine la rotation même si les tâches changent pendant le mouvement', () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    const props = { onSelect: () => {}, flowEnabled: true, onHeadAgentSettled: onSettled };
    const { rerender, container } = render(<OrbitDiagram {...props} agents={agents} selected="ops" />);
    rerender(<OrbitDiagram {...props} agents={agents} selected="rev" />);
    expect(onSettled).toHaveBeenLastCalledWith(null);
    act(() => vi.advanceTimersByTime(200));
    rerender(<OrbitDiagram {...props} agents={agents.map((agent) => ({ ...agent, task: 'Mise à jour' }))} selected="rev" />);
    act(() => vi.advanceTimersByTime(450));
    expect(onSettled).toHaveBeenLastCalledWith('rev');
    expect(container.querySelector('.oc-flow[data-selected]')).not.toBeNull();
  });

  it('stabilise immédiatement la sélection lorsque les animations sont réduites', () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      ...media, media: query, matches: query === '(prefers-reduced-motion: reduce)',
    })));
    const onSettled = vi.fn();
    const props = { agents, onSelect: () => {}, flowEnabled: true, onHeadAgentSettled: onSettled };
    const { rerender } = render(<OrbitDiagram {...props} selected="ops" />);
    onSettled.mockClear();
    rerender(<OrbitDiagram {...props} selected="rev" />);
    expect(onSettled).toHaveBeenLastCalledWith('rev');
    expect(onSettled).not.toHaveBeenCalledWith(null);
  });
});
