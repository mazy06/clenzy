package com.clenzy.booking.service;

import com.clenzy.booking.model.GuestCreditAccount;
import com.clenzy.booking.model.GuestCreditTransaction;
import com.clenzy.booking.model.GuestCreditTxType;
import com.clenzy.booking.repository.GuestCreditAccountRepository;
import com.clenzy.booking.repository.GuestCreditTransactionRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestCreditServiceTest {

    @Mock private GuestCreditAccountRepository accountRepository;
    @Mock private GuestCreditTransactionRepository txRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ObjectProvider<GuestCreditService> self;

    private GuestCreditService service() {
        return new GuestCreditService(accountRepository, txRepository, organizationRepository, reservationRepository, self);
    }

    @Test
    void earn_newAccount_createsAccountIncrementsBalanceAndRecordsTransaction() {
        when(txRepository.existsByOrganizationIdAndReservationCodeAndType(1L, "CODE-1", GuestCreditTxType.EARN)).thenReturn(false);
        when(accountRepository.findByOrganizationIdAndEmail(1L, "guest@x.fr")).thenReturn(Optional.empty());
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service().earn(1L, "Guest@X.FR", 1500, "EUR", "CODE-1");

        ArgumentCaptor<GuestCreditAccount> acc = ArgumentCaptor.forClass(GuestCreditAccount.class);
        verify(accountRepository, org.mockito.Mockito.atLeastOnce()).save(acc.capture());
        assertThat(acc.getValue().getBalanceCents()).isEqualTo(1500);
        assertThat(acc.getValue().getEmail()).isEqualTo("guest@x.fr"); // normalisé

        ArgumentCaptor<GuestCreditTransaction> tx = ArgumentCaptor.forClass(GuestCreditTransaction.class);
        verify(txRepository).save(tx.capture());
        assertThat(tx.getValue().getType()).isEqualTo(GuestCreditTxType.EARN);
        assertThat(tx.getValue().getAmountCents()).isEqualTo(1500);
        assertThat(tx.getValue().getReservationCode()).isEqualTo("CODE-1");
    }

    @Test
    void earn_alreadyCredited_isNoOp() {
        when(txRepository.existsByOrganizationIdAndReservationCodeAndType(1L, "CODE-1", GuestCreditTxType.EARN)).thenReturn(true);

        service().earn(1L, "guest@x.fr", 1500, "EUR", "CODE-1");

        verify(accountRepository, never()).save(any());
        verify(txRepository, never()).save(any());
    }

    @Test
    void earn_nonPositiveAmount_isNoOp() {
        service().earn(1L, "guest@x.fr", 0, "EUR", "CODE-1");
        verify(txRepository, never()).save(any());
        verify(accountRepository, never()).save(any());
    }

    @Test
    void getBalanceCents_returnsAccountBalanceOrZero() {
        GuestCreditAccount acc = new GuestCreditAccount();
        acc.setBalanceCents(4200);
        when(accountRepository.findByOrganizationIdAndEmail(1L, "guest@x.fr")).thenReturn(Optional.of(acc));
        assertThat(service().getBalanceCents(1L, "Guest@X.fr")).isEqualTo(4200);

        when(accountRepository.findByOrganizationIdAndEmail(2L, "none@x.fr")).thenReturn(Optional.empty());
        assertThat(service().getBalanceCents(2L, "none@x.fr")).isZero();
    }
}
