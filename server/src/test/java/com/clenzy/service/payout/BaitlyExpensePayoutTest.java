package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.payout.StripeConnectTransferClient;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyExpensePayoutTest {
    final ProviderExpenseRepository expenses = mock(ProviderExpenseRepository.class);
    final PayoutTransferRepository transfers = mock(PayoutTransferRepository.class);
    final PaymentConnectionRepository connections = mock(PaymentConnectionRepository.class);
    final OwnerPayoutFundingService funding = mock(OwnerPayoutFundingService.class);
    final OwnerPayoutReservationRepository claims = mock(OwnerPayoutReservationRepository.class);
    final EntityManager em = mock(EntityManager.class);
    final BaitlyExpenseBeneficiaryService beneficiaries = mock(BaitlyExpenseBeneficiaryService.class);
    final BaitlyExpensePayoutStore store = new BaitlyExpensePayoutStore(expenses,transfers,connections,funding,claims,em,beneficiaries);
    ProviderExpense expense;
    OwnerPayout payout;
    PayoutTransfer parent;
    @BeforeEach void setup() {
        var owner=new User();owner.setId(10L);
        var provider=new User();provider.setId(42L);
        var property=new Property();property.setId(50L);property.setOrganizationId(7L);property.setOwner(owner);
        payout=new OwnerPayout();payout.setId(20L);payout.setOrganizationId(7L);payout.setOwnerId(10L);
        payout.setFundingVersion(1);payout.setStatus(OwnerPayout.PayoutStatus.PAID);payout.setPayoutMethod(PayoutMethod.STRIPE_CONNECT);
        payout.setNetAmount(new BigDecimal("70"));payout.setExpenses(new BigDecimal("10"));
        payout.setPeriodStart(LocalDate.of(2026,9,1));payout.setPeriodEnd(LocalDate.of(2026,9,30));
        payout.setStripeTransferId("tr_owner");payout.setPaymentReference("tr_owner");
        expense=new ProviderExpense();expense.setId(31L);expense.setOrganizationId(7L);expense.setProvider(provider);
        expense.setProperty(property);expense.setOwnerPayout(payout);expense.setStatus(ExpenseStatus.INCLUDED);
        expense.setAmountHt(new BigDecimal("10"));expense.setAmountTtc(new BigDecimal("10"));expense.setTaxAmount(BigDecimal.ZERO);
        expense.setExpenseDate(LocalDate.of(2026,9,10));
        when(beneficiaries.resolve(expense)).thenReturn(PayoutBeneficiary.user(42L));
        when(expenses.findByIdAndOrgId(31L,7L)).thenReturn(Optional.of(expense));
        when(expenses.findByPayoutIdAndOrgId(20L,7L)).thenReturn(List.of(expense));
        parent=transfer(new PayoutTransferInstruction(7L,PayoutTransfer.Source.OWNER_PAYOUT,20L,10L,
                new BigDecimal("70"),"EUR","acct_owner","Owner"));parent.transferred("tr_owner");
        when(transfers.lockBySource(7L,PayoutTransfer.Source.OWNER_PAYOUT,20L)).thenReturn(Optional.of(parent));
        var account=mock(PaymentConnectionRepository.ProviderAccount.class);
        when(account.getReady()).thenReturn(true);when(account.getAccountId()).thenReturn("acct_provider");
        when(connections.findExpenseProviderAccount(31L,7L)).thenReturn(Optional.of(account));
    }
    @Test void retainedExpenseRequiresFundingAndCreatesItsOwnIdempotencyKey() {
        var plan=store.plan(31L,7L);
        assertThat(plan.instruction().amount()).isEqualByComparingTo("10");
        assertThat(plan.instruction().beneficiaryUserId()).isEqualTo(42L);
        assertThat(plan.instruction().idempotencyKey()).isEqualTo("baitly-expense-31");
        verify(funding).validateFresh(payout);
        store.requireInstruction(plan.instruction());
        assertThat(expense.getStatus()).isEqualTo(ExpenseStatus.INCLUDED);
    }
    @ParameterizedTest @ValueSource(strings={"missing-parent","pending-owner","historical","reference","foreign-owner","wrong-amount","paid-expense","draft","currency","account","unready","funding"})
    void noEmissionWhenFundingOrBeneficiaryIsUnproven(String defect) {
        switch(defect) {
            case "missing-parent" -> expense.setOwnerPayout(null);
            case "pending-owner" -> payout.setStatus(OwnerPayout.PayoutStatus.APPROVED);
            case "historical" -> payout.setFundingVersion(0);
            case "reference" -> payout.setStripeTransferId("tr_other");
            case "foreign-owner" -> payout.setOrganizationId(8L);
            case "wrong-amount" -> payout.setNetAmount(new BigDecimal("71"));
            case "paid-expense" -> expense.setStatus(ExpenseStatus.PAID);
            case "draft" -> expense.setStatus(ExpenseStatus.DRAFT);
            case "currency" -> expense.setCurrency("MAD");
            case "account" -> when(connections.findExpenseProviderAccount(31L,7L)).thenReturn(Optional.empty());
            case "unready" -> when(connections.findExpenseProviderAccount(31L,7L)).thenReturn(Optional.of(mock(PaymentConnectionRepository.ProviderAccount.class)));
            case "funding" -> doThrow(new IllegalStateException("Remboursement en cours")).when(funding).validateFresh(payout);
        }
        assertThatThrownBy(()->store.plan(31L,7L)).isInstanceOf(IllegalStateException.class);
        verify(expenses,never()).saveAndFlush(any());
    }
    @Test void aForeignExpenseDoesNotDiscloseItsPayout() {
        assertThatThrownBy(()->store.plan(31L,8L)).isInstanceOf(com.clenzy.exception.NotFoundException.class);
        verifyNoInteractions(transfers,connections,funding);
    }
    @Test void confirmationAndReplayPreserveTheOnlyFinancialProof() {
        var row=transfer(store.plan(31L,7L).instruction());
        assertThatThrownBy(()->store.settle(row)).isInstanceOf(IllegalStateException.class);
        row.transferred("tr_expense");store.settle(row);
        assertThat(expense.getStatus()).isEqualTo(ExpenseStatus.PAID);
        assertThat(expense.getPaymentReference()).isEqualTo("tr_expense");
        when(transfers.lockBySource(7L,PayoutTransfer.Source.PROVIDER_EXPENSE,31L)).thenReturn(Optional.of(row));
        clearInvocations(funding,connections);
        assertThat(store.plan(31L,7L).existing()).isSameAs(row);
        verifyNoInteractions(funding,connections);
        expense.setAmountTtc(new BigDecimal("11"));
        assertThatThrownBy(()->store.plan(31L,7L)).isInstanceOf(IllegalStateException.class);
    }
    @Test void uncertainTransferCannotBeReemitted() {
        var row=transfer(store.plan(31L,7L).instruction());row.requireReconciliation();
        when(transfers.lockBySource(7L,PayoutTransfer.Source.PROVIDER_EXPENSE,31L)).thenReturn(Optional.of(row));
        assertThatThrownBy(()->store.plan(31L,7L)).isInstanceOf(PayoutReconciliationRequiredException.class);
        assertThat(expense.getStatus()).isEqualTo(ExpenseStatus.INCLUDED);
    }
    @Test void retentionIsAnExactSumRatherThanAnIndependentField() {
        var retention=new BaitlyExpenseRetention(expenses,em);
        assertThat(retention.validate(payout,true)).containsExactly(expense);
        payout.setExpenses(new BigDecimal("11"));
        assertThatThrownBy(()->retention.validate(payout,true)).hasMessageContaining("exactement");
    }
    @ParameterizedTest @ValueSource(strings={"tenant","owner","property","currency","tax","date","status","unbound"})
    void changedExpenseCannotJustifyAWithdrawal(String defect) {
        switch(defect) {
            case "tenant" -> expense.setOrganizationId(8L);
            case "owner" -> payout.setOwnerId(11L);
            case "property" -> expense.getProperty().setOrganizationId(8L);
            case "currency" -> expense.setCurrency("MAD");
            case "tax" -> expense.setTaxAmount(BigDecimal.ONE);
            case "date" -> expense.setExpenseDate(LocalDate.of(2026,10,1));
            case "status" -> expense.setStatus(ExpenseStatus.CANCELLED);
            case "unbound" -> expense.setOwnerPayout(null);
        }
        assertThatThrownBy(()->new BaitlyExpenseRetention(expenses,em).validate(payout,true)).isInstanceOf(IllegalStateException.class);
    }
    @Test void orchestratorRechecksActualParentTransferBeforeSendingExpense() throws Exception {
        var stripe=mock(StripeGateway.class);var client=mock(StripeConnectTransferClient.class);
        var service=new BaitlyExpensePayoutService(store,stripe,client,transfers);
        var proof=new com.stripe.model.Transfer();proof.setId("tr_owner");proof.setReversed(true);proof.setAmountReversed(7000L);
        when(stripe.retrieveTransfer("tr_owner")).thenReturn(proof);
        assertThatThrownBy(()->service.pay(31L,7L,PayoutBeneficiary.user(42L))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verifyNoInteractions(client);
        assertThat(expense.getStatus()).isEqualTo(ExpenseStatus.INCLUDED);
    }
    @Test void companyIsExplicitAndNeverFallsBackToItsRepresentative() {
        when(beneficiaries.resolve(expense)).thenReturn(PayoutBeneficiary.organization(9L));
        assertThatThrownBy(()->store.plan(31L,7L)).hasMessageContaining("société");
        verify(connections,never()).findExpenseProviderAccount(any(),any());
        var account=mock(PaymentConnectionRepository.ProviderAccount.class);
        when(account.getAccountId()).thenReturn("acct_company");when(account.getReady()).thenReturn(true);
        when(connections.findExpenseCompanyAccount(31L,7L)).thenReturn(Optional.of(account));
        var instruction=store.plan(31L,7L).instruction();
        assertThat(instruction.beneficiaryUserId()).isNull();
        assertThat(instruction.beneficiaryOrganizationId()).isEqualTo(9L);
        assertThat(instruction.destination()).isEqualTo("acct_company");
        var row=transfer(instruction);row.transferred("tr_company");store.settle(row);
        when(transfers.lockBySource(7L,PayoutTransfer.Source.PROVIDER_EXPENSE,31L)).thenReturn(Optional.of(row));
        assertThat(store.plan(31L,7L).instruction()).isEqualTo(instruction);
        when(beneficiaries.resolve(expense)).thenReturn(PayoutBeneficiary.user(42L));
        assertThatThrownBy(()->store.plan(31L,7L)).hasMessageContaining("diffère");
    }
    @Test void outdatedConfirmationCannotInitiateAnyStripeCall() {
        var stripe=mock(StripeGateway.class);var client=mock(StripeConnectTransferClient.class);
        var service=new BaitlyExpensePayoutService(store,stripe,client,transfers);
        assertThatThrownBy(()->service.pay(31L,7L,PayoutBeneficiary.organization(9L)))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("bénéficiaire a changé");
        verifyNoInteractions(stripe,client);
    }
    static PayoutTransfer transfer(PayoutTransferInstruction i) {
        var t=new PayoutTransfer();
        ReflectionTestUtils.setField(t,"id",99L);ReflectionTestUtils.setField(t,"organizationId",i.organizationId());
        ReflectionTestUtils.setField(t,"source",i.source());ReflectionTestUtils.setField(t,"sourceId",i.sourceId());
        ReflectionTestUtils.setField(t,"beneficiaryUserId",i.beneficiaryUserId());ReflectionTestUtils.setField(t,"amount",i.amount());
        ReflectionTestUtils.setField(t,"beneficiaryOrganizationId",i.beneficiaryOrganizationId());
        ReflectionTestUtils.setField(t,"currency",i.currency());ReflectionTestUtils.setField(t,"provider","STRIPE");
        ReflectionTestUtils.setField(t,"destination",i.destination());ReflectionTestUtils.setField(t,"description",i.description());
        ReflectionTestUtils.setField(t,"idempotencyKey",i.idempotencyKey());ReflectionTestUtils.setField(t,"state",PayoutTransfer.State.SUBMITTING);
        return t;
    }
}
