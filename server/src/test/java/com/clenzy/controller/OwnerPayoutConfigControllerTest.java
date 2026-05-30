package com.clenzy.controller;

import com.clenzy.dto.OpenBankingInitRequest;
import com.clenzy.dto.OpenBankingInitResponse;
import com.clenzy.dto.OwnerPayoutConfigDto;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.model.User;
import com.clenzy.payment.payout.openbanking.GoCardlessPisClient;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.StripeConnectService;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link OwnerPayoutConfigController}.
 *
 * <p>Covers the CRUD self-service endpoints, admin endpoints, ownership
 * validation, IBAN format validation, Stripe Connect + OpenBanking flows.</p>
 */
@ExtendWith(MockitoExtension.class)
class OwnerPayoutConfigControllerTest {

    @Mock private OwnerPayoutConfigRepository configRepository;
    @Mock private TenantContext tenantContext;
    @Mock private UserRepository userRepository;
    @Mock private StripeConnectService stripeConnectService;
    @Mock private NotificationService notificationService;
    @Mock private GoCardlessPisClient gocardlessClient;

    private OwnerPayoutConfigController controller;

    private static final Long ORG_ID = 10L;
    private static final Long USER_ID = 42L;
    private static final String KC_ID = "kc-user-42";

    @BeforeEach
    void setUp() {
        controller = new OwnerPayoutConfigController(
                configRepository, tenantContext, userRepository,
                stripeConnectService, notificationService, gocardlessClient);
        ReflectionTestUtils.setField(controller, "clenzyBaseUrl", "https://app.clenzy.fr");
    }

    private User user(Long id, String keycloakId) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId(keycloakId);
        u.setFirstName("Jean");
        u.setLastName("Dupont");
        u.setEmail("jean@example.com");
        return u;
    }

    private OwnerPayoutConfig config(Long ownerId, Long orgId) {
        OwnerPayoutConfig c = new OwnerPayoutConfig();
        c.setId(1L);
        c.setOwnerId(ownerId);
        c.setOrganizationId(orgId);
        c.setPayoutMethod(PayoutMethod.MANUAL);
        return c;
    }

    private Jwt jwtFor(String keycloakId) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn(keycloakId);
        return jwt;
    }

    private Jwt jwtAdmin(String keycloakId) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn(keycloakId);
        when(jwt.getClaim("realm_access")).thenReturn(Map.of("roles", List.of("SUPER_ADMIN")));
        return jwt;
    }

    // ─── /me ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getMyConfig")
    class GetMyConfig {

        @Test
        void whenConfigExists_thenReturnsDto() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));

            ResponseEntity<OwnerPayoutConfigDto> response = controller.getMyConfig(jwt);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(response.getBody().ownerId()).isEqualTo(USER_ID);
        }

        @Test
        void whenConfigMissing_thenReturnsEmptyDto() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.empty());

            ResponseEntity<OwnerPayoutConfigDto> response = controller.getMyConfig(jwt);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(response.getBody().ownerId()).isEqualTo(USER_ID);
            assertThat(response.getBody().id()).isNull();
        }

        @Test
        void whenUserNotFound_thenAccessDenied() {
            Jwt jwt = jwtFor(KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getMyConfig(jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ─── /me/sepa ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateMySepa")
    class UpdateMySepa {

        @Test
        void whenValidIban_thenSavesAndNotifies() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest(
                            "FR7630006000011234567890189", "BNPAFRPP", "Jean Dupont");

            OwnerPayoutConfigDto dto = controller.updateMySepa(jwt, request);

            assertThat(dto).isNotNull();

            ArgumentCaptor<OwnerPayoutConfig> captor = ArgumentCaptor.forClass(OwnerPayoutConfig.class);
            verify(configRepository).save(captor.capture());
            OwnerPayoutConfig saved = captor.getValue();
            assertThat(saved.getIban()).isEqualTo("FR7630006000011234567890189");
            assertThat(saved.getBic()).isEqualTo("BNPAFRPP");
            assertThat(saved.getBankAccountHolder()).isEqualTo("Jean Dupont");
            assertThat(saved.getPayoutMethod()).isEqualTo(PayoutMethod.SEPA_TRANSFER);
            assertThat(saved.isVerified()).isFalse();
            assertThat(saved.getStripeConnectedAccountId()).isNull();
            assertThat(saved.isStripeOnboardingComplete()).isFalse();

            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.PAYOUT_CONFIG_SUBMITTED),
                    anyString(), anyString(), anyString());
        }

        @Test
        void whenIbanContainsSpacesAndLowercase_thenNormalized() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest(
                            "fr76 3000 6000 0112 3456 7890 189", "BNPAFRPP", "Jean");
            controller.updateMySepa(jwt, request);

            ArgumentCaptor<OwnerPayoutConfig> captor = ArgumentCaptor.forClass(OwnerPayoutConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getIban()).isEqualTo("FR7630006000011234567890189");
        }

        @Test
        void whenInvalidIbanFormat_thenThrowsIllegalArgument() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest("INVALID!", "BIC", "Name");

            assertThatThrownBy(() -> controller.updateMySepa(jwt, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("IBAN");
        }

        @Test
        void whenMaskedIbanReused_thenKeepsExistingIban() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig existing = config(USER_ID, ORG_ID);
            existing.setIban("FR7630006000011234567890189");
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest(
                            "FR76**********0189", "NEWBIC11", "New Name");
            controller.updateMySepa(jwt, request);

            ArgumentCaptor<OwnerPayoutConfig> captor = ArgumentCaptor.forClass(OwnerPayoutConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getIban()).isEqualTo("FR7630006000011234567890189");
            assertThat(captor.getValue().getBic()).isEqualTo("NEWBIC11");
            assertThat(captor.getValue().getBankAccountHolder()).isEqualTo("New Name");
        }

        @Test
        void whenIbanBlankAndNoExistingIban_thenThrowsIllegalArgument() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest("  ", "BIC", "Name");

            assertThatThrownBy(() -> controller.updateMySepa(jwt, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("requis");
        }

        @Test
        void whenBicAndHolderBlank_thenNotOverwritten() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig existing = config(USER_ID, ORG_ID);
            existing.setIban("FR7630006000011234567890189");
            existing.setBic("OLDBIC11");
            existing.setBankAccountHolder("Old Holder");
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest(
                            "FR7630006000011234567890189", "", "  ");
            controller.updateMySepa(jwt, request);

            ArgumentCaptor<OwnerPayoutConfig> captor = ArgumentCaptor.forClass(OwnerPayoutConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getBic()).isEqualTo("OLDBIC11");
            assertThat(captor.getValue().getBankAccountHolder()).isEqualTo("Old Holder");
        }

        @Test
        void whenConfigDoesNotExist_thenCreated() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.empty());
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest(
                            "FR7630006000011234567890189", "BNPAFRPP", "Jean");
            controller.updateMySepa(jwt, request);

            ArgumentCaptor<OwnerPayoutConfig> captor = ArgumentCaptor.forClass(OwnerPayoutConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getOwnerId()).isEqualTo(USER_ID);
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }
    }

    // ─── Stripe Connect ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("initMyStripeConnect")
    class InitMyStripeConnect {

        @Test
        void whenSuccess_thenReturnsOnboardingUrl() throws StripeException {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);

            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            cfg.setStripeConnectedAccountId("acct_123");
            when(stripeConnectService.createConnectedAccount(USER_ID, ORG_ID)).thenReturn(cfg);
            when(stripeConnectService.generateOnboardingLink("acct_123"))
                    .thenReturn("https://stripe/onboarding");

            ResponseEntity<OwnerPayoutConfigController.StripeConnectInitResponse> response =
                    controller.initMyStripeConnect(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().onboardingUrl()).isEqualTo("https://stripe/onboarding");
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.PAYOUT_CONFIG_SUBMITTED),
                    anyString(), anyString(), anyString());
        }

        @Test
        void whenStripeFails_thenReturns500() throws StripeException {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(stripeConnectService.createConnectedAccount(USER_ID, ORG_ID))
                    .thenThrow(mock(StripeException.class));

            ResponseEntity<OwnerPayoutConfigController.StripeConnectInitResponse> response =
                    controller.initMyStripeConnect(jwt);

            assertThat(response.getStatusCode().is5xxServerError()).isTrue();
            verify(notificationService, never()).notifyAdminsAndManagers(any(), anyString(),
                    anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("getMyStripeOnboardingLink")
    class GetMyStripeOnboardingLink {

        @Test
        void whenConfigExists_thenReturnsUrl() throws StripeException {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);

            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            cfg.setStripeConnectedAccountId("acct_abc");
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(cfg));
            when(stripeConnectService.generateOnboardingLink("acct_abc"))
                    .thenReturn("https://stripe/link");

            ResponseEntity<Map<String, String>> response = controller.getMyStripeOnboardingLink(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("url", "https://stripe/link");
        }

        @Test
        void whenNoConfig_thenIllegalArgument() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getMyStripeOnboardingLink(jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenStripeAccountIdMissing_thenBadRequest() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));

            ResponseEntity<Map<String, String>> response = controller.getMyStripeOnboardingLink(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenStripeFails_thenReturns500() throws StripeException {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);

            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            cfg.setStripeConnectedAccountId("acct_x");
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(cfg));
            when(stripeConnectService.generateOnboardingLink("acct_x"))
                    .thenThrow(mock(StripeException.class));

            ResponseEntity<Map<String, String>> response = controller.getMyStripeOnboardingLink(jwt);

            assertThat(response.getStatusCode().is5xxServerError()).isTrue();
        }
    }

    // ─── Admin endpoints ────────────────────────────────────────────────────

    @Nested
    @DisplayName("getConfig (admin/owner)")
    class GetConfig {

        @Test
        void whenAdminUserAndConfigExists_thenReturnsOk() {
            Jwt jwt = jwtAdmin("kc-admin");
            User admin = user(99L, "kc-admin");
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));

            ResponseEntity<OwnerPayoutConfigDto> response = controller.getConfig(USER_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().ownerId()).isEqualTo(USER_ID);
        }

        @Test
        void whenOwnerCanReadOwnConfig_thenReturnsOk() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));

            ResponseEntity<OwnerPayoutConfigDto> response = controller.getConfig(USER_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotOwnerNotAdmin_thenAccessDenied() {
            Jwt jwt = jwtFor("kc-other");
            User other = user(7L, "kc-other");
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));

            assertThatThrownBy(() -> controller.getConfig(USER_ID, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void whenConfigMissing_thenReturns404() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.empty());

            ResponseEntity<OwnerPayoutConfigDto> response = controller.getConfig(USER_ID, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("getAllConfigs (super admin)")
    class GetAllConfigs {

        @Test
        void returnsAllConfigsForOrg() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findAllByOrgId(ORG_ID))
                    .thenReturn(List.of(config(1L, ORG_ID), config(2L, ORG_ID)));

            List<OwnerPayoutConfigDto> result = controller.getAllConfigs();

            assertThat(result).hasSize(2);
        }

        @Test
        void returnsEmpty_whenNone() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findAllByOrgId(ORG_ID)).thenReturn(List.of());

            assertThat(controller.getAllConfigs()).isEmpty();
        }
    }

    @Nested
    @DisplayName("updateMethod")
    class UpdateMethod {

        @Test
        void whenAdmin_thenChangesPayoutMethod() {
            Jwt jwt = jwtAdmin("kc-admin");
            User admin = user(99L, "kc-admin");
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            OwnerPayoutConfigController.UpdateMethodRequest request =
                    new OwnerPayoutConfigController.UpdateMethodRequest(PayoutMethod.WISE);
            OwnerPayoutConfigDto result = controller.updateMethod(USER_ID, request, jwt);

            assertThat(result.payoutMethod()).isEqualTo(PayoutMethod.WISE);
        }

        @Test
        void whenNonOwner_thenAccessDenied() {
            Jwt jwt = jwtFor("kc-other");
            User other = user(7L, "kc-other");
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));

            OwnerPayoutConfigController.UpdateMethodRequest request =
                    new OwnerPayoutConfigController.UpdateMethodRequest(PayoutMethod.WISE);

            assertThatThrownBy(() -> controller.updateMethod(USER_ID, request, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("updateSepa (admin path)")
    class UpdateSepaAdmin {

        @Test
        void whenAdminUpdates_thenSavesIban() {
            Jwt jwt = jwtAdmin("kc-admin");
            User admin = user(99L, "kc-admin");
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest(
                            "FR7630006000011234567890189", "BIC11111", "Owner Name");
            OwnerPayoutConfigDto dto = controller.updateSepa(USER_ID, request, jwt);

            assertThat(dto).isNotNull();
            verify(configRepository).save(any(OwnerPayoutConfig.class));
            // notify path is only for /me/sepa, not admin variant
            verify(notificationService, never()).notifyAdminsAndManagers(any(), anyString(),
                    anyString(), anyString());
        }

        @Test
        void whenNotOwnerNorAdmin_thenAccessDenied() {
            Jwt jwt = jwtFor("kc-other");
            User other = user(7L, "kc-other");
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));

            OwnerPayoutConfigController.UpdateSepaRequest request =
                    new OwnerPayoutConfigController.UpdateSepaRequest("X", "Y", "Z");

            assertThatThrownBy(() -> controller.updateSepa(USER_ID, request, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("verify (super admin)")
    class Verify {

        @Test
        void whenConfigExists_thenMarksVerifiedAndNotifies() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.of(cfg));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            User owner = user(USER_ID, KC_ID);
            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(owner));

            OwnerPayoutConfigDto dto = controller.verify(USER_ID);

            assertThat(dto.verified()).isTrue();
            verify(notificationService).notify(eq(KC_ID),
                    eq(NotificationKey.PAYOUT_CONFIG_VERIFIED),
                    anyString(), anyString(), anyString());
        }

        @Test
        void whenConfigMissing_thenIllegalArgument() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.verify(USER_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining(String.valueOf(USER_ID));
        }

        @Test
        void whenOwnerNotFound_thenStillReturnsDtoWithoutNotification() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.of(cfg));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

            OwnerPayoutConfigDto dto = controller.verify(USER_ID);

            assertThat(dto.verified()).isTrue();
            verify(notificationService, never()).notify(anyString(), any(), anyString(),
                    anyString(), anyString());
        }
    }

    // ─── OpenBanking ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("listOpenBankingInstitutions")
    class ListInstitutions {

        @Test
        void whenEnabled_thenReturnsList() {
            when(gocardlessClient.isEnabled()).thenReturn(true);
            List<GoCardlessPisClient.InstitutionInfo> list = List.of(
                    new GoCardlessPisClient.InstitutionInfo("bnp", "BNP", "logo"));
            when(gocardlessClient.listInstitutions("FR")).thenReturn(list);

            ResponseEntity<List<GoCardlessPisClient.InstitutionInfo>> response =
                    controller.listOpenBankingInstitutions("FR");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        void whenDisabled_thenReturns503() {
            when(gocardlessClient.isEnabled()).thenReturn(false);

            ResponseEntity<List<GoCardlessPisClient.InstitutionInfo>> response =
                    controller.listOpenBankingInstitutions("FR");

            assertThat(response.getStatusCode().value()).isEqualTo(503);
        }

        @Test
        void whenClientThrows_thenReturns502() {
            when(gocardlessClient.isEnabled()).thenReturn(true);
            when(gocardlessClient.listInstitutions(anyString())).thenThrow(new RuntimeException("boom"));

            ResponseEntity<List<GoCardlessPisClient.InstitutionInfo>> response =
                    controller.listOpenBankingInstitutions("DE");

            assertThat(response.getStatusCode().value()).isEqualTo(502);
        }
    }

    @Nested
    @DisplayName("initMyOpenBanking")
    class InitOpenBanking {

        @Test
        void whenValid_thenReturnsRedirectUrl() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(gocardlessClient.isEnabled()).thenReturn(true);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(gocardlessClient.createRequisition(anyString(), eq("bnp"), anyString()))
                    .thenReturn(new GoCardlessPisClient.RequisitionResult("req-1", "https://gc/link"));

            OpenBankingInitRequest request = new OpenBankingInitRequest("bnp", "gocardless");
            ResponseEntity<OpenBankingInitResponse> response = controller.initMyOpenBanking(jwt, request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().redirectUrl()).isEqualTo("https://gc/link");
            assertThat(response.getBody().requisitionId()).isEqualTo("req-1");

            ArgumentCaptor<OwnerPayoutConfig> captor = ArgumentCaptor.forClass(OwnerPayoutConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getOpenBankingProvider()).isEqualTo("GOCARDLESS");
            assertThat(captor.getValue().getOpenBankingConsentId()).isEqualTo("req-1");
        }

        @Test
        void whenDisabled_thenReturns503() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(gocardlessClient.isEnabled()).thenReturn(false);

            OpenBankingInitRequest request = new OpenBankingInitRequest("bnp", null);
            ResponseEntity<OpenBankingInitResponse> response = controller.initMyOpenBanking(jwt, request);

            assertThat(response.getStatusCode().value()).isEqualTo(503);
        }

        @Test
        void whenInstitutionIdMissing_thenIllegalArgument() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(gocardlessClient.isEnabled()).thenReturn(true);

            OpenBankingInitRequest request = new OpenBankingInitRequest(null, null);

            assertThatThrownBy(() -> controller.initMyOpenBanking(jwt, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("institutionId");
        }

        @Test
        void whenInstitutionIdBlank_thenIllegalArgument() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(gocardlessClient.isEnabled()).thenReturn(true);

            OpenBankingInitRequest request = new OpenBankingInitRequest(" ", null);

            assertThatThrownBy(() -> controller.initMyOpenBanking(jwt, request))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenProviderUnsupported_thenIllegalArgument() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(gocardlessClient.isEnabled()).thenReturn(true);

            OpenBankingInitRequest request = new OpenBankingInitRequest("bnp", "tink");

            assertThatThrownBy(() -> controller.initMyOpenBanking(jwt, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("non supporté");
        }

        @Test
        void whenAdminInitForOwner_thenOk() {
            Jwt jwt = jwtAdmin("kc-admin");
            User admin = user(99L, "kc-admin");
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(gocardlessClient.isEnabled()).thenReturn(true);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));
            when(gocardlessClient.createRequisition(anyString(), anyString(), anyString()))
                    .thenReturn(new GoCardlessPisClient.RequisitionResult("req-X", "https://link"));

            OpenBankingInitRequest request = new OpenBankingInitRequest("bnp", "GOCARDLESS");
            ResponseEntity<OpenBankingInitResponse> response =
                    controller.initOpenBankingAdmin(USER_ID, request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenAdminPathButNonOwnerNonAdmin_thenAccessDenied() {
            Jwt jwt = jwtFor("kc-other");
            User other = user(7L, "kc-other");
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));

            OpenBankingInitRequest request = new OpenBankingInitRequest("bnp", null);

            assertThatThrownBy(() -> controller.initOpenBankingAdmin(USER_ID, request, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    @Nested
    @DisplayName("openBankingCallback")
    class OpenBankingCallback {

        @Test
        void whenConsentValid_thenMarksActiveAndVerified() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            cfg.setOpenBankingConsentId("req-99");
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.of(cfg));
            when(gocardlessClient.isConsentValid("req-99")).thenReturn(true);
            when(configRepository.save(any(OwnerPayoutConfig.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<OwnerPayoutConfigDto> response = controller.openBankingCallback(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            ArgumentCaptor<OwnerPayoutConfig> captor = ArgumentCaptor.forClass(OwnerPayoutConfig.class);
            verify(configRepository).save(captor.capture());
            assertThat(captor.getValue().getPayoutMethod()).isEqualTo(PayoutMethod.OPEN_BANKING);
            assertThat(captor.getValue().isVerified()).isTrue();
            assertThat(captor.getValue().getOpenBankingConsentExpiresAt()).isNotNull();
        }

        @Test
        void whenNoConfig_thenIllegalArgument() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.openBankingCallback(jwt))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenConsentIdMissing_thenBadRequest() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            cfg.setOpenBankingConsentId(null);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.of(cfg));

            ResponseEntity<OwnerPayoutConfigDto> response = controller.openBankingCallback(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenConsentIdBlank_thenBadRequest() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            cfg.setOpenBankingConsentId(" ");
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.of(cfg));

            ResponseEntity<OwnerPayoutConfigDto> response = controller.openBankingCallback(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenConsentInvalid_thenBadRequest() {
            Jwt jwt = jwtFor(KC_ID);
            User u = user(USER_ID, KC_ID);
            when(userRepository.findByKeycloakId(KC_ID)).thenReturn(Optional.of(u));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            OwnerPayoutConfig cfg = config(USER_ID, ORG_ID);
            cfg.setOpenBankingConsentId("req-bad");
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID)).thenReturn(Optional.of(cfg));
            when(gocardlessClient.isConsentValid("req-bad")).thenReturn(false);

            ResponseEntity<OwnerPayoutConfigDto> response = controller.openBankingCallback(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            verify(configRepository, never()).save(any(OwnerPayoutConfig.class));
        }
    }

    // ─── Ownership validation edge cases ────────────────────────────────────

    @Nested
    @DisplayName("validateOwnershipOrAdmin")
    class ValidateOwnership {

        @Test
        void superManagerRoleIsAccepted() {
            Jwt jwt = mock(Jwt.class);
            when(jwt.getSubject()).thenReturn("kc-mgr");
            when(jwt.getClaim("realm_access")).thenReturn(
                    Map.of("roles", List.of("SUPER_MANAGER")));
            User mgr = user(50L, "kc-mgr");
            when(userRepository.findByKeycloakId("kc-mgr")).thenReturn(Optional.of(mgr));
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(configRepository.findByOwnerIdAndOrgId(USER_ID, ORG_ID))
                    .thenReturn(Optional.of(config(USER_ID, ORG_ID)));

            // Should not throw
            ResponseEntity<OwnerPayoutConfigDto> response = controller.getConfig(USER_ID, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void realmAccessWithoutRolesClaimDoesNotElevate() {
            Jwt jwt = mock(Jwt.class);
            when(jwt.getSubject()).thenReturn("kc-other");
            when(jwt.getClaim("realm_access")).thenReturn(Map.of());
            User other = user(7L, "kc-other");
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));

            assertThatThrownBy(() -> controller.getConfig(USER_ID, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        void noRealmAccessClaimDoesNotElevate() {
            Jwt jwt = mock(Jwt.class);
            when(jwt.getSubject()).thenReturn("kc-other");
            when(jwt.getClaim("realm_access")).thenReturn(null);
            User other = user(7L, "kc-other");
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));

            assertThatThrownBy(() -> controller.getConfig(USER_ID, jwt))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
