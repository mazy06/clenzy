package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
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

    @Nested
    @DisplayName("createUpgradeCheckout - validations")
    class CreateUpgradeCheckout {

        @Test
        @DisplayName("should throw RuntimeException when user not found")
        void whenUserNotFound_thenThrowsRuntime() {
            // Arrange
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-unknown", "premium"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("should throw IllegalArgumentException when forfait is invalid")
        void whenInvalidForfait_thenThrowsIllegalArgument() {
            // Arrange
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "invalid"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Forfait invalide");
        }

        @Test
        @DisplayName("should throw when attempting downgrade from premium to essentiel")
        void whenDowngrade_thenThrowsIllegalArgument() {
            // Arrange
            User user = buildUser("kc-1", "premium");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "essentiel"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        @DisplayName("should throw when same forfait is requested")
        void whenSameForfait_thenThrowsIllegalArgument() {
            // Arrange
            User user = buildUser("kc-1", "confort");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "confort"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        @DisplayName("should throw when downgrading from confort to essentiel")
        void whenDowngradeFromConfort_thenThrowsIllegalArgument() {
            // Arrange
            User user = buildUser("kc-1", "confort");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "essentiel"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        @DisplayName("should throw when downgrading from premium to confort")
        void whenDowngradeFromPremiumToConfort_thenThrowsIllegalArgument() {
            // Arrange
            User user = buildUser("kc-1", "premium");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "confort"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        @DisplayName("should pass validation for essentiel to confort upgrade")
        void whenEssentielToConfort_thenValidatesUpgrade() {
            // Arrange
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert - will fail at Stripe API but not at validation
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "confort");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }

        @Test
        @DisplayName("should pass validation for essentiel to premium upgrade")
        void whenEssentielToPremium_thenValidatesUpgrade() {
            // Arrange
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "premium");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }

        @Test
        @DisplayName("should pass validation for confort to premium upgrade")
        void whenConfortToPremium_thenValidatesUpgrade() {
            // Arrange
            User user = buildUser("kc-1", "confort");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "premium");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }

        @Test
        @DisplayName("should default null forfait to essentiel")
        void whenNullCurrentForfait_thenDefaultsToEssentiel() {
            // Arrange
            User user = buildUser("kc-1", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert - upgrading from null (=essentiel) to confort is valid
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "confort");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }

        @Test
        @DisplayName("should reject upgrade to essentiel from null (=essentiel)")
        void whenNullForfaitUpgradeToEssentiel_thenThrows() {
            // Arrange
            User user = buildUser("kc-1", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.createUpgradeCheckout("kc-1", "essentiel"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        @DisplayName("should handle case-insensitive target forfait (PREMIUM)")
        void whenUpperCaseTarget_thenNormalizesToLower() {
            // Arrange
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert - PREMIUM should be normalized to premium, valid upgrade
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "PREMIUM");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }

        @Test
        @DisplayName("should handle case-insensitive current forfait")
        void whenUpperCaseCurrentForfait_thenNormalizesToLower() {
            // Arrange
            User user = buildUser("kc-1", "ESSENTIEL");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            // Act & Assert - current ESSENTIEL -> premium is valid
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "premium");
            } catch (Exception e) {
                assertThatThrownBy(() -> { throw e; })
                        .isNotInstanceOf(IllegalArgumentException.class);
            }
        }
    }

    @Nested
    @DisplayName("completeUpgrade")
    class CompleteUpgrade {

        @Test
        @DisplayName("should wrap Stripe exception as RuntimeException")
        void whenStripeCallFails_thenWrapsInRuntimeException() {
            // Arrange & Act & Assert
            // Session.retrieve will throw because Stripe.apiKey is fake
            assertThatThrownBy(() -> subscriptionService.completeUpgrade("cs_test_fake_session"))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
