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
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
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
    @Mock private EmailService emailService;
    @Mock private RestTemplate restTemplate;

    private InscriptionService inscriptionService;

    @BeforeEach
    void setUp() throws Exception {
        inscriptionService = new InscriptionService(
                pendingInscriptionRepository, userRepository,
                keycloakService, organizationService, pricingConfigService,
                emailService, restTemplate);

        setField(inscriptionService, "stripeSecretKey", "sk_test_dummy");
        setField(inscriptionService, "currency", "EUR");
        setField(inscriptionService, "inscriptionReturnUrl", "http://localhost:3000/inscription/success");
        setField(inscriptionService, "frontendUrl", "http://localhost:3000");
        setField(inscriptionService, "keycloakUrl", "http://clenzy-keycloak:8080");
        setField(inscriptionService, "realm", "clenzy");
        setField(inscriptionService, "clientId", "clenzy-web");
        setField(inscriptionService, "clientSecret", "");
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
        pending.setPhoneNumber("+33612345678");
        pending.setForfait("essentiel");
        pending.setStripeSessionId(stripeSessionId);
        pending.setStatus(PendingInscriptionStatus.PENDING_PAYMENT);
        pending.setBillingPeriod("MONTHLY");
        pending.setExpiresAt(LocalDateTime.now().plusHours(72));
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
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");

            String emailHash = StringUtils.computeEmailHash("jean@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);

            PendingInscription existing = buildPending("jean@test.com", "old-sess");
            when(pendingInscriptionRepository.findByEmailAndStatus("jean@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.of(existing));

            // Note: Stripe.apiKey is set but Session.create will fail in unit test context
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            verify(pendingInscriptionRepository).delete(existing);
        }

        @Test
        @DisplayName("when calendarSync is sync then uses sync price from PricingConfig")
        void whenSyncMode_thenUsesSyncPrice() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("sync@test.com");
            dto.setForfait("premium");
            dto.setBillingPeriod("MONTHLY");
            dto.setCalendarSync("sync");

            String emailHash = StringUtils.computeEmailHash("sync@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pricingConfigService.getPmsSyncPriceCents()).thenReturn(5000);

            when(pendingInscriptionRepository.findByEmailAndStatus("sync@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

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
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setCalendarSync("manuel");

            String emailHash = StringUtils.computeEmailHash("nosync@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3500);

            when(pendingInscriptionRepository.findByEmailAndStatus("nosync@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

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
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setOrganizationType("SYSTEM");

            String emailHash = StringUtils.computeEmailHash("system@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pendingInscriptionRepository.findByEmailAndStatus("system@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

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
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setOrganizationType("CONCIERGE");
            dto.setCompanyName("");

            String emailHash = StringUtils.computeEmailHash("prononame@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pendingInscriptionRepository.findByEmailAndStatus("prononame@test.com", PendingInscriptionStatus.PENDING_PAYMENT))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("nom de la societe");
        }

        @Test
        @DisplayName("MONTHLY billing uses month interval and no discount")
        void whenMonthlyBilling_thenUsesMonthInterval() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setBillingPeriod("MONTHLY");
            BillingPeriod period = dto.getBillingPeriodEnum();
            assertThat(period).isEqualTo(BillingPeriod.MONTHLY);
            assertThat(period.getDiscount()).isEqualTo(1.0);
            assertThat(period.computeMonthlyPriceCents(500)).isEqualTo(500);
        }

        @Test
        @DisplayName("ANNUAL billing applies 20 percent discount")
        void whenAnnualBilling_thenAppliesDiscount() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setBillingPeriod("ANNUAL");
            BillingPeriod period = dto.getBillingPeriodEnum();
            assertThat(period).isEqualTo(BillingPeriod.ANNUAL);
            assertThat(period.getDiscount()).isEqualTo(0.80);
            assertThat(period.computeMonthlyPriceCents(500)).isEqualTo(400);
        }

        @Test
        @DisplayName("BIENNIAL billing applies 35 percent discount")
        void whenBiennialBilling_thenAppliesDiscount() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setBillingPeriod("BIENNIAL");
            BillingPeriod period = dto.getBillingPeriodEnum();
            assertThat(period).isEqualTo(BillingPeriod.BIENNIAL);
            assertThat(period.getDiscount()).isEqualTo(0.65);
            assertThat(period.computeMonthlyPriceCents(500)).isEqualTo(325);
        }
    }

    // ===== CONFIRM PAYMENT =====

    @Nested
    @DisplayName("confirmPayment")
    class ConfirmPayment {

        @Test
        @DisplayName("when valid session then stores Stripe IDs, generates token, sends email, sets PAYMENT_CONFIRMED")
        void whenValidSession_thenConfirmsAndSendsEmail() {
            // Arrange
            PendingInscription pending = buildPending("jean@test.com", "sess_123");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_123"))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any(PendingInscription.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            inscriptionService.confirmPayment("sess_123", "cus_stripe", "sub_stripe");

            // Assert
            assertThat(pending.getStripeCustomerId()).isEqualTo("cus_stripe");
            assertThat(pending.getStripeSubscriptionId()).isEqualTo("sub_stripe");
            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            assertThat(pending.getConfirmationTokenHash()).isNotNull();
            assertThat(pending.getConfirmationTokenHash()).hasSize(64); // SHA-256 hex

            // Email de confirmation envoye
            verify(emailService).sendInscriptionConfirmationEmail(
                    eq("jean@test.com"), eq("Jean Dupont"), anyString(), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("when session not found then throws RuntimeException")
        void whenSessionNotFound_thenThrowsRuntime() {
            when(pendingInscriptionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.confirmPayment("unknown", "cus", "sub"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("non trouvee");
        }

        @Test
        @DisplayName("when already completed then skips")
        void whenAlreadyCompleted_thenSkips() {
            PendingInscription pending = buildPending("jean@test.com", "sess_dup");
            pending.setStatus(PendingInscriptionStatus.COMPLETED);
            when(pendingInscriptionRepository.findByStripeSessionId("sess_dup"))
                    .thenReturn(Optional.of(pending));

            inscriptionService.confirmPayment("sess_dup", "cus", "sub");

            verify(emailService, never()).sendInscriptionConfirmationEmail(
                    anyString(), anyString(), anyString(), any());
        }

        @Test
        @DisplayName("when already PAYMENT_CONFIRMED then resends email")
        void whenAlreadyPaymentConfirmed_thenResendsEmail() {
            PendingInscription pending = buildPending("jean@test.com", "sess_resend");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            when(pendingInscriptionRepository.findByStripeSessionId("sess_resend"))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any(PendingInscription.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            inscriptionService.confirmPayment("sess_resend", "cus", "sub");

            // Should still send email (resend on webhook doublon)
            verify(emailService).sendInscriptionConfirmationEmail(
                    eq("jean@test.com"), eq("Jean Dupont"), anyString(), any(LocalDateTime.class));
        }
    }

    // ===== GET INSCRIPTION INFO BY TOKEN =====

    @Nested
    @DisplayName("getInscriptionInfoByToken")
    class GetInscriptionInfoByToken {

        @Test
        @DisplayName("when valid token then returns inscription info")
        void whenValidToken_thenReturnsInfo() {
            PendingInscription pending = buildPending("jean@test.com", "sess_123");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            // Need to set a hash that matches a known token
            // We'll use the hash directly from the repo lookup
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));

            var info = inscriptionService.getInscriptionInfoByToken("test-token-uuid");

            assertThat(info.get("email")).isEqualTo("jean@test.com");
            assertThat(info.get("fullName")).isEqualTo("Jean Dupont");
            assertThat(info.get("forfait")).isEqualTo("essentiel");
        }

        @Test
        @DisplayName("when token not found then throws RuntimeException")
        void whenTokenNotFound_thenThrows() {
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.getInscriptionInfoByToken("bad-token"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        @DisplayName("when inscription already completed then throws IllegalStateException")
        void whenAlreadyCompleted_thenThrowsIllegalState() {
            PendingInscription pending = buildPending("jean@test.com", "sess_123");
            pending.setStatus(PendingInscriptionStatus.COMPLETED);
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));

            assertThatThrownBy(() -> inscriptionService.getInscriptionInfoByToken("token"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("ALREADY_COMPLETED");
        }

        @Test
        @DisplayName("when token expired then throws RuntimeException")
        void whenExpired_thenThrows() {
            PendingInscription pending = buildPending("jean@test.com", "sess_123");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setExpiresAt(LocalDateTime.now().minusHours(1));
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));

            assertThatThrownBy(() -> inscriptionService.getInscriptionInfoByToken("token"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("expire");
        }
    }

    // ===== MARK INSCRIPTION FAILED =====

    @Nested
    @DisplayName("markInscriptionFailed")
    class MarkInscriptionFailed {

        @Test
        @DisplayName("when session exists then marks as PAYMENT_FAILED")
        void whenSessionExists_thenMarksAsFailed() {
            PendingInscription pending = buildPending("fail@test.com", "sess_fail");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_fail"))
                    .thenReturn(Optional.of(pending));

            inscriptionService.markInscriptionFailed("sess_fail");

            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.PAYMENT_FAILED);
            verify(pendingInscriptionRepository).save(pending);
        }

        @Test
        @DisplayName("when session not found then does nothing")
        void whenSessionNotFound_thenDoesNothing() {
            when(pendingInscriptionRepository.findByStripeSessionId("unknown"))
                    .thenReturn(Optional.empty());

            inscriptionService.markInscriptionFailed("unknown");

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
            inscriptionService.cleanupExpiredInscriptions();

            verify(pendingInscriptionRepository).deleteByStatusAndExpiresAtBefore(
                    eq(PendingInscriptionStatus.PENDING_PAYMENT), any());
        }
    }
}
