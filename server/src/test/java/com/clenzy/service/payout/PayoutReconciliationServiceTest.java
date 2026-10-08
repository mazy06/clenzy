package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.*;
import com.stripe.model.Transfer;
import com.stripe.exception.ApiConnectionException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PayoutReconciliationServiceTest {
    final PayoutTransferRepository transfers=mock(PayoutTransferRepository.class);
    final PayoutTransferEventRepository events=mock(PayoutTransferEventRepository.class);
    final OwnerPayoutRepository owners=mock(OwnerPayoutRepository.class);
    final HousekeeperPayoutRecordRepository providers=mock(HousekeeperPayoutRecordRepository.class);
    final StripeGateway stripe=mock(StripeGateway.class);
    final BaitlyExpensePayoutStore expenses=mock(BaitlyExpensePayoutStore.class);
    final PayoutReconciliationWriter writer=new PayoutReconciliationWriter(transfers,events,owners,providers,org.mockito.Mockito.mock(BaitlyOwnerPayoutDocuments.class), expenses, org.mockito.Mockito.mock(BaitlyCommercePayoutStore.class));
    final PayoutReconciliationService service=new PayoutReconciliationService(transfers,stripe,writer);
    final PayoutTransferInstruction instruction=new PayoutTransferInstruction(7L,PayoutTransfer.Source.INTERVENTION,11L,null,9L,
            new BigDecimal("80"),"EUR","acct_company","Maintenance #11");
    PayoutTransfer row;
    Transfer receipt;
    HousekeeperPayoutRecord payout;
    @BeforeEach void setup() throws Exception {
        row=row(instruction);receipt=receipt(instruction);
        payout=new HousekeeperPayoutRecord(7L,null,11L,new BigDecimal("80"),BigDecimal.TEN,HousekeeperPayoutRecord.Status.FAILED);
        payout.setBeneficiaryOrganizationId(9L);
        when(transfers.findByIdAndOrganizationId(1L,7L)).thenReturn(Optional.of(row));
        when(transfers.lockByIdAndOrganizationId(1L,7L)).thenReturn(Optional.of(row));
        when(providers.lockForReconciliation(11L,7L)).thenReturn(Optional.of(payout));
        when(stripe.retrieveTransfer("tr_match")).thenReturn(receipt);
    }
    static PayoutTransfer row(PayoutTransferInstruction instruction) {
        var row=new PayoutTransfer();
        for(var component:PayoutTransferInstruction.class.getRecordComponents()) {
            try { ReflectionTestUtils.setField(row,component.getName(),component.getAccessor().invoke(instruction)); }
            catch(Exception failure) { throw new AssertionError(failure); }
        }
        ReflectionTestUtils.setField(row,"id",1L);
        ReflectionTestUtils.setField(row,"provider","STRIPE");
        ReflectionTestUtils.setField(row,"idempotencyKey",instruction.idempotencyKey());
        row.requireReconciliation();return row;
    }
    static Transfer receipt(PayoutTransferInstruction instruction) {
        var receipt=new Transfer();receipt.setId("tr_match");receipt.setAmount(8000L);receipt.setCurrency("eur");
        receipt.setDestination(instruction.destination());receipt.setDestinationPayment("py_match");receipt.setLivemode(false);
        receipt.setReversed(false);receipt.setAmountReversed(0L);receipt.setCreated(1791200000L);
        receipt.setMetadata(PayoutTransferEvidence.metadata(instruction));return receipt;
    }
    @Test void verificationIsReadOnlyAndConfirmationRereadsStripeThenAuditsCompanyTransfer() throws Exception {
        assertThat(service.verify(7L,1L,"tr_match").reference()).isEqualTo("tr_match");
        verifyNoInteractions(events,owners,providers);
        assertThat(row.getState()).isEqualTo(PayoutTransfer.State.RECONCILIATION_REQUIRED);
        service.confirm(7L,1L,"tr_match","staff-subject");
        assertThat(payout.getStatus()).isEqualTo(HousekeeperPayoutRecord.Status.SENT);
        assertThat(payout.getStripeTransferId()).isEqualTo("tr_match");
        assertThat(row.getDestinationPayment()).isEqualTo("py_match");
        verify(events).save(argThat(event -> event.getOrigin().equals("RECONCILIATION") && event.getActorSubject().equals("staff-subject")));
        verify(stripe,times(2)).retrieveTransfer("tr_match");verifyNoMoreInteractions(stripe);
        service.confirm(7L,1L,"tr_match","staff-subject");
        verify(providers,times(1)).save(payout);verify(events,times(1)).save(any());
    }
    @Test void expenseReconciliationSettlesOnlyTheMatchingExpenseAndDoesNotReissueMoney() throws Exception {
        var expense=new PayoutTransferInstruction(7L,PayoutTransfer.Source.PROVIDER_EXPENSE,61L,42L,
                new BigDecimal("80"),"EUR","acct_provider","Dépense #61");
        row=row(expense);receipt=receipt(expense);
        when(transfers.findByIdAndOrganizationId(1L,7L)).thenReturn(Optional.of(row));
        when(transfers.lockByIdAndOrganizationId(1L,7L)).thenReturn(Optional.of(row));
        when(stripe.retrieveTransfer("tr_match")).thenReturn(receipt);
        service.verify(7L,1L,"tr_match");verifyNoInteractions(expenses);
        service.confirm(7L,1L,"tr_match","staff");
        service.confirm(7L,1L,"tr_match","staff");
        verify(expenses,times(1)).settle(row);verifyNoInteractions(owners,providers);
        verify(stripe,times(3)).retrieveTransfer("tr_match");verifyNoMoreInteractions(stripe);
        verify(events,times(1)).save(any());
    }
    @Test void foreignOrganizationIsRejectedBeforeStripeLookup() {
        assertThatThrownBy(() -> service.verify(8L,1L,"tr_match")).isInstanceOf(com.clenzy.exception.NotFoundException.class);
        verifyNoInteractions(stripe,events);
    }
    @Test void missingActorIsRejectedBeforeLookup() {
        assertThatThrownBy(() -> service.confirm(7L,1L,"tr_match",null)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(stripe);
    }
    @Test void inFlightTransfersCannotBeReconciled() {
        ReflectionTestUtils.setField(row,"state",PayoutTransfer.State.SUBMITTING);
        assertThatThrownBy(() -> service.verify(7L,1L,"tr_match")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(stripe);
    }
    @ParameterizedTest @ValueSource(strings={"amount","currency","destination","metadata","reversed","amountReversed","reference","proof","mode"})
    void incompatibleOrIncompleteEvidenceNeverChangesMoneyState(String field) {
        switch(field) {
            case "amount" -> receipt.setAmount(7900L);
            case "currency" -> receipt.setCurrency("usd");
            case "destination" -> receipt.setDestination("acct_other");
            case "metadata" -> receipt.setMetadata(Map.of());
            case "reversed" -> receipt.setReversed(true);
            case "amountReversed" -> receipt.setAmountReversed(1L);
            case "reference" -> receipt.setId("tr_other");
            case "proof" -> receipt.setDestinationPayment((String)null);
            case "mode" -> { row.captureDestinationPayment("py_match",true); }
        }
        assertThatThrownBy(() -> service.confirm(7L,1L,"tr_match","staff")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(events,owners,providers);
        assertThat(row.getState()).isEqualTo(PayoutTransfer.State.RECONCILIATION_REQUIRED);
    }
    @Test void stripeIsCheckedAgainAfterPreview() throws Exception {
        service.verify(7L,1L,"tr_match");receipt.setAmountReversed(8000L);
        assertThatThrownBy(() -> service.confirm(7L,1L,"tr_match","staff")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(events,providers);
    }
    @Test void reassignedBusinessBeneficiaryBlocksConfirmation() {
        payout.setBeneficiaryOrganizationId(8L);
        assertThatThrownBy(() -> service.confirm(7L,1L,"tr_match","staff")).isInstanceOf(ResponseStatusException.class);
        verify(events,never()).save(any());verify(providers,never()).save(any());
        assertThat(row.getState()).isEqualTo(PayoutTransfer.State.RECONCILIATION_REQUIRED);
    }
    @Test void stripeFailureDoesNotReleaseOrResendTransfer() throws Exception {
        when(stripe.retrieveTransfer("tr_match")).thenThrow(new ApiConnectionException("offline"));
        assertThatThrownBy(() -> service.confirm(7L,1L,"tr_match","staff")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(events,providers);verify(stripe).retrieveTransfer("tr_match");verifyNoMoreInteractions(stripe);
    }
    @Test void existingReferenceCanProveLegacyTransferOnlyWithResolvedDestination() {
        ReflectionTestUtils.setField(row,"externalReference","tr_match");receipt.setMetadata(Map.of());
        service.verify(7L,1L,"tr_match");
        ReflectionTestUtils.setField(row,"destination","legacy-unresolved");
        assertThatThrownBy(() -> service.verify(7L,1L,"tr_match")).isInstanceOf(ResponseStatusException.class);
    }
    @Test void ownerRecordIsUpdatedOnlyWhenSameAmountRecipientAndRail() throws Exception {
        var ownerInstruction=new PayoutTransferInstruction(7L,PayoutTransfer.Source.OWNER_PAYOUT,31L,10L,new BigDecimal("80"),"EUR","acct_owner","Owner #31");
        row=row(ownerInstruction);receipt=receipt(ownerInstruction);
        when(transfers.findByIdAndOrganizationId(1L,7L)).thenReturn(Optional.of(row));
        when(transfers.lockByIdAndOrganizationId(1L,7L)).thenReturn(Optional.of(row));
        when(stripe.retrieveTransfer("tr_match")).thenReturn(receipt);
        var owner=new OwnerPayout();owner.setOwnerId(10L);owner.setNetAmount(new BigDecimal("80"));
        owner.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);owner.setStatus(OwnerPayout.PayoutStatus.PROCESSING);
        when(owners.lockForReconciliation(31L,7L)).thenReturn(Optional.of(owner));
        service.confirm(7L,1L,"tr_match","staff");
        assertThat(owner.getStatus()).isEqualTo(OwnerPayout.PayoutStatus.PAID);
        assertThat(owner.getPaymentReference()).isEqualTo("tr_match");assertThat(owner.getPaidAt()).isNotNull();
    }
}
