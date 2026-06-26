import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { maxPriorityStatus, isActiveStatus } from '../constants';
import { buildPropertySnapshot, buildPortfolioSnapshot } from '../provider/mockData';
import { MockSupervisionProvider, MockPortfolioProvider } from '../provider/MockSupervisionProvider';
import type { StreamEvent } from '../types';

describe('maxPriorityStatus', () => {
  it('respecte wait > act > think > veille', () => {
    expect(maxPriorityStatus(['veille', 'think', 'act'])).toBe('act');
    expect(maxPriorityStatus(['act', 'wait'])).toBe('wait');
    expect(maxPriorityStatus(['veille'])).toBe('veille');
    expect(maxPriorityStatus([])).toBe('veille');
  });

  it('escalade et erreur priment sur la validation', () => {
    expect(maxPriorityStatus(['wait', 'esc'])).toBe('esc');
    expect(maxPriorityStatus(['esc', 'err'])).toBe('err');
  });
});

describe('isActiveStatus', () => {
  it('act/think/wait sont actifs, veille non', () => {
    expect(isActiveStatus('act')).toBe(true);
    expect(isActiveStatus('think')).toBe(true);
    expect(isActiveStatus('wait')).toBe(true);
    expect(isActiveStatus('veille')).toBe(false);
  });
});

describe('buildPropertySnapshot (showcase)', () => {
  const snap = buildPropertySnapshot('42');

  it('expose 5 agents et le bon scope/propertyId', () => {
    expect(snap.scope).toBe('property');
    expect(snap.propertyId).toBe('42');
    expect(snap.agents).toHaveLength(5);
  });

  it('a exactement un agent en attente, relié à une action de la file', () => {
    const waiting = snap.agents.filter((a) => a.status === 'wait');
    expect(waiting).toHaveLength(1);
    expect(snap.pending).toHaveLength(1);
    expect(snap.pending[0].agentId).toBe(waiting[0].id);
  });

  it('a une expiration dans le futur', () => {
    expect(new Date(snap.pending[0].expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("ne contient pas de HTML brut dans le contenu d'agent", () => {
    const blob = JSON.stringify(snap);
    expect(blob).not.toMatch(/<\/?[a-z]+>/i);
  });
});

describe('buildPortfolioSnapshot', () => {
  const snap = buildPortfolioSnapshot();

  it('agrège 5 agents avec badges (propertyCount)', () => {
    expect(snap.scope).toBe('portfolio');
    expect(snap.agents).toHaveLength(5);
    const rev = snap.agents.find((a) => a.id === 'rev');
    expect(rev?.propertyCount).toBe(3);
    expect(rev?.status).toBe('wait');
  });

  it('chaque action en attente est taguée de son logement', () => {
    expect(snap.pending.length).toBeGreaterThan(0);
    for (const p of snap.pending) {
      expect(p.propertyName).toBeTruthy();
      expect(p.propertyId).toBeTruthy();
    }
  });
});

describe('MockSupervisionProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('charge un snapshot (latence 0 → synchrone)', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const snap = await provider.getSnapshot();
    expect(snap.agents).toHaveLength(5);
    provider.dispose();
  });

  it('émet un événement « agit » (comète) peu après subscribe', () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const events: StreamEvent[] = [];
    const unsub = provider.subscribe((e) => events.push(e));
    vi.advanceTimersByTime(1_200);
    expect(events.some((e) => e.type === 'agent.acting' && e.agentId === 'com')).toBe(true);
    unsub();
    provider.dispose();
  });

  it('valider une action : pending.resolved + Revenue passe « agit »', async () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const events: StreamEvent[] = [];
    provider.subscribe((e) => events.push(e));
    const snap = await provider.getSnapshot();
    await provider.validatePending(snap.pending[0].id);
    expect(events.some((e) => e.type === 'pending.resolved' && e.outcome === 'validated')).toBe(true);
    expect(events.some((e) => e.type === 'agent.status' && e.agentId === 'rev' && e.status === 'act')).toBe(true);
    provider.dispose();
  });

  it('dispose coupe le flux (plus d\'events après)', () => {
    const provider = new MockSupervisionProvider('1', { latencyMs: 0 });
    const events: StreamEvent[] = [];
    provider.subscribe((e) => events.push(e));
    provider.dispose();
    vi.advanceTimersByTime(30_000);
    expect(events).toHaveLength(0);
  });
});

describe('MockPortfolioProvider', () => {
  it('charge un snapshot portefeuille', async () => {
    const provider = new MockPortfolioProvider({ latencyMs: 0 });
    const snap = await provider.getSnapshot();
    expect(snap.scope).toBe('portfolio');
    expect(snap.propertyCount).toBe(8);
    provider.dispose();
  });
});
