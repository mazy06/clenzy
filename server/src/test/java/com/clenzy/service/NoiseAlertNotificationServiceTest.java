package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.model.NoiseAlert.AlertSeverity;
import com.clenzy.model.NoiseAlert.AlertSource;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NoiseAlertNotificationServiceTest {

    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ReservationRepository reservationRepository;

    @InjectMocks
    private NoiseAlertNotificationService service;

    private NoiseAlert alert;
    private NoiseAlertConfig config;
    private Property property;
    private User owner;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setKeycloakId("owner-kc-id");
        owner.setEmail("owner@example.com");

        property = new Property();
        property.setId(100L);
        property.setName("Studio Paris");
        property.setOwner(owner);

        alert = new NoiseAlert();
        alert.setId(1L);
        alert.setOrganizationId(10L);
        alert.setPropertyId(100L);
        alert.setDeviceId(5L);
        alert.setSeverity(AlertSeverity.WARNING);
        alert.setMeasuredDb(75.0);
        alert.setThresholdDb(70);
        alert.setTimeWindowLabel("Jour");
        alert.setSource(AlertSource.WEBHOOK);

        config = new NoiseAlertConfig();
        config.setNotifyInApp(true);
        config.setNotifyEmail(true);
        config.setNotifyGuestMessage(false);
    }

    @Test
    void whenNotifyInAppEnabled_thenSendsInAppNotification() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verify(notificationService).send(
            eq("owner-kc-id"),
            eq(NotificationKey.NOISE_ALERT_WARNING),
            contains("Studio Paris"),
            contains("75 dB"),
            isNull()
        );
        assertTrue(alert.isNotifiedInApp());
    }

    @Test
    void whenCriticalAlert_thenUsesCriticalNotificationKey() {
        alert.setSeverity(AlertSeverity.CRITICAL);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verify(notificationService).send(
            eq("owner-kc-id"),
            eq(NotificationKey.NOISE_ALERT_CRITICAL),
            contains("critique"),
            anyString(),
            isNull()
        );
    }

    @Test
    void whenNotifyEmailEnabled_thenSendsEmail() {
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verify(emailService).sendContactMessage(
            eq("owner@example.com"),
            isNull(),
            isNull(),
            isNull(),
            contains("Studio Paris"),
            contains("75"),
            anyList()
        );
        assertTrue(alert.isNotifiedEmail());
    }

    @Test
    void whenGuestMessageEnabled_andActiveReservation_thenSendsGuestEmail() {
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        Guest guest = new Guest();
        guest.setFirstName("Marie");
        guest.setLastName("Martin");
        guest.setEmail("marie@guest.com");

        Reservation reservation = new Reservation();
        reservation.setId(50L);
        reservation.setGuest(guest);

        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.of(reservation));

        service.dispatch(alert, config);

        verify(emailService).sendContactMessage(
            eq("marie@guest.com"),
            eq("Marie Martin"),
            isNull(),
            isNull(),
            contains("bruit"),
            contains("Studio Paris"),
            anyList()
        );
        assertTrue(alert.isNotifiedGuest());
    }

    @Test
    void whenGuestMessageEnabled_butNoActiveReservation_thenNoGuestMessage() {
        config.setNotifyGuestMessage(true);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));
        when(reservationRepository.findActiveByPropertyIdAndDate(eq(100L), any(LocalDate.class), eq(10L)))
            .thenReturn(Optional.empty());

        service.dispatch(alert, config);

        assertFalse(alert.isNotifiedGuest());
        // Email to owner should still work
        verify(emailService).sendContactMessage(
            eq("owner@example.com"),
            isNull(), isNull(), isNull(),
            anyString(), anyString(), anyList()
        );
    }

    @Test
    void whenNotifyInAppDisabled_thenSkipsInApp() {
        config.setNotifyInApp(false);
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        service.dispatch(alert, config);

        verifyNoInteractions(notificationService);
        assertFalse(alert.isNotifiedInApp());
    }
}
