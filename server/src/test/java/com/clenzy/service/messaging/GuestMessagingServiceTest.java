package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuestMessagingServiceTest {

    @Mock private EmailChannel emailChannel;
    @Mock private WhatsAppChannel whatsAppChannel;
    @Mock private TemplateInterpolationService interpolationService;
    @Mock private GuestMessageLogRepository messageLogRepository;
    @Mock private CheckInInstructionsRepository instructionsRepository;
    @Mock private MessageTemplateRepository templateRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private NotificationService notificationService;

    private GuestMessagingService service;

    @BeforeEach
    void setUp() {
        List<MessageChannel> channels = List.of(emailChannel, whatsAppChannel);
        service = new GuestMessagingService(channels, interpolationService, messageLogRepository,
            instructionsRepository, templateRepository, reservationRepository, notificationService);
    }

    @Test
    void sendForReservation_emailChannel_sendsViaEmail() {
        Property property = new Property();
        property.setId(10L);
        property.setName("Test Prop");
        Guest guest = new Guest();
        guest.setEmail("guest@test.com");
        guest.setPhone("+33612345678");
        guest.setLanguage("fr");

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setGuest(guest);

        MessageTemplate template = new MessageTemplate();
        template.setId(5L);
        template.setName("Check-in");

        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.empty());
        when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Subject", "<p>HTML</p>", "Plain"));

        when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("msg-001"));

        GuestMessageLog logEntry = new GuestMessageLog();
        logEntry.setId(1L);
        when(messageLogRepository.save(any())).thenReturn(logEntry);

        GuestMessageLog result = service.sendForReservation(reservation, template, 1L);

        assertThat(result).isNotNull();
        verify(emailChannel).send(any());
        verify(messageLogRepository).save(any());
    }

    @Test
    void sendForReservationViaChannel_whatsApp_sendsViaWhatsApp() {
        Property property = new Property();
        property.setId(10L);
        property.setName("Test Prop");
        Guest guest = new Guest();
        guest.setPhone("+33612345678");
        guest.setLanguage("en");

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setGuest(guest);

        MessageTemplate template = new MessageTemplate();
        template.setId(5L);
        template.setName("Welcome");

        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.empty());
        when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), eq("en")))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Subject", "<p>Hello</p>", "Hello"));

        when(whatsAppChannel.getChannelType()).thenReturn(MessageChannelType.WHATSAPP);
        when(whatsAppChannel.isAvailable()).thenReturn(true);
        when(whatsAppChannel.send(any())).thenReturn(MessageDeliveryResult.success("wa-msg-001"));

        GuestMessageLog logEntry = new GuestMessageLog();
        logEntry.setId(2L);
        when(messageLogRepository.save(any())).thenReturn(logEntry);

        GuestMessageLog result = service.sendForReservationViaChannel(
            reservation, template, 1L, MessageChannelType.WHATSAPP, java.util.Map.of());

        assertThat(result).isNotNull();
        verify(whatsAppChannel).send(any());
    }

    @Test
    void sendForReservationViaChannel_unavailableChannel_fallsBackToEmail() {
        Property property = new Property();
        property.setId(10L);
        property.setName("Test");
        Guest guest = new Guest();
        guest.setEmail("guest@test.com");
        guest.setLanguage("fr");

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setGuest(guest);

        MessageTemplate template = new MessageTemplate();
        template.setId(5L);
        template.setName("Test");

        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.empty());
        when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Subject", "HTML", "Plain"));

        when(whatsAppChannel.getChannelType()).thenReturn(MessageChannelType.WHATSAPP);
        when(whatsAppChannel.isAvailable()).thenReturn(false);
        when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("email-fallback"));

        GuestMessageLog logEntry = new GuestMessageLog();
        logEntry.setId(3L);
        when(messageLogRepository.save(any())).thenReturn(logEntry);

        service.sendForReservationViaChannel(reservation, template, 1L,
            MessageChannelType.WHATSAPP, java.util.Map.of());

        verify(emailChannel).send(any());
        verify(whatsAppChannel, never()).send(any());
    }

    @Test
    void alreadySent_delegatesToRepository() {
        when(messageLogRepository.existsSentOrPendingByReservationAndType(100L, MessageTemplateType.CHECK_IN))
            .thenReturn(true);

        boolean result = service.alreadySent(100L, MessageTemplateType.CHECK_IN);
        assertThat(result).isTrue();
    }
}
