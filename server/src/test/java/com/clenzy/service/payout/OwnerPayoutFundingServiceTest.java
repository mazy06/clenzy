package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.clenzy.service.payout.ReservationPayoutFundingTest.*;

@ExtendWith(MockitoExtension.class)
class OwnerPayoutFundingServiceTest {
    @Mock PaymentTransactionRepository transactions;
    @Mock OwnerPayoutReservationRepository claims;
    @Mock OwnerPayoutRepository payouts;
    @Mock ReservationRepository reservations;
    @Mock com.clenzy.booking.service.BaitlyReservationCredit credits;
    OwnerPayoutFundingService service;
    @BeforeEach void setup() { service = new OwnerPayoutFundingService(transactions, claims, payouts, reservations, mock(BaitlyOwnerPayoutDocuments.class), mock(BaitlyExpenseRetention.class), credits); org.springframework.test.util.ReflectionTestUtils.setField(service, "em", mock(jakarta.persistence.EntityManager.class)); }

    @Test void reducedReceiptWithoutActualCreditConsumptionCannotFundAnOwner() {
        var r=stay();r.setCreditApplied(new BigDecimal("20"));r.setConfirmationCode("LOYALTY");
        var receipt=receipt(1,"80");receipt.setMetadata(new java.util.HashMap<>(com.clenzy.booking.service.BaitlyReservationCredit.metadata(r,9L)));
        when(transactions.findReservationFunding(eq(7L),anyList(),anySet())).thenReturn(List.of(receipt));
        doThrow(new IllegalStateException("Crédit non rapproché")).when(credits).requireConsumed(r);
        assertThatThrownBy(()->service.select(10L,7L,List.of(r))).hasMessageContaining("Crédit non rapproché");
        verify(claims,never()).saveAllAndFlush(any());
    }

    @Test void selectsOnlyConfirmedUnclaimedReceipts() {
        when(transactions.findReservationFunding(eq(7L), anyList(), anySet())).thenReturn(List.of(receipt(1, "100")));
        var funded = service.select(10L, 7L, List.of(stay()));
        assertThat(funded).hasSize(1);
        assertThat(funded.getFirst().evidence().transactionIds()).containsExactly(1L);
    }
    @Test void excludesReservationAlreadyClaimedByAnotherPeriod() {
        when(claims.findClaimedReservationIds(List.of(1L))).thenReturn(List.of(1L));
        assertThat(service.select(10L, 7L, List.of(stay()))).isEmpty();
    }
    @Test void legacyAugustPayoutBlocksCrossMonthStayInSeptember() {
        OwnerPayout old = payout(); old.setFundingVersion(0);
        old.setPeriodStart(LocalDate.of(2025, 8, 1)); old.setPeriodEnd(LocalDate.of(2025, 8, 31));
        old.setStatus(OwnerPayout.PayoutStatus.PAID);
        when(payouts.findByOwnerId(10L, 7L)).thenReturn(List.of(old));
        assertThat(service.select(10L, 7L, List.of(stay()))).isEmpty();
    }
    @Test void historicalPayoutCannotBeExecutedWithoutReconciliation() {
        OwnerPayout p = payout(); p.setFundingVersion(0);
        assertThatThrownBy(() -> service.validate(p)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("historique");
        verifyNoInteractions(transactions, reservations);
    }
    @Test void validFundingCanBeApproved() {
        validationFixtures(stay(), List.of(receipt(1, "100")));
        assertThatCode(() -> service.validate(payout())).doesNotThrowAnyException();
    }
    @Test void refundAfterGenerationPreventsExecution() {
        PaymentTransaction refund = receipt(2, "5"); refund.setPaymentType(TransactionType.REFUND);
        validationFixtures(stay(), List.of(receipt(1, "100"), refund));
        assertThatThrownBy(() -> service.validate(payout())).isInstanceOf(IllegalStateException.class);
    }
    @Test void ownerChangeDoesNotRerouteExistingPayout() {
        Reservation r = stay(); r.getProperty().getOwner().setId(99L);
        validationFixtures(r, List.of(receipt(1, "100")));
        assertThatThrownBy(() -> service.validate(payout())).isInstanceOf(IllegalStateException.class);
    }
    @Test void propertyFromAnotherOrganizationCannotFundPayout() {
        Reservation r = stay(); r.getProperty().setOrganizationId(8L);
        assertThatThrownBy(() -> service.select(10L, 7L, List.of(r))).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(transactions, claims, payouts);
    }
    @Test void changedDeparturePeriodRequiresReconciliation() {
        Reservation r = stay(); r.setCheckOut(LocalDate.of(2025, 10, 2));
        validationFixtures(r, List.of(receipt(1, "100")));
        assertThatThrownBy(() -> service.validate(payout())).isInstanceOf(IllegalStateException.class);
    }
    @Test void changedReceiptRequiresReconciliationEvenWithSameTotal() {
        validationFixtures(stay(), List.of(receipt(2, "100")));
        assertThatThrownBy(() -> service.validate(payout())).isInstanceOf(IllegalStateException.class);
    }
    @Test void amountCannotExceedItsFunding() {
        validationFixtures(stay(), List.of(receipt(1, "100")));
        OwnerPayout p = payout(); p.setNetAmount(new BigDecimal("101"));
        assertThatThrownBy(() -> service.validate(p)).isInstanceOf(IllegalStateException.class);
    }
    @Test void recordsReservationAndReceiptIdsTogether() {
        var funded = new OwnerPayoutFundingService.FundedStay(stay(),
                new ReservationPayoutFunding.Evidence("EUR", new BigDecimal("100"), List.of(1L)));
        service.record(payout(), List.of(funded));
        verify(claims).saveAllAndFlush(argThat(lines -> {
            OwnerPayoutReservation line = lines.iterator().next();
            return line.getReservationId().equals(1L) && line.getPayoutId().equals(20L)
                    && line.getOrganizationId().equals(7L) && line.getPaymentTransactionIds().equals(List.of(1L));
        }));
    }
    private void validationFixtures(Reservation r, List<PaymentTransaction> tx) {
        when(claims.findByPayoutIdAndOrganizationId(20L, 7L)).thenReturn(List.of(
                new OwnerPayoutReservation(1L, 7L, 20L, new BigDecimal("100"), "EUR", List.of(1L))));
        when(transactions.findReservationFunding(eq(7L), anyList(), anySet())).thenReturn(tx);
        when(reservations.findAllById(List.of(1L))).thenReturn(List.of(r));
    }
    private OwnerPayout payout() {
        OwnerPayout p = new OwnerPayout(); p.setId(20L); p.setOwnerId(10L); p.setOrganizationId(7L);
        p.setPeriodStart(LocalDate.of(2025, 9, 1)); p.setPeriodEnd(LocalDate.of(2025, 9, 30));
        p.setFundingVersion(1); p.setGrossRevenue(new BigDecimal("100"));
        p.setCommissionAmount(new BigDecimal("20")); p.setNetAmount(new BigDecimal("80"));
        return p;
    }
}
