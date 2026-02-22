package com.clenzy.controller;

import com.clenzy.service.SubscriptionService;
import com.stripe.exception.StripeException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionControllerTest {

    @Mock private SubscriptionService subscriptionService;

    private SubscriptionController controller;

    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new SubscriptionController(subscriptionService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("upgrade")
    class Upgrade {
        @Test
        void whenValid_thenReturnsOk() throws StripeException {
            Map<String, String> body = Map.of("targetForfait", "PREMIUM");
            when(subscriptionService.createUpgradeCheckout("user-123", "PREMIUM"))
                    .thenReturn(Map.of("url", "https://checkout.stripe.com/xxx"));

            ResponseEntity<Map<String, String>> response = controller.upgrade(jwt, body);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsKey("url");
        }

        @Test
        void whenMissingForfait_thenBadRequest() {
            Map<String, String> body = Map.of();

            ResponseEntity<Map<String, String>> response = controller.upgrade(jwt, body);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).containsKey("error");
        }

        @Test
        void whenBlankForfait_thenBadRequest() {
            Map<String, String> body = Map.of("targetForfait", "  ");

            ResponseEntity<Map<String, String>> response = controller.upgrade(jwt, body);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenIllegalArgument_thenBadRequest() throws StripeException {
            Map<String, String> body = Map.of("targetForfait", "INVALID");
            when(subscriptionService.createUpgradeCheckout("user-123", "INVALID"))
                    .thenThrow(new IllegalArgumentException("Forfait invalide"));

            ResponseEntity<Map<String, String>> response = controller.upgrade(jwt, body);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).containsEntry("error", "Forfait invalide");
        }

        @Test
        void whenStripeException_thenServerError() throws StripeException {
            Map<String, String> body = Map.of("targetForfait", "PREMIUM");
            when(subscriptionService.createUpgradeCheckout("user-123", "PREMIUM"))
                    .thenThrow(mock(StripeException.class));

            ResponseEntity<Map<String, String>> response = controller.upgrade(jwt, body);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
