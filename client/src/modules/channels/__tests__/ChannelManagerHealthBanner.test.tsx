import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChannelManagerHealthBanner from '../ChannelManagerHealthBanner';
import { channexApi } from '../../../services/api/channexApi';

/**
 * Le bandeau de sante ne peut pas etre vu en dev sans mapping Channex (il se
 * tait a zero — comportement verifie a l'ecran) : ces tests couvrent donc les
 * etats REMPLIS, sains et en erreur, que l'ecran ne montre qu'en production.
 */

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { permissions: ['users:manage'] } }),
}));

function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChannelManagerHealthBanner />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const base = {
  totalMappings: 4,
  countsByStatus: { PENDING: 0, ACTIVE: 4, ERROR: 0, DISABLED: 0 },
  attentionItems: [],
  computedAt: '2026-08-02T10:30:00Z',
};

describe('ChannelManagerHealthBanner', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sain : annonce le channel manager operationnel avec le ratio de mappings', async () => {
    vi.spyOn(channexApi, 'healthSummary').mockResolvedValue(base as never);
    monter();
    expect(await screen.findByText('Channel manager opérationnel')).toBeInTheDocument();
    expect(screen.getByText(/4\/4 mappings actifs/)).toBeInTheDocument();
    expect(screen.getByText('Journal de sync')).toBeInTheDocument();
  });

  it('en erreur : bascule en ton destructif et nomme le premier logement touche', async () => {
    vi.spyOn(channexApi, 'healthSummary').mockResolvedValue({
      ...base,
      countsByStatus: { PENDING: 0, ACTIVE: 2, ERROR: 2, DISABLED: 0 },
      attentionItems: [{
        clenzyPropertyId: 1, propertyName: 'Riad Yasmine', syncStatus: 'ERROR',
        severity: 'ERROR', reason: 'push refuse', lastSyncAt: null, lastSyncError: 'x',
      }],
    } as never);
    monter();
    expect(await screen.findByText('2 logements en erreur de synchronisation')).toBeInTheDocument();
    expect(screen.getByText(/Riad Yasmine/)).toBeInTheDocument();
  });

  it('a zero mapping : ne rend rien', async () => {
    vi.spyOn(channexApi, 'healthSummary').mockResolvedValue({ ...base, totalMappings: 0 } as never);
    const { container } = monter();
    // Laisse la requete se resoudre avant d'affirmer le vide.
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toBe('');
  });
});
