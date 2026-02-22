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
        emailChannel = new EmailChannel(provider);
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
        EmailChannel channel = new EmailChannel(nullProvider);

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
        EmailChannel channel = new EmailChannel(nullProvider);

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
}
