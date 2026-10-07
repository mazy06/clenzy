package com.clenzy.service;

import com.clenzy.dto.PaymentHistoryDto;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PaymentQueryServiceTest {
    final InterventionRepository interventions = mock(InterventionRepository.class);
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final ServiceRequestRepository requests = mock(ServiceRequestRepository.class);
    final TenantContext tenant = mock(TenantContext.class);
    final ServiceQuoteRepository quotes = mock(ServiceQuoteRepository.class);
    final InterventionBatchCheckoutService batch = mock(InterventionBatchCheckoutService.class);
    final PaymentTransactionRepository transactions = mock(PaymentTransactionRepository.class);
    final PaymentQueryService service = new PaymentQueryService(interventions, reservations, requests,
            mock(UserService.class), mock(StripeService.class), tenant, quotes, batch, transactions, mock(BaitlyInterventionCheckoutExpiry.class), mock(BaitlyMaintenanceDepositCheckout.class));
    final User admin = new User();

    PaymentQueryServiceTest() { admin.setRole(UserRole.SUPER_ADMIN); when(tenant.getRequiredOrganizationId()).thenReturn(2L); }

    @Test void partialInterventionRefundExposesItsAmountAndKeepsOnlyTheNetPaidInSummary() {
        var mission=new Intervention(); mission.setId(332L); mission.setOrganizationId(2L);
        mission.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED); mission.setEstimatedCost(new BigDecimal("35")); mission.setCurrency("EUR");
        when(interventions.findPaymentHistory(isNull(),isNull(),any(),eq(2L))).thenReturn(new PageImpl<>(List.of(mission)));
        when(requests.findPaymentHistory(isNull(),isNull(),any(),eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(reservations.findPaymentHistory(isNull(),isNull(),any(),eq(2L))).thenReturn(new PageImpl<>(List.of()));
        var refund=new PaymentTransaction(); refund.setSourceId(332L); refund.setPaymentType(TransactionType.REFUND);
        refund.setStatus(TransactionStatus.COMPLETED); refund.setAmount(new BigDecimal("5")); refund.setCurrency("EUR");
        when(transactions.findReservationFunding(2L,List.of(332L),java.util.Set.of("INTERVENTION"))).thenReturn(List.of(refund));
        when(transactions.findStandaloneRefundableMissionIds(2L,List.of(332L))).thenReturn(List.of(332L));
        @SuppressWarnings("unchecked") var rows=(List<PaymentHistoryDto>)service.getPaymentHistory(admin,null,null,0,10).get("content");
        assertThat(rows.getFirst().status).isEqualTo("PARTIALLY_REFUNDED");
        assertThat(rows.getFirst().refundedAmount).isEqualByComparingTo("5");
        assertThat(rows.getFirst().canCollect).isFalse();
        assertThat(rows.getFirst().supportsPartialRefund).isTrue();
        var summary=service.getPaymentSummary(admin,null);
        assertThat(summary.totalRefunded).isEqualByComparingTo("5");
        assertThat(summary.totalPaid).isEqualByComparingTo("30"); assertThat(summary.totalPending).isZero();
        refund.setStatus(TransactionStatus.PROCESSING); refund.setMetadata(java.util.Map.of("reviewRequired",true));
        @SuppressWarnings("unchecked") var pending=(List<PaymentHistoryDto>)service.getPaymentHistory(admin,null,null,0,10).get("content");
        assertThat(pending.getFirst().refundedAmount).isZero();
        assertThat(pending.getFirst().refundPendingAmount).isEqualByComparingTo("5");
        assertThat(pending.getFirst().refundReviewRequired).isTrue();
    }


    @Test void allocatedBatchStatusAvoidsTheSingularMissionLookup() {
        when(batch.sessionStatus("cs_batch",2L)).thenReturn(java.util.Optional.of(java.util.Map.of("paymentStatus","PAID","interventionStatus","GROUPED")));
        assertThat(service.getSessionStatus("cs_batch").orElseThrow()).containsEntry("paymentStatus","PAID");
        verifyNoInteractions(interventions,reservations,requests);
    }
    @Test void reservationHistoryIncludesConfirmedRefundAndCreditWithoutMixingMissionIds() {
        var booking=reservation(332,PaymentCollection.PMS,PaymentStatus.PARTIALLY_REFUNDED,null);
        booking.setCurrency("EUR"); booking.setCreditApplied(new BigDecimal("20"));
        when(interventions.findPaymentHistory(isNull(),isNull(),any(),eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(requests.findPaymentHistory(isNull(),isNull(),any(),eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(reservations.findPaymentHistory(isNull(),isNull(),any(),eq(2L))).thenReturn(new PageImpl<>(List.of(booking)));
        var refund=new PaymentTransaction(); refund.setSourceId(332L); refund.setPaymentType(TransactionType.REFUND);
        refund.setStatus(TransactionStatus.COMPLETED); refund.setAmount(new BigDecimal("40")); refund.setCurrency("EUR");
        when(transactions.findReservationFunding(2L,List.of(332L),java.util.Set.of("BOOKING_CANCELLATION"))).thenReturn(List.of(refund));
        @SuppressWarnings("unchecked") var rows=(List<PaymentHistoryDto>)service.getPaymentHistory(admin,null,null,0,10).get("content");
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().refundedAmount).isEqualByComparingTo("40");
        assertThat(rows.getFirst().creditAppliedAmount).isEqualByComparingTo("20");
        assertThat(rows.getFirst().amount).isEqualByComparingTo("100");
        assertThat(rows.getFirst().supportsPartialRefund).isFalse();
        verify(transactions,never()).findReservationFunding(anyLong(),anyList(),eq(java.util.Set.of("INTERVENTION")));
    }
    @Test void partialRefundIsNeitherAnUnpaidDebtNorAFullRefund() {
        when(interventions.findPaymentHistory(isNull(), isNull(), any(), eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(requests.findAwaitingPaymentForHost(eq(2L), nullable(Long.class))).thenReturn(List.of());
        var reservation = reservation(42, PaymentCollection.PMS, PaymentStatus.PARTIALLY_REFUNDED, null);
        when(reservations.findAllWithPayment(eq(2L), nullable(Long.class))).thenReturn(List.of(reservation));
        var refund = new PaymentTransaction(); refund.setSourceId(42L); refund.setPaymentType(TransactionType.REFUND);
        refund.setStatus(TransactionStatus.COMPLETED); refund.setAmount(new BigDecimal("40"));
        when(transactions.findReservationFunding(eq(2L), eq(List.of(42L)), any())).thenReturn(List.of(refund));
        var result = service.getPaymentSummary(admin, null);
        assertThat(result.totalRefunded).isEqualByComparingTo("40");
        assertThat(result.totalPaid).isEqualByComparingTo("60"); assertThat(result.totalPending).isZero();
        when(transactions.findReservationFunding(eq(2L), eq(List.of(42L)), any())).thenReturn(List.of());
        result = service.getPaymentSummary(admin, null);
        assertThat(result.totalPending).isZero(); assertThat(result.totalRefunded).isZero(); assertThat(result.totalToVerify).isEqualByComparingTo("100");
    }
    @Test void legacySharedSessionRequiresReconciliationInsteadOfPickingOneMission() {
        when(interventions.findAllByStripeSessionIdAndOrganizationId("cs_old",2L)).thenReturn(List.of(new Intervention(),new Intervention()));
        assertThat(service.getSessionStatus("cs_old").orElseThrow()).containsEntry("interventionStatus","RECONCILIATION_REQUIRED");
        verify(interventions,never()).findByStripeSessionId(anyString(),anyLong());
    }
    Reservation reservation(long id, PaymentCollection collection, PaymentStatus status, String reported) {
        var r = new Reservation(); r.setId(id); r.setTotalPrice(new BigDecimal("100"));
        r.setPaymentCollection(collection); r.setPaymentStatus(status); r.setChannelPaymentCollect(reported); return r;
    }

    @Test void summarySeparatesPaidToOtaUnknownRefundedAndCancelled() {
        when(interventions.findPaymentHistory(isNull(), isNull(), any(), eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(requests.findAwaitingPaymentForHost(eq(2L), nullable(Long.class))).thenReturn(List.of());
        when(reservations.findAllWithPayment(eq(2L), nullable(Long.class))).thenReturn(List.of(
            reservation(1, PaymentCollection.CHANNEL, PaymentStatus.PAID, "ota"),
            reservation(2, PaymentCollection.CHANNEL, PaymentStatus.PAID, null),
            reservation(3, PaymentCollection.CHANNEL, PaymentStatus.REFUNDED, "ota"),
            reservation(4, PaymentCollection.CHANNEL, PaymentStatus.CANCELLED, "ota"),
            reservation(5, PaymentCollection.PMS, PaymentStatus.PENDING, "property"),
            reservation(6, PaymentCollection.PMS, PaymentStatus.PAID, null)));
        var result = service.getPaymentSummary(admin, null);
        assertThat(result.totalPaid).isEqualByComparingTo("100");
        assertThat(result.totalPaidByOta).isEqualByComparingTo("100");
        assertThat(result.totalToVerify).isEqualByComparingTo("100");
        assertThat(result.totalPending).isEqualByComparingTo("100");
        assertThat(result.totalRefunded).isEqualByComparingTo("100");
        assertThat(result.paidByOtaByCurrency.get("EUR")).isEqualByComparingTo("100");
        assertThat(result.toVerifyByCurrency.get("EUR")).isEqualByComparingTo("100");
    }

    @Test void otaSummaryNeverMixesCurrencies() {
        when(interventions.findPaymentHistory(isNull(), isNull(), any(), eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(requests.findAwaitingPaymentForHost(eq(2L), nullable(Long.class))).thenReturn(List.of());
        var eur = reservation(1, PaymentCollection.CHANNEL, PaymentStatus.PAID, "ota"); eur.setCurrency("EUR");
        var mad = reservation(2, PaymentCollection.CHANNEL, PaymentStatus.PAID, "ota"); mad.setCurrency("MAD");
        when(reservations.findAllWithPayment(eq(2L), nullable(Long.class))).thenReturn(List.of(eur, mad));
        var result = service.getPaymentSummary(admin, null);
        assertThat(result.paidByOtaByCurrency).hasSize(2);
        assertThat(result.paidByOtaByCurrency.get("EUR")).isEqualByComparingTo("100");
        assertThat(result.paidByOtaByCurrency.get("MAD")).isEqualByComparingTo("100");
    }

    @Test void offeredCreditNeverInflatesCashKpisAndMalformedDiscountStaysInReview() {
        when(interventions.findPaymentHistory(isNull(),isNull(),any(),eq(2L))).thenReturn(new PageImpl<>(List.of()));
        var paid=reservation(1,PaymentCollection.PMS,PaymentStatus.PAID,null);paid.setCreditApplied(new BigDecimal("20"));
        var pending=reservation(2,PaymentCollection.PMS,PaymentStatus.PENDING,null);pending.setCreditApplied(new BigDecimal("30"));
        var malformed=reservation(3,PaymentCollection.PMS,PaymentStatus.PAID,null);malformed.setCreditApplied(new BigDecimal("101"));
        when(reservations.findAllWithPayment(eq(2L),nullable(Long.class))).thenReturn(List.of(paid,pending,malformed));
        var result=service.getPaymentSummary(admin,null);
        assertThat(result.totalPaid).isEqualByComparingTo("80");assertThat(result.totalPending).isEqualByComparingTo("70");
        assertThat(result.totalToVerify).isEqualByComparingTo("100");assertThat(result.totalRefunded).isZero();
    }

    @Test void unknownFilterMatchesLegacyPaymentRatherThanStoredPaidFlag() {
        when(interventions.findPaymentHistory(eq(PaymentStatus.UNKNOWN), isNull(), any(), eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(requests.findPaymentHistory(eq(PaymentStatus.UNKNOWN), isNull(), any(), eq(2L))).thenReturn(new PageImpl<>(List.of()));
        var legacy = reservation(2, PaymentCollection.CHANNEL, PaymentStatus.PAID, null);
        when(reservations.findPaymentHistory(isNull(), nullable(Long.class), any(), eq(2L))).thenReturn(new PageImpl<>(List.of(
                legacy, reservation(1, PaymentCollection.CHANNEL, PaymentStatus.PAID, "ota"))));
        var result = service.getPaymentHistory(admin, PaymentStatus.UNKNOWN, null, 0, 10);
        @SuppressWarnings("unchecked") var records = (List<PaymentHistoryDto>) result.get("content");
        assertThat(records).hasSize(1);
        assertThat(records.getFirst().status).isEqualTo("UNKNOWN");
        assertThat(records.getFirst().canCollect).isFalse();
        assertThat(records.getFirst().settlementStatus).isEqualTo("EXTERNAL_UNVERIFIED");
        assertThat(legacy.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value=InterventionStatus.class,names={"PENDING","COMPLETED"})
    void payableAmountDeductsConfirmedDepositBeforeBatchReview(InterventionStatus status) {
        var mission = new Intervention(); mission.setId(3L); mission.setOrganizationId(2L);
        mission.setEstimatedCost(new BigDecimal("100")); mission.setPaymentStatus(PaymentStatus.PENDING);
        mission.setStatus(status);
        var quote = new ServiceQuote(); quote.setStatus(ServiceQuote.Status.APPROVED);
        quote.setDepositAmount(new BigDecimal("30")); quote.setDepositPaidAt(java.time.LocalDateTime.now()); quote.setDepositTransactionRef("DEP-TEST");
        when(quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(3L, 2L)).thenReturn(List.of(quote));
        when(interventions.findPaymentHistory(isNull(), isNull(), any(), eq(2L))).thenReturn(new PageImpl<>(List.of(mission)));
        when(requests.findPaymentHistory(isNull(), isNull(), any(), eq(2L))).thenReturn(new PageImpl<>(List.of()));
        when(reservations.findPaymentHistory(isNull(), nullable(Long.class), any(), eq(2L))).thenReturn(new PageImpl<>(List.of()));
        @SuppressWarnings("unchecked") var records = (List<PaymentHistoryDto>) service.getPaymentHistory(admin, null, null, 0, 10).get("content");
        assertThat(records.getFirst().canCollect).isTrue();
        assertThat(records.getFirst().payableAmount).isEqualByComparingTo("70");
    }

    @Test void ownerSummaryExcludesOtherOwnersReservationsAndServiceRequests() {
        var host = new User(); host.setId(42L); host.setRole(UserRole.HOST);
        var other = new User(); other.setId(43L); other.setRole(UserRole.HOST);
        var ownProperty = new Property(); ownProperty.setOwner(host);
        var otherProperty = new Property(); otherProperty.setOwner(other);
        var own = reservation(1, PaymentCollection.PMS, PaymentStatus.PAID, null); own.setProperty(ownProperty);
        var foreign = reservation(2, PaymentCollection.PMS, PaymentStatus.PAID, null); foreign.setProperty(otherProperty);
        var request = new ServiceRequest(); request.setUser(other); request.setEstimatedCost(new BigDecimal("80"));
        when(interventions.findPaymentHistoryByRequestor(eq(42L), isNull(), any(), eq(2L)))
                .thenReturn(new PageImpl<>(List.of()));
        when(reservations.findAllWithPayment(2L, null)).thenReturn(List.of(own, foreign));
        when(reservations.findAllWithPayment(2L, 42L)).thenReturn(List.of(own));
        when(requests.findAwaitingPaymentForHost(2L, null)).thenReturn(List.of(request));
        when(requests.findAwaitingPaymentForHost(2L, 42L)).thenReturn(List.of());

        var result = service.getPaymentSummary(host, 43L);

        assertThat(result.totalPaid).isEqualByComparingTo("100");
        assertThat(result.totalPending).isZero();
        assertThat(result.transactionCount).isEqualTo(1);
        verify(reservations).findAllWithPayment(2L, 42L);
        verify(requests).findAwaitingPaymentForHost(2L, 42L);
    }

    @Test void adminHistoryAppliesSelectedOwnerToAllSources() {
        when(interventions.findPaymentHistory(isNull(), eq(43L), any(), eq(2L)))
                .thenReturn(new PageImpl<>(List.of()));
        when(reservations.findPaymentHistory(isNull(), eq(43L), any(), eq(2L)))
                .thenReturn(new PageImpl<>(List.of()));
        when(requests.findPaymentHistory(isNull(), eq(43L), any(), eq(2L)))
                .thenReturn(new PageImpl<>(List.of()));
        assertThat(service.getPaymentHistory(admin, null, 43L, 0, 10)).containsEntry("totalElements", 0);
        verify(reservations).findPaymentHistory(isNull(), eq(43L), any(), eq(2L));
    }
}
