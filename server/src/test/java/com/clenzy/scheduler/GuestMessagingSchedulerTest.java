package com.clenzy.scheduler;

import com.clenzy.model.*;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.messaging.GuestMessagingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuestMessagingSchedulerTest {

    @Mock private MessagingAutomationConfigRepository configRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private MessageTemplateRepository templateRepository;
    @Mock private GuestMessagingService messagingService;

    @InjectMocks
    private GuestMessagingScheduler scheduler;

    private MessagingAutomationConfig config;
    private MessageTemplate checkInTemplate;
    private Reservation reservation;

    @BeforeEach
    void setUp() {
        config = new MessagingAutomationConfig();
        config.setOrganizationId(1L);
        config.setAutoSendCheckIn(true);
        config.setAutoSendCheckOut(false);
        config.setHoursBeforeCheckIn(24);
        config.setHoursBeforeCheckOut(12);
        config.setCheckInTemplateId(10L);

        checkInTemplate = new MessageTemplate();
        checkInTemplate.setId(10L);
        checkInTemplate.setActive(true);
        checkInTemplate.setType(MessageTemplateType.CHECK_IN);

        reservation = new Reservation();
        reservation.setId(100L);
        // Le check-in auto ne part QUE le jour de l'arrivee (date locale du logement).
        // Property null -> StayTimes.zoneOf retombe sur le fuseau systeme, donc
        // LocalDate.now() ici == LocalDate.now(systemDefault) cote scheduler : coherent.
        reservation.setCheckIn(LocalDate.now());

        Guest guest = new Guest();
        guest.setEmail("guest@example.com");
        reservation.setGuest(guest);
    }

    @Test
    void whenNoConfigsEnabled_thenNothingSent() {
        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of());

        scheduler.processAutomatedMessages();

        verify(messagingService, never()).sendForReservation(any(), any(), anyLong());
    }

    @Test
    void whenCheckInEnabled_thenFindsReservationsAndSends() {
        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(checkInTemplate));
        when(reservationRepository.findConfirmedByCheckInRange(any(LocalDate.class), any(LocalDate.class), eq(1L)))
            .thenReturn(List.of(reservation));
        when(messagingService.alreadySent(100L, MessageTemplateType.CHECK_IN))
            .thenReturn(false);

        scheduler.processAutomatedMessages();

        verify(messagingService).sendForReservation(reservation, checkInTemplate, 1L);
    }

    @Test
    void whenAlreadySent_thenSkipsReservation() {
        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(checkInTemplate));
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(1L)))
            .thenReturn(List.of(reservation));
        when(messagingService.alreadySent(100L, MessageTemplateType.CHECK_IN))
            .thenReturn(true);

        scheduler.processAutomatedMessages();

        verify(messagingService, never()).sendForReservation(any(), any(), anyLong());
    }

    @Test
    void whenTemplateNotFound_thenNoSend() {
        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.empty());

        scheduler.processAutomatedMessages();

        verify(messagingService, never()).sendForReservation(any(), any(), anyLong());
    }

    @Test
    void whenTemplateInactive_thenNoSend() {
        checkInTemplate.setActive(false);

        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(checkInTemplate));

        scheduler.processAutomatedMessages();

        verify(messagingService, never()).sendForReservation(any(), any(), anyLong());
    }

    @Test
    void whenCheckInDisabled_thenSkipsCheckIn() {
        config.setAutoSendCheckIn(false);
        config.setAutoSendCheckOut(true);
        config.setCheckOutTemplateId(20L);

        MessageTemplate checkOutTemplate = new MessageTemplate();
        checkOutTemplate.setId(20L);
        checkOutTemplate.setActive(true);

        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(20L, 1L))
            .thenReturn(Optional.of(checkOutTemplate));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(1L)))
            .thenReturn(List.of(reservation));
        when(messagingService.alreadySent(100L, MessageTemplateType.CHECK_OUT))
            .thenReturn(false);

        scheduler.processAutomatedMessages();

        verify(messagingService).sendForReservation(reservation, checkOutTemplate, 1L);
    }

    @Test
    void whenSendThrows_thenContinuesWithoutPropagation() {
        Reservation reservation2 = new Reservation();
        reservation2.setId(200L);
        reservation2.setCheckIn(LocalDate.now()); // jour de l'arrivee -> eligible au check-in auto
        Guest guest2 = new Guest();
        guest2.setEmail("guest2@example.com");
        reservation2.setGuest(guest2);

        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(checkInTemplate));
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(1L)))
            .thenReturn(List.of(reservation, reservation2));
        when(messagingService.alreadySent(anyLong(), eq(MessageTemplateType.CHECK_IN)))
            .thenReturn(false);
        doThrow(new RuntimeException("DB error"))
            .when(messagingService).sendForReservation(eq(reservation), any(), eq(1L));

        // Should NOT throw — errors are caught per-reservation
        assertDoesNotThrow(() -> scheduler.processAutomatedMessages());

        // Second reservation should still be attempted
        verify(messagingService).sendForReservation(eq(reservation2), any(), eq(1L));
    }

    @Test
    void whenCheckInIsToday_thenSends() {
        // reservation.checkIn == aujourd'hui (cf. setUp) -> l'email part le jour J.
        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(checkInTemplate));
        when(reservationRepository.findConfirmedByCheckInRange(any(LocalDate.class), any(LocalDate.class), eq(1L)))
            .thenReturn(List.of(reservation));
        when(messagingService.alreadySent(100L, MessageTemplateType.CHECK_IN))
            .thenReturn(false);

        scheduler.processAutomatedMessages();

        verify(messagingService).sendForReservation(reservation, checkInTemplate, 1L);
    }

    @Test
    void whenCheckInIsNotToday_thenSkips() {
        // Le pre-filtre BDD (+/- 1 jour) peut remonter une arrivee de demain, mais le
        // filtre "jour de l'arrivee" (date locale du logement == checkIn) doit la rejeter :
        // l'email ne doit JAMAIS partir en avance.
        reservation.setCheckIn(LocalDate.now().plusDays(1));

        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(checkInTemplate));
        when(reservationRepository.findConfirmedByCheckInRange(any(LocalDate.class), any(LocalDate.class), eq(1L)))
            .thenReturn(List.of(reservation));

        scheduler.processAutomatedMessages();

        verify(messagingService, never()).sendForReservation(any(), any(), anyLong());
    }

    @Test
    void whenCheckInIsTodayInPropertyTimezone_thenSends() {
        // La decision "jour J" suit le fuseau du LOGEMENT, pas celui du serveur.
        // Pacific/Kiritimati = UTC+14 : on cale checkIn sur la date locale de ce fuseau,
        // qui peut etre en avance d'un jour civil sur le fuseau systeme.
        ZoneId kiritimati = ZoneId.of("Pacific/Kiritimati");
        Property property = new Property();
        property.setTimezone("Pacific/Kiritimati");
        reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.now(kiritimati));

        when(configRepository.findByAutoSendCheckInTrueOrAutoSendCheckOutTrue())
            .thenReturn(List.of(config));
        when(templateRepository.findByIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.of(checkInTemplate));
        when(reservationRepository.findConfirmedByCheckInRange(any(LocalDate.class), any(LocalDate.class), eq(1L)))
            .thenReturn(List.of(reservation));
        when(messagingService.alreadySent(100L, MessageTemplateType.CHECK_IN))
            .thenReturn(false);

        scheduler.processAutomatedMessages();

        verify(messagingService).sendForReservation(reservation, checkInTemplate, 1L);
    }
}
