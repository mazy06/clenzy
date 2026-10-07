package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InvoicePaymentCoordinationTest {
    final EntityManager em = mock(EntityManager.class);
    final TenantContext tenant = mock(TenantContext.class);
    final PaymentTransactionRepository payments = mock(PaymentTransactionRepository.class);
    final ServiceQuoteRepository quotes = mock(ServiceQuoteRepository.class);
    final InvoicePaymentRecipient recipients = mock(InvoicePaymentRecipient.class);
    final ManagementContractService contracts = mock(ManagementContractService.class);
    final WalletService wallets = mock(WalletService.class);
    final LedgerService ledger = mock(LedgerService.class);
    final InvoicePaymentCoordination service = new InvoicePaymentCoordination(em, tenant, payments, quotes, recipients, contracts, wallets, ledger);

    Invoice invoice() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        var i = new Invoice(); i.setId(1L); i.setOrganizationId(7L); i.setStatus(InvoiceStatus.ISSUED);
        i.setInvoiceNumber("INV-1"); i.setTotalTtc(new BigDecimal("80")); i.setCurrency("EUR");
        when(em.find(Invoice.class, 1L)).thenReturn(i);
        when(recipients.resolve(i)).thenReturn(new InvoicePaymentRecipient.Recipient("test@example.test", "Client"));
        return i;
    }
    Reservation stay(Invoice i) {
        i.setReservationId(2L);
        var r = new Reservation(); r.setId(2L); r.setOrganizationId(7L);
        r.setTotalPrice(new BigDecimal("80")); r.setCurrency("EUR");
        r.setPaymentStatus(PaymentStatus.PENDING); r.setPaymentCollection(PaymentCollection.PMS);
        var p = new Property(); p.setId(3L); r.setProperty(p);
        when(em.find(Reservation.class, 2L)).thenReturn(r); return r;
    }
    Intervention mission(Invoice i) {
        i.setInterventionId(2L);
        var m = new Intervention(); m.setId(2L); m.setOrganizationId(7L);
        m.setEstimatedCost(new BigDecimal("80")); m.setCurrency("EUR"); m.setPaymentStatus(PaymentStatus.PENDING);
        when(em.find(Intervention.class, 2L)).thenReturn(m); return m;
    }
    PaymentOrchestrationRequest prepare() { return service.prepare(1L, "ok", "ko"); }

    @Test void stayInvoiceReusesReservationDebtAndStableKey() {
        stay(invoice()); var request = prepare();
        assertThat(request.sourceType()).isEqualTo("RESERVATION");
        assertThat(request.sourceId()).isEqualTo(2L);
        assertThat(request.idempotencyKey()).isEqualTo("RESERVATION-2");
        assertThat(request.metadata()).containsEntry("invoiceId", "1");
    }
    @Test void missionInvoiceReusesSingleAllocationBatchAndStableKey() {
        mission(invoice()); var request = prepare();
        assertThat(request.sourceType()).isEqualTo("INTERVENTION_BATCH");
        assertThat(request.idempotencyKey()).isEqualTo("INT-BATCH-2");
        assertThat(request.metadata()).containsEntry("interventionIds", "2").containsEntry("purpose", "FULL");
    }
    @Test void commissionHasItsOwnDebtOnlyForOwnerCollectionContract() {
        var i = invoice(); stay(i); i.setInvoiceType(InvoiceType.COMMISSION);
        var c = new ManagementContract(); c.setPaymentModel(ManagementContract.PaymentModel.OWNER_COLLECTS);
        when(contracts.getActiveContract(3L, 7L)).thenReturn(Optional.of(c));
        assertThat(prepare().sourceType()).isEqualTo("INVOICE");
        c.setPaymentModel(ManagementContract.PaymentModel.CONCIERGE_COLLECTS);
        assertThatThrownBy(this::prepare).hasMessageContaining("autre circuit");
    }
    @ParameterizedTest @EnumSource(value=InvoiceStatus.class, names={"PAID","DRAFT","CANCELLED","CREDIT_NOTE"})
    void unpayableInvoiceNeverPreparesSession(InvoiceStatus status) {
        invoice().setStatus(status);
        assertThatThrownBy(this::prepare).hasMessageContaining("pas payable");
    }
    @Test void duplicateCannotCreateSecondDebt() {
        invoice().setDuplicateOfId(10L);
        assertThatThrownBy(this::prepare).hasMessageContaining("pas payable");
    }
    @Test void crossTenantInvoiceDenied() {
        invoice().setOrganizationId(8L);
        assertThatThrownBy(this::prepare).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test void crossTenantSourceDenied() {
        mission(invoice()).setOrganizationId(8L);
        assertThatThrownBy(this::prepare).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test void historicalPaidMissionIsNotChargedAgain() {
        mission(invoice()).setPaidAt(LocalDateTime.now());
        assertThatThrownBy(this::prepare).hasMessageContaining("déjà un encaissement");
    }
    @Test void changedAmountOrCurrencyNeedsReconciliation() {
        var m = mission(invoice()); m.setEstimatedCost(BigDecimal.TEN);
        assertThatThrownBy(this::prepare).hasMessageContaining("solde ou la devise");
        m.setEstimatedCost(new BigDecimal("80")); m.setCurrency("MAD");
        assertThatThrownBy(this::prepare).hasMessageContaining("solde ou la devise");
    }
    @Test void depositCannotBeCollectedAgainViaFullInvoice() {
        mission(invoice()); var q = new ServiceQuote(); q.setStatus(ServiceQuote.Status.APPROVED);
        q.setDepositPaidAt(LocalDateTime.now()); q.setDepositAmount(BigDecimal.TEN);
        when(quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(2L, 7L)).thenReturn(List.of(q));
        assertThatThrownBy(this::prepare).hasMessageContaining("solde ou la devise");
    }
    @Test void partiallyPaidReservationCannotBeCollectedAgain() {
        stay(invoice()).setAmountPaid(BigDecimal.ONE);
        assertThatThrownBy(this::prepare).hasMessageContaining("partiellement");
    }
    @Test void channelCollectionNeverCreatesStripeCharge() {
        stay(invoice()).setPaymentCollection(PaymentCollection.CHANNEL);
        assertThatThrownBy(this::prepare).hasMessageContaining("hors Baitly");
    }
    @Test void sessionBindingCannotUndoFastWebhookConfirmation() {
        var i = invoice(); i.setStatus(InvoiceStatus.PAID); i.setPaymentTransactionId(9L);
        var tx = InvoiceCheckoutServiceTest.transaction();
        when(em.find(PaymentTransaction.class, 9L)).thenReturn(tx);
        service.bindExisting(1L, 9L);
        assertThat(i.getStatus()).isEqualTo(InvoiceStatus.PAID);
        verifyNoInteractions(ledger);
    }
    @Test void unrelatedReservationWithoutInvoiceDoesNotRequireStripeProof() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        var tx = InvoiceCheckoutServiceTest.transaction(); tx.setSourceType("RESERVATION"); tx.setStatus(TransactionStatus.COMPLETED);
        tx.setProviderTxId(null); when(payments.findByTransactionRef("TX-invoice")).thenReturn(Optional.of(tx));
        @SuppressWarnings("unchecked") TypedQuery<Invoice> query = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Invoice.class))).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of());
        service.reconcile("TX-invoice");
        verifyNoInteractions(ledger);
    }
}
