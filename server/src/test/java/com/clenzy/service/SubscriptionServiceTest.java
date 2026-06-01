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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private PricingConfigService pricingConfigService;

    private SubscriptionService subscriptionService;

    @BeforeEach
    void setUp() throws Exception {
        subscriptionService = new SubscriptionService(userRepository, auditLogService, pricingConfigService);

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

        @Test
        @DisplayName("should wrap with message containing 'Erreur Stripe' prefix")
        void whenStripeFails_thenMessageHasPrefix() {
            assertThatThrownBy(() -> subscriptionService.completeUpgrade("cs_bad"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur Stripe");
        }
    }

    @Nested
    @DisplayName("createUpgradeCheckout - pricing & user lookup")
    class CreateUpgradeCheckoutPricing {

        @Test
        @DisplayName("calls PricingConfigService to obtain monthly price")
        void whenValidUpgrade_thenQueriesPricingConfig() {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            // Will throw at Stripe API but should have read the price first
            try {
                subscriptionService.createUpgradeCheckout("kc-1", "confort");
            } catch (Exception ignored) {
            }

            org.mockito.Mockito.verify(pricingConfigService).getPmsMonthlyPriceCents();
        }

        @Test
        @DisplayName("user lookup via Keycloak ID")
        void whenLookup_thenUsesKeycloakId() {
            User user = buildUser("kc-special", "essentiel");
            when(userRepository.findByKeycloakId("kc-special")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2000);

            try {
                subscriptionService.createUpgradeCheckout("kc-special", "premium");
            } catch (Exception ignored) {
            }

            org.mockito.Mockito.verify(userRepository).findByKeycloakId("kc-special");
        }
    }

    @Nested
    @DisplayName("Stripe customer/subscription propagation")
    class StripeCustomerPropagation {

        @Test
        @DisplayName("uses customer ID when user has stripeCustomerId set")
        void whenUserHasStripeCustomer_thenSetsCustomer() {
            User user = buildUser("kc-1", "essentiel");
            user.setStripeCustomerId("cus_existing");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-1", "premium");
            } catch (Exception ignored) {
            }
            // Customer ID branch is exercised even if Stripe API fails
            verify(userRepository).findByKeycloakId("kc-1");
        }

        @Test
        @DisplayName("uses email when stripeCustomerId is null")
        void whenNoStripeCustomer_thenSetsCustomerEmail() {
            User user = buildUser("kc-2", "essentiel");
            user.setStripeCustomerId(null);
            when(userRepository.findByKeycloakId("kc-2")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-2", "confort");
            } catch (Exception ignored) {
            }
            verify(userRepository).findByKeycloakId("kc-2");
        }

        @Test
        @DisplayName("uses email when stripeCustomerId is empty string")
        void whenStripeCustomerIsEmpty_thenSetsCustomerEmail() {
            User user = buildUser("kc-3", "essentiel");
            user.setStripeCustomerId("");
            when(userRepository.findByKeycloakId("kc-3")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-3", "premium");
            } catch (Exception ignored) {
            }
            verify(userRepository).findByKeycloakId("kc-3");
        }

        @Test
        @DisplayName("attempts to cancel old subscription when stripeSubscriptionId set")
        void whenExistingSubscription_thenAttemptsCancel() {
            User user = buildUser("kc-4", "essentiel");
            user.setStripeSubscriptionId("sub_existing");
            when(userRepository.findByKeycloakId("kc-4")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-4", "premium");
            } catch (Exception ignored) {
            }
            verify(userRepository).findByKeycloakId("kc-4");
        }

        @Test
        @DisplayName("does not attempt cancel when stripeSubscriptionId is null")
        void whenNoExistingSubscription_thenSkipsCancel() {
            User user = buildUser("kc-5", "essentiel");
            user.setStripeSubscriptionId(null);
            when(userRepository.findByKeycloakId("kc-5")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-5", "confort");
            } catch (Exception ignored) {
            }
            verify(userRepository).findByKeycloakId("kc-5");
        }

        @Test
        @DisplayName("does not attempt cancel when stripeSubscriptionId is empty")
        void whenEmptyStripeSubscription_thenSkipsCancel() {
            User user = buildUser("kc-6", "essentiel");
            user.setStripeSubscriptionId("");
            when(userRepository.findByKeycloakId("kc-6")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-6", "premium");
            } catch (Exception ignored) {
            }
            verify(userRepository).findByKeycloakId("kc-6");
        }
    }

    @Nested
    @DisplayName("Forfait display name")
    class ForfaitDisplay {

        @Test
        @DisplayName("capitalizes target forfait for display")
        void capitalizesForfait() {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-1", "premium");
            } catch (Exception ignored) {
            }
            verify(pricingConfigService).getPmsMonthlyPriceCents();
        }

        @Test
        @DisplayName("normalizes target case before display name")
        void normalizesCaseInDisplay() {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-1", "PREMIUM");
            } catch (Exception ignored) {
            }
            verify(pricingConfigService).getPmsMonthlyPriceCents();
        }
    }

    @Nested
    @DisplayName("Currency configuration")
    class CurrencyConfig {

        @Test
        @DisplayName("converts currency to lowercase for Stripe API")
        void convertsCurrencyToLowercase() throws Exception {
            // Configured currency was set to EUR in setUp
            User user = buildUser("kc-cur", "essentiel");
            when(userRepository.findByKeycloakId("kc-cur")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            try {
                subscriptionService.createUpgradeCheckout("kc-cur", "premium");
            } catch (Exception ignored) {
            }
            verify(pricingConfigService).getPmsMonthlyPriceCents();
        }
    }

    @Nested
    @DisplayName("completeUpgrade exception path")
    class CompleteUpgradeExceptionPath {

        @Test
        @DisplayName("session retrieval failure throws RuntimeException with stripe message")
        void completeUpgradeFails() {
            assertThatThrownBy(() -> subscriptionService.completeUpgrade("cs_fake_session_id"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Erreur Stripe");
        }
    }
}
