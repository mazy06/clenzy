import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InterventionQuotesSection from '../InterventionQuotesSection';
import { serviceQuotesApi, type ServiceQuote } from '../../../services/api/serviceQuotesApi';

vi.mock('../../../services/api/serviceQuotesApi', () => ({ serviceQuotesApi: { list: vi.fn(), create: vi.fn(), approve: vi.fn(), remove: vi.fn(), submitMine: vi.fn() } }));
const quote: ServiceQuote = { id: 7, interventionId: 349, providerName: 'Équipe test', providerEmail: null, providerPhone: null, amount: 45,
  currency: 'EUR', validUntil: null, earliestStartDate: null, description: 'Devis test', status: 'RECEIVED', providerUserId: null, documentGenerationId: null, lines: [] };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(serviceQuotesApi.list).mockResolvedValue([quote]); });
afterEach(cleanup);

describe('Devis dans la fiche intervention', () => {
  it('distingue une erreur API d’une liste vide et permet de réessayer', async () => {
    vi.mocked(serviceQuotesApi.list).mockRejectedValueOnce(new Error('offline'));
    const loaded = vi.fn();
    render(<InterventionQuotesSection interventionId={349} canEdit onQuotesLoaded={loaded} />);
    expect(await screen.findByText('Impossible de charger les devis.')).toBeVisible();
    expect(screen.queryByText(/Aucun devis saisi/)).not.toBeInTheDocument();
    expect(loaded).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Équipe test')).toBeVisible();
    expect(loaded).toHaveBeenCalledWith([quote]);
  });

  it('affiche un échec d’approbation sans annoncer une réussite puis permet de réessayer', async () => {
    vi.mocked(serviceQuotesApi.approve).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...quote, status: 'APPROVED' });
    const approved = vi.fn();
    render(<InterventionQuotesSection interventionId={349} canEdit onQuoteApproved={approved} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('L’action a échoué');
    expect(approved).not.toHaveBeenCalled();
    vi.mocked(serviceQuotesApi.list).mockResolvedValue([{ ...quote, status: 'APPROVED' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Approuver' }));
    await waitFor(() => expect(approved).toHaveBeenCalledOnce());
    expect(serviceQuotesApi.approve).toHaveBeenLastCalledWith(7);
    expect(await screen.findByRole('button', { name: 'Approuvé' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
  });

  it('conserve les champs du devis après un enregistrement refusé', async () => {
    vi.mocked(serviceQuotesApi.create).mockRejectedValueOnce(new Error('offline'));
    render(<InterventionQuotesSection interventionId={349} canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Saisir un devis' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Prestataire'), { target: { value: 'Entreprise test' } });
    fireEvent.change(dialog.getByLabelText('Montant'), { target: { value: '55' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Enregistrer' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('L’action a échoué');
    expect(dialog.getByLabelText('Prestataire')).toHaveValue('Entreprise test');
    expect(dialog.getByLabelText('Montant')).toHaveValue(55);
    expect(serviceQuotesApi.create).toHaveBeenCalledWith(349, expect.objectContaining({ providerName: 'Entreprise test', amount: 55 }));
  });

  it('n’expose pas les décisions de devis en lecture seule', async () => {
    render(<InterventionQuotesSection interventionId={349} canEdit={false} />);
    expect(await screen.findByText('Équipe test')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reçu' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approuver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Saisir un devis' })).not.toBeInTheDocument();
  });
});
