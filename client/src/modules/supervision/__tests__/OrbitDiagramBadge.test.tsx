// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
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

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
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

  it('ouvre la bulle depuis la pastille et laisse le temps de rejoindre son contenu', () => {
    vi.useFakeTimers();
    const { container } = open();
    const node = container.querySelector('[data-agent="ops"]')!;
    fireEvent.pointerEnter(node, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(180));
    const bubble = screen.getByRole('tooltip');
    expect(node.getAttribute('data-bubble-open')).toBe('true');
    expect(node.getAttribute('aria-describedby')).toBe(bubble.id);
    expect(bubble.textContent).toContain('6 à valider');
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    fireEvent.pointerLeave(node, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(80));
    fireEvent.pointerEnter(bubble, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('tooltip')).toBe(bubble);
    fireEvent.pointerLeave(bubble, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(140));
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(node.hasAttribute('data-bubble-open')).toBe(false);
  });

  it('ouvre les informations au clavier et ferme avec Échap sans sélectionner', () => {
    const onSelect = vi.fn();
    const { container } = render(<OrbitDiagram agents={agents} selected="ops" onSelect={onSelect} flowEnabled={false} />);
    const node = container.querySelector('[data-agent="rev"]')!;
    fireEvent.focus(node);
    expect(screen.getByRole('tooltip').textContent).toContain('Agent Revenue');
    fireEvent.keyDown(node, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.focus(node);
    fireEvent.click(node);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onSelect).toHaveBeenCalledWith('rev');
  });

  it('termine la rotation même si les tâches changent pendant le mouvement', () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    const props = { onSelect: () => {}, flowEnabled: true, onHeadAgentSettled: onSettled };
    const { rerender, container } = render(<OrbitDiagram {...props} agents={agents} selected="ops" />);
    rerender(<OrbitDiagram {...props} agents={agents} selected="rev" />);
    expect(onSettled).toHaveBeenLastCalledWith(null);
    expect(container.querySelector('[data-receiving]')).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    rerender(<OrbitDiagram {...props} agents={agents.map((agent) => ({ ...agent, task: 'Mise à jour' }))} selected="rev" />);
    act(() => vi.advanceTimersByTime(450));
    expect(onSettled).toHaveBeenLastCalledWith('rev');
    expect(container.querySelector('.oc-flow[data-selected]')).not.toBeNull();
    expect(container.querySelector('[data-agent="rev"] [data-receiving]')).not.toBeNull();
    expect(container.querySelector('[data-agent="ops"] [data-receiving]')).toBeNull();
  });

  it('stabilise immédiatement la sélection lorsque les animations sont réduites', () => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      ...media, media: query, matches: query === '(prefers-reduced-motion: reduce)',
    })));
    const onSettled = vi.fn();
    const props = { agents, onSelect: () => {}, flowEnabled: true, onHeadAgentSettled: onSettled };
    const { rerender, container } = render(<OrbitDiagram {...props} selected="ops" />);
    onSettled.mockClear();
    rerender(<OrbitDiagram {...props} selected="rev" />);
    expect(onSettled).toHaveBeenLastCalledWith('rev');
    expect(onSettled).not.toHaveBeenCalledWith(null);
    expect(container.querySelector('[data-receiving]')).toBeNull();
  });

  it('retire les rotations des portraits stabilisés sans déplacer le point de raccord', () => {
    vi.useFakeTimers();
    const props = { agents, onSelect: () => {}, flowEnabled: true };
    const { container, rerender } = render(<OrbitDiagram {...props} selected="ops" />);
    const ring = container.querySelector<HTMLElement>('.oc-ring')!;
    const node = (id: string) => container.querySelector(`[data-agent="${id}"]`)!.closest<HTMLElement>('.oc-node')!;
    const initialPoint = { x: parseFloat(node('ops').style.left), y: parseFloat(node('ops').style.top) };
    expect(ring.style.transform).toBe('none');
    expect(node('ops').style.transform).toBe('none');

    rerender(<OrbitDiagram {...props} selected="rev" />);
    expect(container.querySelector('[data-rotating]')).not.toBeNull();
    expect(container.querySelector('[data-receiving]')).toBeNull();
    act(() => vi.advanceTimersByTime(650));
    expect(ring.style.transform).toBe('none');
    expect(node('rev').style.transform).toBe('none');
    expect(node('ops').style.transform).toBe('none');
    expect(parseFloat(node('rev').style.left)).toBeCloseTo(initialPoint.x);
    expect(parseFloat(node('rev').style.top)).toBeCloseTo(initialPoint.y);
    expect(container.querySelector('[data-agent="rev"] [data-receiving]')).not.toBeNull();

    // A quick change of mind must also release the composited rotation layers.
    rerender(<OrbitDiagram {...props} selected="ops" />);
    act(() => vi.advanceTimersByTime(200));
    rerender(<OrbitDiagram {...props} selected="rev" />);
    act(() => vi.advanceTimersByTime(650));
    expect(ring.style.transform).toBe('none');
    expect(node('rev').style.transform).toBe('none');
    expect(parseFloat(node('rev').style.left)).toBeCloseTo(initialPoint.x);
    expect(parseFloat(node('rev').style.top)).toBeCloseTo(initialPoint.y);
  });

  it('charge une vidéo uniquement pour l’agent aligné et la décharge en pause', () => {
    const { container, rerender } = render(
      <OrbitDiagram agents={agents} selected="ops" onSelect={() => {}} flowEnabled />,
    );
    expect(container.querySelectorAll('[data-receiving]')).toHaveLength(1);
    fireEvent.load(container.querySelector('[data-agent="ops"] img')!);
    const portrait = container.querySelector<HTMLVideoElement>('[data-agent="ops"] video')!;
    expect(portrait.getAttribute('src')).toBe('/images/supervision-agents/ops.webm?v=clean-2');
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('[data-agent="rev"] [data-receiving]')).toBeNull();
    rerender(<OrbitDiagram agents={agents} selected="ops" onSelect={() => {}} flowEnabled={false} />);
    expect(container.querySelector('[data-receiving]')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it('anime le logo officiel de l’orchestrateur seulement pendant les transmissions', () => {
    const { container, rerender } = render(
      <OrbitDiagram agents={agents} selected="ops" onSelect={() => {}} flowEnabled />,
    );
    const logoPaths = () => container.querySelectorAll('[data-core] .baitly-orbit-mark svg > path');
    expect(container.querySelector('[data-core]')?.getAttribute('aria-label')).toBe('Orchestrateur');
    expect(logoPaths()).toHaveLength(3); // Brand outline and its two moving packets.
    rerender(<OrbitDiagram agents={agents} selected="ops" onSelect={() => {}} flowEnabled={false} />);
    expect(logoPaths()).toHaveLength(1);
    expect(screen.queryByText('Orchestrateur')).toBeNull();
  });

  it('arrête le portrait et le relais dans un onglet masqué, puis les reprend', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const onSettled = vi.fn();
    const { container } = render(
      <OrbitDiagram agents={agents} selected="ops" onSelect={() => {}} flowEnabled onHeadAgentSettled={onSettled} />,
    );
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.querySelector('[data-receiving]')).toBeNull();
    expect(container.querySelector('.oc-flow[data-selected]')).toBeNull();
    expect(container.querySelectorAll('.baitly-orbit-mark svg > path')).toHaveLength(1);
    expect(onSettled).toHaveBeenLastCalledWith(null);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.querySelector('[data-agent="ops"] [data-receiving]')).not.toBeNull();
    expect(onSettled).toHaveBeenLastCalledWith('ops');
  });

  it('garde une identité et un bouton accessibles si le portrait ne charge pas', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <OrbitDiagram agents={agents} selected="ops" onSelect={onSelect} flowEnabled />,
    );
    const button = container.querySelector<HTMLButtonElement>('[data-agent="rev"]')!;
    fireEvent.error(button.querySelector('img')!);
    expect(button.querySelector('img')).toBeNull();
    expect(button.querySelector('.baitly-agent-portrait svg')).not.toBeNull();
    expect(button.getAttribute('aria-label')).toContain('Revenue');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith('rev');
  });
});
