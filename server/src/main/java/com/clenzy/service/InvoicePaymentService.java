package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@Transactional
public class InvoicePaymentService {

    private static final Logger log = LoggerFactory.getLogger(InvoicePaymentService.class);

    private final PaymentOrchestrationService paymentOrchestrationService;
    private final InvoiceRepository invoiceRepository;
    private final TenantContext tenantContext;

    public InvoicePaymentService(PaymentOrchestrationService paymentOrchestrationService,
                                   InvoiceRepository invoiceRepository,
                                   TenantContext tenantContext) {
        this.paymentOrchestrationService = paymentOrchestrationService;
        this.invoiceRepository = invoiceRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Initiates payment for an invoice through the payment orchestrator.
     */
    public PaymentOrchestrationResult payInvoice(Long invoiceId,
                                                   PaymentProviderType preferredProvider,
                                                   String successUrl, String cancelUrl) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found: " + invoiceId));

        // Verify invoice is payable
        if (invoice.getStatus() != InvoiceStatus.SENT
            && invoice.getStatus() != InvoiceStatus.ISSUED
            && invoice.getStatus() != InvoiceStatus.OVERDUE) {
            throw new IllegalStateException(
                "Invoice cannot be paid in status: " + invoice.getStatus());
        }

        log.info("Initiating payment for invoice {} ({})", invoice.getInvoiceNumber(), invoice.getTotalTtc());

        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
            invoice.getTotalTtc(),
            invoice.getCurrency(),
            "INVOICE",
            invoiceId,
            "Payment for invoice " + invoice.getInvoiceNumber(),
            invoice.getBuyerName(),
            preferredProvider,
            successUrl,
            cancelUrl,
            Map.of("invoiceNumber", invoice.getInvoiceNumber())
        );

        PaymentOrchestrationResult result = paymentOrchestrationService.initiatePayment(request);

        // Update invoice with payment info
        if (result.isSuccess()) {
            invoice.setPaymentTransactionId(result.transaction().getId());
            invoice.setPaymentMethod(result.providerUsed().name());
            invoiceRepository.save(invoice);
        }

        return result;
    }

    /**
     * Mark invoice as paid (called from webhook or manual confirmation).
     */
    public Invoice markAsPaid(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found: " + invoiceId));

        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaidAt(LocalDateTime.now());
        invoice = invoiceRepository.save(invoice);

        log.info("Invoice {} marked as paid", invoice.getInvoiceNumber());
        return invoice;
    }

    /**
     * Send an invoice (change status from DRAFT to SENT).
     */
    public Invoice sendInvoice(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new RuntimeException("Invoice not found: " + invoiceId));

        if (invoice.getStatus() != InvoiceStatus.DRAFT) {
            throw new IllegalStateException(
                "Only DRAFT invoices can be sent. Current status: " + invoice.getStatus());
        }

        invoice.setStatus(InvoiceStatus.SENT);
        invoice = invoiceRepository.save(invoice);

        log.info("Invoice {} sent", invoice.getInvoiceNumber());
        return invoice;
    }
}
