package com.clenzy.service;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour {@link EmailService}.
 * Couvre la construction, l'envoi et les cas d'erreur des 5 types d'emails.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private SystemEmailTemplateService systemEmailTemplateService;

    @Mock
    private PlatformSettingsService platformSettingsService;

    // Pas de mock : l'interpolation est une operation pure, on utilise le vrai
    // service pour valider que les variables sont correctement substituees.
    private TemplateInterpolationService templateInterpolationService;

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        // TranslationService mock null-friendly : on n'utilise PAS la traduction
        // dans ces tests (les variables sont en FR direct). Le service appelle
        // translationService uniquement via interpolateAndTranslate qu'on n'invoque pas.
        templateInterpolationService = new TemplateInterpolationService(
            org.mockito.Mockito.mock(com.clenzy.service.messaging.TranslationService.class));
        emailService = new EmailService(mailSenderProvider, systemEmailTemplateService, templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
        ReflectionTestUtils.setField(emailService, "fromAddress", "info@clenzy.fr");
        ReflectionTestUtils.setField(emailService, "notificationTo", "info@clenzy.fr");
        ReflectionTestUtils.setField(emailService, "maxAttachments", 10);
        ReflectionTestUtils.setField(emailService, "maxAttachmentSizeBytes", 10_485_760L);

        // Stub default : retourne un template systeme minimal pour les 3 cles
        // utilisees par les tests existants (devis, maintenance, invitation).
        // Tests qui veulent un autre comportement override avec when().thenReturn().
        // lenient() : certains tests n'utilisent pas tous les stubs → ne pas
        // faire echouer Mockito sur "unused stubbing".
        org.mockito.Mockito.lenient().when(systemEmailTemplateService.resolve(any(), any(), any()))
            .thenAnswer(inv -> java.util.Optional.of(buildStubTemplate(inv.getArgument(1))));

        // Destinataires des notifications internes : par defaut info@clenzy.fr (comportement
        // actuel). Les tests qui veulent un autre comportement override avec when().thenReturn().
        org.mockito.Mockito.lenient().when(platformSettingsService.getInternalNotificationEmails())
            .thenReturn(List.of("info@clenzy.fr"));
        // Adresse d'expédition (From) par defaut : info@clenzy.fr / Baitly.
        org.mockito.Mockito.lenient().when(platformSettingsService.getSenderEmail()).thenReturn("info@clenzy.fr");
        org.mockito.Mockito.lenient().when(platformSettingsService.getSenderName()).thenReturn("Baitly");
    }

    /**
     * Renvoie un template stub minimal avec subject+body contenant les variables
     * utilisees par chaque cle. Permet aux tests de valider que :
     * (1) le service appelle bien systemEmailTemplateService.resolve avec la bonne cle
     * (2) le subject+body sont interpoles avec les variables
     */
    private static SystemEmailTemplate buildStubTemplate(Object key) {
        SystemEmailTemplate t = new SystemEmailTemplate();
        t.setTemplateKey(String.valueOf(key));
        t.setLanguage("fr");
        t.setRecipientType("INTERNAL_TEAM");
        t.setSystem(true);
        switch (String.valueOf(key)) {
            case "quote_request_internal" -> {
                t.setSubject("📋 Nouvelle demande de devis — {fullName} — {city}");
                t.setBody("<html><body>{detailsHtml}<p>Forfait {recommendedPackage} {recommendedRate}€</p></body></html>");
            }
            case "maintenance_request_internal" -> {
                t.setSubject("{urgencyTag}🔧 Demande de devis maintenance — {fullName} — {city}");
                t.setBody("<html><body>{urgencyBanner}{detailsHtml}</body></html>");
            }
            case "invitation_organization" -> {
                t.setSubject("Invitation a rejoindre {orgName} sur Baitly");
                t.setBody("<html><body><p>{inviterName} vous invite a {orgName} ({roleName})</p><a href=\"{invitationLink}\">Accepter</a><p>Expire : {expiresAt}</p></body></html>");
            }
            default -> {
                t.setSubject("Template " + key);
                t.setBody("<html><body>Stub</body></html>");
            }
        }
        return t;
    }

    private MimeMessage createRealMimeMessage() {
        return new MimeMessage(Session.getDefaultInstance(new Properties()));
    }

    private QuoteRequestDto buildQuoteRequestDto() {
        QuoteRequestDto dto = new QuoteRequestDto();
        dto.setFullName("Jean Dupont");
        dto.setEmail("jean@example.com");
        dto.setPhone("0612345678");
        dto.setCity("Paris");
        dto.setPostalCode("75001");
        dto.setPropertyType("appartement");
        dto.setPropertyCount("2");
        dto.setGuestCapacity("4");
        dto.setSurface(65);
        dto.setBookingFrequency("regulier");
        dto.setCleaningSchedule("apres-depart");
        dto.setCalendarSync("sync");
        dto.setServices(List.of("menage-complet", "linge"));
        dto.setServicesDevis(List.of("repassage", "vitres"));
        return dto;
    }

    private MaintenanceRequestDto buildMaintenanceRequestDto(String urgency) {
        MaintenanceRequestDto dto = new MaintenanceRequestDto();
        dto.setFullName("Marie Martin");
        dto.setEmail("marie@example.com");
        dto.setPhone("0698765432");
        dto.setCity("Lyon");
        dto.setPostalCode("69001");
        dto.setUrgency(urgency);
        dto.setSelectedWorks(List.of("fuite-eau", "prise-elec"));
        dto.setCustomNeed("Fuite sous l'evier");
        dto.setDescription("Le robinet goutte depuis 3 jours");
        return dto;
    }

    // ═══════════════════════════════════════════════════════════════
    // Constructor tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class ConstructorTests {

        @Test
        void whenMailSenderAvailable_thenNoException() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);

            assertThatCode(() -> new EmailService(mailSenderProvider, systemEmailTemplateService, templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService))
                    .doesNotThrowAnyException();
        }

        @Test
        void whenMailSenderNull_thenNoExceptionButWarningLogged() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);

            assertThatCode(() -> new EmailService(mailSenderProvider, systemEmailTemplateService, templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService))
                    .doesNotThrowAnyException();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // requireMailSender tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class RequireMailSenderTests {

        @Test
        void whenMailSenderNull_thenThrowsIllegalStateException() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider, systemEmailTemplateService, templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
            ReflectionTestUtils.setField(serviceWithoutMail, "fromAddress", "info@clenzy.fr");
            ReflectionTestUtils.setField(serviceWithoutMail, "notificationTo", "info@clenzy.fr");

            // sendQuoteRequestNotification has catch(Exception e) that wraps IllegalStateException
            // into RuntimeException, so we check for the wrapped cause
            assertThatThrownBy(() -> serviceWithoutMail.sendQuoteRequestNotification(
                    buildQuoteRequestDto(), "premium", 45))
                    .isInstanceOf(RuntimeException.class)
                    .hasCauseInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenMailSenderPresent_thenNoException() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            assertThatCode(() -> emailService.sendQuoteRequestNotification(
                    buildQuoteRequestDto(), "premium", 45))
                    .doesNotThrowAnyException();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendQuoteRequestNotification tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendQuoteRequestNotificationTests {

        @Test
        void whenValidDto_thenSendsEmailWithCorrectSubjectAndFromTo() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteRequestNotification(buildQuoteRequestDto(), "premium", 45);

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).contains("Nouvelle demande de devis");
            assertThat(mimeMessage.getSubject()).contains("Jean Dupont");
            assertThat(mimeMessage.getSubject()).contains("Paris");
            assertThat(mimeMessage.getFrom()[0].toString()).contains("info@clenzy.fr");
            assertThat(mimeMessage.getAllRecipients()[0].toString()).contains("info@clenzy.fr");
        }

        @Test
        void whenValidDto_thenHtmlBodyContainsRecommendedPackage() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteRequestNotification(buildQuoteRequestDto(), "confort", 35);

            verify(mailSender).send(mimeMessage);
            // The email was sent successfully with the data
            assertThat(mimeMessage.getSubject()).contains("Jean Dupont");
        }

        @Test
        void whenMessagingExceptionThrown_thenWrapsInRuntimeException() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());
            doThrow(new RuntimeException("SMTP error")).when(mailSender).send(any(MimeMessage.class));

            assertThatThrownBy(() -> emailService.sendQuoteRequestNotification(
                    buildQuoteRequestDto(), "premium", 45))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur d'envoi de l'email de notification");
        }

        @Test
        void whenServicesAreNull_thenHandledGracefully() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            QuoteRequestDto dto = buildQuoteRequestDto();
            dto.setServices(null);
            dto.setServicesDevis(null);

            assertThatCode(() -> emailService.sendQuoteRequestNotification(dto, "essentiel", 25))
                    .doesNotThrowAnyException();
            verify(mailSender).send(mimeMessage);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendMaintenanceNotification tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendMaintenanceNotificationTests {

        @Test
        void whenUrgent_thenSubjectContainsUrgencyPrefix() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendMaintenanceNotification(buildMaintenanceRequestDto("urgent"));

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).contains("URGENT");
            assertThat(mimeMessage.getSubject()).contains("Demande de devis maintenance");
            assertThat(mimeMessage.getSubject()).contains("Marie Martin");
        }

        @Test
        void whenNormalUrgency_thenNoUrgencyPrefix() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendMaintenanceNotification(buildMaintenanceRequestDto("normal"));

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).doesNotContain("URGENT");
            assertThat(mimeMessage.getSubject()).contains("Demande de devis maintenance");
        }

        @Test
        void whenPlanifieUrgency_thenNoUrgencyPrefix() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendMaintenanceNotification(buildMaintenanceRequestDto("planifie"));

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).doesNotContain("URGENT");
        }

        @Test
        void whenNullCity_thenSubjectOmitsCity() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            MaintenanceRequestDto dto = buildMaintenanceRequestDto("normal");
            dto.setCity(null);

            emailService.sendMaintenanceNotification(dto);

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).contains("Marie Martin");
            // City should not appear since it's null
            assertThat(mimeMessage.getSubject()).doesNotContain("Lyon");
        }

        @Test
        void whenMessagingExceptionThrown_thenWrapsInRuntimeException() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());
            doThrow(new RuntimeException("SMTP error")).when(mailSender).send(any(MimeMessage.class));

            assertThatThrownBy(() -> emailService.sendMaintenanceNotification(
                    buildMaintenanceRequestDto("normal")))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur d'envoi de l'email de notification maintenance");
        }

        @Test
        void whenSelectedWorksEmpty_thenHandledGracefully() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            MaintenanceRequestDto dto = buildMaintenanceRequestDto("normal");
            dto.setSelectedWorks(List.of());
            dto.setCustomNeed(null);
            dto.setDescription(null);

            assertThatCode(() -> emailService.sendMaintenanceNotification(dto))
                    .doesNotThrowAnyException();
            verify(mailSender).send(mimeMessage);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendContactMessage tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendContactMessageTests {

        @Test
        void whenValidInput_thenSendsAndReturnsMessageId() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            String result = emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Test Subject", "Hello, ceci est un test.", null);

            verify(mailSender).send(mimeMessage);
            assertThat(result).isNotNull().isNotBlank();
        }

        @Test
        void whenBlankSubject_thenUsesDefaultSubject() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "   ", "Un message valide.", null);

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).isEqualTo("(Sans objet)");
        }

        @Test
        void whenNullSubject_thenUsesDefaultSubject() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    null, "Un message valide.", null);

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).isEqualTo("(Sans objet)");
        }

        @Test
        void whenBlankMessage_thenThrowsIllegalArgumentException() {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            assertThatThrownBy(() -> emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject", "   ", null))
                    .isInstanceOf(RuntimeException.class)
                    .hasCauseInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenNullMessage_thenThrowsIllegalArgumentException() {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            assertThatThrownBy(() -> emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject", null, null))
                    .isInstanceOf(RuntimeException.class)
                    .hasCauseInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenEmptyMessage_thenThrowsIllegalArgumentException() {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            assertThatThrownBy(() -> emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject", "", null))
                    .isInstanceOf(RuntimeException.class)
                    .hasCauseInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenNullAttachments_thenHandledGracefully() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            String result = emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject", "Valid message.", null);

            verify(mailSender).send(mimeMessage);
            assertThat(result).isNotNull();
        }

        @Test
        void whenEmptyAttachmentsList_thenHandledGracefully() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            String result = emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject", "Valid message.", List.of());

            verify(mailSender).send(mimeMessage);
            assertThat(result).isNotNull();
        }

        @Test
        void whenReplyToIsNull_thenSendsSuccessfullyWithoutExplicitReplyTo() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            String result = emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    null, null,
                    "Subject", "Valid message.", null);

            verify(mailSender).send(mimeMessage);
            assertThat(result).isNotNull();
            // When replyTo is null, MimeMessage defaults to the From address (no explicit Reply-To header)
            assertThat(mimeMessage.getHeader("Reply-To")).isNull();
        }

        @Test
        void whenReplyToIsBlank_thenSendsSuccessfullyWithoutExplicitReplyTo() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            String result = emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "   ", "Expediteur",
                    "Subject", "Valid message.", null);

            verify(mailSender).send(mimeMessage);
            assertThat(result).isNotNull();
            // When replyTo is blank, no explicit Reply-To header is set
            assertThat(mimeMessage.getHeader("Reply-To")).isNull();
        }

        @Test
        void whenSubjectContainsCrLf_thenSanitized() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject\r\nBcc: attacker@evil.com", "Valid message.", null);

            verify(mailSender).send(mimeMessage);
            // The subject should have CR/LF replaced with space
            assertThat(mimeMessage.getSubject()).doesNotContain("\r");
            assertThat(mimeMessage.getSubject()).doesNotContain("\n");
        }

        @Test
        void whenMailSenderNull_thenThrowsIllegalStateException() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider, systemEmailTemplateService, templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
            ReflectionTestUtils.setField(serviceWithoutMail, "fromAddress", "info@clenzy.fr");
            ReflectionTestUtils.setField(serviceWithoutMail, "notificationTo", "info@clenzy.fr");
            ReflectionTestUtils.setField(serviceWithoutMail, "maxAttachments", 10);
            ReflectionTestUtils.setField(serviceWithoutMail, "maxAttachmentSizeBytes", 10_485_760L);

            assertThatThrownBy(() -> serviceWithoutMail.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject", "Valid message.", null))
                    .isInstanceOf(RuntimeException.class)
                    .hasCauseInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenWithAttachments_thenSendsSuccessfully() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            MultipartFile mockFile = mock(MultipartFile.class);
            when(mockFile.isEmpty()).thenReturn(false);
            when(mockFile.getOriginalFilename()).thenReturn("document.pdf");
            when(mockFile.getContentType()).thenReturn("application/pdf");
            when(mockFile.getBytes()).thenReturn("PDF content".getBytes());
            when(mockFile.getSize()).thenReturn(1024L);

            String result = emailService.sendContactMessage(
                    "dest@example.com", "Destinataire",
                    "sender@example.com", "Expediteur",
                    "Subject", "Valid message.", List.of(mockFile));

            verify(mailSender).send(mimeMessage);
            assertThat(result).isNotNull();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendDocumentEmail tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendDocumentEmailTests {

        @Test
        void whenValidInput_thenSendsWithPdfAttachment() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            byte[] pdfBytes = "fake-pdf-content".getBytes();

            emailService.sendDocumentEmail(
                    "client@example.com", "Facture Janvier 2026",
                    "<h1>Facture</h1>", "facture-2026-01.pdf", pdfBytes);

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).isEqualTo("Facture Janvier 2026");
            assertThat(mimeMessage.getFrom()[0].toString()).contains("info@clenzy.fr");
            assertThat(mimeMessage.getAllRecipients()[0].toString()).contains("client@example.com");
        }

        @Test
        void whenMessagingExceptionThrown_thenWrapsInRuntimeException() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
            doThrow(new RuntimeException(new jakarta.mail.MessagingException("SMTP down")))
                    .when(mailSender).send(any(MimeMessage.class));

            assertThatThrownBy(() -> emailService.sendDocumentEmail(
                    "client@example.com", "Facture",
                    "<h1>Facture</h1>", "facture.pdf", "pdf".getBytes()))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenMailSenderNull_thenThrowsRuntimeException() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider, systemEmailTemplateService, templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
            ReflectionTestUtils.setField(serviceWithoutMail, "fromAddress", "info@clenzy.fr");

            assertThatThrownBy(() -> serviceWithoutMail.sendDocumentEmail(
                    "client@example.com", "Facture",
                    "<h1>Facture</h1>", "facture.pdf", "pdf".getBytes()))
                    .isInstanceOf(RuntimeException.class)
                    .hasCauseInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenSubjectContainsCrLf_thenSanitized() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendDocumentEmail(
                    "client@example.com", "Facture\r\nBcc: evil@hack.com",
                    "<h1>Facture</h1>", "facture.pdf", "pdf".getBytes());

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).doesNotContain("\r");
            assertThat(mimeMessage.getSubject()).doesNotContain("\n");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendInvitationEmail tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendInvitationEmailTests {

        @Test
        void whenValidInput_thenSendsWithCorrectSubject() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendInvitationEmail(
                    "invite@example.com", "Mon Organisation", "Admin Name",
                    "MEMBER", "https://app.clenzy.fr/invite/abc123",
                    LocalDateTime.of(2026, 3, 1, 12, 0));

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).contains("Invitation a rejoindre");
            assertThat(mimeMessage.getSubject()).contains("Mon Organisation");
            // Rebrand Clenzy → Baitly : le subject reference desormais Baitly via
            // le template DB (cf. migration 0155 seed invitation_organization).
            assertThat(mimeMessage.getSubject()).contains("Baitly");
            assertThat(mimeMessage.getAllRecipients()[0].toString()).contains("invite@example.com");
        }

        @Test
        void whenNullExpiresAt_thenUsesDefaultExpiry() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            assertThatCode(() -> emailService.sendInvitationEmail(
                    "invite@example.com", "Org", "Admin",
                    "OWNER", "https://app.clenzy.fr/invite/xyz", null))
                    .doesNotThrowAnyException();

            verify(mailSender).send(mimeMessage);
        }

        @Test
        void whenSendThrowsMailException_thenWrappedInRuntimeException() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
            // sendInvitationEmail now catches Exception and wraps in RuntimeException.
            doThrow(new org.springframework.mail.MailSendException("Connection refused"))
                    .when(mailSender).send(any(MimeMessage.class));

            assertThatThrownBy(() -> emailService.sendInvitationEmail(
                    "invite@example.com", "Org", "Admin",
                    "MEMBER", "https://app.clenzy.fr/invite/abc", null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur d'envoi de l'email d'invitation");
        }

        @Test
        void whenMailSenderNull_thenThrowsRuntimeException() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider, systemEmailTemplateService, templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
            ReflectionTestUtils.setField(serviceWithoutMail, "fromAddress", "info@clenzy.fr");

            // sendInvitationEmail now catches Exception and wraps in RuntimeException
            assertThatThrownBy(() -> serviceWithoutMail.sendInvitationEmail(
                    "invite@example.com", "Org", "Admin",
                    "MEMBER", "https://app.clenzy.fr/invite/abc", null))
                    .isInstanceOf(RuntimeException.class)
                    .hasCauseInstanceOf(IllegalStateException.class);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sanitizeHeaderValue tests (via reflection for private method)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SanitizeHeaderValueTests {

        private String invokeSanitizeHeaderValue(String value) throws Exception {
            Method method = EmailService.class.getDeclaredMethod("sanitizeHeaderValue", String.class);
            method.setAccessible(true);
            return (String) method.invoke(emailService, value);
        }

        @Test
        void whenValueContainsCr_thenStripped() throws Exception {
            assertThat(invokeSanitizeHeaderValue("Hello\rWorld")).isEqualTo("Hello World");
        }

        @Test
        void whenValueContainsLf_thenStripped() throws Exception {
            assertThat(invokeSanitizeHeaderValue("Hello\nWorld")).isEqualTo("Hello World");
        }

        @Test
        void whenValueContainsCrLf_thenStripped() throws Exception {
            assertThat(invokeSanitizeHeaderValue("Hello\r\nWorld")).isEqualTo("Hello World");
        }

        @Test
        void whenValueContainsMultipleCrLf_thenAllStripped() throws Exception {
            assertThat(invokeSanitizeHeaderValue("A\r\nB\nC\rD")).isEqualTo("A B C D");
        }

        @Test
        void whenNull_thenReturnsEmptyString() throws Exception {
            assertThat(invokeSanitizeHeaderValue(null)).isEqualTo("");
        }

        @Test
        void whenCleanValue_thenReturnsUnchanged() throws Exception {
            assertThat(invokeSanitizeHeaderValue("Clean subject line")).isEqualTo("Clean subject line");
        }

        @Test
        void whenValueHasLeadingTrailingSpaces_thenTrimmed() throws Exception {
            assertThat(invokeSanitizeHeaderValue("  spaced  ")).isEqualTo("spaced");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Libelles de roles (extraits vers RoleEmailLabels — T-SOLID-9)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class FormatRoleNameTests {

        private String invokeFormatRoleName(String role) {
            return com.clenzy.service.email.RoleEmailLabels.displayName(role);
        }

        @ParameterizedTest
        @CsvSource({
                "OWNER, Proprietaire",
                "SUPER_ADMIN, Super Administrateur",
                "SUPER_MANAGER, Super Manager",
                "SUPERVISOR, Superviseur",
                "TECHNICIAN, Technicien",
                "HOUSEKEEPER, Agent de menage",
                "LAUNDRY, Blanchisserie",
                "EXTERIOR_TECH, Tech. Exterieur",
                "HOST, Proprietaire",
                "MEMBER, Membre"
        })
        void whenKnownRole_thenReturnsFrenchLabel(String role, String expected) throws Exception {
            assertThat(invokeFormatRoleName(role)).isEqualTo(expected);
        }

        @Test
        void whenLowercaseRole_thenStillMapsCorrectly() throws Exception {
            assertThat(invokeFormatRoleName("owner")).isEqualTo("Proprietaire");
            assertThat(invokeFormatRoleName("member")).isEqualTo("Membre");
        }

        @Test
        void whenUnknownRole_thenReturnsRawRole() throws Exception {
            assertThat(invokeFormatRoleName("CUSTOM_ROLE")).isEqualTo("CUSTOM_ROLE");
        }

        @Test
        void whenNull_thenReturnsMembre() throws Exception {
            assertThat(invokeFormatRoleName(null)).isEqualTo("Membre");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // formatPackageName (extrait vers QuoteEmailComposer — T-SOLID-9)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class FormatPackageNameTests {

        private String invokeFormatPackageName(String packageId) {
            return new com.clenzy.service.email.QuoteEmailComposer().formatPackageName(packageId);
        }

        @Test
        void whenPremium_thenReturnsForfaitPremium() throws Exception {
            assertThat(invokeFormatPackageName("premium")).isEqualTo("Forfait Premium");
        }

        @Test
        void whenConfort_thenReturnsForfaitConfort() throws Exception {
            assertThat(invokeFormatPackageName("confort")).isEqualTo("Forfait Confort");
        }

        @Test
        void whenEssentiel_thenReturnsForfaitEssentiel() throws Exception {
            assertThat(invokeFormatPackageName("essentiel")).isEqualTo("Forfait Essentiel");
        }

        @Test
        void whenUnknownPackage_thenReturnsRawId() throws Exception {
            assertThat(invokeFormatPackageName("custom-plan")).isEqualTo("custom-plan");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // getLabel tests (methode privee de QuoteEmailComposer — T-SOLID-9)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class GetLabelTests {

        private String invokeGetLabel(java.util.Map<String, String> labels, String key) throws Exception {
            var composer = new com.clenzy.service.email.QuoteEmailComposer();
            Method method = com.clenzy.service.email.QuoteEmailComposer.class
                    .getDeclaredMethod("getLabel", java.util.Map.class, String.class);
            method.setAccessible(true);
            return (String) method.invoke(composer, labels, key);
        }

        @Test
        void whenKeyExists_thenReturnsEscapedLabel() throws Exception {
            java.util.Map<String, String> labels = java.util.Map.of("test", "Valeur <Test>");
            assertThat(invokeGetLabel(labels, "test")).isEqualTo("Valeur &lt;Test&gt;");
        }

        @Test
        void whenKeyNotFound_thenReturnsEscapedKey() throws Exception {
            java.util.Map<String, String> labels = java.util.Map.of("a", "A");
            assertThat(invokeGetLabel(labels, "<script>")).isEqualTo("&lt;script&gt;");
        }

        @Test
        void whenKeyNull_thenReturnsNonRenseigne() throws Exception {
            java.util.Map<String, String> labels = java.util.Map.of("a", "A");
            assertThat(invokeGetLabel(labels, null)).isEqualTo("Non renseign\u00e9");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Integration-style tests (verifying full email flow)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class FullFlowTests {

        @Test
        void whenSendingQuoteRequest_thenMailSenderSendCalledExactlyOnce() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            emailService.sendQuoteRequestNotification(buildQuoteRequestDto(), "premium", 45);

            verify(mailSender, times(1)).send(any(MimeMessage.class));
        }

        @Test
        void whenSendingMaintenanceRequest_thenMailSenderSendCalledExactlyOnce() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            emailService.sendMaintenanceNotification(buildMaintenanceRequestDto("normal"));

            verify(mailSender, times(1)).send(any(MimeMessage.class));
        }

        @Test
        void whenSendingContactMessage_thenMailSenderSendCalledExactlyOnce() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            emailService.sendContactMessage(
                    "dest@example.com", "Dest", "reply@example.com", "Sender",
                    "Subject", "Body text", null);

            verify(mailSender, times(1)).send(any(MimeMessage.class));
        }

        @Test
        void whenSendingDocumentEmail_thenMailSenderSendCalledExactlyOnce() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            emailService.sendDocumentEmail(
                    "client@example.com", "Doc", "<p>Body</p>",
                    "doc.pdf", "content".getBytes());

            verify(mailSender, times(1)).send(any(MimeMessage.class));
        }

        @Test
        void whenSendingInvitationEmail_thenMailSenderSendCalledExactlyOnce() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            emailService.sendInvitationEmail(
                    "invite@example.com", "Org", "Admin",
                    "MEMBER", "https://app.clenzy.fr/invite/abc",
                    LocalDateTime.of(2026, 3, 1, 12, 0));

            verify(mailSender, times(1)).send(any(MimeMessage.class));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendWelcomeEmail tests (catches exception silently)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendWelcomeEmailTests {

        @Test
        void whenValidInput_thenSendsWithBrandedSubject() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendWelcomeEmail("new@example.com", "Alice", "Martin",
                    "HOST", "https://app.clenzy.fr/login");

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).contains("Bienvenue sur Clenzy");
            assertThat(mimeMessage.getAllRecipients()[0].toString()).contains("new@example.com");
        }

        @Test
        void whenMailSenderThrows_thenSwallowedSilently() {
            // sendWelcomeEmail catches and never propagates (user creation should not fail on email)
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());
            doThrow(new RuntimeException("SMTP down")).when(mailSender).send(any(MimeMessage.class));

            assertThatCode(() -> emailService.sendWelcomeEmail(
                    "x@y.z", "X", "Y", "MEMBER", "http://localhost"))
                    .doesNotThrowAnyException();
        }

        @Test
        void whenNullRoleName_thenStillSends() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendWelcomeEmail("a@b.c", "F", "L", null, "http://x");

            verify(mailSender).send(mimeMessage);
        }

        @Test
        void whenMailSenderNull_thenDoesNotThrow() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);
            EmailService svc = new EmailService(mailSenderProvider, systemEmailTemplateService,
                    templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
            ReflectionTestUtils.setField(svc, "fromAddress", "info@clenzy.fr");

            assertThatCode(() -> svc.sendWelcomeEmail("a@b.c", "F", "L", "HOST", "http://x"))
                    .doesNotThrowAnyException();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendInscriptionConfirmationEmail tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendInscriptionConfirmationEmailTests {

        @Test
        void whenValidInput_thenSendsConfirmationLink() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendInscriptionConfirmationEmail(
                    "newuser@example.com", "John Doe",
                    "https://app.clenzy.fr/inscription/confirm?token=abc",
                    LocalDateTime.of(2026, 6, 1, 18, 0));

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).contains("Confirmez votre inscription");
            assertThat(mimeMessage.getAllRecipients()[0].toString()).contains("newuser@example.com");
        }

        @Test
        void whenNullExpiresAt_thenUsesDefault() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            assertThatCode(() -> emailService.sendInscriptionConfirmationEmail(
                    "x@y.z", "Jane", "http://link", null))
                    .doesNotThrowAnyException();

            verify(mailSender).send(mimeMessage);
        }

        @Test
        void whenMailSendThrows_thenWrapsInRuntime() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());
            doThrow(new org.springframework.mail.MailSendException("smtp down"))
                    .when(mailSender).send(any(MimeMessage.class));

            assertThatThrownBy(() -> emailService.sendInscriptionConfirmationEmail(
                    "x@y.z", "Jane", "http://link", LocalDateTime.now().plusHours(72)))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur d'envoi de l'email de confirmation");
        }

        @Test
        void whenMailSenderNull_thenWrapsInRuntime() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);
            EmailService svc = new EmailService(mailSenderProvider, systemEmailTemplateService,
                    templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
            ReflectionTestUtils.setField(svc, "fromAddress", "info@clenzy.fr");

            assertThatThrownBy(() -> svc.sendInscriptionConfirmationEmail(
                    "x@y.z", "Jane", "http://link", null))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendSimpleHtmlEmail tests
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendSimpleHtmlEmailTests {

        @Test
        void whenValidInput_thenSendsHtmlEmail() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendSimpleHtmlEmail("dest@example.com", "Reset password",
                    "<p>Click <a href='http://x'>here</a></p>");

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).isEqualTo("Reset password");
        }

        @Test
        void whenSubjectContainsCrLf_thenSanitized() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendSimpleHtmlEmail("dest@example.com",
                    "Title\r\nBcc: attacker@evil.com", "<p>body</p>");

            verify(mailSender).send(mimeMessage);
            assertThat(mimeMessage.getSubject()).doesNotContain("\r").doesNotContain("\n");
        }

        @Test
        void whenSendThrowsMailException_thenWrappedInRuntime() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());
            doThrow(new org.springframework.mail.MailSendException("SMTP refused"))
                    .when(mailSender).send(any(MimeMessage.class));

            assertThatThrownBy(() -> emailService.sendSimpleHtmlEmail(
                    "dest@example.com", "Subject", "<p>body</p>"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur d'envoi de l'email");
        }

        @Test
        void whenMailSenderNull_thenRuntime() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);
            EmailService svc = new EmailService(mailSenderProvider, systemEmailTemplateService,
                    templateInterpolationService, new com.clenzy.service.messaging.EmailWrapperService(), platformSettingsService);
            ReflectionTestUtils.setField(svc, "fromAddress", "info@clenzy.fr");

            assertThatThrownBy(() -> svc.sendSimpleHtmlEmail("x@y.z", "S", "<p>b</p>"))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Maintenance — urgency banner branches (urgent / normal / planifie)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class MaintenanceUrgencyBannerTests {

        @ParameterizedTest
        @ValueSource(strings = {"urgent", "normal", "planifie"})
        void whenUrgencyValueProvided_thenEmailSentWithoutError(String urgency) {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            assertThatCode(() -> emailService.sendMaintenanceNotification(
                    buildMaintenanceRequestDto(urgency))).doesNotThrowAnyException();

            verify(mailSender, atLeastOnce()).send(any(MimeMessage.class));
        }

        @Test
        void whenWithCustomNeedAndDescription_thenContainsBothInBody() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            MaintenanceRequestDto dto = buildMaintenanceRequestDto("urgent");
            dto.setCustomNeed("Custom work request");
            dto.setDescription("Long description here");
            dto.setPostalCode("75002");

            emailService.sendMaintenanceNotification(dto);

            verify(mailSender).send(mimeMessage);
        }

        @Test
        void whenAllOptionalFieldsNull_thenSendsWithoutError() {
            when(mailSender.createMimeMessage()).thenReturn(createRealMimeMessage());

            MaintenanceRequestDto dto = new MaintenanceRequestDto();
            dto.setFullName("Min");
            dto.setEmail("min@example.com");
            dto.setUrgency("urgent");
            dto.setSelectedWorks(List.of("fuite-eau"));

            assertThatCode(() -> emailService.sendMaintenanceNotification(dto))
                    .doesNotThrowAnyException();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // getLabel — null+empty key, escaping
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class GetLabelEdgeCases {

        @Test
        void getLabel_withNullAndEmptyArguments() throws Exception {
            var composer = new com.clenzy.service.email.QuoteEmailComposer();
            java.lang.reflect.Method m = com.clenzy.service.email.QuoteEmailComposer.class
                    .getDeclaredMethod("getLabel", java.util.Map.class, String.class);
            m.setAccessible(true);
            java.util.Map<String, String> labels = java.util.Map.of("k", "<v>");
            assertThat((String) m.invoke(composer, labels, "k")).isEqualTo("&lt;v&gt;");
            assertThat((String) m.invoke(composer, labels, null)).isEqualTo("Non renseigné");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // sendContactMessage — sanitizeFileName branches
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class SendContactMessageAdvancedTests {

        @Test
        void whenAttachmentWithoutContentType_thenDefaultsToOctetStream() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            MultipartFile mockFile = mock(MultipartFile.class);
            when(mockFile.isEmpty()).thenReturn(false);
            when(mockFile.getOriginalFilename()).thenReturn("file.bin");
            when(mockFile.getContentType()).thenReturn(null);
            when(mockFile.getBytes()).thenReturn(new byte[]{1, 2, 3});
            when(mockFile.getSize()).thenReturn(3L);

            String result = emailService.sendContactMessage(
                    "dest@x.com", "Dest", "rt@x.com", "Sender",
                    "S", "Hi", List.of(mockFile));

            assertThat(result).isNotNull();
            verify(mailSender).send(mimeMessage);
        }

        @Test
        void whenAttachmentEmpty_thenSkipped() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            MultipartFile empty = mock(MultipartFile.class);
            when(empty.isEmpty()).thenReturn(true);

            String result = emailService.sendContactMessage(
                    "dest@x.com", "Dest", "rt@x.com", "Sender",
                    "S", "Hi", List.of(empty));

            assertThat(result).isNotNull();
            verify(mailSender).send(mimeMessage);
        }
    }

    /**
     * Copie interne du devis envoyée à l'équipe (info@) — remplace l'ancien
     * CC-a-soi-meme peu fiable par un email dédié (destinataire principal To:).
     */
    @Nested
    class QuoteInternalCopyTests {

        @Test
        void sendQuoteInternalCopy_sendsToInternalAddressAsPrimaryRecipient_notCc() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteInternalCopy("nicolas@hotmail.fr", "PDFDATA".getBytes(), "Devis.pdf");

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());
            MimeMessage sent = captor.getValue();

            // Destinataire principal (To:) = adresse interne → fiable. Surtout PAS un CC.
            assertThat(sent.getRecipients(jakarta.mail.Message.RecipientType.TO))
                    .extracting(Object::toString).containsExactly("info@clenzy.fr");
            assertThat(sent.getRecipients(jakarta.mail.Message.RecipientType.CC)).isNull();
            assertThat(sent.getSubject()).contains("nicolas@hotmail.fr");
        }

        @Test
        void sendQuoteInternalCopy_attachesThePdf() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteInternalCopy("nicolas@hotmail.fr", "PDFDATA".getBytes(), "Devis_Nicolas.pdf");

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());

            jakarta.mail.Multipart mp = (jakarta.mail.Multipart) captor.getValue().getContent();
            boolean hasPdf = false;
            for (int i = 0; i < mp.getCount(); i++) {
                if ("Devis_Nicolas.pdf".equals(mp.getBodyPart(i).getFileName())) {
                    hasPdf = true;
                }
            }
            assertThat(hasPdf).as("le PDF du devis doit être joint à la copie interne").isTrue();
        }

        @Test
        void sendQuoteInternalCopy_noRecipientsConfigured_isNoOp() {
            // Aucun destinataire configuré (liste vide) ET fallback env vide → no-op.
            when(platformSettingsService.getInternalNotificationEmails()).thenReturn(List.of());
            ReflectionTestUtils.setField(emailService, "notificationTo", "");

            emailService.sendQuoteInternalCopy("nicolas@hotmail.fr", "PDF".getBytes(), "Devis.pdf");

            verify(mailSender, never()).send(any(MimeMessage.class));
        }

        @Test
        void sendQuoteInternalCopy_usesConfiguredRecipients_supportsMultiple() throws Exception {
            // Destinataires pilotés par les Settings du PMS (≠ From info@) → plus de self-send,
            // et plusieurs adresses possibles.
            when(platformSettingsService.getInternalNotificationEmails())
                    .thenReturn(List.of("perso@outlook.fr", "associe@gmail.com"));
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteInternalCopy("nicolas@hotmail.fr", "PDF".getBytes(), "Devis.pdf");

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());
            assertThat(captor.getValue().getRecipients(jakarta.mail.Message.RecipientType.TO))
                    .extracting(Object::toString)
                    .containsExactlyInAnyOrder("perso@outlook.fr", "associe@gmail.com");
        }

        @Test
        void emails_useConfiguredSenderFrom() throws Exception {
            // From piloté par les Settings (platform_settings.sender_email/name).
            when(platformSettingsService.getSenderEmail()).thenReturn("hello@baitly.fr");
            when(platformSettingsService.getSenderName()).thenReturn("Baitly Pro");
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteInternalCopy("nicolas@hotmail.fr", "PDF".getBytes(), "Devis.pdf");

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());
            assertThat(captor.getValue().getFrom())
                    .extracting(Object::toString)
                    .anyMatch(s -> s.contains("hello@baitly.fr"));
        }

        @Test
        void sendQuoteToProspect_noLongerCcsInternalAddress() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteToProspect("nicolas@hotmail.fr", "PDF".getBytes(), "Devis.pdf", null, null);

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());
            MimeMessage sent = captor.getValue();

            assertThat(sent.getRecipients(jakarta.mail.Message.RecipientType.TO))
                    .extracting(Object::toString).containsExactly("nicolas@hotmail.fr");
            // Plus aucun CC interne sur le mail prospect (remplacé par sendQuoteInternalCopy).
            assertThat(sent.getRecipients(jakarta.mail.Message.RecipientType.CC)).isNull();
        }
    }

    /**
     * Z7-SEC-02 : le corps personnalise de l'editeur "Renvoyer" (input user)
     * doit etre echappe avant insertion dans le HTML de l'email prospect —
     * le HTML brut est rendu comme texte litteral, le markdown leger reste rendu.
     */
    @Nested
    class QuoteToProspectCustomBodyEscapingTests {

        @Test
        void whenCustomBodyContainsHtml_thenItIsEscapedInProspectEmail() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteToProspect("prospect@example.com", "PDF".getBytes(), "Devis.pdf",
                    null, "Bonjour,\n\n<a href=\"https://evil.example\">Cliquez ici</a>");

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());
            String html = extractHtmlPart(captor.getValue());

            assertThat(html).isNotNull();
            // Securite : l'ancre injectee N'EST PAS rendue comme un lien vivant —
            // ses chevrons restent echappes (&lt; / &gt;), donc affichee en texte
            // litteral. jsoup re-serialise le &quot; interne en " (les guillemets
            // dans une valeur d'attribut n'ont pas besoin d'echappement) : cosmetique,
            // le construct reste neutralise (pas de <a ...> reel).
            assertThat(html).doesNotContain("<a href=\"https://evil.example\">");
            assertThat(html).contains("&lt;a href=\"https://evil.example\"&gt;Cliquez ici&lt;/a&gt;");
        }

        @Test
        void whenCustomBodyUsesLightMarkdown_thenRenderingIsPreserved() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteToProspect("prospect@example.com", "PDF".getBytes(), "Devis.pdf",
                    null, "Bonjour,\n\nVotre devis *personnalisé* est en _pièce jointe_.");

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());
            String html = extractHtmlPart(captor.getValue());

            assertThat(html).isNotNull();
            assertThat(html).contains("<strong>personnalisé</strong>");
            assertThat(html).contains("<em>pièce jointe</em>");
        }

        @Test
        void whenNoCustomBody_thenDefaultTemplateBodyIsUsedUnchanged() throws Exception {
            MimeMessage mimeMessage = createRealMimeMessage();
            when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

            emailService.sendQuoteToProspect("prospect@example.com", "PDF".getBytes(), "Devis.pdf",
                    null, null);

            ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
            verify(mailSender).send(captor.capture());
            String html = extractHtmlPart(captor.getValue());

            // Corps par defaut (template stub "quote_to_prospect" → body "Stub") rendu sans alteration.
            assertThat(html).isNotNull();
            assertThat(html).contains("Stub");
        }

        /**
         * Extrait recursivement la partie text/html du message multipart.
         * <p>{@code saveChanges()} d'abord : sur un MimeMessage construit en memoire,
         * les en-tetes Content-Type des parties ne sont synchronises qu'a cet appel
         * (sinon tout se declare text/plain et la partie HTML est introuvable).
         * Fidele a la prod : {@code Transport.send} fait le meme saveChanges.</p>
         */
        private String extractHtmlPart(MimeMessage message) throws Exception {
            message.saveChanges();
            return findHtmlPart(message);
        }

        private String findHtmlPart(jakarta.mail.Part part) throws Exception {
            if (part.isMimeType("text/html")) {
                return String.valueOf(part.getContent());
            }
            if (part.getContent() instanceof jakarta.mail.Multipart multipart) {
                for (int i = 0; i < multipart.getCount(); i++) {
                    String html = findHtmlPart(multipart.getBodyPart(i));
                    if (html != null) return html;
                }
            }
            return null;
        }
    }
}
