package com.clenzy.controller;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationMember;
import com.clenzy.dto.RolePermissionsDto;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OrganizationMemberRepository;
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
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
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
    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository organizationMemberRepository;
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
                invitationService, organizationRepository, organizationMemberRepository,
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
            when(organizationRepository.findById(10L)).thenReturn(Optional.of(org));
            when(organizationMemberRepository.findByUserId(1L)).thenReturn(Optional.empty());

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
