package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.MapboxStaticImageService;
import com.clenzy.service.NotificationService;
import com.clenzy.service.WelcomeGuideService;
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
    @Mock private MapboxStaticImageService mapboxStaticImageService;
    @Mock private WelcomeGuideService welcomeGuideService;

    private GuestMessagingService service;

    @BeforeEach
    void setUp() {
        List<MessageChannel> channels = List.of(emailChannel, whatsAppChannel);
        service = new GuestMessagingService(channels, interpolationService, messageLogRepository,
            instructionsRepository, templateRepository, reservationRepository, notificationService,
            accessCodeResolverService, mapboxStaticImageService, welcomeGuideService);

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
    void whenSendingBeforeCheckInTime_thenAccessCodeMaskedInVars() {
        Property property = new Property();
        property.setId(10L);
        property.setName("Test Prop");
        property.setTimezone("Europe/Paris");
        Guest guest = new Guest();
        guest.setEmail("guest@test.com");
        guest.setLanguage("fr");

        Reservation reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setGuest(guest);
        reservation.setCheckIn(java.time.LocalDate.now().plusDays(2)); // arrivée future
        reservation.setCheckInTime("15:00");
        reservation.setCheckOut(java.time.LocalDate.now().plusDays(5));

        MessageTemplate template = new MessageTemplate();
        template.setId(5L);
        template.setName("Check-in");

        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
            .thenReturn(Optional.empty());
        // Le gating ne s'applique que si le voyageur a un canal de repli (livret publié).
        when(welcomeGuideService.hasPublishedGuideFor(any())).thenReturn(true);
        when(accessCodeResolverService.resolveForReservation(any(), any(), any()))
            .thenReturn(new AccessCodeResult(
                AccessCodeResult.AccessMethod.SMART_LOCK, Map.of("accessCode", "987654")));
        when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("S", "H", "P"));
        when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("ok"));

        GuestMessageLog logEntry = new GuestMessageLog();
        logEntry.setId(12L);
        when(messageLogRepository.save(any())).thenReturn(logEntry);

        service.sendForReservation(reservation, template, 1L);

        // Le code réel (987654) ne doit PAS partir dans le message avant l'heure de check-in.
        verify(interpolationService).interpolateAndTranslate(
            eq(template), eq(reservation), eq(guest), eq(property), any(),
            argThat(vars -> {
                String code = vars.get("accessCode");
                return code != null && !code.contains("987654") && code.contains("livret");
            }),
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

    // ============= EXTENDED =============

    @org.junit.jupiter.api.Nested
    class PreviewMessage {
        @Test
        void preview_returnsInterpolatedMessage() {
            Property property = new Property();
            property.setId(10L);
            Guest guest = new Guest();
            guest.setEmail("g@test.com");

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(r));
            when(templateRepository.findByIdAndOrganizationId(5L, 1L)).thenReturn(Optional.of(template));
            when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L)).thenReturn(Optional.empty());
            when(interpolationService.interpolate(eq(template), eq(r), eq(guest), eq(property), any()))
                .thenReturn(new TemplateInterpolationService.InterpolatedMessage("subj", "html", "plain"));

            var result = service.previewMessage(100L, 5L, 1L);

            assertThat(result.subject()).isEqualTo("subj");
        }

        @Test
        void preview_reservationNotFound_throws() {
            when(reservationRepository.findById(100L)).thenReturn(Optional.empty());

            assertThatThrows(() -> service.previewMessage(100L, 5L, 1L));
        }

        @Test
        void preview_templateNotFound_throws() {
            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(new Property());
            r.setGuest(new Guest());
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(r));
            when(templateRepository.findByIdAndOrganizationId(5L, 1L)).thenReturn(Optional.empty());

            assertThatThrows(() -> service.previewMessage(100L, 5L, 1L));
        }
    }

    @org.junit.jupiter.api.Nested
    class SendMessageById {
        @Test
        void sendMessage_emailWithMissingEmail_throwsRecipientMissing() {
            Property property = new Property();
            property.setId(10L);
            Guest guest = new Guest();
            guest.setEmail(null);
            guest.setPhone("+331");

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);
            r.setSource("direct");

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(r));
            when(templateRepository.findByIdAndOrganizationId(5L, 1L)).thenReturn(Optional.of(template));

            assertThatThrows(() ->
                service.sendMessage(100L, 5L, 1L, MessageChannelType.EMAIL));
        }

        @Test
        void sendMessage_smsWithMissingPhone_anonymizedIcal_throwsWithSpecialHint() {
            Property property = new Property();
            property.setId(10L);
            Guest guest = new Guest();
            guest.setEmail("g@test.com");
            guest.setPhone(null);

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);
            r.setSource("airbnb");

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(r));
            when(templateRepository.findByIdAndOrganizationId(5L, 1L)).thenReturn(Optional.of(template));

            assertThatThrows(() ->
                service.sendMessage(100L, 5L, 1L, MessageChannelType.SMS));
        }

        @Test
        void sendMessage_reservationNotFound_throws() {
            when(reservationRepository.findById(100L)).thenReturn(Optional.empty());

            assertThatThrows(() -> service.sendMessage(100L, 5L, 1L));
        }

        @Test
        void sendMessage_crossOrgReservation_isRejected() {
            // IDOR : reservationId controle par l'appelant (tool LLM send_guest_message),
            // mais la reservation appartient a une AUTRE organisation que le caller (orgId=1).
            Reservation foreign = new Reservation();
            foreign.setId(100L);
            foreign.setOrganizationId(2L); // org tierce
            when(reservationRepository.findById(100L)).thenReturn(Optional.of(foreign));

            org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.security.access.AccessDeniedException.class,
                () -> service.sendMessage(100L, 5L, 1L, MessageChannelType.EMAIL));

            // Le template ne doit meme pas etre charge (garde en amont).
            verify(templateRepository, never()).findByIdAndOrganizationId(anyLong(), anyLong());
        }

        @Test
        void sendMessage_defaultEmailChannel_succeeds() {
            Property property = new Property();
            property.setId(10L);
            Guest guest = new Guest();
            guest.setEmail("g@test.com");

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);
            template.setName("Welcome");

            when(reservationRepository.findById(100L)).thenReturn(Optional.of(r));
            when(templateRepository.findByIdAndOrganizationId(5L, 1L)).thenReturn(Optional.of(template));
            when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L)).thenReturn(Optional.empty());
            when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new TemplateInterpolationService.InterpolatedMessage("S", "<p>H</p>", "P"));
            when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
            when(emailChannel.isAvailable()).thenReturn(true);
            when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("ok"));

            GuestMessageLog le = new GuestMessageLog();
            le.setId(1L);
            when(messageLogRepository.save(any())).thenReturn(le);

            var result = service.sendMessage(100L, 5L, 1L);

            assertThat(result).isNotNull();
            verify(emailChannel).send(any());
        }
    }

    @org.junit.jupiter.api.Nested
    class ChannelFallbackEdgeCases {
        @Test
        void sendForReservationViaChannel_noChannelAvailableAtAll_returnsFailedLog() {
            Property property = new Property();
            property.setId(10L);
            property.setName("P");
            // owner with keycloakId
            com.clenzy.model.User owner = new com.clenzy.model.User();
            owner.setKeycloakId("owner-kc");
            property.setOwner(owner);

            Guest guest = new Guest();
            guest.setEmail("g@test.com");

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);
            template.setName("T");

            when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
                .thenReturn(Optional.empty());
            when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new TemplateInterpolationService.InterpolatedMessage("S", "H", "P"));
            // Both channels unavailable
            when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
            when(emailChannel.isAvailable()).thenReturn(false);
            when(whatsAppChannel.getChannelType()).thenReturn(MessageChannelType.WHATSAPP);
            when(whatsAppChannel.isAvailable()).thenReturn(false);

            GuestMessageLog log = new GuestMessageLog();
            log.setId(99L);
            log.setStatus(MessageStatus.FAILED);
            when(messageLogRepository.save(any())).thenReturn(log);

            var result = service.sendForReservationViaChannel(
                r, template, 1L, MessageChannelType.WHATSAPP, Map.of());

            assertThat(result).isNotNull();
            // No send call ever
            verify(emailChannel, never()).send(any());
            verify(whatsAppChannel, never()).send(any());
        }

        @Test
        void sendForReservationViaChannel_emailWithoutRecipient_returnsFailedLog() {
            Property property = new Property();
            property.setId(10L);
            property.setName("P");

            Guest guest = new Guest();
            guest.setEmail(null); // no email
            guest.setPhone(null);

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);
            template.setName("T");

            when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
                .thenReturn(Optional.empty());
            when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new TemplateInterpolationService.InterpolatedMessage("S", "H", "P"));
            when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
            when(emailChannel.isAvailable()).thenReturn(true);

            GuestMessageLog log = new GuestMessageLog();
            log.setId(99L);
            when(messageLogRepository.save(any())).thenReturn(log);

            var result = service.sendForReservationViaChannel(
                r, template, 1L, MessageChannelType.EMAIL, Map.of());

            assertThat(result).isNotNull();
            verify(emailChannel, never()).send(any());
        }

        @Test
        void sendForReservationViaChannel_sendFails_logsFailedAndNotifies() {
            Property property = new Property();
            property.setId(10L);
            property.setName("P");
            com.clenzy.model.User owner = new com.clenzy.model.User();
            owner.setKeycloakId("owner-kc");
            property.setOwner(owner);

            Guest guest = new Guest();
            guest.setEmail("g@test.com");
            guest.setFirstName("G");
            guest.setLastName("Test");

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);
            template.setName("T");

            when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
                .thenReturn(Optional.empty());
            when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new TemplateInterpolationService.InterpolatedMessage("S", "H", "P"));
            when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
            when(emailChannel.isAvailable()).thenReturn(true);
            when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.failure("smtp error"));

            GuestMessageLog log = new GuestMessageLog();
            log.setId(1L);
            log.setStatus(MessageStatus.FAILED);
            when(messageLogRepository.save(any())).thenReturn(log);

            service.sendForReservationViaChannel(r, template, 1L, MessageChannelType.EMAIL, Map.of());

            // Echec = owner notifie (surcharge orgId explicite : contexte scheduler)
            // + admins/managers (meme circuit que les echecs de generation de document).
            verify(notificationService).send(eq("owner-kc"), eq(NotificationKey.GUEST_MESSAGE_FAILED),
                anyString(), anyString(), any(), eq(1L));
            verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.GUEST_MESSAGE_FAILED),
                anyString(), anyString(), any(), eq(1L));
        }

        @Test
        void sendForReservationViaChannel_noRecipient_logsFailedAndNotifiesAdmins() {
            Property property = new Property();
            property.setId(10L);
            property.setName("P");

            Guest guest = new Guest(); // fiche sans email (ex. import iCal anonymise)
            guest.setFirstName("G");
            guest.setLastName("Test");

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);
            template.setName("T");

            when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
                .thenReturn(Optional.empty());
            when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new TemplateInterpolationService.InterpolatedMessage("S", "H", "P"));
            when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
            when(emailChannel.isAvailable()).thenReturn(true);

            GuestMessageLog log = new GuestMessageLog();
            log.setId(1L);
            log.setStatus(MessageStatus.FAILED);
            when(messageLogRepository.save(any())).thenReturn(log);

            GuestMessageLog result = service.sendForReservationViaChannel(
                r, template, 1L, MessageChannelType.EMAIL, Map.of());

            assertThat(result.getStatus()).isEqualTo(MessageStatus.FAILED);
            verify(emailChannel, never()).send(any());
            // Historiquement, ce chemin sortait AVANT toute notification : echec silencieux.
            verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.GUEST_NO_EMAIL_FOR_CHECKIN),
                anyString(), anyString(), any(), eq(1L));
        }

        @Test
        void sendForReservation_emailWithMapboxFailure_continuesWithEmptyMap() {
            Property property = new Property();
            property.setId(10L);
            property.setName("P");
            property.setLatitude(new java.math.BigDecimal("48.85"));
            property.setLongitude(new java.math.BigDecimal("2.35"));

            Guest guest = new Guest();
            guest.setEmail("g@test.com");
            guest.setLanguage("fr");

            Reservation r = new Reservation();
            r.setId(100L);
            r.setProperty(property);
            r.setGuest(guest);

            MessageTemplate template = new MessageTemplate();
            template.setId(5L);
            template.setName("T");

            when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, 1L))
                .thenReturn(Optional.empty());
            when(mapboxStaticImageService.generateMapImageTag(any(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("mapbox down"));
            when(interpolationService.interpolateAndTranslate(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new TemplateInterpolationService.InterpolatedMessage("S", "H", "P"));
            when(emailChannel.getChannelType()).thenReturn(MessageChannelType.EMAIL);
            when(emailChannel.isAvailable()).thenReturn(true);
            when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("ok"));

            GuestMessageLog le = new GuestMessageLog();
            le.setId(1L);
            when(messageLogRepository.save(any())).thenReturn(le);

            var result = service.sendForReservation(r, template, 1L);
            assertThat(result).isNotNull();
        }
    }

    private static void assertThatThrows(Runnable r) {
        try {
            r.run();
            org.junit.jupiter.api.Assertions.fail("Expected exception");
        } catch (Exception expected) {
            // ok
        }
    }
}
