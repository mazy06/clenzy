import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApplicationDocuments } from './MarketplaceProviderDetailPage';

const state = vi.hoisted(() => ({ mutate: vi.fn(), error: false }));
vi.mock('../../hooks/useMarketplaceProviders', () => ({
  useProviderDocuments: () => ({ data: [{ id: 12, documentType: 'IDENTITY', fileName: 'identity.pdf', status: 'PENDING', createdAt: '2026-09-16' }] }),
  useReviewProviderDocument: () => ({ mutate: state.mutate, isPending: false, isError: state.error, error: new Error('Review unavailable') }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));
afterEach(() => { cleanup(); state.mutate.mockReset(); state.error = false; });

describe('Candidate document decisions', () => {
  it('keeps viewing available while blocking decisions before email confirmation', () => {
    render(<ApplicationDocuments providerId={7} emailConfirmed={false} />);
    expect(screen.getByRole('button', { name: 'marketplaceDocuments.open' })).toBeEnabled();
    for (const name of ['marketplaceDocuments.approve', 'marketplaceDocuments.reject']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(state.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('marketplace.review.confirmEmailFirst');
  });

  it('requires an explanation and submits the correct candidate and document', () => {
    render(<ApplicationDocuments providerId={7} emailConfirmed />);
    fireEvent.click(screen.getByRole('button', { name: 'marketplaceDocuments.reject' }));
    expect(screen.getByRole('button', { name: 'marketplaceDocuments.confirmReject' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'marketplaceDocuments.reason' }), { target: { value: '  Scan illisible  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'marketplaceDocuments.confirmReject' }));
    expect(state.mutate).toHaveBeenCalledWith({ id: 7, documentId: 12, status: 'REJECTED', reviewNote: 'Scan illisible' }, expect.any(Object));
  });

  it('shows a server rejection instead of silently leaving the decision unchanged', () => {
    state.error = true;
    render(<ApplicationDocuments providerId={7} emailConfirmed />);
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement();
  });
});
