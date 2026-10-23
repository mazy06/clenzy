package com.clenzy.service.messaging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Properties;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyEmailDiagnosticsPrivacyTest {
    private final JavaMailSender sender = mock(JavaMailSender.class);
    private final Logger logger = (Logger) LoggerFactory.getLogger(EmailChannel.class);
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private EmailChannel channel;
    private static final String PRIVATE = "private@example.invalid body=SECRET-CONTENT "
            + "https://example.invalid/reset?token=SECRET-TOKEN password=SECRET-PASSWORD";

    @BeforeEach void prepare() {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(sender);
        channel = new EmailChannel(provider, new EmailWrapperService());
        ReflectionTestUtils.setField(channel, "fromAddress", "sender@example.invalid");
        logs.start();
        logger.addAppender(logs);
    }
    @AfterEach void clean() {
        logger.detachAppender(logs);
        logs.stop();
    }
    static Stream<RuntimeException> providerFailures() {
        var nested = new jakarta.mail.MessagingException(PRIVATE);
        nested.setNextException(new IllegalStateException(PRIVATE));
        return Stream.of(new MailAuthenticationException(PRIVATE, nested),
                new MailSendException(PRIVATE, nested), new RuntimeException(PRIVATE, nested));
    }
    @ParameterizedTest @MethodSource("providerFailures")
    void smtpFailureNeverLeaksIntoPersistentResultOrLog(RuntimeException failure) {
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        doThrow(failure).when(sender).send(any(MimeMessage.class));
        var result = channel.send(request());
        assertThat(result.success()).isFalse();
        assertThat(result.providerMessageId()).isNull();
        assertThat(result.errorMessage()).startsWith("Envoi email impossible (")
                .doesNotContain("private@", "SECRET", "token=", "password=", "https://");
        assertThat(logs.list).isNotEmpty().allSatisfy(event -> {
            assertThat(event.getFormattedMessage()).doesNotContain("private@", "SECRET", "token=", "password=", "https://");
            assertThat(event.getThrowableProxy()).isNull();
        });
        verify(sender).send(any(MimeMessage.class));
    }
    @Test void acceptedMailDoesNotLogRecipientSubjectBodyOrProviderId() throws Exception {
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        message.setHeader("Message-ID", "<SECRET-ID@example.invalid>");
        when(sender.createMimeMessage()).thenReturn(message);
        var result = channel.send(request());
        assertThat(result.success()).isTrue();
        assertThat(result.providerMessageId()).isEqualTo("<SECRET-ID@example.invalid>");
        assertThat(result.errorMessage()).isNull();
        assertThat(logs.list).isNotEmpty().allSatisfy(event -> {
            assertThat(event.getFormattedMessage()).doesNotContain("private@", "SECRET", "token=", "password=", "https://");
            assertThat(event.getThrowableProxy()).isNull();
        });
    }
    private MessageDeliveryRequest request() {
        return new MessageDeliveryRequest("private@example.invalid", null, "Synthetic",
                PRIVATE, PRIVATE, PRIVATE, "fr");
    }
}
