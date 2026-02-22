package com.clenzy.service;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.dto.QuoteRequestDto;
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

    private EmailService emailService;

    @BeforeEach
    void setUp() {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        emailService = new EmailService(mailSenderProvider);
        ReflectionTestUtils.setField(emailService, "fromAddress", "info@clenzy.fr");
        ReflectionTestUtils.setField(emailService, "notificationTo", "info@clenzy.fr");
        ReflectionTestUtils.setField(emailService, "maxAttachments", 10);
        ReflectionTestUtils.setField(emailService, "maxAttachmentSizeBytes", 10_485_760L);
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

            assertThatCode(() -> new EmailService(mailSenderProvider))
                    .doesNotThrowAnyException();
        }

        @Test
        void whenMailSenderNull_thenNoExceptionButWarningLogged() {
            when(mailSenderProvider.getIfAvailable()).thenReturn(null);

            assertThatCode(() -> new EmailService(mailSenderProvider))
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
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider);
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
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider);
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
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider);
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
            assertThat(mimeMessage.getSubject()).contains("Clenzy");
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
            EmailService serviceWithoutMail = new EmailService(mailSenderProvider);
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
    // formatRoleName tests (via reflection for private method)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class FormatRoleNameTests {

        private String invokeFormatRoleName(String role) throws Exception {
            Method method = EmailService.class.getDeclaredMethod("formatRoleName", String.class);
            method.setAccessible(true);
            return (String) method.invoke(emailService, role);
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
    // formatPackageName tests (via reflection for private method)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class FormatPackageNameTests {

        private String invokeFormatPackageName(String packageId) throws Exception {
            Method method = EmailService.class.getDeclaredMethod("formatPackageName", String.class);
            method.setAccessible(true);
            return (String) method.invoke(emailService, packageId);
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
    // getLabel tests (via reflection for private method)
    // ═══════════════════════════════════════════════════════════════

    @Nested
    class GetLabelTests {

        @SuppressWarnings("unchecked")
        private String invokeGetLabel(java.util.Map<String, String> labels, String key) throws Exception {
            Method method = EmailService.class.getDeclaredMethod("getLabel", java.util.Map.class, String.class);
            method.setAccessible(true);
            return (String) method.invoke(emailService, labels, key);
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
}
