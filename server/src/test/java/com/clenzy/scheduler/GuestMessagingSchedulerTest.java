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
}
