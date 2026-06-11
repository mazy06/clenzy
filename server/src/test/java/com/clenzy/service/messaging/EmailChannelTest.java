package com.clenzy.service.messaging;

import com.clenzy.model.MessageChannelType;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailChannelTest {

    @Mock private JavaMailSender mailSender;
    @Mock private MimeMessage mimeMessage;

    private EmailChannel emailChannel;

    @BeforeEach
    void setUp() {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mailSender);
        emailChannel = new EmailChannel(provider, new EmailWrapperService());
        ReflectionTestUtils.setField(emailChannel, "fromAddress", "test@clenzy.fr");
    }

    @Test
    void getChannelType_returnsEmail() {
        assertEquals(MessageChannelType.EMAIL, emailChannel.getChannelType());
    }

    @Test
    void isAvailable_whenMailSenderConfigured_thenTrue() {
        assertTrue(emailChannel.isAvailable());
    }

    @Test
    void isAvailable_whenMailSenderNull_thenFalse() {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> nullProvider = mock(ObjectProvider.class);
        when(nullProvider.getIfAvailable()).thenReturn(null);
        EmailChannel channel = new EmailChannel(nullProvider, new EmailWrapperService());

        assertFalse(channel.isAvailable());
    }

    @Test
    void whenRecipientEmailIsNull_thenFailure() {
        var request = new MessageDeliveryRequest(
            null, null, "Test", "Subject", "<p>Body</p>", "Body", "fr"
        );

        var result = emailChannel.send(request);

        assertFalse(result.success());
        assertTrue(result.errorMessage().contains("Email du destinataire"));
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void whenRecipientEmailIsBlank_thenFailure() {
        var request = new MessageDeliveryRequest(
            "  ", null, "Test", "Subject", "<p>Body</p>", "Body", "fr"
        );

        var result = emailChannel.send(request);

        assertFalse(result.success());
    }

    @Test
    void whenMailSenderNotConfigured_thenFailure() {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> nullProvider = mock(ObjectProvider.class);
        when(nullProvider.getIfAvailable()).thenReturn(null);
        EmailChannel channel = new EmailChannel(nullProvider, new EmailWrapperService());

        var request = new MessageDeliveryRequest(
            "test@example.com", null, "Test", "Subject", "<p>Body</p>", "Body", "fr"
        );

        var result = channel.send(request);

        assertFalse(result.success());
        assertTrue(result.errorMessage().contains("JavaMailSender non configure"));
    }

    @Test
    void whenSendSucceeds_thenReturnSuccess() {
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        var request = new MessageDeliveryRequest(
            "guest@example.com", null, "Jean", "Bienvenue", "<p>Hello</p>", "Hello", "fr"
        );

        var result = emailChannel.send(request);

        assertTrue(result.success());
        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void whenSendThrowsException_thenReturnFailure() {
        when(mailSender.createMimeMessage()).thenThrow(new RuntimeException("SMTP error"));

        var request = new MessageDeliveryRequest(
            "guest@example.com", null, "Jean", "Bienvenue", "<p>Hello</p>", "Hello", "fr"
        );

        var result = emailChannel.send(request);

        assertFalse(result.success());
        assertTrue(result.errorMessage().contains("SMTP error"));
    }

    // ═══════════════════════════════════════════════════════════════
    // Z7-SEC-03 — branche "document HTML complet" sanitisee
    // ═══════════════════════════════════════════════════════════════

    @Test
    void whenFullHtmlBodyContainsScript_thenScriptStrippedBeforeSend() throws Exception {
        // Arrange — body HTML complet (commence par <html) avec payload dangereux
        MimeMessage realMessage = createRealMimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(realMessage);
        var request = new MessageDeliveryRequest(
            "guest@example.com", null, "Jean", "Sujet",
            "<html><body><p>Bonjour</p><script>alert(1)</script>"
                + "<img src=\"x\" onerror=\"steal()\"/></body></html>",
            "Bonjour", "fr"
        );

        // Act
        var result = emailChannel.send(request);

        // Assert — envoi OK, constructs dangereux supprimes, contenu legitime conserve
        assertTrue(result.success());
        String html = extractHtmlPart(realMessage);
        assertNotNull(html);
        assertFalse(html.contains("<script"));
        assertFalse(html.contains("alert(1)"));
        assertFalse(html.contains("onerror"));
        assertTrue(html.contains("<p>Bonjour</p>"));
    }

    @Test
    void whenFullHtmlBodyIsClean_thenSentVerbatimWithoutWrapper() throws Exception {
        // Arrange — document HTML complet legitime (ex. briefing deja rendu)
        MimeMessage realMessage = createRealMimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(realMessage);
        String cleanHtml = "<!DOCTYPE html><html><body><h1>Briefing</h1>"
            + "<p>Contenu &amp; lien <a href=\"https://app.clenzy.fr\">ici</a></p></body></html>";
        var request = new MessageDeliveryRequest(
            "guest@example.com", null, "Jean", "Briefing", cleanHtml, "Briefing", "fr"
        );

        // Act
        var result = emailChannel.send(request);

        // Assert — pas de double-wrap (le document n'est PAS re-enrobe dans le
        // template guest) ; la structure du document complet est preservee. jsoup
        // re-serialise en sa forme normalisee : doctype minuscule + <head></head>
        // explicite (cosmetique, pas de re-encodage du contenu ni perte de balise).
        String normalized = "<!doctype html><html><head></head><body><h1>Briefing</h1>"
            + "<p>Contenu &amp; lien <a href=\"https://app.clenzy.fr\">ici</a></p></body></html>";
        assertTrue(result.success());
        assertEquals(normalized, extractHtmlPart(realMessage));
    }

    @Test
    void whenPlainBodyDoesNotStartWithHtmlTag_thenWrappedByGuestTemplate() throws Exception {
        // Arrange — corps interpole simple : doit passer par le wrapper guest
        MimeMessage realMessage = createRealMimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(realMessage);
        var request = new MessageDeliveryRequest(
            "guest@example.com", null, "Jean", "Bienvenue", "Bonjour Jean", "Bonjour Jean", "fr"
        );

        // Act
        var result = emailChannel.send(request);

        // Assert — le contenu est habille (different du body brut)
        assertTrue(result.success());
        String html = extractHtmlPart(realMessage);
        assertNotNull(html);
        assertTrue(html.contains("Bonjour Jean"));
        assertNotEquals("Bonjour Jean", html);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private MimeMessage createRealMimeMessage() {
        return new MimeMessage(jakarta.mail.Session.getInstance(new java.util.Properties()));
    }

    /** Extrait la partie text/html d'un message construit par MimeMessageHelper. */
    private String extractHtmlPart(MimeMessage message) throws Exception {
        message.saveChanges();
        return findHtml(message.getContent());
    }

    private String findHtml(Object content) throws Exception {
        if (content instanceof String s) {
            return s;
        }
        if (content instanceof jakarta.mail.Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                String found = findHtml(multipart.getBodyPart(i).getContent());
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }
}
