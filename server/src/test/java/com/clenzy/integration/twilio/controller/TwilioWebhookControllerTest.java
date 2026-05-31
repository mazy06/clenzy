package com.clenzy.integration.twilio.controller;

import com.clenzy.integration.twilio.config.TwilioConfig;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("TwilioWebhookController")
class TwilioWebhookControllerTest {

    /**
     * Build une config configuree (account-sid + auth-token presents).
     * Le controller instanciera un vrai RequestValidator base sur l'auth-token.
     * Toute signature qu'on enverra echouera la validation HMAC -> 403.
     */
    private TwilioConfig configuredConfig() {
        TwilioConfig config = new TwilioConfig();
        config.setAccountSid("ACtest1234567890");
        config.setAuthToken("test_auth_token_secret_value");
        return config;
    }

    /**
     * Build une config non configuree (champs vides) — le controller logge un warn
     * et passe en mode "rejette tout".
     */
    private TwilioConfig unconfiguredConfig() {
        return new TwilioConfig(); // accountSid/authToken null -> isConfigured()=false
    }

    private HttpServletRequest mockRequest(String signature, String url) {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getHeader("X-Twilio-Signature")).thenReturn(signature);
        when(req.getRequestURL()).thenReturn(new StringBuffer(url));
        return req;
    }

    // ── /status ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("handleStatusCallback")
    class StatusCallback {

        @Test
        @DisplayName("controller configure + signature invalide HMAC -> 403")
        void configured_invalidSignature_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(configuredConfig());
            Map<String, String> params = new LinkedHashMap<>();
            params.put("MessageSid", "SMxxxxx");
            params.put("MessageStatus", "delivered");

            HttpServletRequest req = mockRequest(
                "ZmFrZS1zaWduYXR1cmU=", // base64 random
                "https://api.clenzy.fr/api/webhooks/twilio/status"
            );

            ResponseEntity<String> response = controller.handleStatusCallback(params, req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).isEqualTo("Invalid signature");
        }

        @Test
        @DisplayName("controller configure + signature absente -> 403")
        void configured_missingSignature_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(configuredConfig());
            HttpServletRequest req = mockRequest(null, "https://api.clenzy.fr/api/webhooks/twilio/status");

            ResponseEntity<String> response = controller.handleStatusCallback(Map.of(), req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("controller configure + signature blank -> 403")
        void configured_blankSignature_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(configuredConfig());
            HttpServletRequest req = mockRequest("   ", "https://api.clenzy.fr/api/webhooks/twilio/status");

            ResponseEntity<String> response = controller.handleStatusCallback(Map.of(), req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("controller non configure -> rejette tout en 403")
        void unconfigured_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(unconfiguredConfig());
            HttpServletRequest req = mockRequest("any-sig", "https://api.clenzy.fr/api/webhooks/twilio/status");

            ResponseEntity<String> response = controller.handleStatusCallback(Map.of(), req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).isEqualTo("Invalid signature");
        }
    }

    // ── /inbound ────────────────────────────────────────────────────

    @Nested
    @DisplayName("handleInboundMessage")
    class InboundMessage {

        @Test
        @DisplayName("controller configure + signature invalide -> 403")
        void configured_invalidSignature_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(configuredConfig());
            Map<String, String> params = new LinkedHashMap<>();
            params.put("From", "+33600000000");
            params.put("Body", "Hello");
            params.put("MessageSid", "SMabc");

            HttpServletRequest req = mockRequest(
                "ZmFrZS1zaWduYXR1cmU=",
                "https://api.clenzy.fr/api/webhooks/twilio/inbound"
            );

            ResponseEntity<String> response = controller.handleInboundMessage(params, req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("controller non configure -> 403 (RequestValidator null)")
        void unconfigured_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(unconfiguredConfig());
            HttpServletRequest req = mockRequest("any-sig", "https://api.clenzy.fr/api/webhooks/twilio/inbound");

            ResponseEntity<String> response = controller.handleInboundMessage(Map.of(), req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("controller configure + signature absente sur inbound -> 403")
        void configured_missingSignature_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(configuredConfig());
            HttpServletRequest req = mockRequest(null, "https://api.clenzy.fr/api/webhooks/twilio/inbound");

            ResponseEntity<String> response = controller.handleInboundMessage(Map.of(), req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }

        @Test
        @DisplayName("controller configure + exception sur getRequestURL -> 403 (catch generique)")
        void configured_exceptionDuringValidation_returns403() {
            TwilioWebhookController controller = new TwilioWebhookController(configuredConfig());
            HttpServletRequest req = mock(HttpServletRequest.class);
            when(req.getHeader("X-Twilio-Signature")).thenReturn("sig");
            when(req.getRequestURL()).thenThrow(new RuntimeException("Boom"));

            ResponseEntity<String> response = controller.handleInboundMessage(Map.of(), req);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).isEqualTo("Invalid signature");
        }
    }
}
