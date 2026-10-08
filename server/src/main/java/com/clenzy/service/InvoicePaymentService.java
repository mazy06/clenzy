package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.Invoice;
import com.clenzy.model.PaymentProviderType;
import org.springframework.stereotype.Service;

/** Orchestration Baitly hors transaction SQL ; persistance courte et verrouillée. */
@Service
public class InvoicePaymentService {
    private final PaymentOrchestrationService orchestration;
    private final InvoicePaymentCoordination invoices;

    public InvoicePaymentService(PaymentOrchestrationService orchestration, InvoicePaymentCoordination invoices) {
        this.orchestration = orchestration; this.invoices = invoices;
    }

    public PaymentOrchestrationResult payInvoice(Long invoiceId, PaymentProviderType preferredProvider,
            String successUrl, String cancelUrl) {
        if (preferredProvider != null && preferredProvider != PaymentProviderType.STRIPE)
            throw new IllegalStateException("Le paiement des factures utilise le PSP Stripe configuré");
        var result = orchestration.initiatePayment(invoices.prepare(invoiceId, successUrl, cancelUrl));
        if (result.isSuccess()) invoices.bindExisting(invoiceId, result.transaction().getId());
        return result;
    }

    /** Aucune déclaration manuelle ne peut remplacer la preuve du PSP. */
    public Invoice markAsPaid(Long invoiceId) {
        throw new IllegalStateException("Le règlement de la facture doit être confirmé par le PSP");
    }

    public Invoice sendInvoice(Long invoiceId) { return invoices.send(invoiceId); }
}
