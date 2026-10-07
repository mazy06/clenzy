package com.clenzy.booking.service;

import com.clenzy.booking.model.*;
import com.clenzy.booking.repository.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuestCreditServiceTest {
    @Mock GuestCreditAccountRepository accounts;
    @Mock GuestCreditTransactionRepository entries;
    @Mock OrganizationRepository organizations;
    @Mock ReservationRepository reservations;
    @Mock ObjectProvider<GuestCreditService> self;
    GuestCreditService service;
    @BeforeEach void setup() { service=new GuestCreditService(accounts,entries,organizations,reservations,self); }
    void lock(String currency, long balance) {
        var row=mock(GuestCreditAccountRepository.LockedBalance.class);
        lenient().when(row.getId()).thenReturn(9L);lenient().when(row.getCurrency()).thenReturn(currency);
        lenient().when(row.getBalanceCents()).thenReturn(balance);
        when(accounts.lockBalance(1L,"guest@x.fr")).thenReturn(Optional.of(row));
    }
    void previous(GuestCreditTxType type, long amount, long account) {
        var row=new GuestCreditTransaction();row.setAccountId(account);row.setAmountCents(amount);
        when(entries.findByOrganizationIdAndReservationCodeAndType(1L,"CODE",type)).thenReturn(Optional.of(row));
    }
    @Test void earningsUseAtomicIncrementAndNormalizeEmail() {
        lock("EUR",1000);service.earn(1L," Guest@X.FR ",500,"EUR","CODE");
        verify(accounts).addBalance(9L,500);
        verify(entries).saveAndFlush(argThat(t->t.getAmountCents()==500 && t.getAccountId()==9L && t.getType()==GuestCreditTxType.EARN));
    }
    @Test void repeatedEarningDoesNotIncrementAgain() {
        lock("EUR",1000);previous(GuestCreditTxType.EARN,500,9);
        service.earn(1L,"guest@x.fr",500,"EUR","CODE");verify(accounts,never()).addBalance(any(),anyLong());
    }
    @Test void mismatchedReplayIsNotTreatedAsIdempotent() {
        lock("EUR",1000);previous(GuestCreditTxType.EARN,499,9);
        assertThatThrownBy(()->service.earn(1L,"guest@x.fr",500,"EUR","CODE")).isInstanceOf(IllegalStateException.class);
    }
    @Test void creditInAnotherCurrencyIsRejected() {
        lock("MAD",1000);
        assertThatThrownBy(()->service.earn(1L,"guest@x.fr",500,"EUR","CODE")).isInstanceOf(IllegalStateException.class);
        verify(accounts,never()).addBalance(any(),anyLong());
    }
    @Test void insufficientRedemptionDoesNotWriteReceipt() {
        lock("EUR",0);assertThat(service.redeem(1L,"guest@x.fr",500,"CODE")).isFalse();
        verify(entries,never()).saveAndFlush(any());
    }
    @Test void successfulRedemptionRecordsNegativeAmount() {
        lock("EUR",1000);when(accounts.deductIfSufficient(1L,"guest@x.fr",500)).thenReturn(1);
        assertThat(service.redeem(1L,"guest@x.fr",500,"CODE")).isTrue();
        verify(entries).saveAndFlush(argThat(t->t.getAmountCents()==-500 && t.getType()==GuestCreditTxType.REDEEM));
    }
    @Test void replayDoesNotDeductAgainEvenIfBalanceIsNowZero() {
        lock("EUR",0);previous(GuestCreditTxType.REDEEM,-500,9);
        assertThat(service.redeem(1L,"guest@x.fr",500,"CODE")).isTrue();
        verify(accounts,never()).deductIfSufficient(any(),any(),anyLong());
    }
    @Test void changedAccountCannotConsumeIntent() {
        lock("EUR",1000);
        assertThatThrownBy(()->service.redeem(1L,"guest@x.fr",500,"EUR","CODE",8L)).isInstanceOf(IllegalStateException.class);
        verify(accounts,never()).deductIfSufficient(any(),any(),anyLong());
    }
    @Test void clawbackRequiresExactHistoricalConsumption() {
        lock("EUR",0);
        assertThatThrownBy(()->service.clawback(1L,"guest@x.fr",500,"CODE")).isInstanceOf(IllegalStateException.class);
        verify(accounts,never()).addBalance(any(),anyLong());
    }
    @Test void clawbackDoesNotReturnCreditToAnotherGuest() {
        lock("EUR",0);previous(GuestCreditTxType.REDEEM,-500,10);
        assertThatThrownBy(()->service.clawback(1L,"guest@x.fr",500,"CODE")).isInstanceOf(IllegalStateException.class);
    }
    @Test void exactClawbackIsIdempotent() {
        lock("EUR",0);previous(GuestCreditTxType.REDEEM,-500,9);previous(GuestCreditTxType.CLAWBACK,500,9);
        service.clawback(1L,"guest@x.fr",500,"CODE");verify(accounts,never()).addBalance(any(),anyLong());
    }
    @Test void previewDoesNotConvertCurrency() {
        var account=new GuestCreditAccount();account.setCurrency("MAD");account.setBalanceCents(500);
        when(accounts.findByOrganizationIdAndEmail(1L,"guest@x.fr")).thenReturn(Optional.of(account));
        assertThat(service.getBalanceCents(1L,"guest@x.fr","EUR")).isZero();
        assertThat(service.getBalanceCents(1L,"guest@x.fr","MAD")).isEqualTo(500);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value=com.clenzy.model.PaymentStatus.class,names="PAID",mode=org.junit.jupiter.params.provider.EnumSource.Mode.EXCLUDE)
    void unpaidStayCannotEarnCreditEvenAfterSchedulerSelectedIt(com.clenzy.model.PaymentStatus status) {
        var stay=new com.clenzy.model.Reservation();stay.setPaymentStatus(status);
        when(reservations.lockCancellation(1L,"CODE")).thenReturn(Optional.of(stay));
        assertThatThrownBy(()->service.earnCompletedStay(1L,"CODE",10,java.time.LocalDate.now())).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(accounts,entries);
    }
    @Test void loyaltyIsEarnedOnTheCashPortionAndNotAgainOnConsumedCredit() {
        var stay=new com.clenzy.model.Reservation();stay.setOrganizationId(1L);stay.setConfirmationCode("CODE");
        stay.setPaymentStatus(com.clenzy.model.PaymentStatus.PAID);stay.setStatus("confirmed");stay.setSource("direct");
        stay.setCheckOut(java.time.LocalDate.now().minusDays(1));stay.setTotalPrice(new java.math.BigDecimal("100"));
        stay.setCreditApplied(new java.math.BigDecimal("20"));stay.setCurrency("EUR");
        var guest=new com.clenzy.model.Guest();guest.setEmail("guest@x.fr");stay.setGuest(guest);
        when(reservations.lockCancellation(1L,"CODE")).thenReturn(Optional.of(stay));lock("EUR",0);
        service.earnCompletedStay(1L,"CODE",10,java.time.LocalDate.now());
        verify(accounts).addBalance(9L,800);
    }
}
