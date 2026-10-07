package com.clenzy.payment.payout;

import com.clenzy.payment.StripeGateway;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore.Instruction;
import com.stripe.model.Transfer;
import com.stripe.model.TransferReversal;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyStripeTransferRecoveryTest {
    StripeGateway gateway = mock(StripeGateway.class);
    BaitlyStripeTransferRecovery service = new BaitlyStripeTransferRecovery(gateway);
    Instruction order = order(Instant.now());
    Transfer transfer;
    TransferReversal proof;
    static Instruction order(Instant first) {
        return new Instruction(1L,7L,2L,"tr_test","acct_provider","py_test",false,
                new BigDecimal("30"),new BigDecimal("30"),"EUR","REF-test",first);
    }
    @BeforeEach void stripe() throws Exception {
        transfer = new Transfer(); transfer.setId("tr_test"); transfer.setAmount(3000L); transfer.setCurrency("eur");
        transfer.setDestination("acct_provider"); transfer.setDestinationPayment("py_test"); transfer.setLivemode(false);
        transfer.setReversed(false); transfer.setAmountReversed(0L);
        proof = new TransferReversal(); proof.setId("trr_test"); proof.setAmount(3000L); proof.setCurrency("eur");
        proof.setTransfer("tr_test"); proof.setBalanceTransaction("txn_test"); proof.setCreated(Instant.now().getEpochSecond());
        proof.setMetadata(order.metadata());
        when(gateway.retrieveTransfer("tr_test")).thenReturn(transfer);
        when(gateway.listTransferReversals("tr_test")).thenReturn(List.of());
        when(gateway.createTransferReversal(eq("tr_test"),any(),eq(order.key()))).thenReturn(proof);
        when(gateway.retrieveTransferReversal("tr_test","trr_test")).thenReturn(proof);
    }
    @Test void recoveryUsesExactAmountDestinationAndDurableKeyThenCanonicalProof() throws Exception {
        assertThat(service.recover(order)).isEqualTo("trr_test");
        verify(gateway).createTransferReversal(eq("tr_test"),argThat(p -> p.getAmount()==3000L && p.getMetadata().equals(order.metadata())),eq(order.key()));
    }
    @Test void lostResponseIsDiscoveredEvenAfterIdempotencyExpirationWithoutNewTransfer() throws Exception {
        when(gateway.createTransferReversal(anyString(),any(),anyString())).thenThrow(new IllegalStateException("timeout"));
        assertThatThrownBy(() -> service.recover(order)).hasMessage("timeout");
        when(gateway.listTransferReversals("tr_test")).thenReturn(List.of(proof));
        transfer.setReversed(true); transfer.setAmountReversed(3000L);
        assertThat(service.recover(order(Instant.now().minusSeconds(48*3600)))).isEqualTo("trr_test");
        verify(gateway,times(1)).createTransferReversal(anyString(),any(),anyString());
    }
    @Test void missingOldProofCannotCreateAgainWithExpiredKey() {
        assertThatThrownBy(() -> service.recover(order(Instant.now().minusSeconds(24*3600)))).hasMessage("RECOVERY_WINDOW_EXPIRED");
        verifyNoEmission();
    }

    Instruction afterFirst() throws Exception {
        var first = new TransferReversal(); first.setId("trr_first"); first.setTransfer("tr_test");
        first.setAmount(501L); first.setCurrency("eur"); first.setCreated(Instant.now().getEpochSecond());
        first.setBalanceTransaction("txn_first"); first.setMetadata(Map.of("baitly_recovery_id","99","baitly_refund_ref","REF-first"));
        transfer.setAmountReversed(501L);
        when(gateway.listTransferReversals("tr_test")).thenReturn(List.of(first));
        when(gateway.retrieveTransferReversal("tr_test","trr_first")).thenReturn(first);
        proof.setAmount(2499L);
        return new Instruction(1L,7L,2L,"tr_test","acct_provider","py_test",false,new BigDecimal("30"),
                new BigDecimal("24.99"),"EUR","REF-test",Instant.now(),List.of(
                    new com.clenzy.service.payout.BaitlyTransferRecoveryStore.PreviousRecovery("trr_first",new BigDecimal("5.01"),first.getMetadata())));
    }
    @Test void secondRecoveryChecksPreviousCanonicalEvidenceAndRecoversOnlyRemainingCents() throws Exception {
        var next = afterFirst();
        assertThat(service.recover(next)).isEqualTo("trr_test");
        verify(gateway).retrieveTransferReversal("tr_test","trr_first");
        verify(gateway).createTransferReversal(eq("tr_test"),argThat(p -> p.getAmount()==2499L),eq(next.key()));
    }
    @ParameterizedTest @ValueSource(strings={"missing","unknown","amount","metadata","total"})
    void previousOrExternalReversalMustNeverBeGuessed(String defect) throws Exception {
        var next = afterFirst();
        var prior = gateway.retrieveTransferReversal("tr_test","trr_first");
        switch(defect) {
            case "missing" -> when(gateway.listTransferReversals("tr_test")).thenReturn(List.of());
            case "unknown" -> { var other = new TransferReversal(); other.setId("trr_external");
                when(gateway.listTransferReversals("tr_test")).thenReturn(List.of(prior,other)); }
            case "amount" -> prior.setAmount(500L);
            case "metadata" -> prior.setMetadata(Map.of("baitly_recovery_id","other"));
            case "total" -> transfer.setAmountReversed(502L);
        }
        assertThatThrownBy(() -> service.recover(next)).isInstanceOf(IllegalStateException.class);
        verifyNoEmission();
    }
    @Test void canonicalReadCannotReplaceRequestedReference() throws Exception {
        var listed = new TransferReversal(); listed.setId("trr_requested"); listed.setMetadata(order.metadata());
        when(gateway.listTransferReversals("tr_test")).thenReturn(List.of(listed));
        when(gateway.retrieveTransferReversal("tr_test","trr_requested")).thenReturn(proof);
        assertThatThrownBy(() -> service.recover(order)).hasMessage("RECOVERY_PROOF_MISMATCH");
        verifyNoEmission();
    }
    @ParameterizedTest @ValueSource(strings={"amount","destination","currency","livemode","payment","reference","external"})
    void incompatibleTransferNeverEmits(String defect) {
        switch(defect) {
            case "amount" -> transfer.setAmount(3100L);
            case "destination" -> transfer.setDestination("acct_other");
            case "currency" -> transfer.setCurrency("usd");
            case "livemode" -> transfer.setLivemode(true);
            case "payment" -> transfer.setDestinationPayment("py_other");
            case "reference" -> transfer.setId("tr_other");
            case "external" -> transfer.setAmountReversed(100L);
        }
        assertThatThrownBy(() -> service.recover(order)).isInstanceOf(IllegalStateException.class);
        verifyNoEmission();
    }
    @ParameterizedTest @ValueSource(strings={"amount","currency","transfer","balance","metadata","duplicate"})
    void canonicalRecoveryMustMatchEveryBoundField(String defect) throws Exception {
        when(gateway.listTransferReversals("tr_test")).thenReturn(List.of(proof));
        switch(defect) {
            case "amount" -> proof.setAmount(2000L);
            case "currency" -> proof.setCurrency("usd");
            case "transfer" -> proof.setTransfer("tr_other");
            case "balance" -> proof.setBalanceTransaction(null);
            case "metadata" -> { var m=new HashMap<>(order.metadata()); m.put("baitly_organization_id","8"); proof.setMetadata(m); }
            case "duplicate" -> when(gateway.listTransferReversals("tr_test")).thenReturn(List.of(proof,proof));
        }
        assertThatThrownBy(() -> service.recover(order)).isInstanceOf(IllegalStateException.class);
        verifyNoEmission();
    }
    @Test void sqlTransactionNeverContainsStripeNetwork() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try { assertThatThrownBy(() -> service.recover(order)).hasMessage("NETWORK_INSIDE_TRANSACTION"); verifyNoInteractions(gateway); }
        finally { TransactionSynchronizationManager.setActualTransactionActive(false); }
    }
    private void verifyNoEmission() {
        try { verify(gateway,never()).createTransferReversal(anyString(),any(),anyString()); }
        catch(com.stripe.exception.StripeException e) { throw new AssertionError(e); }
    }
}
