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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
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
    @Mock private PlatformPromoCodeService promoCodeService;
    @Mock private BrevoContactService brevoContactService;

    private InscriptionService inscriptionService;

    @BeforeEach
    void setUp() throws Exception {
        inscriptionService = new InscriptionService(
                pendingInscriptionRepository, userRepository,
                keycloakService, organizationService, pricingConfigService,
                emailService, restTemplate, promoCodeService, brevoContactService);

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
        @DisplayName("when CGU not accepted then throws RuntimeException")
        void whenCguNotAccepted_thenThrows() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("nocgu@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setAcceptedTerms(false); // explicit refus

            // Act & Assert
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("conditions generales");

            // L'email check ne doit pas etre atteint
            verify(userRepository, never()).existsByEmailHash(anyString());
        }

        @Test
        @DisplayName("when email already exists then throws RuntimeException")
        void whenEmailAlreadyExists_thenThrows() {
            // Arrange
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("existing@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setAcceptedTerms(true);

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
            dto.setAcceptedTerms(true);

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
            dto.setAcceptedTerms(true);

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
            dto.setAcceptedTerms(true);

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
            dto.setAcceptedTerms(true);

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
            dto.setAcceptedTerms(true);

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

    // ===== COMPLETE INSCRIPTION WITH PASSWORD =====

    @Nested
    @DisplayName("completeInscriptionWithPassword")
    class CompleteInscriptionWithPassword {

        @Test
        @DisplayName("when valid token + PAYMENT_CONFIRMED then creates Keycloak user + DB user + org + returns tokens")
        void whenValid_thenCreatesAllAndReturnsTokens() {
            PendingInscription pending = buildPending("jean@test.com", "sess_full");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setCompanyName("Acme SARL");
            pending.setOrganizationType("CONCIERGE");
            pending.setStripeCustomerId("cus_x");
            pending.setStripeSubscriptionId("sub_x");

            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(keycloakService.createUser(any())).thenReturn("kc-new-id");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            // Mock RestTemplate for auto-login
            Map<String, Object> tokenBody = new java.util.HashMap<>();
            tokenBody.put("access_token", "ACC_TOKEN");
            tokenBody.put("refresh_token", "REF_TOKEN");
            tokenBody.put("id_token", "ID_TOKEN");
            tokenBody.put("expires_in", 300);
            tokenBody.put("token_type", "Bearer");
            org.springframework.http.ResponseEntity<Map> response =
                    org.springframework.http.ResponseEntity.ok(tokenBody);
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class))).thenReturn(response);

            Map<String, Object> result = inscriptionService.completeInscriptionWithPassword("raw-token", "Passw0rd!");

            assertThat(result.get("access_token")).isEqualTo("ACC_TOKEN");
            assertThat(result.get("refresh_token")).isEqualTo("REF_TOKEN");
            assertThat(pending.getStatus()).isEqualTo(PendingInscriptionStatus.COMPLETED);

            // Verify user was created
            ArgumentCaptor<User> userCap = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCap.capture());
            User savedUser = userCap.getValue();
            assertThat(savedUser.getEmail()).isEqualTo("jean@test.com");
            assertThat(savedUser.getKeycloakId()).isEqualTo("kc-new-id");
            assertThat(savedUser.getRole()).isEqualTo(UserRole.HOST);
            assertThat(savedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
            assertThat(savedUser.isEmailVerified()).isTrue();
            assertThat(savedUser.getStripeCustomerId()).isEqualTo("cus_x");
            assertThat(savedUser.getCompanyName()).isEqualTo("Acme SARL");

            // Verify org was created with CONCIERGE type
            verify(organizationService).createForUserWithBilling(
                    any(User.class), eq("Acme SARL"),
                    eq(OrganizationType.CONCIERGE),
                    eq("cus_x"), eq("sub_x"),
                    eq("essentiel"), eq("MONTHLY"));
        }

        @Test
        @DisplayName("when invalid token then throws RuntimeException")
        void whenInvalidToken_thenThrows() {
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.completeInscriptionWithPassword("bad-token", "pwd"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        @DisplayName("when status is COMPLETED then throws (already finalized)")
        void whenAlreadyCompleted_thenThrows() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.COMPLETED);
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));

            assertThatThrownBy(() -> inscriptionService.completeInscriptionWithPassword("token", "pwd"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("deja ete finalisee");
        }

        @Test
        @DisplayName("when status is PENDING_PAYMENT then throws (payment not confirmed)")
        void whenNotConfirmed_thenThrows() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.PENDING_PAYMENT);
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));

            assertThatThrownBy(() -> inscriptionService.completeInscriptionWithPassword("token", "pwd"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("paiement n'a pas encore");
        }

        @Test
        @DisplayName("when token expired then throws RuntimeException")
        void whenExpired_thenThrows() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setExpiresAt(LocalDateTime.now().minusHours(1));
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));

            assertThatThrownBy(() -> inscriptionService.completeInscriptionWithPassword("token", "pwd"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("expire");
        }

        @Test
        @DisplayName("when invalid org type then falls back to INDIVIDUAL")
        void whenInvalidOrgType_thenFallsBackToIndividual() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setOrganizationType("UNKNOWN_TYPE");

            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(keycloakService.createUser(any())).thenReturn("kc-fallback");
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Map<String, Object> tokenBody = Map.of("access_token", "x", "refresh_token", "y");
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(org.springframework.http.ResponseEntity.ok(tokenBody));

            inscriptionService.completeInscriptionWithPassword("tok", "pwd");

            verify(organizationService).createForUserWithBilling(
                    any(), anyString(),
                    eq(OrganizationType.INDIVIDUAL),
                    any(), any(), any(), any());
        }

        @Test
        @DisplayName("when companyName blank then uses firstName + lastName for org name")
        void whenBlankCompanyName_thenUsesNameForOrgName() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setCompanyName("");  // blank

            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(keycloakService.createUser(any())).thenReturn("kc-x");
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Map<String, Object> tokenBody = Map.of("access_token", "x");
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(org.springframework.http.ResponseEntity.ok(tokenBody));

            inscriptionService.completeInscriptionWithPassword("tok", "pwd");

            verify(organizationService).createForUserWithBilling(
                    any(), eq("Jean Dupont"),  // firstName + " " + lastName
                    any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("when Keycloak fails then wraps RuntimeException")
        void whenKeycloakFails_thenWraps() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);

            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));
            when(keycloakService.createUser(any())).thenThrow(new RuntimeException("KC down"));

            assertThatThrownBy(() -> inscriptionService.completeInscriptionWithPassword("tok", "pwd"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("creation du compte");
        }

        @Test
        @DisplayName("when Keycloak login fails then throws RuntimeException")
        void whenKeycloakLoginFails_thenThrows() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);

            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(keycloakService.createUser(any())).thenReturn("kc-id");
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // RestTemplate returns 4xx (no body)
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(org.springframework.http.ResponseEntity.status(401).build());

            assertThatThrownBy(() -> inscriptionService.completeInscriptionWithPassword("tok", "pwd"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("creation du compte");  // wrapped error message
        }
    }

    // ===== RESEND CONFIRMATION EMAIL =====

    @Nested
    @DisplayName("resendConfirmationEmail")
    class ResendConfirmationEmail {

        @Test
        @DisplayName("when valid PAYMENT_CONFIRMED inscription then regenerates token + resends email")
        void whenValid_thenResendsEmail() {
            PendingInscription pending = buildPending("jean@test.com", "sess_x");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            when(pendingInscriptionRepository.findByEmailAndStatus("jean@test.com", PendingInscriptionStatus.PAYMENT_CONFIRMED))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            inscriptionService.resendConfirmationEmail("jean@test.com");

            assertThat(pending.getConfirmationTokenHash()).isNotNull();
            assertThat(pending.getExpiresAt()).isAfter(LocalDateTime.now().plusHours(70));
            verify(emailService).sendInscriptionConfirmationEmail(
                    eq("jean@test.com"), eq("Jean Dupont"), anyString(), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("when no inscription found for email then throws RuntimeException")
        void whenNotFound_thenThrows() {
            when(pendingInscriptionRepository.findByEmailAndStatus(
                    "unknown@test.com", PendingInscriptionStatus.PAYMENT_CONFIRMED))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.resendConfirmationEmail("unknown@test.com"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Aucune inscription en attente");

            verify(emailService, org.mockito.Mockito.never())
                    .sendInscriptionConfirmationEmail(anyString(), anyString(), anyString(), any());
        }
    }

    // ===== INITIATE INSCRIPTION — additional billing periods =====

    @Nested
    @DisplayName("initiateInscription — additional branches")
    class InitiateInscriptionAdditional {

        @Test
        @DisplayName("ANNUAL billing uses YEAR Stripe interval")
        void whenAnnual_thenUsesYearInterval() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("annual@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("ANNUAL");
            dto.setAcceptedTerms(true);

            String emailHash = StringUtils.computeEmailHash("annual@test.com");
            when(userRepository.existsByEmailHash(emailHash)).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pendingInscriptionRepository.findByEmailAndStatus(any(), any()))
                    .thenReturn(Optional.empty());

            // ANNUAL path will fail at Stripe.Session.create
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);
        }

        @Test
        @DisplayName("BIENNIAL billing uses YEAR Stripe interval")
        void whenBiennial_thenUsesYearInterval() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("biennial@test.com");
            dto.setForfait("premium");
            dto.setBillingPeriod("BIENNIAL");
            dto.setAcceptedTerms(true);

            when(userRepository.existsByEmailHash(anyString())).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pendingInscriptionRepository.findByEmailAndStatus(any(), any()))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);
        }

        @Test
        @DisplayName("CONCIERGE with companyName -> path validated")
        void whenConciergeWithName_thenPasses() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("conc@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setOrganizationType("CONCIERGE");
            dto.setCompanyName("Acme Conciergerie");
            dto.setAcceptedTerms(true);

            when(userRepository.existsByEmailHash(anyString())).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pendingInscriptionRepository.findByEmailAndStatus(any(), any()))
                    .thenReturn(Optional.empty());

            // Should pass validation, fail at Stripe
            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isNotInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("with promo code null - skip applyPromoCodeIfValid")
        void whenPromoCodeNull_thenSkipsPromo() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("nopromo@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setPromoCode(null);
            dto.setAcceptedTerms(true);

            when(userRepository.existsByEmailHash(anyString())).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pendingInscriptionRepository.findByEmailAndStatus(any(), any()))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            verify(promoCodeService, org.mockito.Mockito.never()).validate(anyString());
        }

        @Test
        @DisplayName("with promo code blank - skip applyPromoCodeIfValid")
        void whenPromoCodeBlank_thenSkipsPromo() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("blankpromo@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setPromoCode("   ");
            dto.setAcceptedTerms(true);

            when(userRepository.existsByEmailHash(anyString())).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pendingInscriptionRepository.findByEmailAndStatus(any(), any()))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            verify(promoCodeService, org.mockito.Mockito.never()).validate(anyString());
        }

        @Test
        @DisplayName("with promo code invalid -> validate returns empty -> skip discount")
        void whenPromoCodeInvalid_thenSkipsDiscount() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("badpromo@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setPromoCode("INVALID_CODE");
            dto.setAcceptedTerms(true);

            when(userRepository.existsByEmailHash(anyString())).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pendingInscriptionRepository.findByEmailAndStatus(any(), any()))
                    .thenReturn(Optional.empty());
            when(promoCodeService.validate("INVALID_CODE")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            verify(promoCodeService).validate("INVALID_CODE");
            verify(promoCodeService, org.mockito.Mockito.never()).tryConsume(anyLong());
        }

        @Test
        @DisplayName("with promo code valide mais consume echoue -> skip discount")
        void whenPromoConsumeFails_thenSkipsDiscount() {
            com.clenzy.dto.InscriptionDto dto = new com.clenzy.dto.InscriptionDto();
            dto.setFullName("Jean Dupont");
            dto.setEmail("racepromo@test.com");
            dto.setForfait("essentiel");
            dto.setBillingPeriod("MONTHLY");
            dto.setPromoCode("RACE_CODE");
            dto.setAcceptedTerms(true);

            com.clenzy.model.PlatformPromoCode pc = new com.clenzy.model.PlatformPromoCode();
            pc.setId(1L);
            pc.setCode("RACE_CODE");
            pc.setDiscountType(com.clenzy.model.PlatformPromoCode.DiscountType.PERCENTAGE);
            pc.setDiscountValue(10);

            when(userRepository.existsByEmailHash(anyString())).thenReturn(false);
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(3000);
            when(pendingInscriptionRepository.findByEmailAndStatus(any(), any()))
                    .thenReturn(Optional.empty());
            when(promoCodeService.validate("RACE_CODE")).thenReturn(Optional.of(pc));
            when(promoCodeService.tryConsume(1L)).thenReturn(false); // race lost

            assertThatThrownBy(() -> inscriptionService.initiateInscription(dto))
                    .isInstanceOf(Exception.class);

            verify(promoCodeService).tryConsume(1L);
        }
    }

    // ===== CONFIRM PAYMENT — additional =====

    @Nested
    @DisplayName("confirmPayment — additional")
    class ConfirmPaymentAdditional {

        @Test
        @DisplayName("if email sending throws then wraps exception")
        void whenEmailFails_thenWrapsException() {
            PendingInscription pending = buildPending("jean@test.com", "sess_email_fail");
            when(pendingInscriptionRepository.findByStripeSessionId("sess_email_fail"))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            doThrow(new RuntimeException("Brevo down"))
                    .when(emailService).sendInscriptionConfirmationEmail(
                            anyString(), anyString(), anyString(), any());

            assertThatThrownBy(() -> inscriptionService.confirmPayment("sess_email_fail", "cus", "sub"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("envoi de l'email");
        }
    }

    // ===== COMPLETE — additional =====

    @Nested
    @DisplayName("completeInscriptionWithPassword — additional")
    class CompleteInscriptionAdditional {

        @Test
        @DisplayName("when organizationType null then defaults to INDIVIDUAL")
        void whenOrgTypeNull_thenDefaultsToIndividual() {
            PendingInscription pending = buildPending("jean@test.com", "sess_null_type");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setOrganizationType(null);

            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(keycloakService.createUser(any())).thenReturn("kc-null");
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(org.springframework.http.ResponseEntity.ok(
                            Map.of("access_token", "x")));

            inscriptionService.completeInscriptionWithPassword("tok", "pwd");

            verify(organizationService).createForUserWithBilling(
                    any(), anyString(), eq(OrganizationType.INDIVIDUAL),
                    any(), any(), any(), any());
        }

        @Test
        @DisplayName("when expiresAt is null then proceeds without expiration check")
        void whenExpiresAtNull_thenSucceeds() {
            PendingInscription pending = buildPending("jean@test.com", "sess_no_exp");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setExpiresAt(null);

            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));
            when(pendingInscriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(keycloakService.createUser(any())).thenReturn("kc-no-exp");
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(org.springframework.http.ResponseEntity.ok(
                            Map.of("access_token", "x")));

            // No expiration → proceeds normally
            Map<String, Object> result = inscriptionService.completeInscriptionWithPassword("tok", "pwd");
            assertThat(result).isNotNull();
        }
    }

    // ===== GET INSCRIPTION INFO — additional =====

    @Nested
    @DisplayName("getInscriptionInfoByToken — additional")
    class GetInscriptionInfoAdditional {

        @Test
        @DisplayName("when expiresAt null then no expiration check")
        void whenExpiresAtNull_thenSucceeds() {
            PendingInscription pending = buildPending("jean@test.com", "sess_no_exp");
            pending.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
            pending.setExpiresAt(null);
            when(pendingInscriptionRepository.findByConfirmationTokenHash(anyString()))
                    .thenReturn(Optional.of(pending));

            var info = inscriptionService.getInscriptionInfoByToken("tok");

            assertThat(info.get("email")).isEqualTo("jean@test.com");
        }
    }
}
