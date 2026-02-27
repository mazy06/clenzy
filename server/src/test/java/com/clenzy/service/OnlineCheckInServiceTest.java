package com.clenzy.service;

import com.clenzy.config.CheckInConfig;
import com.clenzy.model.*;
import com.clenzy.repository.OnlineCheckInRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OnlineCheckInServiceTest {

    @Mock private OnlineCheckInRepository checkInRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private NotificationService notificationService;

    private CheckInConfig config;
    private OnlineCheckInService service;

    @BeforeEach
    void setUp() {
        config = new CheckInConfig();
        config.setBaseUrl("https://app.clenzy.fr/checkin");
        config.setTokenTtlDays(30);
        service = new OnlineCheckInService(checkInRepository, reservationRepository, config, notificationService);
    }

    @Test
    void createCheckIn_newReservation_createsCheckIn() {
        Reservation reservation = new Reservation();
        reservation.setId(100L);

        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(checkInRepository.findByReservationIdAndOrganizationId(100L, 1L)).thenReturn(Optional.empty());

        OnlineCheckIn saved = new OnlineCheckIn();
        saved.setId(1L);
        saved.setToken(UUID.randomUUID());
        saved.setReservation(reservation);
        when(checkInRepository.save(any())).thenReturn(saved);

        OnlineCheckIn result = service.createCheckIn(100L, 1L);

        assertThat(result.getId()).isEqualTo(1L);
        verify(checkInRepository).save(any());
    }

    @Test
    void createCheckIn_existingCheckIn_returnsExisting() {
        Reservation reservation = new Reservation();
        reservation.setId(100L);

        OnlineCheckIn existing = new OnlineCheckIn();
        existing.setId(5L);

        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(checkInRepository.findByReservationIdAndOrganizationId(100L, 1L)).thenReturn(Optional.of(existing));

        OnlineCheckIn result = service.createCheckIn(100L, 1L);

        assertThat(result.getId()).isEqualTo(5L);
        verify(checkInRepository, never()).save(any());
    }

    @Test
    void createCheckIn_reservationNotFound_throws() {
        when(reservationRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createCheckIn(999L, 1L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("999");
    }

    @Test
    void startCheckIn_pendingCheckIn_startsSuccessfully() {
        UUID token = UUID.randomUUID();
        Property property = new Property();
        property.setName("Test Property");
        Reservation reservation = new Reservation();
        reservation.setProperty(property);

        OnlineCheckIn checkIn = new OnlineCheckIn();
        checkIn.setId(1L);
        checkIn.setToken(token);
        checkIn.setStatus(OnlineCheckInStatus.PENDING);
        checkIn.setExpiresAt(LocalDateTime.now().plusDays(10));
        checkIn.setReservation(reservation);

        when(checkInRepository.findByToken(token)).thenReturn(Optional.of(checkIn));
        when(checkInRepository.save(any())).thenReturn(checkIn);

        OnlineCheckIn result = service.startCheckIn(token);

        assertThat(result.getStatus()).isEqualTo(OnlineCheckInStatus.STARTED);
        assertThat(result.getStartedAt()).isNotNull();
    }

    @Test
    void startCheckIn_expiredCheckIn_throws() {
        UUID token = UUID.randomUUID();
        OnlineCheckIn checkIn = new OnlineCheckIn();
        checkIn.setStatus(OnlineCheckInStatus.EXPIRED);
        checkIn.setExpiresAt(LocalDateTime.now().minusDays(1));

        when(checkInRepository.findByToken(token)).thenReturn(Optional.of(checkIn));

        assertThatThrownBy(() -> service.startCheckIn(token))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("expire");
    }

    @Test
    void completeCheckIn_startsAndCompletes() {
        UUID token = UUID.randomUUID();
        Property property = new Property();
        property.setName("Test Property");
        Reservation reservation = new Reservation();
        reservation.setProperty(property);

        OnlineCheckIn checkIn = new OnlineCheckIn();
        checkIn.setId(1L);
        checkIn.setStatus(OnlineCheckInStatus.STARTED);
        checkIn.setReservation(reservation);

        when(checkInRepository.findByToken(token)).thenReturn(Optional.of(checkIn));
        when(checkInRepository.save(any())).thenReturn(checkIn);

        OnlineCheckIn result = service.completeCheckIn(token,
            "Jean", "Dupont", "jean@test.com", "+33612345678",
            "ABC123", "PASSPORT", "15:00", "Late arrival", 2, null);

        assertThat(result.getStatus()).isEqualTo(OnlineCheckInStatus.COMPLETED);
        assertThat(result.getFirstName()).isEqualTo("Jean");
        assertThat(result.getCompletedAt()).isNotNull();
    }

    @Test
    void completeCheckIn_alreadyCompleted_throws() {
        UUID token = UUID.randomUUID();
        OnlineCheckIn checkIn = new OnlineCheckIn();
        checkIn.setStatus(OnlineCheckInStatus.COMPLETED);

        when(checkInRepository.findByToken(token)).thenReturn(Optional.of(checkIn));

        assertThatThrownBy(() -> service.completeCheckIn(token,
            "Jean", "Dupont", null, null, null, null, null, null, null, null))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("deja complete");
    }

    @Test
    void generateCheckInLink_formatsCorrectly() {
        OnlineCheckIn checkIn = new OnlineCheckIn();
        UUID token = UUID.fromString("12345678-1234-1234-1234-123456789012");
        checkIn.setToken(token);

        String link = service.generateCheckInLink(checkIn);

        assertThat(link).isEqualTo("https://app.clenzy.fr/checkin/12345678-1234-1234-1234-123456789012");
    }

    @Test
    void expireOldCheckIns_expiresOverdueCheckIns() {
        OnlineCheckIn c1 = new OnlineCheckIn();
        c1.setStatus(OnlineCheckInStatus.PENDING);
        OnlineCheckIn c2 = new OnlineCheckIn();
        c2.setStatus(OnlineCheckInStatus.PENDING);

        when(checkInRepository.findByStatusAndExpiresAtBefore(
            eq(OnlineCheckInStatus.PENDING), any()))
            .thenReturn(List.of(c1, c2));

        service.expireOldCheckIns();

        assertThat(c1.getStatus()).isEqualTo(OnlineCheckInStatus.EXPIRED);
        assertThat(c2.getStatus()).isEqualTo(OnlineCheckInStatus.EXPIRED);
        verify(checkInRepository).saveAll(List.of(c1, c2));
    }
}
