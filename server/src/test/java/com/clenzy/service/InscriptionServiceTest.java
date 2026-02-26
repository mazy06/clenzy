package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.model.*;
import com.clenzy.repository.PendingInscriptionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.util.StringUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InscriptionServiceTest {

    @Mock private PendingInscriptionRepository pendingInscriptionRepository;
    @Mock private UserRepository userRepository;
    @Mock private KeycloakService keycloakService;
    @Mock private OrganizationService organizationService;
    @Mock private PricingConfigService pricingConfigService;

    private InscriptionService inscriptionService;

    @BeforeEach
    void setUp() throws Exception {
        inscriptionService = new InscriptionService(
                pendingInscriptionRepository, userRepository,
                keycloakService, organizationService, pricingConfigService);

        setField(inscriptionService, "stripeSecretKey", "sk_test_dummy");
        setField(inscriptionService, "currency", "EUR");
        setField(inscriptionService, "inscriptionReturnUrl", "http://localhost:3000/inscription/success");
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private PendingInscription buildPending(String email, String stripeSessionId) {
        PendingInscription pending = new PendingInscription();
        pending.setId(1L);
        pending.setFirstName("Jean");
        pending.setLastName("Dupont");
        pending.setEmail(email);
        pending.setPassword("Passw0rd!");
        pending.setPhoneNumber("+33612345678");
        pending.setForfait("essentiel");
        pending.setStripeSessionId(stripeSessionId);
        pending.setStatus(PendingInscriptionStatus.PENDING_PAYMENT);
        pending.setBillingPeriod("MONTHLY");
        return pending;
    }

    // ===== INITIATE INSCRIPTION =====

    @Nested
    @DisplayName("initiateInscription")
    class InitiateInscription {

        @Test
        @DisplayName("when email already exists then throws RuntimeException")
        void whenEmailAlreadyExists_thenThrows() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("existing@test.com");
            dto.setPassword("Passw0rd!");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");

            String emailHash = StringUtils.computeEmailHash("existing@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(true);

            // Act & Assert
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Impossible de traiter");
        }

        @Test
        @DisplayName("when existing pending inscription then deletes old before creating new")
        void whenExistingPending_thenDeletesOld() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("jean@test.com");
            dto.setPassword("Passw0rd!");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");

            String emailHash = StringUtils.computeEmailHash("jean@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);

            PendingInscription existing = buildPending("jean@test.com", "old-sess");
            when(pendingInscriptionRepository.findByEmailAndStatus("jean@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.of(existing));

            // Note: Stripe.apiKey is set but Session.create will fail in unit test context
            // This test verifies the cleanup logic before Stripe is called
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            // The existing pending inscription should have been deleted before the Stripe call
            verify(pendingInscriptionRepository).delete(existing);
        }

        @Test
        @DisplayName("when calendarSync is sync then uses sync price from PricingConfig")
        void whenSyncMode_thenUsesSyncPrice() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("sync@test.com");
            dto.setPassword("Passw0rd!");
            dto.setForfait("premium");
            dto.setBillingPeriod("MONTHLY");
            dto.setCalendarSync("sync");

            String emailHash = StringUtils.computeEmailHash("sync@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pricingConfigService.getPmsSyncPriceCents()).thenReturn(5000);

            when(pendingInscriptionRepository.findByEmailAndStatus("sync@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

            // Stripe will fail but we verify the correct price method is called
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            // Verify sync price was used, not monthly
            verify(pricingConfigService).getPmsSyncPriceCents();
            verify(pricingConfigService, never()).getPmsMonthlyPriceCents();
        }

        @Test
        @DisplayName("when calendarSync is not sync then uses monthly price from PricingConfig")
        void whenNonSyncMode_thenUsesMonthlyPrice() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("nosync@test.com");
            dto.setPassword("Passw0rd!");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setCalendarSync("manuel");

            String emailHash = StringUtils.computeEmailHash("nosync@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3500);

            when(pendingInscriptionRepository.findByEmailAndStatus("nosync@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

            // Stripe will fail but we verify the correct price method is called
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            // Verify monthly price was used, not sync
            verify(pricingConfigService).getPmsMonthlyPriceCents();
            verify(pricingConfigService, never()).getPmsSyncPriceCents();
        }

        @Test
        @DisplayName("when organizationType is SYSTEM then throws RuntimeException")
        void whenSystemOrgType_thenThrows() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("system@test.com");
            dto.setPassword("Passw0rd!");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setOrganizationType("SYSTEM");

            String emailHash = StringUtils.computeEmailHash("system@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pendingInscriptionRepository.findByEmailAndStatus("system@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("non autorise");
        }

        @Test
        @DisplayName("when pro org type without companyName then throws RuntimeException")
        void whenProTypeWithoutCompanyName_thenThrows() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("prononame@test.com");
            dto.setPassword("Passw0rd!");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setOrganizationType("CONCIERGE");
            dto.setCompanyName(""); // vide

            String emailHash = StringUtils.computeEmailHash("prononame@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pendingInscriptionRepository.findByEmailAndStatus("prononame@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("nom de la societe");
        }

        @Test
        @DisplayName("MONTHLY billing uses month interval and no discount")
        void whenMonthlyBilling_thenUsesMonthInterval() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setBillingPeriod("MONTHLY");

            // Act
            BillingPeriod period = dto.getBillingPeriodEnum();

            // Assert
            assertThat(period).isEqualTo(BillingPeriod.MONTHLY);
            assertThat(period.getDiscount()).isEqualTo(1.0);
            int monthlyPrice = period.computeMonthlyPriceCents(500);
            assertThat(monthlyPrice).isEqualTo(500);
        }

        @Test
        @DisplayName("ANNUAL billing applies 20 percent discount")
        void whenAnnualBilling_thenAppliesDiscount() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setBillingPeriod("ANNUAL");

            // Act
            BillingPeriod period = dto.getBillingPeriodEnum();

            // Assert
            assertThat(period).isEqualTo(BillingPeriod.ANNUAL);
            assertThat(period.getDiscount()).isEqualTo(0.80);
            int monthlyPrice = period.computeMonthlyPriceCents(500);
            assertThat(monthlyPrice).isEqualTo(400); // 500 * 0.80
        }

        @Test
        @DisplayName("BIENNIAL billing applies 35 percent discount")
        void whenBiennialBilling_thenAppliesDiscount() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setBillingPeriod("BIENNIAL");

            // Act
            BillingPeriod period = dto.getBillingPeriodEnum();

            // Assert
            assertThat(period).isEqualTo(BillingPeriod.BIENNIAL);
            assertThat(period.getDiscount()).isEqualTo(0.65);
            int monthlyPrice = period.computeMonthlyPriceCents(500);
            assertThat(monthlyPrice).isEqualTo(325); // 500 * 0.65
        }
    }

    // ===== COMPLETE INSCRIPTION =====

    @Nested
    @DisplayName("completeInscription")
    class CompleteInscription {

        @Test
        @DisplayName("when valid session then creates Keycloak and DB user and organization")
        void whenValidSession_thenCreatesKeycloakAndDbUser() {
            // Arrange
            PendingInscription pending = buildPending("jean@test.com", "sess_123");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any(CreateUserDto.class))).thenReturn("kc-new-id");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(42L);
                return u;
            });

            // Act
            inscriptionService.completeInscription("sess_123", "cus_stripe", "sub_stripe");

            // Assert
            ArgumentCaptor<CreateUserDto> kcCaptor = ArgumentCaptor.forClass(CreateUserDto.class);
            verify(keycloakService).createUser(kcCaptor.capture());
            assertThat(kcCaptor.getValue().getEmail()).isEqualTo("jean@test.com");
            assertThat(kcCaptor.getValue().getRole()).isEqualTo("HOST");

            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            User savedUser = userCaptor.getValue();
            assertThat(savedUser.getKeycloakId()).isEqualTo("kc-new-id");
            assertThat(savedUser.getRole()).isEqualTo(UserRole.HOST);
            assertThat(savedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
            assertThat(savedUser.isEmailVerified()).isTrue();
            assertThat(savedUser.getStripeCustomerId()).isEqualTo("cus_stripe");
            assertThat(savedUser.getStripeSubscriptionId()).isEqualTo("sub_stripe");

            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.COMPLETED);

            verify(organizationService).createForUserWithBilling(
                    any(User.class), anyString(), eq(OrganizationType.INDIVIDUAL),
                    eq("cus_stripe"), eq("sub_stripe"), eq("essentiel"), eq("MONTHLY"));
        }

        @Test
        @DisplayName("when session not found then throws RuntimeException")
        void whenSessionNotFound_thenThrowsRuntime() {
            // Arrange
            when(pendingInscriptionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> inscriptionService.completeInscription(
                    "unknown", "cus", "sub"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("non trouvee");
        }

        @Test
        @DisplayName("when already completed then skips user creation")
        void whenAlreadyCompleted_thenSkips() {
            // Arrange
            PendingInscription pending = buildPending("jean@test.com", "sess_dup");
            pending.setStatus(PendingInscriptionStatus.COMPLETED);
            when(pendingInscriptionRepository.findByStripeSessionId("sess_dup"))
                    .thenReturn(Optional.of(pending));

            // Act
            inscriptionService.completeInscription("sess_dup", "cus", "sub");

            // Assert
            verify(keycloakService, never()).createUser(any());
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("when Keycloak fails then marks as PAYMENT_FAILED and rethrows")
        void whenKeycloakFails_thenMarksFailed() {
            // Arrange
            PendingInscription pending = buildPending("fail@test.com", "sess_fail");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_fail"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenThrow(new RuntimeException("Keycloak down"));

            // Act & Assert
            assertThatThrownBy(() -> inscriptionService.completeInscription(
                    "sess_fail", "cus", "sub"))
                    .isInstanceOf(RuntimeException.class);

            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.PAYMENT_FAILED);
            verify(pendingInscriptionRepository).save(pending);
        }

        @Test
        @DisplayName("when company name is set then uses it as org name")
        void whenCompanyNameSet_thenUsesAsOrgName() {
            // Arrange
            PendingInscription pending = buildPending("corp@test.com", "sess_corp");
            pending.setCompanyName("Clenzy Corp");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_corp"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenReturn("kc-corp");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(50L);
                return u;
            });

            // Act
            inscriptionService.completeInscription("sess_corp", "cus_c", "sub_c");

            // Assert
            verify(organizationService).createForUserWithBilling(
                    any(User.class), eq("Clenzy Corp"), eq(OrganizationType.INDIVIDUAL),
                    eq("cus_c"), eq("sub_c"), eq("essentiel"), eq("MONTHLY"));
        }

        @Test
        @DisplayName("when organizationType is CONCIERGE then creates org with CONCIERGE type")
        void whenConciergeType_thenCreatesOrgWithConciergeType() {
            // Arrange
            PendingInscription pending = buildPending("concierge@test.com", "sess_conc");
            pending.setCompanyName("Super Conciergerie");
            pending.setOrganizationType("CONCIERGE");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_conc"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenReturn("kc-conc");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(60L);
                return u;
            });

            // Act
            inscriptionService.completeInscription("sess_conc", "cus_conc", "sub_conc");

            // Assert
            verify(organizationService).createForUserWithBilling(
                    any(User.class), eq("Super Conciergerie"), eq(OrganizationType.CONCIERGE),
                    eq("cus_conc"), eq("sub_conc"), eq("essentiel"), eq("MONTHLY"));
        }

        @Test
        @DisplayName("when organizationType is CLEANING_COMPANY then creates org with that type")
        void whenCleaningCompanyType_thenCreatesOrgWithCleaningType() {
            // Arrange
            PendingInscription pending = buildPending("cleaning@test.com", "sess_clean");
            pending.setCompanyName("CleanPro SARL");
            pending.setOrganizationType("CLEANING_COMPANY");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_clean"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenReturn("kc-clean");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(61L);
                return u;
            });

            // Act
            inscriptionService.completeInscription("sess_clean", "cus_clean", "sub_clean");

            // Assert
            verify(organizationService).createForUserWithBilling(
                    any(User.class), eq("CleanPro SARL"), eq(OrganizationType.CLEANING_COMPANY),
                    eq("cus_clean"), eq("sub_clean"), eq("essentiel"), eq("MONTHLY"));
        }

        @Test
        @DisplayName("when organizationType is null then defaults to INDIVIDUAL (backward compat)")
        void whenOrgTypeNull_thenDefaultsToIndividual() {
            // Arrange
            PendingInscription pending = buildPending("legacy@test.com", "sess_legacy");
            pending.setOrganizationType(null); // Simulates old rows before migration
            when(pendingInscriptionRepository.findByStripeSessionId("sess_legacy"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenReturn("kc-legacy");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(70L);
                return u;
            });

            // Act
            inscriptionService.completeInscription("sess_legacy", "cus_leg", "sub_leg");

            // Assert
            verify(organizationService).createForUserWithBilling(
                    any(User.class), anyString(), eq(OrganizationType.INDIVIDUAL),
                    eq("cus_leg"), eq("sub_leg"), eq("essentiel"), eq("MONTHLY"));
        }

        @Test
        @DisplayName("when no company name then uses first and last name as org name")
        void whenNoCompanyName_thenUsesFullName() {
            // Arrange
            PendingInscription pending = buildPending("solo@test.com", "sess_solo");
            pending.setCompanyName(null);
            when(pendingInscriptionRepository.findByStripeSessionId("sess_solo"))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenReturn("kc-solo");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(51L);
                return u;
            });

            // Act
            inscriptionService.completeInscription("sess_solo", "cus_s", "sub_s");

            // Assert
            verify(organizationService).createForUserWithBilling(
                    any(User.class), eq("Jean Dupont"), eq(OrganizationType.INDIVIDUAL),
                    eq("cus_s"), eq("sub_s"), eq("essentiel"), eq("MONTHLY"));
        }
    }

    // ===== MARK INSCRIPTION FAILED =====

    @Nested
    @DisplayName("markInscriptionFailed")
    class MarkInscriptionFailed {

        @Test
        @DisplayName("when session exists then marks as PAYMENT_FAILED")
        void whenSessionExists_thenMarksAsFailed() {
            // Arrange
            PendingInscription pending = buildPending("fail@test.com", "sess_fail");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_fail"))
                    .thenReturn(Optional.of(pending));

            // Act
            inscriptionService.markInscriptionFailed("sess_fail");

            // Assert
            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.PAYMENT_FAILED);
            verify(pendingInscriptionRepository).save(pending);
        }

        @Test
        @DisplayName("when session not found then does nothing")
        void whenSessionNotFound_thenDoesNothing() {
            // Arrange
            when(pendingInscriptionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            // Act
            inscriptionService.markInscriptionFailed("unknown");

            // Assert
            verify(pendingInscriptionRepository, never()).save(any());
        }
    }

    // ===== CLEANUP EXPIRED =====

    @Nested
    @DisplayName("cleanupExpiredInscriptions")
    class CleanupExpired {

        @Test
        @DisplayName("when called then deletes expired PENDING_PAYMENT inscriptions")
        void whenCalled_thenDeletesExpiredPendingInscriptions() {
            // Act
            inscriptionService.cleanupExpiredInscriptions();

            // Assert
            verify(pendingInscriptionRepository).deleteByStatusAndExpiresAtBefore(
                    eq(PendingInscriptionStatus.PENDING_PAYMENT), any());
        }
    }
}
