import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentRecordDetail from './PaymentRecordDetail';
import type { PaymentRecord } from '../../services/api/paymentsApi';

vi.mock('../billing/components/FinanceIdentity', () => ({ default: () => <div>Logement et intervenant</div> }));
vi.mock('./PaymentInterventionEvidence', () => ({ default: () => <div>Pièces liées</div> }));
vi.mock('./BaitlyExternalBatchRefundPanel', () => ({ default: () => <div>Rapprochement du lot</div> }));
vi.mock('../billing/components/useFinanceIntervention', () => ({ useFinanceIntervention: () => ({ data: {
  id: 5, status: 'COMPLETED', type: 'CLEANING', priority: 'NORMAL', scheduledDate: '2026-10-04T11:00:00',
  estimatedDurationHours: 2, actualDurationMinutes: 95, description: 'Nettoyer les sanitaires',
  requestorName: 'Client test', notes: '{"inspection":"Linge remplacé","rooms":{"general":"Sols propres"}}',
  beforePhotosUrls: '["/images/before.jpg"]', afterPhotosUrls: '["/images/after.jpg"]',
}, isLoading: false, isError: false }) }));
afterEach(cleanup);

describe('Détail du paiement', () => {
  it('exposes the dispute hold and prevents starting another payment', () => {
    const payment = { id: 2, referenceId: 7, type: 'INTERVENTION', status: 'PAID', canCollect: true,
      amount: 35, currency: 'EUR', paymentDisputed: true } as PaymentRecord;
    render(<PaymentRecordDetail payment={payment} status="Payé" onPay={vi.fn()} onSendLink={vi.fn()} sending={false} processing={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Litige bancaire');
    expect(screen.getByRole('alert')).toHaveTextContent('exclus des reversements');
    expect(screen.queryByRole('button', { name: 'Payer', exact: true })).not.toBeInTheDocument();
  });
  it('distinguishes the collected amount, partial refund and remaining amount without offering a new payment', () => {
    const payment = { id: 2, referenceId: 332, type: 'INTERVENTION', status: 'PARTIALLY_REFUNDED', canCollect: false,
      amount: 35, refundedAmount: 5, currency: 'EUR' } as PaymentRecord;
    render(<PaymentRecordDetail payment={payment} status="Partiellement remboursé" onPay={vi.fn()} onSendLink={vi.fn()} sending={false} processing={false} />);
    expect(screen.getByText(/35,00/)).toBeVisible();
    expect(screen.getByText(/^5,00/)).toBeVisible();
    expect(screen.getByText(/30,00/)).toBeVisible();
    expect(screen.getByText(/montant déjà remboursé est déduit du solde disponible/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Payer', exact: true })).not.toBeInTheDocument();
  });

  it('explains a pending refund proof without claiming the full mission is refunded', () => {
    const payment = { id: 2, referenceId: 332, type: 'INTERVENTION', status: 'PAID', canCollect: false,
      amount: 35, refundPendingAmount: 5, refundReviewRequired: true, currency: 'EUR' } as PaymentRecord;
    render(<PaymentRecordDetail payment={payment} status="Payé" onPay={vi.fn()} onSendLink={vi.fn()} sending={false} processing={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Remboursement à rapprocher');
    expect(screen.getByRole('alert')).toHaveTextContent('5,00');
    expect(screen.queryByText('Montant conservé')).not.toBeInTheDocument();
  });
  it('shows the remaining balance, mission evidence and an explicit pay action without executing on read', () => {
    const onPay = vi.fn();
    const payment: PaymentRecord = { id: 1, referenceId: 5, description: 'Ménage', propertyName: 'Riad', amount: 100,
      payableAmount: 60, currency: 'EUR', status: 'PENDING', type: 'INTERVENTION', canCollect: true, transactionDate: '2026-10-04', createdAt: '2026-10-04' };
    const props = { payment, status: 'En attente', onPay, onView: vi.fn(), onRefund: vi.fn(), onSendLink: vi.fn(), canRefund: false, sending: false, refunding: false, processing: false };
    const view = render(<PaymentRecordDetail {...props} />);
    expect(screen.getByText(/60,00/)).toBeVisible();
    expect(screen.getByText(/Acompte déjà déduit/)).toBeVisible();
    expect(screen.getByText('1h35')).toBeVisible();
    expect(screen.getByText(/Linge remplacé/)).toHaveTextContent('Sols propres');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Photos', exact: true }));
    expect(screen.getByRole('img', { name: 'Photos après intervention 1' })).toHaveAttribute('src', expect.stringContaining('/images/after.jpg'));
    expect(onPay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Payer', exact: true }));
    expect(onPay).toHaveBeenCalledOnce();
    view.rerender(<PaymentRecordDetail {...props} payment={{ ...payment, status: 'PAID', canCollect: false }} />);
    expect(screen.queryByRole('button', { name: 'Payer', exact: true })).not.toBeInTheDocument();
  });

  it('does not offer a payment when collection is not authorized', () => {
    const payment = { id: 2, referenceId: 7, type: 'INTERVENTION', status: 'PENDING', canCollect: false, amount: 55, currency: 'EUR' } as PaymentRecord;
    render(<PaymentRecordDetail payment={payment} status="En attente" onPay={vi.fn()} onSendLink={vi.fn()} sending={false} processing={false} />);
    expect(screen.queryByRole('button', { name: 'Payer', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rembourser' })).not.toBeInTheDocument();
  });
});
