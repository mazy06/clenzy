// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentConstellation } from '../components/AgentConstellation';
import { buildPropertySnapshot, buildPortfolioSnapshot } from '../provider/mockData';
import { applyStreamEvent } from '../core/applyStreamEvent';
import type { OrchestratorSnapshot } from '../types';

// jsdom n'implémente pas getTotalLength (utilisé par le rendu SVG framer-motion).
beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
  if (!proto.getTotalLength) proto.getTotalLength = () => 100;
});

describe('<AgentConstellation> (par logement)', () => {
  it('rend 5 satellites, le cœur et le canvas', () => {
    const { container } = render(<AgentConstellation snapshot={buildPropertySnapshot('1')} />);
    expect(container.querySelectorAll('[data-agent]')).toHaveLength(5);
    expect(container.querySelector('[data-core]')).toBeTruthy();
    expect(container.querySelector('[data-supervision-constellation]')).toBeTruthy();
  });

  it('affiche les noms d’agents traduits (FR)', () => {
    render(<AgentConstellation snapshot={buildPropertySnapshot('1')} />);
    expect(screen.getAllByText('Communication').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0);
  });

  it('marque l’agent en attente avec data-status="wait"', () => {
    const { container } = render(<AgentConstellation snapshot={buildPropertySnapshot('1')} />);
    expect(container.querySelectorAll('[data-status="wait"]')).toHaveLength(1);
  });

  it('ne révèle aucun jargon technique (texte visible uniquement)', () => {
    const { container } = render(<AgentConstellation snapshot={buildPropertySnapshot('1')} />);
    // On juge le texte VISIBLE : exclure <style>/<script> (les noms de classes
    // CSS ne sont pas à l'écran — ex. l'animation du logo contient "node").
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('style, script').forEach((n) => n.remove());
    const txt = (clone.textContent || '').toLowerCase();
    for (const jargon of ['node', 'edge', 'interrupt', 'checkpoint', 'token', 'prompt', 'langgraph']) {
      expect(txt).not.toContain(jargon);
    }
  });
});

describe('<AgentConstellation> (portefeuille)', () => {
  it('porte un badge (nb de logements) sur les agents concernés', () => {
    const { container } = render(<AgentConstellation snapshot={buildPortfolioSnapshot()} />);
    // com=3, rev=3, ops=2, fin=1, rep=0 → 4 badges (> 0)
    expect(container.querySelectorAll('.sat__badge')).toHaveLength(4);
  });
});

describe('<AgentConstellation> — états escaladé / erreur', () => {
  it('met les satellites esc/err en avant (non atténués) + faisceau coloré', () => {
    let snap = buildPropertySnapshot('1');
    snap = applyStreamEvent(snap, { type: 'agent.status', agentId: 'fin', status: 'esc' }) as OrchestratorSnapshot;
    snap = applyStreamEvent(snap, { type: 'agent.status', agentId: 'rep', status: 'err' }) as OrchestratorSnapshot;
    const { container } = render(<AgentConstellation snapshot={snap} />);
    expect(container.querySelector('[data-status="esc"]')?.className).toContain('on');
    expect(container.querySelector('[data-status="err"]')?.className).toContain('on');
    expect(container.querySelector('.wire.esc')).toBeTruthy();
    expect(container.querySelector('.wire.err')).toBeTruthy();
  });
});

describe('<AgentConstellation> — accessibilité', () => {
  it('expose un groupe étiqueté, des satellites aria, un cœur basculable', () => {
    const { container } = render(<AgentConstellation snapshot={buildPropertySnapshot('1')} />);
    expect(container.querySelector('[role="group"]')).toBeTruthy();
    const com = container.querySelector('[data-agent="com"]')!;
    expect(com.getAttribute('aria-label')).toMatch(/Communication/);
    expect(com.getAttribute('aria-describedby')).toBe('sat-tip-com');
    const core = container.querySelector('[data-core]')!;
    expect(core.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(core);
    expect(core.getAttribute('aria-pressed')).toBe('true');
  });
});
