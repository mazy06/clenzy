package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InvoicePaymentServiceTest {

    @Mock private PaymentOrchestrationService paymentOrchestrationService;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private TenantContext tenantContext;
    @Mock private com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;

    private InvoicePaymentService service;

    @BeforeEach
    void setUp() {
        service = new InvoicePaymentService(paymentOrchestrationService, invoiceRepository, tenantContext, organizationAccessGuard);
    }

    private Invoice buildInvoice(Long id, InvoiceStatus status) {
        Invoice invoice = new Invoice();
        invoice.setId(id);
        invoice.setOrganizationId(1L);
        invoice.setInvoiceNumber("INV-" + id);
        invoice.setStatus(status);
        invoice.setTotalTtc(new BigDecimal("100.00"));
        invoice.setTotalHt(new BigDecimal("83.33"));
        invoice.setTotalTax(new BigDecimal("16.67"));
        invoice.setCurrency("EUR");
        invoice.setBuyerName("ACME Corp");
        return invoice;
    }

    private PaymentOrchestrationResult resultOf(boolean success) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setId(99L);
        PaymentResult pr = success
                ? PaymentResult.success("provider-tx-1", "https://pay")
                : PaymentResult.failure("declined");
        return new PaymentOrchestrationResult(tx, pr, PaymentProviderType.STRIPE);
    }

    @Nested
    @DisplayName("payInvoice")
    class PayInvoice {

        @Test
        @DisplayName("throws when invoice not found")
        void invoiceMissing_throws() {
            when(invoiceRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.payInvoice(1L,
                    PaymentProviderType.STRIPE, "ok", "ko"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Invoice not found");
        }

        @Test
        @DisplayName("rejects payment when status is DRAFT")
        void draftStatus_rejects() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.DRAFT);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

            assertThatThrownBy(() -> service.payInvoice(1L,
                    PaymentProviderType.STRIPE, "ok", "ko"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("cannot be paid");
        }

        @Test
        @DisplayName("rejects payment when status is PAID")
        void paidStatus_rejects() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.PAID);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

            assertThatThrownBy(() -> service.payInvoice(1L,
                    PaymentProviderType.STRIPE, "ok", "ko"))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("succeeds for SENT invoice and persists transaction info")
        void sentStatus_succeeds() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.SENT);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
            when(paymentOrchestrationService.initiatePayment(any())).thenReturn(resultOf(true));

            PaymentOrchestrationResult result = service.payInvoice(1L,
                    PaymentProviderType.STRIPE, "ok", "ko");

            assertThat(result.isSuccess()).isTrue();
            verify(invoiceRepository).save(invoice);
            assertThat(invoice.getPaymentTransactionId()).isEqualTo(99L);
            assertThat(invoice.getPaymentMethod()).isEqualTo("STRIPE");
        }

        @Test
        @DisplayName("succeeds for ISSUED invoice")
        void issuedStatus_succeeds() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.ISSUED);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
            when(paymentOrchestrationService.initiatePayment(any())).thenReturn(resultOf(true));

            service.payInvoice(1L, PaymentProviderType.STRIPE, "ok", "ko");

            verify(invoiceRepository).save(invoice);
        }

        @Test
        @DisplayName("succeeds for OVERDUE invoice")
        void overdueStatus_succeeds() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.OVERDUE);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
            when(paymentOrchestrationService.initiatePayment(any())).thenReturn(resultOf(true));

            service.payInvoice(1L, PaymentProviderType.STRIPE, "ok", "ko");

            verify(invoiceRepository).save(invoice);
        }

        @Test
        @DisplayName("does not persist transaction info when payment failed")
        void failedPayment_doesNotSave() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.SENT);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
            when(paymentOrchestrationService.initiatePayment(any())).thenReturn(resultOf(false));

            service.payInvoice(1L, PaymentProviderType.STRIPE, "ok", "ko");

            // No save since result is not success
            verify(invoiceRepository, never()).save(any());
            assertThat(invoice.getPaymentTransactionId()).isNull();
        }

        @Test
        @DisplayName("builds payment request with invoice metadata")
        void buildsPaymentRequest() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.SENT);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
            when(paymentOrchestrationService.initiatePayment(any())).thenReturn(resultOf(true));

            service.payInvoice(1L, PaymentProviderType.STRIPE, "ok-url", "ko-url");

            ArgumentCaptor<PaymentOrchestrationRequest> captor =
                    ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(paymentOrchestrationService).initiatePayment(captor.capture());
            PaymentOrchestrationRequest req = captor.getValue();
            assertThat(req.amount()).isEqualByComparingTo("100.00");
            assertThat(req.currency()).isEqualTo("EUR");
            assertThat(req.sourceType()).isEqualTo("INVOICE");
            assertThat(req.sourceId()).isEqualTo(1L);
            assertThat(req.customerEmail()).isEqualTo("ACME Corp");
            assertThat(req.preferredProvider()).isEqualTo(PaymentProviderType.STRIPE);
            assertThat(req.successUrl()).isEqualTo("ok-url");
            assertThat(req.cancelUrl()).isEqualTo("ko-url");
            assertThat(req.metadata()).containsEntry("invoiceNumber", "INV-1");
        }
    }

    @Nested
    @DisplayName("markAsPaid")
    class MarkAsPaid {

        @Test
        @DisplayName("sets status to PAID and stamps paidAt")
        void marksAndStamps() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.SENT);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
            when(invoiceRepository.save(invoice)).thenReturn(invoice);

            Invoice result = service.markAsPaid(1L);

            assertThat(result.getStatus()).isEqualTo(InvoiceStatus.PAID);
            assertThat(result.getPaidAt()).isNotNull();
            verify(invoiceRepository).save(invoice);
        }

        @Test
        @DisplayName("throws when invoice not found")
        void notFound_throws() {
            when(invoiceRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.markAsPaid(99L))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("sendInvoice")
    class SendInvoice {

        @Test
        @DisplayName("transitions DRAFT to SENT")
        void draftSent() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.DRAFT);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));
            when(invoiceRepository.save(invoice)).thenReturn(invoice);

            Invoice result = service.sendInvoice(1L);

            assertThat(result.getStatus()).isEqualTo(InvoiceStatus.SENT);
            verify(invoiceRepository).save(invoice);
        }

        @Test
        @DisplayName("rejects when not DRAFT")
        void notDraft_rejects() {
            Invoice invoice = buildInvoice(1L, InvoiceStatus.SENT);
            when(invoiceRepository.findById(1L)).thenReturn(Optional.of(invoice));

            assertThatThrownBy(() -> service.sendInvoice(1L))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Only DRAFT");
        }

        @Test
        @DisplayName("throws when invoice not found")
        void notFound_throws() {
            when(invoiceRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.sendInvoice(99L))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
