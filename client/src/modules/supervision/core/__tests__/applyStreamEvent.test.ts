import { describe, it, expect } from 'vitest';
import { applyStreamEvent } from '../applyStreamEvent';
import { buildPropertySnapshot, buildPortfolioSnapshot } from '../../provider/mockData';
import type { OrchestratorSnapshot, PortfolioSnapshot } from '../../types';

const asProperty = (s: ReturnType<typeof applyStreamEvent>) => s as OrchestratorSnapshot;
const asPortfolio = (s: ReturnType<typeof applyStreamEvent>) => s as PortfolioSnapshot;

describe('applyStreamEvent — par logement', () => {
  it('agent.status met à jour statut / tâche / progression (immuable)', () => {
    const s0 = buildPropertySnapshot('1');
    const s1 = asProperty(
      applyStreamEvent(s0, { type: 'agent.status', agentId: 'ops', status: 'think', task: 'X', thinkingProgress: 80 }),
    );
    const ops = s1.agents.find((a) => a.id === 'ops')!;
    expect(ops.status).toBe('think');
    expect(ops.task).toBe('X');
    expect(ops.thinkingProgress).toBe(80);
    expect(s1).not.toBe(s0); // immuabilité
    expect(s0.agents.find((a) => a.id === 'ops')!.status).toBe('think'); // s0 inchangé (était déjà think)
  });

  it('agent.acting → act + reservationId', () => {
    const s0 = buildPropertySnapshot('1');
    const s1 = asProperty(applyStreamEvent(s0, { type: 'agent.acting', agentId: 'rev', reservationId: 'r-9' }));
    const rev = s1.agents.find((a) => a.id === 'rev')!;
    expect(rev.status).toBe('act');
    expect(rev.reservationId).toBe('r-9');
  });

  it('pending.resolved retire l’action de la file', () => {
    const s0 = buildPropertySnapshot('1');
    const id = s0.pending[0].id;
    const s1 = asProperty(applyStreamEvent(s0, { type: 'pending.resolved', actionId: id, outcome: 'validated' }));
    expect(s1.pending.find((p) => p.id === id)).toBeUndefined();
  });

  it('feed.added préprend au journal', () => {
    const s0 = buildPropertySnapshot('1');
    const s1 = asProperty(
      applyStreamEvent(s0, { type: 'feed.added', entry: { id: 'x', agentId: 'com', at: '2026-06-25T10:00:00Z', text: 'Hello' } }),
    );
    expect(s1.feed[0].id).toBe('x');
    expect(s1.feed.length).toBe(s0.feed.length + 1);
  });

  it('connection bascule online', () => {
    const s0 = buildPropertySnapshot('1');
    expect(asProperty(applyStreamEvent(s0, { type: 'connection', online: false })).online).toBe(false);
  });

  it('conversation.message ajoute un tour (opérateur ou orchestrateur)', () => {
    const s0 = buildPropertySnapshot('1');
    const s1 = asProperty(
      applyStreamEvent(s0, {
        type: 'conversation.message',
        turn: { id: 'op-1', role: 'operator', text: 'Baisse les prix', at: '2026-06-25T10:00:00Z' },
      }),
    );
    expect(s1.conversation).toHaveLength(1);
    expect(s1.conversation![0]).toMatchObject({ id: 'op-1', role: 'operator', text: 'Baisse les prix' });
  });

  it('conversation.delta crée puis concatène le tour orchestrateur (streaming)', () => {
    const s0 = buildPropertySnapshot('1');
    const s1 = asProperty(applyStreamEvent(s0, { type: 'conversation.delta', id: 'orch-1', delta: 'Bonjour' }));
    const s2 = asProperty(applyStreamEvent(s1, { type: 'conversation.delta', id: 'orch-1', delta: ', humain' }));
    expect(s2.conversation).toHaveLength(1);
    expect(s2.conversation![0]).toMatchObject({ id: 'orch-1', role: 'orchestrator', text: 'Bonjour, humain' });
  });

  it('conversation.busy bascule l’indicateur de run en cours', () => {
    const s0 = buildPropertySnapshot('1');
    expect(asProperty(applyStreamEvent(s0, { type: 'conversation.busy', busy: true })).conversationBusy).toBe(true);
    const s1 = applyStreamEvent(s0, { type: 'conversation.busy', busy: true });
    expect(asProperty(applyStreamEvent(s1, { type: 'conversation.busy', busy: false })).conversationBusy).toBe(false);
  });

  it('pendingAction.added pose l’action en attente (approbation inline)', () => {
    const s0 = buildPropertySnapshot('1');
    const s1 = asProperty(
      applyStreamEvent(s0, {
        type: 'pendingAction.added',
        action: { interruptId: 'int-1', toolName: 'Send Message', message: 'Confirmer ?', args: { to: 'x' } },
      }),
    );
    expect(s1.pendingAction).toEqual({
      interruptId: 'int-1',
      toolName: 'Send Message',
      message: 'Confirmer ?',
      args: { to: 'x' },
    });
    expect(s1).not.toBe(s0); // immuabilité
  });

  it('pendingAction.cleared vide l’action en attente (run repris)', () => {
    const s0 = buildPropertySnapshot('1');
    const withPending = applyStreamEvent(s0, {
      type: 'pendingAction.added',
      action: { interruptId: 'int-1', toolName: 'Send Message', message: 'Confirmer ?' },
    });
    const cleared = asProperty(applyStreamEvent(withPending, { type: 'pendingAction.cleared' }));
    expect(cleared.pendingAction).toBeUndefined();
  });

  it('pendingAction.cleared sans action en attente est un no-op (référence inchangée)', () => {
    const s0 = buildPropertySnapshot('1');
    const s1 = applyStreamEvent(s0, { type: 'pendingAction.cleared' });
    expect(s1).toBe(s0);
  });
});

describe('applyStreamEvent — portefeuille', () => {
  it('agent.status met à jour le rollup', () => {
    const s0 = buildPortfolioSnapshot();
    const s1 = asPortfolio(applyStreamEvent(s0, { type: 'agent.status', agentId: 'rep', status: 'act', task: 'Y' }));
    const rep = s1.agents.find((a) => a.id === 'rep')!;
    expect(rep.status).toBe('act');
    expect(rep.task).toBe('Y');
  });

  it('feed.added conserve le nom du logement', () => {
    const s0 = buildPortfolioSnapshot();
    const s1 = asPortfolio(
      applyStreamEvent(s0, {
        type: 'feed.added',
        entry: { id: 'z', agentId: 'com', at: '2026-06-25T10:00:00Z', text: 'T', propertyName: 'Duplex' },
      }),
    );
    expect(s1.feed[0].propertyName).toBe('Duplex');
  });
});
