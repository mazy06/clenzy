package com.clenzy.controller;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.model.Organization;
import com.clenzy.dto.RolePermissionsDto;
import com.clenzy.service.*;
import com.clenzy.service.LoginProtectionService.LoginStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock private UserService userService;
    @Mock private PermissionService permissionService;
    @Mock private AuditLogService auditLogService;
    @Mock private SecurityAuditService securityAuditService;
    @Mock private LoginProtectionService loginProtectionService;
    @Mock private OrganizationInvitationService invitationService;
    @Mock private OrganizationService organizationService;
    @Mock private KeycloakService keycloakService;
    @Mock private RestTemplate restTemplate;

    private AuthController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("email", "test@example.com")
                .claim("preferred_username", "testuser")
                .claim("given_name", "Jean")
                .claim("family_name", "Dupont")
                .claim("realm_access", Map.of("roles", List.of("HOST")))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() throws Exception {
        controller = new AuthController(userService, permissionService,
                auditLogService, securityAuditService, loginProtectionService,
                invitationService, organizationService, keycloakService,
                restTemplate);
        // Set @Value fields via reflection
        setField("keycloakUrl", "http://localhost:8080");
        setField("realm", "clenzy");
        setField("clientId", "clenzy-web");
        setField("clientSecret", "secret");
    }

    private void setField(String name, String value) throws Exception {
        Field field = AuthController.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(controller, value);
    }

    @Nested
    @DisplayName("login")
    class Login {
        @Test
        void whenMissingCredentials_thenBadRequest() {
            Map<String, String> creds = Map.of();
            ResponseEntity<Map<String, Object>> response = controller.login(creds);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody().get("error")).isEqualTo("missing_credentials");
        }

        @Test
        void whenBlankUsername_thenBadRequest() {
            Map<String, String> creds = Map.of("username", "", "password", "pass");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenBlankPassword_thenBadRequest() {
            Map<String, String> creds = Map.of("username", "user", "password", "");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenAccountLocked_thenReturns429() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(true, 120, false));

            Map<String, String> creds = Map.of("username", "user@test.com", "password", "pass");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);

            assertThat(response.getStatusCode().value()).isEqualTo(429);
            assertThat(response.getBody().get("error")).isEqualTo("account_locked");
            assertThat(response.getBody().get("retryAfter")).isEqualTo(120L);
        }

        @Test
        void whenCaptchaRequiredButMissing_thenReturns403() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, true));

            Map<String, String> creds = new HashMap<>();
            creds.put("username", "user@test.com");
            creds.put("password", "pass");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);

            assertThat(response.getStatusCode().value()).isEqualTo(403);
            assertThat(response.getBody().get("error")).isEqualTo("captcha_required");
        }

        @Test
        void whenCaptchaInvalid_thenReturns403() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, true));
            when(loginProtectionService.validateCaptchaToken("bad-token")).thenReturn(false);

            Map<String, String> creds = new HashMap<>();
            creds.put("username", "user@test.com");
            creds.put("password", "pass");
            creds.put("captchaToken", "bad-token");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);

            assertThat(response.getStatusCode().value()).isEqualTo(403);
            assertThat(response.getBody().get("error")).isEqualTo("captcha_invalid");
        }

        @Test
        void whenKeycloakSuccess_thenReturnsTokens() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, false));

            Map<String, Object> tokenBody = new HashMap<>();
            tokenBody.put("access_token", "at");
            tokenBody.put("refresh_token", "rt");
            tokenBody.put("id_token", "it");
            tokenBody.put("expires_in", 300);
            tokenBody.put("token_type", "Bearer");

            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenReturn(ResponseEntity.ok(tokenBody));

            Map<String, String> creds = Map.of("username", "user@test.com", "password", "pass");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("access_token")).isEqualTo("at");
            verify(loginProtectionService).recordSuccessfulLogin("user@test.com");
            verify(auditLogService).logLogin(anyString(), anyString());
        }

        @Test
        void whenKeycloakFails_thenReturns401() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, false));
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenThrow(new RuntimeException("Auth error"));

            Map<String, String> creds = Map.of("username", "user@test.com", "password", "pass");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
            verify(loginProtectionService).recordFailedAttempt("user@test.com");
        }

        @Test
        void whenEmailFieldUsedInsteadOfUsername_thenAccepted() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, false));
            when(restTemplate.postForEntity(anyString(), any(), eq(Map.class)))
                    .thenThrow(new RuntimeException("Auth error"));

            // Use "email" key instead of "username"
            Map<String, String> creds = new HashMap<>();
            creds.put("email", "user@test.com");
            creds.put("password", "pass");
            ResponseEntity<Map<String, Object>> response = controller.login(creds);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
            verify(loginProtectionService).recordFailedAttempt("user@test.com");
        }
    }

    @Nested
    @DisplayName("me")
    class Me {
        @Test
        void whenNullJwt_thenReturnsNotAuthenticated() {
            Map<String, Object> result = controller.me(null);
            assertThat(result.get("authenticated")).isEqualTo(false);
        }

        @Test
        void whenUserFoundByKeycloakId_thenReturnsFullProfile() {
            Jwt jwt = createJwt();
            User user = new User();
            user.setId(1L);
            user.setFirstName("Jean");
            user.setLastName("Dupont");
            user.setEmail("test@example.com");
            user.setRole(UserRole.HOST);
            user.setStatus(UserStatus.ACTIVE);
            user.setOrganizationId(10L);

            when(userService.findByKeycloakId("user-123")).thenReturn(user);

            RolePermissionsDto perms = new RolePermissionsDto();
            perms.setPermissions(List.of("properties.read", "properties.write"));
            when(permissionService.getRolePermissions("HOST")).thenReturn(perms);

            Organization org = new Organization();
            org.setName("Org A");
            when(organizationService.findById(10L)).thenReturn(Optional.of(org));
            when(organizationService.findMembershipByUserId(1L)).thenReturn(Optional.empty());

            Map<String, Object> result = controller.me(jwt);

            assertThat(result.get("authenticated")).isEqualTo(true);
            assertThat(result.get("id")).isEqualTo(1L);
            assertThat(result.get("role")).isEqualTo("HOST");
            assertThat(result.get("organizationName")).isEqualTo("Org A");
        }

        @Test
        void whenUserNotFound_thenAutoProvisions() {
            Jwt jwt = createJwt();
            when(userService.findByKeycloakId("user-123")).thenReturn(null);
            when(userService.findByEmail("test@example.com")).thenReturn(null);

            User provisioned = new User();
            provisioned.setId(99L);
            provisioned.setRole(UserRole.HOST);
            provisioned.setStatus(UserStatus.ACTIVE);
            provisioned.setEmail("test@example.com");
            when(userService.autoProvisionUser(eq("user-123"), eq("test@example.com"),
                    eq("Jean"), eq("Dupont"), any(UserRole.class))).thenReturn(provisioned);

            RolePermissionsDto perms = new RolePermissionsDto();
            perms.setPermissions(List.of("properties.read"));
            when(permissionService.getRolePermissions("HOST")).thenReturn(perms);

            Map<String, Object> result = controller.me(jwt);

            assertThat(result.get("id")).isEqualTo(99L);
            // Called twice: once during auto-provisioning, once for user without org
            verify(invitationService, times(2)).autoAcceptPendingInvitations(eq("test@example.com"), any(User.class));
        }

        @Test
        void whenUserFoundByEmail_thenAutoLinks() {
            Jwt jwt = createJwt();
            when(userService.findByKeycloakId("user-123")).thenReturn(null);

            User existing = new User();
            existing.setId(5L);
            existing.setRole(UserRole.HOST);
            existing.setStatus(UserStatus.ACTIVE);
            existing.setEmail("test@example.com");
            when(userService.findByEmail("test@example.com")).thenReturn(existing);

            RolePermissionsDto perms = new RolePermissionsDto();
            perms.setPermissions(List.of("properties.read"));
            when(permissionService.getRolePermissions("HOST")).thenReturn(perms);

            Map<String, Object> result = controller.me(jwt);

            assertThat(result.get("id")).isEqualTo(5L);
            verify(userService).updateKeycloakId(5L, "user-123");
        }
    }

    @Nested
    @DisplayName("debugPermissions")
    class DebugPermissions {
        @Test
        void whenNullJwt_thenReturns401() {
            ResponseEntity<Map<String, Object>> response = controller.debugPermissions(null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        void whenUserFound_thenReturnsDebugInfo() {
            Jwt jwt = createJwt();
            User user = new User();
            user.setId(1L);
            user.setRole(UserRole.HOST);
            user.setKeycloakId("user-123");
            when(userService.findByKeycloakId("user-123")).thenReturn(user);

            RolePermissionsDto perms = new RolePermissionsDto();
            perms.setPermissions(List.of("p1"));
            when(permissionService.getRolePermissions("HOST")).thenReturn(perms);
            when(permissionService.getUserPermissionsForSync("user-123")).thenReturn(List.of("p1"));
            when(permissionService.getAllAvailablePermissions()).thenReturn(List.of("p1", "p2"));

            ResponseEntity<Map<String, Object>> response = controller.debugPermissions(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("user_found_by_keycloakId")).isEqualTo(true);
        }
    }

    @Nested
    @DisplayName("forgotPassword")
    class ForgotPassword {

        /** Requete anonyme type, IP directe (pas de proxy). */
        private MockHttpServletRequest request(String remoteAddr) {
            MockHttpServletRequest req = new MockHttpServletRequest();
            req.setRemoteAddr(remoteAddr);
            return req;
        }

        /** Les deux seaux (IP + email) laissent passer. */
        private void allowAllBuckets() {
            when(loginProtectionService.tryAcquire(anyString(), anyInt(), any())).thenReturn(true);
        }

        @Test
        void whenMissingEmail_thenBadRequest() {
            ResponseEntity<Map<String, String>> response =
                    controller.forgotPassword(Map.of(), request("10.0.0.1"));
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            verifyNoInteractions(keycloakService);
            // Pas d'email = pas de consommation de quota
            verifyNoInteractions(loginProtectionService);
        }

        @Test
        void whenValidEmail_thenSendsResetEmailAndReturnsGenericMessage() {
            allowAllBuckets();
            when(keycloakService.sendPasswordResetEmail("test@example.com")).thenReturn(true);

            ResponseEntity<Map<String, String>> response =
                    controller.forgotPassword(Map.of("email", "Test@Example.com"), request("10.0.0.1"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("message")).contains("Si un compte existe");
            verify(keycloakService).sendPasswordResetEmail("test@example.com");
        }

        @Test
        void whenUnknownEmail_thenStillReturnsGenericMessage() {
            allowAllBuckets();
            when(keycloakService.sendPasswordResetEmail("unknown@example.com")).thenReturn(false);

            ResponseEntity<Map<String, String>> response =
                    controller.forgotPassword(Map.of("email", "unknown@example.com"), request("10.0.0.1"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("message")).contains("Si un compte existe");
        }

        @Test
        void whenKeycloakFails_thenStillReturnsGenericMessage() {
            allowAllBuckets();
            when(keycloakService.sendPasswordResetEmail("test@example.com"))
                    .thenThrow(new RuntimeException("keycloak down"));

            ResponseEntity<Map<String, String>> response =
                    controller.forgotPassword(Map.of("email", "test@example.com"), request("10.0.0.1"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        @DisplayName("le quota est demande a Redis, pas a un compteur local")
        void whenCalled_thenConsumesBothRedisBuckets() {
            allowAllBuckets();
            when(keycloakService.sendPasswordResetEmail(anyString())).thenReturn(true);

            controller.forgotPassword(Map.of("email", "test@example.com"), request("10.0.0.1"));

            verify(loginProtectionService).tryAcquire(eq("pwd-reset:ip:10.0.0.1"), eq(10), eq(Duration.ofHours(1)));
            verify(loginProtectionService).tryAcquire(eq("pwd-reset:email:test@example.com"), eq(1), eq(Duration.ofMinutes(1)));
        }

        @Test
        @DisplayName("limite par email atteinte -> aucun email, reponse generique")
        void whenEmailBucketExhausted_thenNoEmailSent() {
            when(loginProtectionService.tryAcquire(startsWith("pwd-reset:ip:"), anyInt(), any())).thenReturn(true);
            when(loginProtectionService.tryAcquire(startsWith("pwd-reset:email:"), anyInt(), any())).thenReturn(false);

            ResponseEntity<Map<String, String>> response =
                    controller.forgotPassword(Map.of("email", "test@example.com"), request("10.0.0.1"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("message")).contains("Si un compte existe");
            verifyNoInteractions(keycloakService);
        }

        @Test
        @DisplayName("limite par IP atteinte -> bloque meme sur un email jamais vu (anti mail-bombing)")
        void whenIpBucketExhausted_thenBlockedEvenForFreshEmail() {
            when(loginProtectionService.tryAcquire(startsWith("pwd-reset:ip:"), anyInt(), any())).thenReturn(false);
            when(loginProtectionService.tryAcquire(startsWith("pwd-reset:email:"), anyInt(), any())).thenReturn(true);

            ResponseEntity<Map<String, String>> response =
                    controller.forgotPassword(Map.of("email", "jamais-vu@example.com"), request("10.0.0.1"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verifyNoInteractions(keycloakService);
        }

        @Test
        @DisplayName("le budget IP est consomme meme quand l'email rejette")
        void whenEmailBucketRejects_thenIpBudgetStillConsumed() {
            when(loginProtectionService.tryAcquire(startsWith("pwd-reset:ip:"), anyInt(), any())).thenReturn(true);
            when(loginProtectionService.tryAcquire(startsWith("pwd-reset:email:"), anyInt(), any())).thenReturn(false);

            controller.forgotPassword(Map.of("email", "test@example.com"), request("10.0.0.1"));

            // Sinon marteler un seul email serait un contournement gratuit de la limite IP
            verify(loginProtectionService).tryAcquire(eq("pwd-reset:ip:10.0.0.1"), anyInt(), any());
        }

        @Test
        @DisplayName("X-Forwarded-For d'un pair non fiable est ignore pour la cle IP")
        void whenSpoofedForwardedFor_thenKeyedOnRealPeer() {
            allowAllBuckets();
            when(keycloakService.sendPasswordResetEmail(anyString())).thenReturn(true);

            MockHttpServletRequest req = request("203.0.113.9");
            req.addHeader("X-Forwarded-For", "1.2.3.4");

            controller.forgotPassword(Map.of("email", "test@example.com"), req);

            // Le pair direct n'est pas un proxy de confiance : XFF n'est pas honore,
            // sinon la limite par IP se contournerait en changeant l'en-tete.
            verify(loginProtectionService).tryAcquire(eq("pwd-reset:ip:203.0.113.9"), anyInt(), any());
        }
    }

    @Nested
    @DisplayName("sendPasswordResetEmailForCurrentUser")
    class SendPasswordResetEmailForCurrentUser {
        @Test
        void whenNullJwt_thenReturns401() {
            ResponseEntity<Map<String, String>> response = controller.sendPasswordResetEmailForCurrentUser(null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
            verifyNoInteractions(keycloakService);
        }

        @Test
        void whenAuthenticated_thenSendsResetEmail() {
            when(loginProtectionService.tryAcquire(anyString(), anyInt(), any())).thenReturn(true);

            ResponseEntity<Map<String, String>> response = controller.sendPasswordResetEmailForCurrentUser(createJwt());
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(keycloakService).sendPasswordResetEmailByKeycloakId("user-123");
            verify(loginProtectionService).tryAcquire(eq("pwd-reset:user:user-123"), eq(1), eq(Duration.ofMinutes(1)));
        }

        @Test
        @DisplayName("limite atteinte -> 429 explicite (utilisateur connu, pas d'enjeu d'enumeration)")
        void whenThrottled_thenReturns429() {
            when(loginProtectionService.tryAcquire(anyString(), anyInt(), any())).thenReturn(false);

            ResponseEntity<Map<String, String>> response = controller.sendPasswordResetEmailForCurrentUser(createJwt());

            assertThat(response.getStatusCode().value()).isEqualTo(429);
            assertThat(response.getBody().get("error")).isEqualTo("too_many_requests");
            verifyNoInteractions(keycloakService);
        }

        @Test
        void whenKeycloakFails_thenReturns500() {
            when(loginProtectionService.tryAcquire(anyString(), anyInt(), any())).thenReturn(true);
            doThrow(new RuntimeException("keycloak down"))
                    .when(keycloakService).sendPasswordResetEmailByKeycloakId("user-123");

            ResponseEntity<Map<String, String>> response = controller.sendPasswordResetEmailForCurrentUser(createJwt());
            assertThat(response.getStatusCode().value()).isEqualTo(500);
            assertThat(response.getBody().get("error")).isEqualTo("reset_email_failed");
        }
    }

    @Nested
    @DisplayName("logout")
    class Logout {
        @Test
        void whenValidAuth_thenLogsOut() {
            Jwt jwt = createJwt();
            ResponseEntity<Map<String, String>> response = controller.logout(jwt, "Bearer test-token");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("status")).isEqualTo("success");
            verify(auditLogService).logLogout(anyString(), any());
        }

        @Test
        void whenNullJwt_thenBadRequest() {
            ResponseEntity<Map<String, String>> response = controller.logout(null, null);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenInvalidAuthHeader_thenBadRequest() {
            Jwt jwt = createJwt();
            ResponseEntity<Map<String, String>> response = controller.logout(jwt, "Basic abc");
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
