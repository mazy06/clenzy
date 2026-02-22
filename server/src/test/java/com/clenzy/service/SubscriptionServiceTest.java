package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;

    private SubscriptionService subscriptionService;

    @BeforeEach
    void setUp() throws Exception {
        subscriptionService = new SubscriptionService(userRepository, auditLogService);

        setField(subscriptionService, "stripeSecretKey", "sk_test_dummy");
        setField(subscriptionService, "currency", "EUR");
        setField(subscriptionService, "frontendUrl", "http://localhost:3000");
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private User buildUser(String keycloakId, String forfait) {
        User user = new User();
        user.setId(1L);
        user.setKeycloakId(keycloakId);
        user.setEmail("user@test.com");
        user.setFirstName("Jean");
        user.setLastName("Dupont");
        user.setRole(UserRole.HOST);
        user.setStatus(UserStatus.ACTIVE);
        user.setForfait(forfait);
        return user;
    }

    // ===== CREATE UPGRADE CHECKOUT =====

    @Nested
    class CreateUpgradeCheckout {

        @Test
        void whenUserNotFound_thenThrowsRuntime() {
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-unknown", "premium"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        void whenInvalidForfait_thenThrowsIllegalArgument() {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "invalid"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Forfait invalide");
        }

        @Test
        void whenDowngrade_thenThrowsIllegalArgument() {
            User user = buildUser("kc-1", "premium");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "essentiel"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        void whenSameForfait_thenThrowsIllegalArgument() {
            User user = buildUser("kc-1", "confort");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "confort"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        void whenEssentielToConfort_thenValidatesUpgrade() {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // This will fail at Stripe.apiKey since we're using a dummy key,
            // but it validates the business logic passes
            // We just verify no IllegalArgumentException is thrown
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "confort");
            } catch (Exception e) {
                // Expected: Stripe API call will fail with dummy key
                // But not an IllegalArgumentException — the validation passed
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }

        @Test
        void whenEssentielToPremium_thenValidatesUpgrade() {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            try {
                subscriptionService.createUpgradeCheckout("kc-1", "premium");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }

        @Test
        void whenNullCurrentForfait_thenDefaultsToEssentiel() {
            User user = buildUser("kc-1", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Upgrading from null (defaults to essentiel) to confort should be valid
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "confort");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }
    }
}
