package com.clenzy.integration.minut.controller;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.minut.config.MinutConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.security.access.prepost.PreAuthorize;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyMinutWebhookReceiptTest {
    private static final String SECRET = "synthetic-private-secret";
    private static final String PAYLOAD = "{\"device_id\":\"synthetic-private-device\"}";
    private final MinutConfig config = mock(MinutConfig.class);
    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
    private final MinutWebhookController controller = new MinutWebhookController(config, kafka);

    private String signature(String payload) throws Exception {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\n"})
    void blankSecretNeverPermitsPublicationEvenWithSignature(String secret) throws Exception {
        when(config.getWebhookSecret()).thenReturn(secret);
        assertThat(controller.receiveWebhook(PAYLOAD, signature(PAYLOAD)).getStatusCode().value()).isEqualTo(503);
        verifyNoInteractions(kafka);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "sha256=invalid", "G"})
    void malformedSignatureIsRejectedWithoutKafka(String signature) {
        when(config.getWebhookSecret()).thenReturn(SECRET);
        assertThat(controller.receiveWebhook(PAYLOAD, signature).getStatusCode().value()).isEqualTo(400);
        verifyNoInteractions(kafka);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\n"})
    void blankPayloadIsRejected(String payload) throws Exception {
        when(config.getWebhookSecret()).thenReturn(SECRET);
        assertThat(controller.receiveWebhook(payload, signature(payload)).getStatusCode().value()).isEqualTo(400);
        verifyNoInteractions(kafka);
    }

    @Test
    void nullPayloadWithConfiguredSecretIsRejected() {
        when(config.getWebhookSecret()).thenReturn(SECRET);
        assertThat(controller.receiveWebhook(null, null).getStatusCode().value()).isEqualTo(400);
        verifyNoInteractions(kafka);
    }

    @Test
    void signatureAuthenticatesExactBodyBeforeSendingAnything() throws Exception {
        when(config.getWebhookSecret()).thenReturn(SECRET);
        assertThat(controller.receiveWebhook(PAYLOAD + " ", signature(PAYLOAD)).getStatusCode().value()).isEqualTo(400);
        verifyNoInteractions(kafka);
    }

    @ParameterizedTest
    @ValueSource(strings = {"asyncFailure", "syncFailure", "timeout", "interrupted", "cancelled", "missingFuture", "missingReceipt"})
    @SuppressWarnings("unchecked")
    void onlyBrokerAcknowledgementMayReturnSuccessAndDiagnosticsStayPrivate(String scenario) throws Exception {
        when(config.getWebhookSecret()).thenReturn(SECRET);
        var error = new IllegalStateException(SECRET + PAYLOAD, new RuntimeException(SECRET));
        error.addSuppressed(new RuntimeException(PAYLOAD));
        CompletableFuture<SendResult<String, Object>> future = mock(CompletableFuture.class);
        switch (scenario) {
            case "asyncFailure" -> when(future.get(3, TimeUnit.SECONDS)).thenThrow(new ExecutionException(error));
            case "syncFailure" -> when(kafka.send(KafkaConfig.TOPIC_MINUT_WEBHOOKS, PAYLOAD)).thenThrow(error);
            case "timeout" -> when(future.get(3, TimeUnit.SECONDS)).thenThrow(new TimeoutException(SECRET));
            case "interrupted" -> when(future.get(3, TimeUnit.SECONDS)).thenThrow(new InterruptedException(SECRET));
            case "cancelled" -> when(future.get(3, TimeUnit.SECONDS)).thenThrow(new CancellationException(SECRET));
            default -> { }
        }
        if (!scenario.equals("syncFailure")) when(kafka.send(KafkaConfig.TOPIC_MINUT_WEBHOOKS, PAYLOAD))
                .thenReturn(scenario.equals("missingFuture") ? null : future);
        var logger = (Logger) LoggerFactory.getLogger(MinutWebhookController.class);
        var logs = new ListAppender<ILoggingEvent>();
        logs.start();
        logger.addAppender(logs);
        try {
            var response = controller.receiveWebhook(PAYLOAD, signature(PAYLOAD));
            assertThat(response.getStatusCode().value()).isEqualTo(503);
            assertThat(response.getBody()).containsEntry("status", "error");
            assertThat(response.getBody().toString()).doesNotContain(SECRET, PAYLOAD);
            assertThat(logs.list).isNotEmpty().allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(SECRET, "synthetic-private-device");
                assertThat(event.getThrowableProxy()).isNull();
            });
            assertThat(Thread.currentThread().isInterrupted()).isEqualTo(scenario.equals("interrupted"));
            verify(kafka, times(1)).send(KafkaConfig.TOPIC_MINUT_WEBHOOKS, PAYLOAD);
            if (!scenario.equals("syncFailure") && !scenario.equals("missingFuture")) {
                verify(future).get(3, TimeUnit.SECONDS);
                verify(future, never()).cancel(anyBoolean()); // Timeout is uncertainty, not proof of cancellation.
            }
        } finally {
            Thread.interrupted();
            logger.detachAppender(logs);
            logs.stop();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void waitsForFutureAcknowledgementAndKeepsExistingTopicAndBody() throws Exception {
        when(config.getWebhookSecret()).thenReturn(SECRET);
        CompletableFuture<SendResult<String, Object>> future = mock(CompletableFuture.class);
        when(kafka.send(KafkaConfig.TOPIC_MINUT_WEBHOOKS, PAYLOAD)).thenReturn(future);
        when(future.get(3, TimeUnit.SECONDS)).thenReturn(mock(SendResult.class));
        assertThat(controller.receiveWebhook(PAYLOAD, signature(PAYLOAD)).getStatusCode().value()).isEqualTo(200);
        var order = inOrder(kafka, future);
        order.verify(kafka).send(KafkaConfig.TOPIC_MINUT_WEBHOOKS, PAYLOAD);
        order.verify(future).get(3, TimeUnit.SECONDS);
        assertThat(MinutWebhookController.class.getAnnotation(PreAuthorize.class).value()).isEqualTo("permitAll()");
    }
}
