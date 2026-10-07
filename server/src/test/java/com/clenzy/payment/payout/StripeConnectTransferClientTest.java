package com.clenzy.payment.payout;

import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.Transfer;
import com.stripe.param.TransferCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.clenzy.model.PayoutTransfer;
import com.clenzy.service.payout.*;
import com.stripe.exception.ApiConnectionException;
import java.util.Optional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class StripeConnectTransferClientTest {

    private StripeGateway stripeGateway;
    private StripeConnectTransferClient client;
    private PayoutTransferJournal journal;
    private final PayoutTransferInstruction instruction = new PayoutTransferInstruction(
            7L, PayoutTransfer.Source.OWNER_PAYOUT, 1L, 11L, new BigDecimal("500.00"), "EUR", "acct_x", "desc");

    @BeforeEach
    void setUp() throws Exception {
        stripeGateway = mock(StripeGateway.class);
        journal = mock(PayoutTransferJournal.class);
        client = new StripeConnectTransferClient(stripeGateway, journal);
        when(stripeGateway.retrievePlatformBalance()).thenReturn(balance("eur", 50000L, 50000L));
    }

    @Test
    void createTransfer_convertsAmountLowercasesCurrencyAndReturnsId() throws StripeException {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_1");
        when(transfer.getDestinationPayment()).thenReturn("py_1");
        when(transfer.getLivemode()).thenReturn(false);
        ArgumentCaptor<TransferCreateParams> paramsCaptor = ArgumentCaptor.forClass(TransferCreateParams.class);
        when(stripeGateway.createTransfer(paramsCaptor.capture(), eq("payout-1"))).thenReturn(transfer);

        String id = client.createTransfer(instruction);

        assertThat(id).isEqualTo("tr_1");
        TransferCreateParams params = paramsCaptor.getValue();
        assertThat(params.getAmount()).isEqualTo(50000L);
        assertThat(params.getCurrency()).isEqualTo("eur");
        assertThat(params.getDestination()).isEqualTo("acct_x");
        assertThat(params.getDescription()).isEqualTo("desc");
        assertThat(params.getMetadata()).isEqualTo(com.clenzy.service.payout.PayoutTransferEvidence.metadata(instruction));
        var order = inOrder(journal, stripeGateway);
        order.verify(journal).previous(instruction);
        order.verify(stripeGateway).retrievePlatformBalance();
        order.verify(journal).prepare(instruction);
        order.verify(stripeGateway).createTransfer(any(), eq("payout-1"));
        order.verify(journal).transferred(instruction, "tr_1", "py_1", false);
    }

    @Test
    void successfulTransferIsReplayedLocallyEvenAfterProviderKeyExpires() throws Exception {
        when(journal.previous(instruction)).thenReturn(Optional.of("tr_original"));
        assertThat(client.createTransfer(instruction)).isEqualTo("tr_original");
        verifyNoInteractions(stripeGateway);
    }

    @Test
    void networkTimeoutRequiresReconciliationInsteadOfAutomaticRetry() throws Exception {
        when(stripeGateway.createTransfer(any(), anyString())).thenThrow(new ApiConnectionException("Timeout"));
        assertThatThrownBy(() -> client.createTransfer(instruction)).isInstanceOf(PayoutReconciliationRequiredException.class);
        verify(journal).uncertain(instruction);
        verify(journal, never()).transferred(any(), any(), any(), any());
    }

    @Test
    void databaseFailureAfterMoneyMovedKeepsKnownReferenceInAlert() throws Exception {
        Transfer transfer = new Transfer();
        transfer.setId("tr_money_sent");
        when(stripeGateway.createTransfer(any(), anyString())).thenReturn(transfer);
        doThrow(new IllegalStateException("Database unavailable")).when(journal).transferred(instruction, "tr_money_sent", null, null);
        assertThatThrownBy(() -> client.createTransfer(instruction))
                .isInstanceOfSatisfying(PayoutReconciliationRequiredException.class,
                        e -> assertThat(e.getTransferReference()).isEqualTo("tr_money_sent"));
        verify(journal).uncertain(instruction);
    }

    @Test
    void concurrentOrUncertainRequestNeverCallsProvider() {
        when(journal.previous(instruction)).thenThrow(new PayoutReconciliationRequiredException("Pending", null, null));
        assertThatThrownBy(() -> client.createTransfer(instruction)).isInstanceOf(PayoutReconciliationRequiredException.class);
        verifyNoInteractions(stripeGateway);
        verify(journal, never()).uncertain(any());
    }

    private com.stripe.model.Balance balance(String currency, Long amount, Long card) {
        var row = new com.stripe.model.Balance.Available();
        row.setCurrency(currency); row.setAmount(amount);
        var sources = new com.stripe.model.Balance.Available.SourceTypes(); sources.setCard(card); row.setSourceTypes(sources);
        var balance = new com.stripe.model.Balance(); balance.setAvailable(java.util.List.of(row)); return balance;
    }

    @Test void insufficientWrongCurrencyAndUnverifiableFundsNeverReserveOrSend() throws Exception {
        for (var balance : java.util.List.of(balance("eur",49999L,50000L), balance("eur",50000L,49999L),
                balance("usd",90000L,90000L), balance("eur",50000L,null), balance("eur",null,50000L))) {
            when(stripeGateway.retrievePlatformBalance()).thenReturn(balance);
            assertThatThrownBy(() -> client.createTransfer(instruction)).isInstanceOf(PayoutFundsUnavailableException.class);
        }
        verify(journal, never()).prepare(any());
        verify(stripeGateway, never()).createTransfer(any(), any());
        verify(journal, never()).uncertain(any());
    }

    @Test void balanceOutageIsSafeToRetryAndDoesNotClaimAnEmission() throws Exception {
        when(stripeGateway.retrievePlatformBalance()).thenThrow(new ApiConnectionException("Offline"));
        assertThatThrownBy(() -> client.createTransfer(instruction)).isInstanceOf(PayoutFundsUnavailableException.class)
                .hasCauseInstanceOf(ApiConnectionException.class);
        verify(journal, never()).prepare(any());
        verify(journal, never()).uncertain(any());
    }

    @Test void prepareStillArbitratesAConcurrentTransferAfterBalanceCheck() throws Exception {
        when(journal.prepare(instruction)).thenReturn(Optional.of("tr_concurrent"));
        assertThat(client.createTransfer(instruction)).isEqualTo("tr_concurrent");
        verify(stripeGateway, never()).createTransfer(any(), any());
    }

    @Test void unavailableProviderConfigurationAlsoFailsBeforeClaimingFunds() throws Exception {
        when(stripeGateway.retrievePlatformBalance()).thenThrow(new IllegalArgumentException("Missing API configuration"));
        assertThatThrownBy(() -> client.createTransfer(instruction)).isInstanceOf(PayoutFundsUnavailableException.class);
        verify(journal, never()).prepare(any());
        verify(stripeGateway, never()).createTransfer(any(),any());
    }

    @Test void receiptPreservesDestinationPaymentAndModeForBankMatching() throws Exception {
        var transfer = new Transfer(); transfer.setId("tr_proof"); transfer.setDestinationPayment("py_receipt"); transfer.setLivemode(false);
        when(stripeGateway.createTransfer(any(),any())).thenReturn(transfer);
        assertThat(client.createTransfer(instruction)).isEqualTo("tr_proof");
        verify(journal).transferred(instruction,"tr_proof","py_receipt",false);
    }

    @Test
    void refusesAnExternalCallWithinDatabaseTransaction() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            assertThatThrownBy(() -> client.createTransfer(instruction)).isInstanceOf(IllegalStateException.class);
            verifyNoInteractions(journal, stripeGateway);
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
    }
}
