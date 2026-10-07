package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PayoutTransferJournalTest {
    private final PayoutTransferRepository transfers = mock(PayoutTransferRepository.class);
    private final PayoutTransferEventRepository events = mock(PayoutTransferEventRepository.class);
    private final BaitlyProviderPayoutGuard guard = mock(BaitlyProviderPayoutGuard.class);
    private final BaitlyOwnerPayoutGuard ownerGuard = mock(BaitlyOwnerPayoutGuard.class);
    private final BaitlyExpensePayoutStore expenses = mock(BaitlyExpensePayoutStore.class);
    private final PayoutTransferJournal journal = new PayoutTransferJournal(transfers, events, guard, ownerGuard, mock(BaitlyOwnerPayoutDocuments.class), expenses, org.mockito.Mockito.mock(BaitlyCommercePayoutStore.class));
    private final PayoutTransferInstruction instruction = new PayoutTransferInstruction(
            7L, PayoutTransfer.Source.OWNER_PAYOUT, 31L, 10L, new BigDecimal("80"), "eur", "acct_owner", "Payout #31");
    private PayoutTransfer row;

    @BeforeEach
    void setup() {
        row = new PayoutTransfer();
        ReflectionTestUtils.setField(row, "id", 1L);
        ReflectionTestUtils.setField(row, "organizationId", instruction.organizationId());
        ReflectionTestUtils.setField(row, "source", instruction.source());
        ReflectionTestUtils.setField(row, "sourceId", instruction.sourceId());
        ReflectionTestUtils.setField(row, "beneficiaryUserId", instruction.beneficiaryUserId());
        ReflectionTestUtils.setField(row, "amount", instruction.amount());
        ReflectionTestUtils.setField(row, "currency", instruction.currency());
        ReflectionTestUtils.setField(row, "destination", instruction.destination());
        ReflectionTestUtils.setField(row, "description", instruction.description());
        ReflectionTestUtils.setField(row, "provider", "STRIPE");
        ReflectionTestUtils.setField(row, "idempotencyKey", instruction.idempotencyKey());
        ReflectionTestUtils.setField(row, "state", PayoutTransfer.State.SUBMITTING);
        when(transfers.lockBySource(7L, instruction.source(), 31L)).thenReturn(Optional.of(row));
    }

    @Test void preflightLookupBlocksUncertaintyAndReplaysOnlyMatchingSuccess() {
        assertThatThrownBy(() -> journal.previous(instruction)).isInstanceOf(PayoutReconciliationRequiredException.class);
        row.transferred("tr_original");
        assertThat(journal.previous(instruction)).contains("tr_original");
        ReflectionTestUtils.setField(row,"amount",new BigDecimal("79"));
        assertThatThrownBy(() -> journal.previous(instruction)).isInstanceOf(PayoutReconciliationRequiredException.class);
        verifyNoInteractions(events);
        verify(transfers,never()).insertIfAbsent(any(),any(),any(),any(),any(),any(),any(),any(),any(),any());
    }
    @Test void providerFundingIsRecheckedBeforeReservingAnyTransfer() {
        var provider = new PayoutTransferInstruction(7L,PayoutTransfer.Source.INTERVENTION,11L,42L,
                new BigDecimal("30"),"EUR","acct_provider","Solde prestation #11");
        doThrow(new IllegalStateException("remboursement à rapprocher")).when(guard).requireInstruction(provider);
        assertThatThrownBy(() -> journal.prepare(provider)).hasMessageContaining("remboursement");
        verify(transfers,never()).insertIfAbsent(any(),any(),any(),any(),any(),any(),any(),any(),any(),any());
        verifyNoInteractions(events);
    }

    @Test void expenseFundingIsRecheckedAndOnlyStripeProofSettlesTheExpense() {
        var expense = new PayoutTransferInstruction(7L,PayoutTransfer.Source.PROVIDER_EXPENSE,61L,42L,
                new BigDecimal("80"),"EUR","acct_provider","Dépense #61");
        when(transfers.lockBySource(7L,expense.source(),61L)).thenReturn(Optional.empty());
        doThrow(new IllegalStateException("retenue absente")).when(expenses).requireInstruction(expense);
        assertThatThrownBy(() -> journal.prepare(expense)).hasMessageContaining("retenue");
        verify(transfers,never()).insertIfAbsent(any(),any(),any(),any(),any(),any(),any(),any(),any(),any());
        verify(expenses,never()).settle(any());
        var expenseRow=PayoutReconciliationServiceTest.row(expense);
        when(transfers.lockBySource(7L,expense.source(),61L)).thenReturn(Optional.of(expenseRow));
        journal.transferred(expense,"tr_expense","py_expense",false);
        verify(expenses).settle(argThat(t -> t.getState()==PayoutTransfer.State.TRANSFERRED
                && "tr_expense".equals(t.getExternalReference()) && "py_expense".equals(t.getDestinationPayment())));
    }

    @Test void destinationEvidenceIsPersistedAndCannotBeReplaced() {
        journal.transferred(instruction,"tr_original","py_original",false);
        assertThat(row.getDestinationPayment()).isEqualTo("py_original");
        assertThat(row.getStripeLivemode()).isFalse();
        assertThatThrownBy(() -> journal.transferred(instruction,"tr_original","py_other",false)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> journal.transferred(instruction,"tr_original","py_original",true)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void onlyNewInstructionAcquiresEmissionAndAppendsEvent() {
        when(transfers.lockBySource(7L, instruction.source(), 31L)).thenReturn(Optional.empty(), Optional.of(row));
        when(transfers.insertIfAbsent(anyLong(), anyString(), anyLong(), anyLong(), isNull(), any(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(1);
        assertThat(journal.prepare(instruction)).isEmpty();
        verify(events).save(argThat(e -> e.getState() == PayoutTransfer.State.SUBMITTING));
        verify(ownerGuard).requireInstruction(instruction);
    }

    @Test
    void knownTransferIsReturnedWithoutNewEvent() {
        row.transferred("tr_original");
        assertThat(journal.prepare(instruction)).contains("tr_original");
        verifyNoInteractions(events);
        verifyNoInteractions(ownerGuard, guard);
    }

    @Test void staleOwnerFundingNeverReservesAnEmission() {
        when(transfers.lockBySource(7L, instruction.source(), 31L)).thenReturn(Optional.empty());
        doThrow(new IllegalStateException("litige reçu")).when(ownerGuard).requireInstruction(instruction);
        assertThatThrownBy(() -> journal.prepare(instruction)).isInstanceOf(PayoutFundsUnavailableException.class);
        verify(transfers,never()).insertIfAbsent(any(),any(),any(),any(),any(),any(),any(),any(),any(),any());
        verifyNoInteractions(events);
    }

    @ParameterizedTest
    @EnumSource(value = PayoutTransfer.State.class, names = {"SUBMITTING", "RECONCILIATION_REQUIRED"})
    void inFlightAndUncertainTransfersCannotBeReissued(PayoutTransfer.State state) {
        ReflectionTestUtils.setField(row, "state", state);
        assertThatThrownBy(() -> journal.prepare(instruction)).isInstanceOf(PayoutReconciliationRequiredException.class);
        verifyNoInteractions(events);
    }

    @Test
    void amountBeneficiaryAndDestinationCannotChangeOnRetry() {
        row.transferred("tr_original");
        for (PayoutTransferInstruction changed : new PayoutTransferInstruction[] {
                new PayoutTransferInstruction(7L, instruction.source(), 31L, 99L, instruction.amount(), "EUR", "acct_owner", "Payout #31"),
                new PayoutTransferInstruction(7L, instruction.source(), 31L, null, 10L, instruction.amount(), "EUR", "acct_owner", "Payout #31"),
                new PayoutTransferInstruction(7L, instruction.source(), 31L, 10L, new BigDecimal("79"), "EUR", "acct_owner", "Payout #31"),
                new PayoutTransferInstruction(7L, instruction.source(), 31L, 10L, instruction.amount(), "EUR", "acct_other", "Payout #31")}) {
            assertThatThrownBy(() -> journal.prepare(changed)).isInstanceOf(PayoutReconciliationRequiredException.class);
        }
    }

    @Test void beneficiaryMustBeOnePersonOrOneOrganization() {
        assertThatThrownBy(() -> new PayoutBeneficiary(null,null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PayoutBeneficiary(42L,9L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PayoutBeneficiary.organization(-9L)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void moneyScaleDoesNotBreakIdempotency() {
        ReflectionTestUtils.setField(row, "amount", new BigDecimal("80.0"));
        row.transferred("tr_original");
        assertThat(journal.prepare(instruction)).contains("tr_original");
    }

    @Test
    void repeatedSuccessAndLateFailureDoNotOverwriteConfirmedTransfer() {
        journal.transferred(instruction, "tr_original");
        journal.transferred(instruction, "tr_original");
        journal.uncertain(instruction);
        assertThat(row.getState()).isEqualTo(PayoutTransfer.State.TRANSFERRED);
        verify(events, times(1)).save(any());
        assertThatThrownBy(() -> journal.transferred(instruction, "tr_other")).isInstanceOf(PayoutReconciliationRequiredException.class);
    }

    @Test
    void repeatedUncertaintyAppendsOnlyOneTransition() {
        journal.uncertain(instruction);
        journal.uncertain(instruction);
        assertThat(row.getState()).isEqualTo(PayoutTransfer.State.RECONCILIATION_REQUIRED);
        verify(events, times(1)).save(any());
    }

    @Test
    void switchingRailCannotBypassAnUncertainOrSuccessfulTransfer() {
        assertThatThrownBy(() -> journal.checkOwnerRoute(7L, 31L, PayoutMethod.SEPA_TRANSFER))
                .isInstanceOf(PayoutReconciliationRequiredException.class);
        row.transferred("tr_original");
        assertThatThrownBy(() -> journal.checkOwnerRoute(7L, 31L, PayoutMethod.WISE))
                .isInstanceOf(PayoutReconciliationRequiredException.class);
        journal.checkOwnerRoute(7L, 31L, PayoutMethod.STRIPE_CONNECT);
    }

    @Test
    void precisionCannotBeSilentlyRounded() {
        assertThatThrownBy(() -> new PayoutTransferInstruction(7L, instruction.source(), 31L, 10L,
                new BigDecimal("80.001"), "EUR", "acct_owner", "Payout #31")).isInstanceOf(ArithmeticException.class);
        assertThatThrownBy(() -> new PayoutTransferInstruction(7L, instruction.source(), 31L, 10L,
                new BigDecimal("80"), "JPY", "acct_owner", "Payout #31")).isInstanceOf(IllegalArgumentException.class);
    }
}
