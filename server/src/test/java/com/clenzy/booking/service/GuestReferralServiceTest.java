package com.clenzy.booking.service;

import com.clenzy.booking.model.GuestCreditAccount;
import com.clenzy.booking.model.GuestReferral;
import com.clenzy.booking.model.GuestReferralStatus;
import com.clenzy.booking.repository.GuestCreditAccountRepository;
import com.clenzy.booking.repository.GuestReferralRepository;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Parrainage (2.11) : génération de code, claim (validations + anti-abus), crédit des deux côtés
 * sur séjour terminé (clés idempotentes distinctes).
 */
@ExtendWith(MockitoExtension.class)
class GuestReferralServiceTest {

    @Mock private GuestCreditAccountRepository accountRepository;
    @Mock private GuestReferralRepository referralRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private GuestCreditService creditService;
    @Mock private ObjectProvider<GuestReferralService> self;

    private GuestReferralService service() {
        return new GuestReferralService(accountRepository, referralRepository, reservationRepository,
                organizationRepository, creditService, self);
    }

    private GuestCreditAccount referrer(String email, String code) {
        GuestCreditAccount a = new GuestCreditAccount();
        a.setOrganizationId(1L);
        a.setEmail(email);
        a.setReferralCode(code);
        return a;
    }

    private Reservation directReservation(String guestEmail) {
        Guest guest = mock(Guest.class);
        when(guest.getEmail()).thenReturn(guestEmail);
        Reservation r = mock(Reservation.class);
        when(r.getSource()).thenReturn("direct");
        when(r.getGuest()).thenReturn(guest);
        return r;
    }

    @Test
    void getOrCreateCode_generatesWhenMissing() {
        GuestCreditAccount acc = new GuestCreditAccount();
        acc.setOrganizationId(1L);
        acc.setEmail("g@x.fr");
        when(accountRepository.findByOrganizationIdAndEmail(1L, "g@x.fr")).thenReturn(Optional.of(acc));
        when(accountRepository.findByOrganizationIdAndReferralCode(eq(1L), anyString())).thenReturn(Optional.empty());
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        String code = service().getOrCreateCode(1L, "G@X.FR");

        assertThat(code).isNotBlank().hasSize(8);
        assertThat(acc.getReferralCode()).isEqualTo(code);
    }

    @Test
    void claim_validReferral_savesPendingLink() {
        Reservation reservation = directReservation("filleul@x.fr");
        when(accountRepository.findByOrganizationIdAndReferralCode(1L, "ABC12345"))
                .thenReturn(Optional.of(referrer("parrain@x.fr", "ABC12345")));
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE-1", 1L))
                .thenReturn(Optional.of(reservation));
        when(referralRepository.existsByOrganizationIdAndRefereeEmail(1L, "filleul@x.fr")).thenReturn(false);

        boolean ok = service().claim(1L, "CODE-1", "abc12345");

        assertThat(ok).isTrue();
        ArgumentCaptor<GuestReferral> ref = ArgumentCaptor.forClass(GuestReferral.class);
        verify(referralRepository).save(ref.capture());
        assertThat(ref.getValue().getRefereeEmail()).isEqualTo("filleul@x.fr");
        assertThat(ref.getValue().getReferrerEmail()).isEqualTo("parrain@x.fr");
        assertThat(ref.getValue().getStatus()).isEqualTo(GuestReferralStatus.PENDING);
    }

    @Test
    void claim_unknownCode_returnsFalse() {
        when(accountRepository.findByOrganizationIdAndReferralCode(1L, "NOPE")).thenReturn(Optional.empty());
        assertThat(service().claim(1L, "CODE-1", "nope")).isFalse();
        verify(referralRepository, never()).save(any());
    }

    @Test
    void claim_selfReferral_returnsFalse() {
        Reservation reservation = directReservation("same@x.fr");
        when(accountRepository.findByOrganizationIdAndReferralCode(1L, "ABC12345"))
                .thenReturn(Optional.of(referrer("same@x.fr", "ABC12345")));
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE-1", 1L))
                .thenReturn(Optional.of(reservation));

        assertThat(service().claim(1L, "CODE-1", "ABC12345")).isFalse();
        verify(referralRepository, never()).save(any());
    }

    @Test
    void claim_alreadyReferred_returnsFalse() {
        Reservation reservation = directReservation("filleul@x.fr");
        when(accountRepository.findByOrganizationIdAndReferralCode(1L, "ABC12345"))
                .thenReturn(Optional.of(referrer("parrain@x.fr", "ABC12345")));
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("CODE-1", 1L))
                .thenReturn(Optional.of(reservation));
        when(referralRepository.existsByOrganizationIdAndRefereeEmail(1L, "filleul@x.fr")).thenReturn(true);

        assertThat(service().claim(1L, "CODE-1", "ABC12345")).isFalse();
        verify(referralRepository, never()).save(any());
    }

    @Test
    void grantOne_creditsBothSidesWithDistinctKeysAndMarksGranted() {
        GuestReferral ref = new GuestReferral();
        ref.setOrganizationId(1L);
        ref.setReferrerEmail("parrain@x.fr");
        ref.setRefereeEmail("filleul@x.fr");
        ref.setReservationCode("CODE-9");
        ref.setStatus(GuestReferralStatus.PENDING);

        service().grantOne(ref, 1000);

        verify(creditService).grant(1L, "parrain@x.fr", 1000, "REF:CODE-9:referrer");
        verify(creditService).grant(1L, "filleul@x.fr", 1000, "REF:CODE-9:referee");
        assertThat(ref.getStatus()).isEqualTo(GuestReferralStatus.GRANTED);
        assertThat(ref.getGrantedAt()).isNotNull();
        verify(referralRepository).save(ref);
    }

    @Test
    void referralCreditCents_returnsZeroWhenDisabled() {
        when(organizationRepository.findById(5L)).thenReturn(Optional.empty());
        assertThat(service().referralCreditCents(5L)).isZero();
        verify(creditService, never()).grant(anyLong(), anyString(), anyLong(), anyString());
    }
}
