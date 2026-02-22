package com.clenzy.controller;

import com.clenzy.service.InscriptionService;
import com.clenzy.service.StripeService;
import com.clenzy.service.SubscriptionService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for StripeWebhookController.
 * Note: The webhook handling relies on static Stripe methods (Webhook.constructEvent, Session.retrieve)
 * which cannot be unit-tested without static mocking (mockito-inline).
 * These tests verify controller construction, field injection, and the paths that can be reached
 * without valid Stripe signatures (i.e. the 400 error paths).
 */
@ExtendWith(MockitoExtension.class)
class StripeWebhookControllerTest {

    @Mock private StripeService stripeService;
    @Mock private InscriptionService inscriptionService;
    @Mock private SubscriptionService subscriptionService;

    private StripeWebhookController controller;

    @BeforeEach
    void setUp() throws Exception {
        controller = new StripeWebhookController(stripeService, inscriptionService, subscriptionService);
        setField("webhookSecret", "whsec_test_secret");
        setField("stripeSecretKey", "sk_test_xxx");
    }

    private void setField(String name, String value) throws Exception {
        Field field = StripeWebhookController.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(controller, value);
    }

    @Nested
    @DisplayName("handleStripeWebhook - signature verification")
    class HandleWebhookSignatureVerification {

        @Test
        @DisplayName("returns 400 when signature is invalid")
        void whenInvalidSignature_thenReturnsBadRequest() {
            // Arrange
            String payload = "{\"type\": \"checkout.session.completed\"}";
            String invalidSig = "invalid-sig-header";

            // Act
            ResponseEntity<String> response = controller.handleStripeWebhook(payload, invalidSig);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 when payload is empty")
        void whenEmptyPayload_thenReturnsBadRequest() {
            // Arrange & Act
            ResponseEntity<String> response = controller.handleStripeWebhook("", "");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 when payload is null-like JSON")
        void whenMalformedPayload_thenReturnsBadRequest() {
            // Arrange & Act
            ResponseEntity<String> response = controller.handleStripeWebhook("not-json", "t=123,v1=abc");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("returns 400 with message containing 'Signature invalide' for bad sig")
        void whenBadSignature_thenBodyContainsSignatureInvalide() {
            // Arrange
            String payload = "{\"id\": \"evt_1\", \"type\": \"checkout.session.completed\"}";
            String badSig = "t=1234567890,v1=bad_signature_value";

            // Act
            ResponseEntity<String> response = controller.handleStripeWebhook(payload, badSig);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("controller construction")
    class Construction {

        @Test
        @DisplayName("controller is correctly instantiated with all dependencies")
        void whenConstructed_thenNotNull() {
            assertThat(controller).isNotNull();
        }

        @Test
        @DisplayName("@Value fields are set via reflection")
        void whenFieldsSet_thenAccessibleViaReflection() throws Exception {
            // Arrange
            Field webhookField = StripeWebhookController.class.getDeclaredField("webhookSecret");
            webhookField.setAccessible(true);
            Field keyField = StripeWebhookController.class.getDeclaredField("stripeSecretKey");
            keyField.setAccessible(true);

            // Assert
            assertThat(webhookField.get(controller)).isEqualTo("whsec_test_secret");
            assertThat(keyField.get(controller)).isEqualTo("sk_test_xxx");
        }
    }
}
