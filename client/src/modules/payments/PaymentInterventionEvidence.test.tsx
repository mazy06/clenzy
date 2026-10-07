import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentInterventionEvidence from './PaymentInterventionEvidence';
import type { InterventionDetailsData } from '../interventions/interventionUtils';

const api = vi.hoisted(() => ({ documents: vi.fn(), quotes: vi.fn(), invoices: vi.fn(), expenses: vi.fn(), preview: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 2 } }) }));
vi.mock('../../services/api/documentsApi', () => ({ documentsApi: { getGenerationsByReference: api.documents, fetchGenerationBlobUrl: api.preview } }));
vi.mock('../../services/api/serviceQuotesApi', () => ({ serviceQuotesApi: { list: api.quotes } }));
vi.mock('../../services/api/invoicesApi', () => ({ invoicesApi: { list: api.invoices } }));
vi.mock('../../services/api/providerExpensesApi', () => ({ providerExpensesApi: { getAll: api.expenses } }));
vi.mock('../../services/api/propertiesApi', () => ({ propertiesApi: { getById: vi.fn().mockResolvedValue({ id: 2, latitude: 48, longitude: 2, city: 'Paris', country: 'France' }) } }));
vi.mock('../notifications/NotificationFieldParts', () => ({ MapTile: ({ address }: { address: string }) => <span>{address}</span> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function renderEvidence(view: 'documents' | 'restock' = 'restock') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PaymentInterventionEvidence view={view} intervention={{ id: 5, propertyId: 2, propertyAddress: '12 rue du Test' } as InterventionDetailsData} /></QueryClientProvider>);
}
describe('Justificatifs de l’intervention', () => {
  it('uses exact intervention links, deduplicates documents and opens the quote in one click', async () => {
    api.documents.mockResolvedValue([{ id: 8, referenceType: 'INTERVENTION', referenceId: 5, documentType: 'DEVIS', status: 'COMPLETED' }]);
    api.quotes.mockResolvedValue([{ id: 3, interventionId: 5, providerName: 'Prestataire test', documentGenerationId: 8 }]);
    api.invoices.mockResolvedValue([{ id: 4, interventionId: 5, invoiceNumber: 'FAC-5', status: 'CREDIT_NOTE', documentGenerationId: 9 }, { id: 10, interventionId: 99, invoiceNumber: 'AUTRE-MISSION' }]);
    api.expenses.mockResolvedValue([
      { id: 1, interventionId: 5, description: 'Savon mains', category: 'SUPPLIES', status: 'APPROVED', amountTtc: 12, currency: 'EUR' },
      { id: 2, interventionId: 99, description: 'Autre dépense', status: 'PAID', amountTtc: 500, currency: 'EUR' },
      { id: 3, interventionId: 5, description: 'Dépense annulée', status: 'CANCELLED', amountTtc: 25, currency: 'EUR' },
    ]);
    api.preview.mockRejectedValue(new Error('PDF unavailable'));
    renderEvidence();
    expect(await screen.findByText('Savon mains')).toBeVisible();
    expect(screen.queryByText('Autre dépense')).not.toBeInTheDocument();
    expect(screen.queryByText('Dépense annulée')).not.toBeInTheDocument();
    cleanup();
    renderEvidence('documents');
    expect(await screen.findByText('FAC-5')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Avoir FAC-5' })).toBeVisible();
    expect(screen.queryByText('AUTRE-MISSION')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Devis/ })).toHaveLength(1);
    expect(api.preview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Devis/ }));
    expect(api.preview).toHaveBeenCalledWith(8);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce document n’a pas pu être ouvert.');
  });
  it('distinguishes unavailable expense data from an empty restocking history', async () => {
    api.documents.mockResolvedValue([]); api.quotes.mockResolvedValue([]); api.invoices.mockResolvedValue([]);
    api.expenses.mockRejectedValue(new Error('Forbidden'));
    renderEvidence();
    expect(await screen.findByRole('alert')).toHaveTextContent('Les dépenses n’ont pas pu être chargées.');
    expect(screen.queryByText('Aucun réassort ni dépense documenté pour cette intervention.')).not.toBeInTheDocument();
  });
});
