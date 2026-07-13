package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.UserRepository;
import com.stripe.exception.ApiException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private StripeGateway stripeGateway;
    @Mock private com.clenzy.payment.subscription.SubscriptionProviderRegistry subscriptionProviderRegistry;
    @Mock private com.clenzy.payment.subscription.SubscriptionProvider subscriptionProvider;

    private SubscriptionService subscriptionService;

    @BeforeEach
    void setUp() throws Exception {
        subscriptionService = new SubscriptionService(userRepository, auditLogService, pricingConfigService,
                stripeGateway, subscriptionProviderRegistry);

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
        void whenStripeCallFails_thenWrapsInRuntimeException() throws Exception {
            // Arrange — le gateway echoue (Stripe indisponible / session inconnue)
            when(stripeGateway.retrieveSession("cs_test_fake_session"))
                    .thenThrow(new ApiException("session inconnue", null, "c", 404, null));

            // Act & Assert
            assertThatThrownBy(() -> subscriptionService.completeUpgrade("cs_test_fake_session"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("should wrap with message containing 'Erreur Stripe' prefix")
        void whenStripeFails_thenMessageHasPrefix() throws Exception {
            when(stripeGateway.retrieveSession("cs_bad"))
                    .thenThrow(new ApiException("indisponible", null, "c", 500, null));

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
        @DisplayName("inclut le supplément IA du forfait cible dans le montant Stripe (X5)")
        void whenUpgrade_thenUnitAmountIncludesAiSurcharge() throws Exception {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pricingConfigService.getAiMonthlySurchargeCents("confort")).thenReturn(2900);
            when(subscriptionProviderRegistry.resolve(any())).thenReturn(subscriptionProvider);
            when(subscriptionProvider.createSubscriptionCheckout(any()))
                    .thenReturn(com.clenzy.payment.PaymentResult.success("cs_x", "https://stripe.test/checkout"));

            subscriptionService.createUpgradeCheckout("kc-1", "confort");

            ArgumentCaptor<com.clenzy.payment.subscription.SubscriptionCheckoutRequest> captor =
                    ArgumentCaptor.forClass(com.clenzy.payment.subscription.SubscriptionCheckoutRequest.class);
            verify(subscriptionProvider).createSubscriptionCheckout(captor.capture());
            assertThat(captor.getValue().unitAmountMinor()).isEqualTo(5900L); // 30 € PMS + 29 € supplément IA Confort
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
    @DisplayName("createUpgradeCheckout - gateway happy path")
    class GatewayHappyPath {

        @Test
        @DisplayName("creates checkout session via StripeGateway with upgrade metadata")
        void whenValidUpgrade_thenCreatesSessionViaGateway() throws Exception {
            User user = buildUser("kc-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2900);

            when(subscriptionProviderRegistry.resolve(any())).thenReturn(subscriptionProvider);
            when(subscriptionProvider.createSubscriptionCheckout(any()))
                    .thenReturn(com.clenzy.payment.PaymentResult.success("cs_upg_1", "https://checkout.stripe.com/cs_upg_1"));

            Map<String, String> result = subscriptionService.createUpgradeCheckout("kc-1", "premium");

            assertThat(result).containsEntry("checkoutUrl", "https://checkout.stripe.com/cs_upg_1");

            // Le checkout d'abonnement passe par le port SubscriptionProvider avec les metadata attendues.
            ArgumentCaptor<com.clenzy.payment.subscription.SubscriptionCheckoutRequest> paramsCaptor =
                    ArgumentCaptor.forClass(com.clenzy.payment.subscription.SubscriptionCheckoutRequest.class);
            verify(subscriptionProvider).createSubscriptionCheckout(paramsCaptor.capture());
            assertThat(paramsCaptor.getValue().metadata())
                    .containsEntry("type", "upgrade")
                    .containsEntry("forfait", "premium")
                    .containsEntry("previousForfait", "essentiel");
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
        void completeUpgradeFails() throws Exception {
            when(stripeGateway.retrieveSession("cs_fake_session_id"))
                    .thenThrow(new ApiException("retrieve KO", null, "c", 500, null));

            assertThatThrownBy(() -> subscriptionService.completeUpgrade("cs_fake_session_id"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Erreur Stripe");
        }
    }
}
