import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StreamEvent } from '../../types';

// Le provider parle directement à l'endpoint Java via buildApiUrl + getAccessToken.
// On mocke ces deux seams pour exercer la traduction SSE → StreamEvents sans réseau.
vi.mock('../../../../config/api', () => ({ buildApiUrl: (e: string) => `http://test${e}` }));
vi.mock('../../../../keycloak', () => ({ getAccessToken: () => 'test-token' }));

import { AgUiSupervisionProvider } from '../AgUiSupervisionProvider';

/** Construit un corps de réponse SSE (ReadableStream) à partir de frames AG-UI. */
function sseBody(frames: Array<Record<string, unknown>>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
      controller.close();
    },
  });
}

function mockFetchOnce(frames: Array<Record<string, unknown>>) {
  const body = sseBody(frames);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, body } as unknown as Response),
  );
}

describe('AgUiSupervisionProvider — kickoff (chemin live)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('émet le tour opérateur, traduit l’activité en constellation et accumule la réponse texte', async () => {
    mockFetchOnce([
      { type: 'STATE_SNAPSHOT', snapshot: { agentActivity: { specialist: 'communication', phase: 'thinking' } } },
      { type: 'STATE_SNAPSHOT', snapshot: { agentActivity: { specialist: 'communication', phase: 'acting', toolName: 'send_message' } } },
      { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Voici ' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'la réponse.' },
      { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
      { type: 'STATE_SNAPSHOT', snapshot: { agentActivity: { specialist: 'communication', phase: 'done' } } },
    ]);

    const provider = new AgUiSupervisionProvider('demo');
    const events: StreamEvent[] = [];
    provider.subscribe((e) => events.push(e));

    await provider.kickoff('Réponds au voyageur');

    // Tour opérateur émis immédiatement.
    const opTurn = events.find((e) => e.type === 'conversation.message');
    expect(opTurn).toMatchObject({ type: 'conversation.message', turn: { role: 'operator', text: 'Réponds au voyageur' } });

    // Constellation : communication (→ com) passe think puis act.
    const statuses = events.filter((e) => e.type === 'agent.status');
    expect(statuses.some((e) => e.type === 'agent.status' && e.agentId === 'com' && e.status === 'think')).toBe(true);
    expect(statuses.some((e) => e.type === 'agent.status' && e.agentId === 'com' && e.status === 'act')).toBe(true);
    expect(statuses.some((e) => e.type === 'agent.status' && e.agentId === 'com' && e.status === 'veille')).toBe(true);

    // Réponse texte : deltas portant le MÊME id (un seul tour orchestrateur, concaténable).
    const deltas = events.filter((e): e is Extract<StreamEvent, { type: 'conversation.delta' }> => e.type === 'conversation.delta');
    expect(deltas).toHaveLength(2);
    expect(deltas[0].id).toBe(deltas[1].id);
    expect(deltas.map((d) => d.delta).join('')).toBe('Voici la réponse.');

    // Busy : true au démarrage, false à la fin.
    const busy = events.filter((e) => e.type === 'conversation.busy');
    expect(busy[0]).toMatchObject({ busy: true });
    expect(busy[busy.length - 1]).toMatchObject({ busy: false });

    provider.dispose();
  });

  it('un message vide ne déclenche aucun run', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AgUiSupervisionProvider('demo');
    await provider.kickoff('   ');
    expect(fetchSpy).not.toHaveBeenCalled();
    provider.dispose();
  });

  it('expose kickoff (canKickoff côté hook)', () => {
    const provider = new AgUiSupervisionProvider('demo');
    expect(typeof provider.kickoff).toBe('function');
    provider.dispose();
  });
});

describe('AgUiSupervisionProvider — HITL inline (interrupt → resume)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('RUN_FINISHED outcome=interrupt → pose une action en attente (pendingAction.added)', async () => {
    mockFetchOnce([
      { type: 'RUN_STARTED', runId: 'run-1' },
      {
        type: 'RUN_FINISHED',
        outcome: {
          type: 'interrupt',
          interrupts: [
            {
              id: 'int-42',
              reason: 'confirmation',
              message: 'Confirmer l’envoi du message au voyageur ?',
              toolCallId: 'tc-1',
              metadata: { toolName: 'send_message', args: { reservationId: 'r-9' } },
            },
          ],
        },
      },
    ]);

    const provider = new AgUiSupervisionProvider('demo');
    const events: StreamEvent[] = [];
    provider.subscribe((e) => events.push(e));

    await provider.kickoff('Réponds au voyageur');

    const added = events.find((e) => e.type === 'pendingAction.added');
    expect(added).toMatchObject({
      type: 'pendingAction.added',
      action: {
        interruptId: 'int-42',
        toolName: 'Send Message', // humanisé
        message: 'Confirmer l’envoi du message au voyageur ?',
        args: { reservationId: 'r-9' },
      },
    });

    provider.dispose();
  });

  it('resolvePendingAction(true) → POST /agui/run avec resume status=resolved + confirmed:true', async () => {
    const fetchSpy = vi.fn().mockImplementation(() => ({
      ok: true,
      body: sseBody([{ type: 'RUN_STARTED', runId: 'run-x' }]),
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AgUiSupervisionProvider('demo');
    const events: StreamEvent[] = [];
    provider.subscribe((e) => events.push(e));

    // 1) Run initial qui se met en pause sur un interrupt.
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      body: sseBody([
        { type: 'RUN_STARTED', runId: 'run-1' },
        {
          type: 'RUN_FINISHED',
          outcome: { type: 'interrupt', interrupts: [{ id: 'int-42', metadata: { toolName: 'send_message' } }] },
        },
      ]),
    });
    await provider.kickoff('Réponds au voyageur');

    // 2) L'opérateur valide → resume.
    await provider.resolvePendingAction(true);

    // La carte est retirée dès la décision.
    expect(events.some((e) => e.type === 'pendingAction.cleared')).toBe(true);

    // Dernier POST = le resume : on inspecte le body racine.
    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    const body = JSON.parse((lastCall[1] as RequestInit).body as string);
    expect(body.resume).toEqual([{ interruptId: 'int-42', status: 'resolved', payload: { confirmed: true } }]);
    // Contexte du fil renvoyé comme un run normal.
    expect(body.threadId).toBe('supervision-demo');
    expect(body.runId).toBe('run-1');
    expect(Array.isArray(body.messages)).toBe(true);

    provider.dispose();
  });

  it('resolvePendingAction(false) → resume status=cancelled + confirmed:false', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AgUiSupervisionProvider('demo');
    provider.subscribe(() => {});

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      body: sseBody([
        { type: 'RUN_STARTED', runId: 'run-1' },
        {
          type: 'RUN_FINISHED',
          outcome: { type: 'interrupt', interrupts: [{ id: 'int-7', metadata: { toolName: 'cancel_reservation' } }] },
        },
      ]),
    });
    await provider.kickoff('Annule la résa');

    fetchSpy.mockResolvedValueOnce({ ok: true, body: sseBody([{ type: 'RUN_STARTED', runId: 'run-2' }]) });
    await provider.resolvePendingAction(false);

    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    const body = JSON.parse((lastCall[1] as RequestInit).body as string);
    expect(body.resume).toEqual([{ interruptId: 'int-7', status: 'cancelled', payload: { confirmed: false } }]);

    provider.dispose();
  });

  it('resolvePendingAction sans interrupt en attente est un no-op (aucun POST)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AgUiSupervisionProvider('demo');
    await provider.resolvePendingAction(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    provider.dispose();
  });
});
