// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderWithProviders as render, screen, within } from '../../../test/renderWithProviders';
import { AgentSpeechContent } from '../renderers/AgentSpeechContent';
import { AGENT_PORTRAITS } from '../core/agentPortraitAssets';
import type { PendingAction } from '../types';

const agent = { id: 'ops' as const, status: 'wait' as const, autonomy: 'notify' as const, task: null, pendingCount: 4 };
const action = (id: string, extra: Partial<PendingAction> = {}): PendingAction => ({
  id, agentId: 'ops', title: 'Mission à confirmer', motif: '', reasoning: '',
  createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7_200_000).toISOString(), ...extra,
});

describe('AgentSpeechContent', () => {
  it('shares action illustrations and stock photos with the queue while bounding its preview', () => {
    const { container } = render(<AgentSpeechContent agent={agent} isSelected={false} waiting={[
      action('cleaning', { applyActionType: 'CLEANING_REQUEST' }),
      action('stock', { title: 'Stock bas : Savon (2 restant)', motif: 'Seuil de 5 atteint et aucun fournisseur configuré — Préparer le réassort.' }),
      action('assign', { applyActionType: 'REASSIGN_CLEANING' }),
      action('hidden', { title: 'Quatrième demande' }),
    ]} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector('img')).toHaveAttribute('src', '/images/hitl/cleaning.webp');
    expect(rows[1].querySelector('.baitly-stock-thumbnail')).not.toBeNull();
    expect(rows[1].querySelector('.baitly-action-illustration')).toBeNull();
    expect(within(rows[1]).getByText('Savon')).toBeInTheDocument();
    expect(rows[2].querySelector('img')).toHaveAttribute('src', '/images/hitl/provider-search.webp');
    expect(screen.queryByText('Quatrième demande')).toBeNull();
    expect(screen.getByText('Cliquez sur l’agent : 1 de plus')).toBeInTheDocument();
    expect(container.querySelector('.baitly-agent-speech-avatar img')).toHaveAttribute('src', AGENT_PORTRAITS.ops);
    expect(container.querySelector('video')).toBeNull();
  });

  it('does not present a payment or reminder as expired, or fabricate pending rows', () => {
    const { rerender } = render(<AgentSpeechContent agent={agent} isSelected waiting={[
      action('payment', { kind: 'payment', expiresAt: '2020-01-01T00:00:00Z' }),
      action('reminder', { kind: 'reminder', expiresAt: '2020-01-01T00:00:00Z' }),
    ]} />);
    expect(screen.getByText('À régler')).toBeInTheDocument();
    expect(screen.getByText('Rappel')).toBeInTheDocument();
    expect(screen.queryByText('Expirée')).toBeNull();
    rerender(<AgentSpeechContent agent={{ ...agent, pendingCount: 0, status: 'veille' }} isSelected={false} waiting={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('Aucune demande en attente pour cet agent.')).toBeInTheDocument();
  });
});
