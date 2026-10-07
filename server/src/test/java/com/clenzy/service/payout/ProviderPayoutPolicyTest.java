package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.catalog.ServiceCatalogReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProviderPayoutPolicyTest {
    private final PaymentTransactionRepository transactions = mock(PaymentTransactionRepository.class);
    private final ServiceCatalogReference catalog = mock(ServiceCatalogReference.class);
    private final com.clenzy.repository.InterventionPaymentAllocationRepository allocations = mock(com.clenzy.repository.InterventionPaymentAllocationRepository.class);
    private final BaitlyResidualPayoutFunding residual = mock(BaitlyResidualPayoutFunding.class);
    private final ProviderPayoutPolicy policy = new ProviderPayoutPolicy(transactions,catalog,allocations,residual);
    private final Intervention mission = new Intervention();
    @BeforeEach void setup() {
        mission.setId(11L); mission.setOrganizationId(7L); mission.setStatus(InterventionStatus.COMPLETED);
        mission.setPaymentStatus(PaymentStatus.PAID); mission.setCurrency("EUR");
        mission.setEstimatedCost(new BigDecimal("100"));
    }
    private PaymentTransaction receipt(String ref,String amount) {
        var tx = new PaymentTransaction();
        tx.setOrganizationId(7L); tx.setSourceType("INTERVENTION"); tx.setSourceId(11L);
        tx.setPaymentType(TransactionType.CHECKOUT); tx.setStatus(TransactionStatus.COMPLETED);
        tx.setProviderType(PaymentProviderType.STRIPE); tx.setProviderTxId(ref);
        tx.setAmount(new BigDecimal(amount)); tx.setCurrency("EUR"); return tx;
    }
    @Test void paidFlagWithoutCollectionCannotFundAnyProvider() {
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
    }
    @Test void disputedReceiptNeverFundsAProvider() {
        var payment=receipt("cs_paid","100"); payment.setDisputedAmount(BigDecimal.ONE);
        assertThat(ProviderPayoutPolicy.fullyFunded(mission,new BigDecimal("100"),List.of(payment))).isFalse();
    }
    @Test void partialStatusNeedsReconciledResidualEvidence() {
        mission.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
        when(residual.available(mission)).thenReturn(Optional.of(new BigDecimal("30")));
        assertThat(policy.blockingReason(mission)).isNull();
        assertThat(policy.payableGross(mission)).isEqualByComparingTo("30");
        mission.setStatus(InterventionStatus.CANCELLED);
        assertThat(policy.blockingReason(mission)).isEqualTo("MISSION_NOT_COMPLETED");
    }
    @Test void depositAndBalanceFundExactlyOneMission() {
        when(transactions.findByOrganizationIdAndSourceTypeAndSourceId(7L,"INTERVENTION",11L))
                .thenReturn(List.of(receipt("cs_deposit","30"),receipt("cs_balance","70")));
        assertThat(policy.blockingReason(mission)).isNull();
        mission.setStatus(InterventionStatus.IN_PROGRESS);
        assertThat(policy.blockingReason(mission)).isEqualTo("MISSION_NOT_COMPLETED");
    }
    @Test void acceptedMarketplaceNeedCanSupplyPaymentEvidence() {
        var need = new ServiceRequest(); need.setId(21L); need.setOrganizationId(7L); need.setConvertedInterventionId(11L);
        mission.setServiceRequest(need);
        var tx = receipt("cs_need","100"); tx.setSourceType("SERVICE_REQUEST"); tx.setSourceId(21L);
        when(transactions.findByOrganizationIdAndSourceTypeAndSourceId(7L,"SERVICE_REQUEST",21L)).thenReturn(List.of(tx));
        assertThat(policy.blockingReason(mission)).isNull();
        need.setOrganizationId(8L);
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
    }
    @Test void refundOrUnallocatedBatchRequiresReconciliation() {
        var full = receipt("cs_full","100");
        var refund = receipt("re_1","10"); refund.setPaymentType(TransactionType.REFUND); refund.setStatus(TransactionStatus.PENDING);
        assertThat(ProviderPayoutPolicy.fullyFunded(mission,new BigDecimal("100"),List.of(full,refund))).isFalse();
        full.setMetadata(Map.of("interventionIds","11,12"));
        assertThat(ProviderPayoutPolicy.fullyFunded(mission,new BigDecimal("100"),List.of(full))).isFalse();
    }
    @Test void duplicateReceiptCannotBeCountedTwice() {
        var tx = receipt("cs_one","50");
        assertThat(ProviderPayoutPolicy.fullyFunded(mission,new BigDecimal("100"),List.of(tx,tx))).isFalse();
    }
    @Test void foreignCurrencyCannotBeReinterpretedAsEuros() {
        mission.setCurrency("MAD");
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYOUT_CURRENCY_UNSUPPORTED");
        mission.setCurrency("EUR");
        var tx=receipt("cs_mad","100"); tx.setCurrency("MAD");
        assertThat(ProviderPayoutPolicy.fullyFunded(mission,new BigDecimal("100"),List.of(tx))).isFalse();
    }

    @Test void confirmedBatchSuppliesOnlyTheMissionAllocation() {
        var tx = receipt("cs_batch", "180"); tx.setSourceType("INTERVENTION_BATCH"); tx.setTransactionRef("TX-batch");
        tx.setMetadata(Map.of("interventionIds", "11,12"));
        var own = new InterventionPaymentAllocation(tx, 11L, new BigDecimal("100")); own.confirm();
        var other = new InterventionPaymentAllocation(tx, 12L, new BigDecimal("80")); other.confirm();
        when(allocations.findForMission(7L,11L)).thenReturn(List.of(own));
        when(allocations.findForTransaction(7L,"TX-batch")).thenReturn(List.of(own,other));
        assertThat(policy.blockingReason(mission)).isNull();
        var refund=receipt("re_part","100"); refund.setPaymentType(TransactionType.REFUND); refund.setStatus(TransactionStatus.PROCESSING);
        when(transactions.findByOrganizationIdAndSourceTypeAndSourceId(7L,"INTERVENTION",11L)).thenReturn(List.of(refund));
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
        when(transactions.findByOrganizationIdAndSourceTypeAndSourceId(7L,"INTERVENTION",11L)).thenReturn(List.of());
        mission.setEstimatedCost(new BigDecimal("180"));
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
    }
    @Test void incompleteOrUnconfirmedBatchNeverFundsAPayout() {
        var tx = receipt("cs_batch", "180"); tx.setSourceType("INTERVENTION_BATCH"); tx.setTransactionRef("TX-batch");
        tx.setMetadata(Map.of("interventionIds", "11,12"));
        var own = new InterventionPaymentAllocation(tx,11L,new BigDecimal("100")); own.confirm();
        var other = new InterventionPaymentAllocation(tx,12L,new BigDecimal("80"));
        when(allocations.findForMission(7L,11L)).thenReturn(List.of(own));
        when(allocations.findForTransaction(7L,"TX-batch")).thenReturn(List.of(own));
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
        when(allocations.findForTransaction(7L,"TX-batch")).thenReturn(List.of(own,other));
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
        other.confirm();
        var refund = receipt("re_batch","10"); refund.setPaymentType(TransactionType.REFUND);
        when(transactions.findByOrganizationIdAndSourceTypeAndSourceId(7L,"INTERVENTION_BATCH",11L)).thenReturn(List.of(tx,refund));
        assertThat(policy.blockingReason(mission)).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
    }
    @ParameterizedTest
    @CsvSource({"CLEANING,entretien","MAINTENANCE,travaux","LAUNDRY,blanchisserie","LINEN,blanchisserie",
            "EXTERIOR,exterieur","POOL,exterieur","CHEF,chef","DRIVER,driver","PHOTOGRAPHY,photography","CONCIERGE,concierge"})
    void eachTradeSelectsItsOwnCommission(String category,String commission) {
        mission.setServiceItemCode("catalog-service");
        when(catalog.categoryCode("catalog-service")).thenReturn(category);
        assertThat(policy.commissionCategory(mission)).isEqualTo(commission);
    }
}
