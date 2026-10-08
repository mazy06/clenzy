package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.*;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyUpsellSettlementTest {
    @Mock UpsellOrderRepository orders;
    @Mock PaymentTransactionRepository transactions;
    @Mock ReservationRepository reservations;
    @Mock WelcomeGuideRepository guides;
    @Mock MonetizationConfigService pricing;
    @Mock ManagementContractService contracts;
    @Mock WalletService wallets;
    @Mock LedgerService ledger;
    BaitlyUpsellSettlement service;
    UpsellOrder order;
    PaymentTransaction tx;

    @BeforeEach void setup() {
        service = new BaitlyUpsellSettlement(orders, transactions, reservations, guides, pricing, contracts,
                wallets, ledger, Clock.fixed(Instant.parse("2026-10-07T12:00:00Z"), ZoneOffset.UTC));
        order = new UpsellOrder(); order.setId(8L); order.setOrganizationId(2L); order.setReservationId(20L);
        order.setAmount(new BigDecimal("100")); order.setCurrency("EUR"); order.setStripeSessionId("cs_test");
        order.setPlatformFeeAmount(new BigDecimal("10")); order.setConciergeAmount(new BigDecimal("18"));
        order.setHostAmount(new BigDecimal("72")); order.setBeneficiaryOwnerId(4L);
        tx = new PaymentTransaction(); tx.setOrganizationId(2L); tx.setSourceType("UPSELL"); tx.setSourceId(8L);
        tx.setPaymentType(TransactionType.CHECKOUT); tx.setStatus(TransactionStatus.COMPLETED);
        tx.setAmount(new BigDecimal("100")); tx.setCurrency("EUR");
    }

    void proof() {
        when(orders.lockBySession("cs_test")).thenReturn(Optional.of(order));
        when(transactions.findByProviderTxId("cs_test")).thenReturn(Optional.of(tx));
    }

    @Test void settlementUsesFrozenAmountsAndOwnerEvenAfterConfigurationChanged() {
        proof(); service.settle("cs_test"); service.settle("cs_test");
        assertThat(order.getStatus()).isEqualTo(UpsellOrderStatus.PAID);
        assertThat(order.getPaidAt()).isEqualTo(LocalDateTime.of(2026,10,7,12,0));
        verify(wallets).getOrCreateWallet(2L, WalletType.OWNER, 4L, "EUR");
        verify(ledger).recordTransfer(any(), any(), eq(new BigDecimal("72")), eq(LedgerReferenceType.UPSELL), eq("UPSELL-8"), anyString());
        verify(ledger).recordTransfer(any(), any(), eq(new BigDecimal("18")), eq(LedgerReferenceType.UPSELL), eq("UPSELL-8"), anyString());
        verifyNoInteractions(pricing, contracts, reservations, guides);
    }

    @Test void missingLedgerCreditDoesNotMarkTheOrderPaid() {
        proof(); doThrow(new IllegalStateException("ledger unavailable")).when(ledger).recordTransfer(any(),any(),any(),any(),anyString(),anyString());
        assertThatThrownBy(() -> service.settle("cs_test")).isInstanceOf(IllegalStateException.class);
        assertThat(order.getStatus()).isEqualTo(UpsellOrderStatus.PENDING);
        verify(orders, never()).save(any());
    }

    @Test void incompleteHistoricSnapshotRequiresReview() {
        proof(); order.setBeneficiaryOwnerId(null);
        assertThatThrownBy(() -> service.settle("cs_test")).hasMessageContaining("rapprochement");
        verifyNoInteractions(wallets, ledger);
    }

    @Test void wrongTenantProofIsRejected() {
        proof(); tx.setOrganizationId(99L);
        assertThatThrownBy(() -> service.settle("cs_test")).hasMessageContaining("incompatible");
        verifyNoInteractions(wallets,ledger);
    }
    @Test void wrongAmountIsRejected() {
        proof(); tx.setAmount(new BigDecimal("99"));
        assertThatThrownBy(() -> service.settle("cs_test")).isInstanceOf(IllegalStateException.class);
    }
    @Test void pendingPaymentIsNotAReceipt() {
        proof(); tx.setStatus(TransactionStatus.PROCESSING);
        assertThatThrownBy(() -> service.settle("cs_test")).isInstanceOf(IllegalStateException.class);
    }
    @Test void refundReplayNeverCreditsAgain() {
        proof(); order.setStatus(UpsellOrderStatus.REFUNDED); service.settle("cs_test");
        verifyNoInteractions(wallets, ledger);
    }
    @Test void canceledOrderRequiresReview() {
        proof(); order.setStatus(UpsellOrderStatus.CANCELLED);
        assertThatThrownBy(() -> service.settle("cs_test")).hasMessageContaining("annulée");
    }
    @Test void snapshotUsesManagementContractAndExactRemainder() {
        User owner = new User(); owner.setId(4L);
        Property property = new Property(); property.setId(7L); property.setOrganizationId(2L); property.setOwner(owner);
        Reservation reservation = new Reservation(); reservation.setOrganizationId(2L); reservation.setProperty(property);
        ManagementContract contract = new ManagementContract(); contract.setUpsellCommissionRate(new BigDecimal("0.2"));
        when(reservations.findById(20L)).thenReturn(Optional.of(reservation));
        when(pricing.getEffectiveUpsellPlatformFeePct(2L)).thenReturn(new BigDecimal("10"));
        when(contracts.getActiveContract(7L,2L)).thenReturn(Optional.of(contract));
        service.snapshot(order);
        assertThat(order.getHostAmount()).isEqualByComparingTo("72");
        assertThat(order.getConciergeAmount()).isEqualByComparingTo("18");
        verifyNoInteractions(wallets, ledger);
    }
    @Test void reservationFromAnotherOrganizationCannotBeSold() {
        Reservation reservation = new Reservation(); reservation.setOrganizationId(99L);
        when(reservations.findById(20L)).thenReturn(Optional.of(reservation));
        assertThatThrownBy(() -> service.snapshot(order)).hasMessageContaining("hors organisation");
    }
}
