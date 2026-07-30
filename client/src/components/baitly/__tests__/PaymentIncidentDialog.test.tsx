import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PaymentIncidentDialog from '../PaymentIncidentDialog';
import { actionItemsApi } from '../../../services/api/actionItemsApi';

/**
 * Un incident de règlement n'appelle pas le même geste selon son origine : un
 * litige se conteste chez le fournisseur avant une échéance, un virement échoué
 * se réémet depuis les reversements, un lien expiré se renvoie au voyageur.
 *
 * <p>Afficher la mauvaise consigne coûte plus cher que de n'en afficher aucune —
 * on enverrait la gestion sur le mauvais écran pendant que le délai court. Ces
 * tests figent donc l'appariement type → consigne → destination, et le fait que
 * la clôture retire bien la ligne de la file.</p>
 */

vi.mock('../../../services/api/actionItemsApi', () => ({
  actionItemsApi: { resolve: vi.fn() },
}));

function renderDialog(incident: Record<string, unknown>, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PaymentIncidentDialog incidentId={41} onClose={onClose} incident={incident} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

describe('PaymentIncidentDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renvoie un litige vers les paiements, avec son échéance', () => {
    renderDialog({ type: 'DISPUTE_OPENED', title: 'Litige bancaire', badge: 'J-3' });

    // L'échéance est l'information qui décide de tout : passée, la somme est perdue.
    expect(screen.getByText(/J-3/)).toBeInTheDocument();
    expect(screen.getByText(/contesté ce paiement/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paiements/i })).toBeInTheDocument();
  });

  it('renvoie un virement échoué vers les reversements', () => {
    renderDialog({ type: 'TRANSFER_FAILED', title: 'Virement échoué' });

    expect(screen.getByText(/bénéficiaire n’a rien reçu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reversements/i })).toBeInTheDocument();
  });

  it('renvoie un lien expiré vers les réservations', () => {
    renderDialog({ type: 'SESSION_EXPIRED', title: 'Lien expiré' });

    expect(screen.getByText(/lien de paiement a expiré/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réservations/i })).toBeInTheDocument();
  });

  it('sur une nature inconnue, n’invente aucune destination', () => {
    renderDialog({ type: 'SOMETHING_NEW', title: 'Incident' });

    // Mieux vaut ne proposer aucun écran que d'envoyer au mauvais endroit.
    expect(screen.queryByRole('button', { name: /voir/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /traité/i })).toBeInTheDocument();
  });

  it('la clôture appelle le serveur puis referme la modale', async () => {
    vi.mocked(actionItemsApi.resolve).mockResolvedValue(undefined);
    const onClose = renderDialog({ type: 'DISPUTE_OPENED', title: 'Litige' });

    fireEvent.click(screen.getByRole('button', { name: /traité/i }));

    await waitFor(() => expect(actionItemsApi.resolve).toHaveBeenCalledWith(41));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('un échec de clôture laisse la modale ouverte et le dit', async () => {
    vi.mocked(actionItemsApi.resolve).mockRejectedValue(new Error('boom'));
    const onClose = renderDialog({ type: 'DISPUTE_OPENED', title: 'Litige' });

    fireEvent.click(screen.getByRole('button', { name: /traité/i }));

    // Fermer sur échec ferait croire l'incident traité alors qu'il reste ouvert.
    await waitFor(() => expect(screen.getByText(/clôture a échoué/)).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});
