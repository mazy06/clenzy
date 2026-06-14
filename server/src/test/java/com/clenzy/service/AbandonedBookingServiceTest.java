package com.clenzy.service;

import com.clenzy.model.AbandonedBooking;
import com.clenzy.model.AbandonedBookingStatus;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
import com.clenzy.repository.AbandonedBookingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Récupération de panier abandonné (CLZ Domaine 2) : enregistrement idempotent, no-op sans email,
 * marquage de relance.
 */
@ExtendWith(MockitoExtension.class)
class AbandonedBookingServiceTest {

    @Mock private AbandonedBookingRepository repository;

    private AbandonedBookingService service;

    private static final Long ORG = 1L;
    private static final Instant NOW = Instant.parse("2026-06-14T12:00:00Z");

    @BeforeEach
    void setUp() {
        service = new AbandonedBookingService(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private Reservation reservationWithEmail(String email) {
        Reservation r = new Reservation();
        r.setId(99L);
        r.setOrganizationId(ORG);
        r.setGuestName("Alice Martin");
        r.setCheckIn(LocalDate.of(2026, 7, 1));
        r.setCheckOut(LocalDate.of(2026, 7, 5));
        r.setGuestCount(2);
        r.setTotalPrice(new BigDecimal("480.00"));
        r.setCurrency("EUR");
        if (email != null) {
            Guest g = new Guest();
            g.setEmail(email);
            r.setGuest(g);
        }
        return r;
    }

    @Test
    void recordIfAbsent_withEmail_notExisting_createsSnapshot() {
        when(repository.existsByOrganizationIdAndReservationId(ORG, 99L)).thenReturn(false);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.recordIfAbsent(reservationWithEmail("alice@example.com"));

        ArgumentCaptor<AbandonedBooking> captor = ArgumentCaptor.forClass(AbandonedBooking.class);
        verify(repository).save(captor.capture());
        AbandonedBooking saved = captor.getValue();
        assertThat(saved.getReservationId()).isEqualTo(99L);
        assertThat(saved.getGuestEmail()).isEqualTo("alice@example.com");
        assertThat(saved.getStatus()).isEqualTo(AbandonedBookingStatus.PENDING);
        assertThat(saved.getTotal()).isEqualByComparingTo("480.00");
        assertThat(saved.getCreatedAt()).isEqualTo(NOW);
    }

    @Test
    void recordIfAbsent_noEmail_skips() {
        service.recordIfAbsent(reservationWithEmail(null));
        verify(repository, never()).save(any());
    }

    @Test
    void recordIfAbsent_alreadyExists_skips() {
        when(repository.existsByOrganizationIdAndReservationId(ORG, 99L)).thenReturn(true);

        service.recordIfAbsent(reservationWithEmail("alice@example.com"));

        verify(repository, never()).save(any());
    }

    @Test
    void markRecoverySent_setsStatusAndTimestamp() {
        AbandonedBooking ab = new AbandonedBooking();
        ab.setStatus(AbandonedBookingStatus.PENDING);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.markRecoverySent(ab);

        assertThat(ab.getStatus()).isEqualTo(AbandonedBookingStatus.RECOVERY_SENT);
        assertThat(ab.getRecoverySentAt()).isEqualTo(NOW);
    }
}
