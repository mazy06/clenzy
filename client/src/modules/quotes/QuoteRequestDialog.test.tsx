// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import QuoteRequestDialog from './QuoteRequestDialog';
import type { CatalogProviderDto } from '../../services/api/providerCatalogApi';
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), useCreate: vi.fn() }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../hooks/useMarketplaceProperties', () => ({ useMarketplaceProperties: () => ({ data: [{ id: 42, name: 'Riad Azur' }], isLoading: false, isError: false }) }));
vi.mock('../../hooks/useQuoteRequests', () => ({ useCreateQuoteRequest: (id?: number) => { mocks.useCreate(id); return { mutate: mocks.mutate, isPending: false }; } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const provider = { id: 1, displayName: 'Pro', offers: [
  { id: 11, label: 'Ménage', active: true, categoryCode: 'CLEANING', serviceItemCode: 'cleaning-turnover' },
  { id: 12, label: 'Jardin', active: true, categoryCode: 'GARDEN', serviceItemCode: 'garden' },
] } as CatalogProviderDto;
it('sends the actual selected property and service instead of the first category', () => {
  render(<QuoteRequestDialog provider={provider} open onOpenChange={vi.fn()} initialPropertyId="42" />);
  fireEvent.change(screen.getByLabelText('marketplaceWorkflow.subject'), { target: { value: 'Jardin du riad' } });
  fireEvent.change(screen.getByLabelText('marketplaceWorkflow.service'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'marketplaceWorkflow.send' }));
  expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 42, categoryCode: 'GARDEN', serviceItemCode: 'garden' }), expect.anything());
});
it('blocks a property carried in the URL that is not in the accessible choices', () => {
  render(<QuoteRequestDialog provider={provider} open onOpenChange={vi.fn()} initialPropertyId="999" />);
  fireEvent.change(screen.getByLabelText('marketplaceWorkflow.subject'), { target: { value: 'Demande' } });
  expect(screen.getByRole('button', { name: 'marketplaceWorkflow.send' })).toBeDisabled();
});
it('keeps a general request without inventing a service or property', () => {
  render(<QuoteRequestDialog provider={provider} open onOpenChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('marketplaceWorkflow.subject'), { target: { value: 'Demande' } });
  fireEvent.click(screen.getByRole('button', { name: 'marketplaceWorkflow.send' }));
  expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ propertyId: null, categoryCode: undefined, serviceItemCode: undefined }), expect.anything());
});

it('keeps replacement context immutable and sends through the dedicated command', () => {
  render(<QuoteRequestDialog provider={provider} open onOpenChange={vi.fn()} replacement={{ quoteId: 55, propertyId: 42,
    title: 'Nettoyage prévu', categoryCode: 'CLEANING', serviceItemCode: 'cleaning-turnover', desiredDate: '2026-12-01',
    activeRequestId: null, startTime: '14:30:00', durationMinutes: 90 }} />);
  expect(mocks.useCreate).toHaveBeenCalledWith(55);
  expect(screen.getByLabelText('marketplaceWorkflow.subject')).toHaveValue('Nettoyage prévu');
  for (const field of ['subject', 'property', 'service', 'details']) expect(screen.getByLabelText('marketplaceWorkflow.' + field)).toBeDisabled();
  fireEvent.change(screen.getByLabelText('marketplaceWorkflow.date'), { target: { value: '2026-12-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'marketplaceWorkflow.send' }));
  expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 42, desiredDate: '2026-12-02' }), expect.anything());
});

it('blocks a second request when a replacement already exists', () => {
  render(<QuoteRequestDialog provider={provider} open onOpenChange={vi.fn()} replacement={{ quoteId: 55, propertyId: 42,
    title: 'Nettoyage prévu', categoryCode: 'CLEANING', serviceItemCode: 'cleaning-turnover', desiredDate: null,
    activeRequestId: 99, startTime: null, durationMinutes: null }} />);
  expect(screen.getByRole('button', { name: 'marketplaceWorkflow.send' })).toBeDisabled();
});

it('requires an explicit service for a legacy mission with no catalogue reference', () => {
  render(<QuoteRequestDialog provider={provider} open onOpenChange={vi.fn()} replacement={{ quoteId: 55, propertyId: 42,
    title: 'Nettoyage prévu', categoryCode: null, serviceItemCode: null, desiredDate: null, requiresServiceSelection: true,
    activeRequestId: null, startTime: null, durationMinutes: null }} />);
  expect(screen.getByRole('button', { name: 'marketplaceWorkflow.send' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('marketplaceWorkflow.service'), { target: { value: '11' } });
  expect(screen.getByRole('button', { name: 'marketplaceWorkflow.send' })).toBeEnabled();
});
