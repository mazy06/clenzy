package com.clenzy.integration.minut.controller;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.minut.config.MinutConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MinutWebhookControllerTest {

    @Mock private MinutConfig config;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;

    private MinutWebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new MinutWebhookController(config, kafkaTemplate);
    }

    private String hmacSha256(String secret, String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    @Nested
    @DisplayName("signature validation")
    class SignatureValidation {

        @Test
        void noSecretConfigured_acceptsWithoutSignature() {
            when(config.getWebhookSecret()).thenReturn(null);

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook("{}", null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(kafkaTemplate).send(eq(KafkaConfig.TOPIC_MINUT_WEBHOOKS), eq("{}"));
        }

        @Test
        void emptySecret_acceptsWithoutSignature() {
            when(config.getWebhookSecret()).thenReturn("");

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook("{}", null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void secretConfigured_missingSignatureHeader_returns400() {
            when(config.getWebhookSecret()).thenReturn("my-secret");

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook("{}", null);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody().get("status")).isEqualTo("error");
            verify(kafkaTemplate, never()).send(any(), any());
        }

        @Test
        void invalidSignature_returns400() {
            when(config.getWebhookSecret()).thenReturn("my-secret");

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook("{}", "deadbeef");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void validSignature_publishesToKafka() throws Exception {
            String secret = "shh";
            String payload = "{\"event\":\"disturbance\"}";
            String sig = hmacSha256(secret, payload);
            when(config.getWebhookSecret()).thenReturn(secret);

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook(payload, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(kafkaTemplate).send(eq(KafkaConfig.TOPIC_MINUT_WEBHOOKS), eq(payload));
        }

        @Test
        void uppercaseSignatureAccepted() throws Exception {
            String secret = "shh";
            String payload = "{}";
            String sig = hmacSha256(secret, payload).toUpperCase();
            when(config.getWebhookSecret()).thenReturn(secret);

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook(payload, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("Kafka publish behaviour")
    class KafkaPublish {

        @Test
        void publishSucceeds_returnsOk() throws Exception {
            String secret = "shh";
            String payload = "{}";
            when(config.getWebhookSecret()).thenReturn(secret);
            String sig = hmacSha256(secret, payload);

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook(payload, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("status")).isEqualTo("ok");
        }

        @Test
        void publishFails_stillReturns200_avoidingRetries() throws Exception {
            String secret = "shh";
            String payload = "{}";
            when(config.getWebhookSecret()).thenReturn(secret);
            when(kafkaTemplate.send(eq(KafkaConfig.TOPIC_MINUT_WEBHOOKS), eq(payload)))
                    .thenThrow(new RuntimeException("kafka down"));
            String sig = hmacSha256(secret, payload);

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook(payload, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("message")).contains("delayed");
        }

        @Test
        void nullPayload_handled() {
            when(config.getWebhookSecret()).thenReturn(null);

            ResponseEntity<Map<String, String>> response =
                    controller.receiveWebhook(null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
