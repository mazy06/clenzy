import React, { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSession, createServiceSession } = vi.hoisted(() => ({
  createSession: vi.fn(), createServiceSession: vi.fn(),
}));
vi.mock('../../services/api/paymentsApi', () => ({ paymentsApi: { createEmbeddedSession: createSession } }));
vi.mock('../../services/api/serviceRequestsApi', () => ({ serviceRequestsApi: { createEmbeddedSession: createServiceSession } }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../config/runtimeConfig', () => ({ runtimeEnv: () => '' }));
vi.mock('../Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} EUR</span> }));
vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ options, children }: { options: { clientSecret: string }; children: React.ReactNode }) => (
    <section aria-label={`Checkout ${options.clientSecret}`}>{children}</section>
  ),
  EmbeddedCheckout: () => <span>Formulaire Stripe</span>,
}));
vi.mock('../ui', () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>,
    Spinner: () => <span>Chargement</span>,
    Alert: Container, AlertAction: Container, AlertDescription: Container,
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
    DialogContent: Container, DialogHeader: Container, DialogTitle: Container,
  };
});
import PaymentCheckoutModal from '../PaymentCheckoutModal';

const props = { open: true, onClose: vi.fn(), onSuccess: vi.fn(), amount: 45 };

describe('PaymentCheckoutModal session creation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('opens one checkout despite the StrictMode effect replay', async () => {
    let finish!: (v: { clientSecret: string; sessionId: string }) => void;
    createSession.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<StrictMode><PaymentCheckoutModal {...props} interventionId={405} /></StrictMode>);
    expect(createSession).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ clientSecret: 'test-checkout', sessionId: 'test-session' }); });
    expect(screen.getByRole('region', { name: 'Checkout test-checkout' })).toBeInTheDocument();
  });

  it('also deduplicates service-request checkout creation', async () => {
    createServiceSession.mockResolvedValue({ clientSecret: 'service-checkout', sessionId: 'service-session' });
    render(<StrictMode><PaymentCheckoutModal {...props} serviceRequestId={7} /></StrictMode>);
    await screen.findByText('Formulaire Stripe');
    expect(createServiceSession).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('does not duplicate an in-flight request when closing and reopening quickly', async () => {
    let finish!: (v: { clientSecret: string }) => void;
    createSession.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { rerender } = render(<PaymentCheckoutModal {...props} interventionId={1} />);
    rerender(<PaymentCheckoutModal {...props} open={false} interventionId={1} />);
    rerender(<PaymentCheckoutModal {...props} interventionId={1} />);
    await act(async () => { finish({ clientSecret: 'same-checkout' }); });
    expect(screen.getByRole('region', { name: 'Checkout same-checkout' })).toBeInTheDocument();
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('ignores the previous mission response when the selection changes', async () => {
    let finishOld!: (v: { clientSecret: string }) => void;
    createSession.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce({ clientSecret: 'new-checkout' });
    const { rerender } = render(<PaymentCheckoutModal {...props} interventionId={1} />);
    rerender(<PaymentCheckoutModal {...props} interventionId={2} />);
    await screen.findByRole('region', { name: 'Checkout new-checkout' });
    await act(async () => { finishOld({ clientSecret: 'old-checkout' }); });
    expect(screen.queryByRole('region', { name: 'Checkout old-checkout' })).not.toBeInTheDocument();
  });

  it('can retry after closing a failed attempt', async () => {
    createSession.mockRejectedValueOnce({ message: 'Intervention annulée' })
      .mockResolvedValueOnce({ clientSecret: 'retry-checkout' });
    const { rerender } = render(<PaymentCheckoutModal {...props} interventionId={1} />);
    await screen.findByText('Intervention annulée');
    rerender(<PaymentCheckoutModal {...props} open={false} interventionId={1} />);
    rerender(<PaymentCheckoutModal {...props} interventionId={1} />);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Checkout retry-checkout' })).toBeInTheDocument());
    expect(createSession).toHaveBeenCalledTimes(2);
  });
});
