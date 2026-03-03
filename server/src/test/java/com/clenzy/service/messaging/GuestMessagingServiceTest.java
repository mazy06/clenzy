package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.NotificationService;
import com.clenzy.service.access.AccessCodeResolverService;
import com.clenzy.service.access.AccessCodeResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
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
    @Mock private AccessCodeResolverService accessCodeResolverService;

    private GuestMessagingService service;

    @BeforeEach
    void setUp() {
        List<MessageChannel> channels = List.of(emailChannel, whatsAppChannel);
        service = new GuestMessagingService(channels, interpolationService, messageLogRepository,
            instructionsRepository, templateRepository, reservationRepository, notificationService,
            accessCodeResolverService);

        // Default : resolution manuelle (pas de code dynamique)
        lenient().when(accessCodeResolverService.resolveForReservation(any(), any(), any()))
            .thenReturn(AccessCodeResult.manual());
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

    // ─── Access Code Resolution ──────────────────────────────

    @Test
    void whenAccessCodeResolved_thenVarsIncludeDynamicCode() {
        Property property = new Property();
        property.setId(10L);
        property.setName("Test Prop");
        Guest guest = new Guest();
        guest.setEmail("guest@test.com");
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
        when(accessCodeResolverService.resolveForReservation(any(), any(), any()))
            .thenReturn(new AccessCodeResult(
                AccessCodeResult.AccessMethod.SMART_LOCK,
                Map.of("accessCode", "987654", "accessMethod", "SMART_LOCK")
            ));
        when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Subject", "<p>Code: 987654</p>", "Code: 987654"));

        when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("msg-002"));

        GuestMessageLog logEntry = new GuestMessageLog();
        logEntry.setId(10L);
        when(messageLogRepository.save(any())).thenReturn(logEntry);

        GuestMessageLog result = service.sendForReservation(reservation, template, 1L);

        assertThat(result).isNotNull();
        verify(accessCodeResolverService).resolveForReservation(eq(property), eq(reservation), any());
        // Le template est interpole avec les variables resolues
        verify(interpolationService).interpolateAndTranslate(
            eq(template), eq(reservation), eq(guest), eq(property), any(),
            argThat(vars -> "987654".equals(vars.get("accessCode")) && "SMART_LOCK".equals(vars.get("accessMethod"))),
            eq("fr")
        );
    }

    @Test
    void whenAccessCodeResolutionFails_thenMessageStillSent() {
        Property property = new Property();
        property.setId(10L);
        property.setName("Test Prop");
        Guest guest = new Guest();
        guest.setEmail("guest@test.com");
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
        when(accessCodeResolverService.resolveForReservation(any(), any(), any()))
            .thenThrow(new RuntimeException("Service unavailable"));
        when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Subject", "HTML", "Plain"));

        when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("msg-003"));

        GuestMessageLog logEntry = new GuestMessageLog();
        logEntry.setId(11L);
        when(messageLogRepository.save(any())).thenReturn(logEntry);

        // Ne doit PAS lever d'exception — degradation gracieuse
        GuestMessageLog result = service.sendForReservation(reservation, template, 1L);

        assertThat(result).isNotNull();
        verify(emailChannel).send(any());
    }
}
