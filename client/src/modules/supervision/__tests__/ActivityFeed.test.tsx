// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityFeed } from '../components/ActivityFeed';
import type { FeedEntry } from '../types';

// La modale prévisualise le message via l'API guest-messaging : on la stubbe pour
// éviter tout appel réseau dans le test.
vi.mock('../../../services/api/guestMessagingApi', () => ({
  guestMessagingApi: {
    previewMessage: vi.fn().mockResolvedValue({ subject: 'Départ', htmlBody: '<p>Merci de votre séjour</p>' }),
  },
}));

const at = () => new Date().toISOString();

describe('<ActivityFeed> — message envoyé cliquable', () => {
  it('rend une ligne cliquable pour une entrée porteuse de messageLogId', () => {
    const entries: FeedEntry[] = [
      { id: 'f-1', agentId: 'com', at: at(), text: 'Message de check-out', messageLogId: 42 },
    ];
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByRole('button', { name: 'Voir le message envoyé' })).toBeTruthy();
  });

  it('ne rend PAS de ligne cliquable pour une entrée sans messageLogId', () => {
    const entries: FeedEntry[] = [
      { id: 'f-2', agentId: 'rev', at: at(), text: 'Tarif ajusté' },
    ];
    render(<ActivityFeed entries={entries} />);
    expect(screen.queryByRole('button', { name: 'Voir le message envoyé' })).toBeNull();
  });

  it('ouvre la modale de prévisualisation au clic', async () => {
    const entries: FeedEntry[] = [
      { id: 'f-3', agentId: 'com', at: at(), text: 'Message de check-out', messageLogId: 42 },
    ];
    render(<ActivityFeed entries={entries} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir le message envoyé' }));
    expect(await screen.findByText('Message envoyé')).toBeTruthy();
  });
});
