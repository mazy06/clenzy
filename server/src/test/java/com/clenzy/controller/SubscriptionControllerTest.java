package com.clenzy.controller;

import com.clenzy.service.SubscriptionService;
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
        // L'upgrade direct par Stripe Checkout est retiré : le changement de formule
        // passe par la proposition d'abonnement mensuel (Paramètres > Abonnement).
        @Test
        void whenValid_thenGoneWithNextStep() {
            Map<String, String> body = Map.of("targetForfait", "PREMIUM");

            ResponseEntity<Map<String, String>> response = controller.upgrade(jwt, body);

            assertThat(response.getStatusCode().value()).isEqualTo(410);
            assertThat(response.getBody()).containsEntry("next", "/settings?tab=subscription");
            verifyNoInteractions(subscriptionService);
        }

        @Test
        void whenUnknownForfait_thenGoneWithoutCheckout() {
            Map<String, String> body = Map.of("targetForfait", "INVALID");

            ResponseEntity<Map<String, String>> response = controller.upgrade(jwt, body);

            assertThat(response.getStatusCode().value()).isEqualTo(410);
            verifyNoInteractions(subscriptionService);
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
    }
}
