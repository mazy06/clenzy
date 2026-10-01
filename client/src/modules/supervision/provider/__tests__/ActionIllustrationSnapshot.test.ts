import { afterEach, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../../types';
import { actionIllustration } from '../../core/actionIllustration';

vi.mock('../../../../config/api', () => ({ buildApiUrl: (endpoint: string) => `http://test${endpoint}` }));
vi.mock('../../../../keycloak', () => ({ getAccessToken: () => 'test-token' }));
vi.mock('../supervisionConfigApi', () => ({ fetchAutonomy: async () => null }));
import { AgUiSupervisionProvider } from '../AgUiSupervisionProvider';

afterEach(() => vi.unstubAllGlobals());

it('conserve l’identité des scanners et du rappel jusqu’à la vignette affichée', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    let data: unknown = null;
    if (input.endsWith('/suggestions/123')) data = [
      { id: 'guide', agentId: 'com', tool: 'guest_instructions_missing', title: 'Information', motif: '', createdAt: '2026-10-01T10:00:00Z' },
      { id: 'tax', agentId: 'cmp', tool: 'tax_due', actionType: 'TAX_MARK_FILED', title: 'Information', motif: '', createdAt: '2026-10-01T10:00:00Z' },
    ];
    else if (input.endsWith('/payout-reminder')) data = { id: 'reminder', title: 'Reversement à venir', motif: '', reasoning: '', payoutDate: '2026-10-02' };
    else if (input.endsWith('/activity/123')) data = { feed: [], autoActions: 0 };
    else if (input.includes('/stream/')) return { ok: false };
    else data = [];
    return { ok: true, status: 200, json: async () => data };
  }));
  const provider = new AgUiSupervisionProvider('123');
  const events: StreamEvent[] = [];
  provider.subscribe((event) => events.push(event));
  try {
    await provider.getSnapshot();
    await vi.waitFor(() => expect(events.some((event) => event.type === 'snapshot.refreshed')).toBe(true));
    const refreshed = events.find((event): event is Extract<StreamEvent, {type: 'snapshot.refreshed'}> => event.type === 'snapshot.refreshed')!;
    const cards = refreshed.snapshot.pending;
    expect(cards.find((card) => card.id === 'guide')?.sourceTool).toBe('guest_instructions_missing');
    expect(actionIllustration(cards.find((card) => card.id === 'guide'))).toBe('welcome-guide');
    expect(actionIllustration(cards.find((card) => card.id === 'tax'))).toBe('tourist-tax');
    expect(cards.find((card) => card.id === 'reminder')?.sourceTool).toBe('payout_reminder');
    expect(actionIllustration(cards.find((card) => card.id === 'reminder'))).toBe('owner-transfer');
  } finally {
    provider.dispose();
  }
});

