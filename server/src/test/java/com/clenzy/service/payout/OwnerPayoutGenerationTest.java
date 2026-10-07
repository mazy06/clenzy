package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.commission.ManagementCommissionCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import static com.clenzy.service.payout.ReservationPayoutFundingTest.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Chaîne réelle calcul + sélection des encaissements + attribution, sans appel PSP. */
@ExtendWith(MockitoExtension.class)
class OwnerPayoutGenerationTest {
    @Mock OwnerPayoutRepository payouts;
    @Mock ChannelCommissionRepository channelCommissions;
    @Mock ReservationRepository reservations;
    @Mock PropertyRepository properties;
    @Mock ProviderExpenseRepository expenses;
    @Mock ManagementContractService contracts;
    @Mock NotificationService notifications;
    @Mock UserRepository users;
    @Mock PaymentTransactionRepository transactions;
    @Mock OwnerPayoutReservationRepository claims;
    @Mock ObjectProvider<AccountingService> self;
    AccountingService service;
    final LocalDate from = LocalDate.of(2025, 9, 1);
    final LocalDate to = LocalDate.of(2025, 9, 30);

    @BeforeEach void setup() {
        var funding = new OwnerPayoutFundingService(transactions, claims, payouts, reservations, mock(BaitlyOwnerPayoutDocuments.class), mock(BaitlyExpenseRetention.class), org.mockito.Mockito.mock(com.clenzy.booking.service.BaitlyReservationCredit.class));
        org.springframework.test.util.ReflectionTestUtils.setField(funding, "em", mock(jakarta.persistence.EntityManager.class));
        service = new AccountingService(payouts, channelCommissions, reservations, properties, expenses,
                contracts, notifications, users, new ManagementCommissionCalculator(), funding, mock(BaitlyOwnerPayoutDocuments.class), self);
        when(users.lockPayoutOwner(10L, 7L)).thenReturn(Optional.of(new User()));
    }

    @Test void generatesFromConfirmedReceiptsAndPersistsTheirAssociation() {
        Reservation stay = stay(); stay.setCurrency("MAD");
        PaymentTransaction tx = receipt(91, "100"); tx.setCurrency("MAD");
        fixtures(List.of(stay), List.of(tx));
        when(payouts.save(any())).thenAnswer(inv -> {
            OwnerPayout payout = inv.getArgument(0); payout.setId(31L); return payout;
        });
        OwnerPayout result = service.generatePayout(10L, 7L, from, to);
        assertThat(result.getCurrency()).isEqualTo("MAD");
        assertThat(result.getGrossRevenue()).isEqualByComparingTo("100");
        assertThat(result.getNetAmount()).isEqualByComparingTo("100");
        assertThat(result.getFundingVersion()).isEqualTo(1);
        verify(claims).saveAllAndFlush(argThat(lines -> {
            OwnerPayoutReservation line = lines.iterator().next();
            return line.getPayoutId().equals(31L) && line.getReservationId().equals(1L)
                    && line.getPaymentTransactionIds().equals(List.of(91L)) && line.getCurrency().equals("MAD");
        }));
    }

    @Test void paidStatusWithoutReceiptDoesNotCreatePayoutOrConsumeExpenses() {
        fixtures(List.of(stay()), List.of());
        assertThatThrownBy(() -> service.generatePayout(10L, 7L, from, to))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Aucun séjour");
        verify(payouts, never()).save(any());
        verify(claims, never()).saveAllAndFlush(any());
        verifyNoInteractions(expenses);
    }

    @Test void netSharesFreezeSharedExpensesAndConserveEveryCentAcrossStays() {
        var first=stay();var second=stay();second.setId(2L);
        var secondReceipt=receipt(92,"100");secondReceipt.setSourceId(2L);
        fixtures(List.of(second,first),List.of(receipt(91,"100"),secondReceipt));
        var expense=new ProviderExpense();expense.setCurrency("EUR");expense.setAmountTtc(new BigDecimal("33.33"));expense.setStatus(ExpenseStatus.APPROVED);
        when(expenses.findApprovedByPropertyOwnerAndPeriod(10L,from,to,7L)).thenReturn(List.of(expense));
        when(payouts.save(any())).thenAnswer(call->{OwnerPayout p=call.getArgument(0);p.setId(31L);return p;});
        var result=service.generatePayout(10L,7L,from,to);
        assertThat(result.getNetAmount()).isEqualByComparingTo("166.67");
        var captured=org.mockito.ArgumentCaptor.forClass(Iterable.class);
        verify(claims).saveAllAndFlush(captured.capture());
        var lines=new java.util.ArrayList<OwnerPayoutReservation>();
        captured.getValue().forEach(value->lines.add((OwnerPayoutReservation)value));
        assertThat(lines).hasSize(2);
        assertThat(lines.stream().map(OwnerPayoutReservation::getNetAmount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("166.67");
        assertThat(lines.stream().map(OwnerPayoutReservation::getNetAmount)).containsExactlyInAnyOrder(new BigDecimal("83.33"),new BigDecimal("83.34"));
        assertThat(expense.getStatus()).isEqualTo(ExpenseStatus.INCLUDED);
        assertThat(expense.getOwnerPayout()).isSameAs(result);
    }

    @Test void mixedCurrenciesCannotBeSilentlySummed() {
        Reservation second = stay(); second.setId(2L); second.setCurrency("SAR");
        PaymentTransaction otherReceipt = receipt(92, "100"); otherReceipt.setSourceId(2L); otherReceipt.setCurrency("SAR");
        fixtures(List.of(stay(), second), List.of(receipt(91, "100"), otherReceipt));
        assertThatThrownBy(() -> service.generatePayout(10L, 7L, from, to))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("devises");
        verify(payouts, never()).save(any());
        verifyNoInteractions(expenses);
    }

    @Test void ownerCollectedContractDoesNotFundPlatformPayout() {
        when(reservations.findByOwnerIdAndDateRange(10L, from, to, 7L)).thenReturn(List.of(stay()));
        ManagementContract contract = new ManagementContract();
        contract.setPaymentModel(ManagementContract.PaymentModel.OWNER_COLLECTS);
        when(contracts.getActiveContract(50L, 7L)).thenReturn(Optional.of(contract));
        assertThatThrownBy(() -> service.generatePayout(10L, 7L, from, to)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(transactions, expenses);
        verify(payouts, never()).save(any());
    }

    @Test void stayDepartingInNextMonthDoesNotFundCurrentMonth() {
        Reservation future = stay(); future.setCheckOut(LocalDate.of(2025, 10, 2));
        when(reservations.findByOwnerIdAndDateRange(10L, from, to, 7L)).thenReturn(List.of(future));
        assertThatThrownBy(() -> service.generatePayout(10L, 7L, from, to)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(transactions, expenses);
    }

    @Test void expensesInAnotherCurrencyNeedReconciliationBeforeAttribution() {
        fixtures(List.of(stay()), List.of(receipt(91, "100")));
        ProviderExpense expense = new ProviderExpense(); expense.setCurrency("MAD");
        expense.setAmountTtc(new BigDecimal("10")); expense.setStatus(ExpenseStatus.APPROVED);
        when(expenses.findApprovedByPropertyOwnerAndPeriod(10L, from, to, 7L)).thenReturn(List.of(expense));
        assertThatThrownBy(() -> service.generatePayout(10L, 7L, from, to)).isInstanceOf(IllegalStateException.class);
        assertThat(expense.getStatus()).isEqualTo(ExpenseStatus.APPROVED);
        verify(claims, never()).saveAllAndFlush(any());
        verify(payouts, never()).save(any());
    }

    private void fixtures(List<Reservation> stays, List<PaymentTransaction> receipts) {
        when(reservations.findByOwnerIdAndDateRange(10L, from, to, 7L)).thenReturn(stays);
        when(transactions.findReservationFunding(eq(7L), anyList(), anySet())).thenReturn(receipts);
    }
}
