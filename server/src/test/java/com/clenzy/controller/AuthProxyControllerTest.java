package com.clenzy.controller;

import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.LoginProtectionService.LoginStatus;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthProxyControllerTest {

    @Mock private LoginProtectionService loginProtectionService;
    @Mock private RestTemplate restTemplate;

    private AuthProxyController controller;

    @BeforeEach
    void setUp() throws Exception {
        controller = new AuthProxyController(loginProtectionService, restTemplate);
        setField("tokenUri", "http://keycloak:8080/realms/clenzy/protocol/openid-connect/token");
        setField("clientId", "clenzy-web");
        setField("clientSecret", "secret");
    }

    private void setField(String name, String value) throws Exception {
        Field field = AuthProxyController.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(controller, value);
    }

    @Nested
    @DisplayName("login")
    class Login {
        @Test
        void whenNullBody_thenBadRequest() {
            ResponseEntity<?> response = controller.login(null);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenMissingUsername_thenBadRequest() {
            var body = new AuthProxyController.LoginRequest(null, "pass", null);
            ResponseEntity<?> response = controller.login(body);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenMissingPassword_thenBadRequest() {
            var body = new AuthProxyController.LoginRequest("user", null, null);
            ResponseEntity<?> response = controller.login(body);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenAccountLocked_thenTooManyRequests() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(true, 120, false));

            var body = new AuthProxyController.LoginRequest("user@test.com", "pass", null);
            ResponseEntity<?> response = controller.login(body);

            assertThat(response.getStatusCode().value()).isEqualTo(429);
        }

        @Test
        void whenCaptchaRequired_andNotProvided_thenForbidden() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, true));

            var body = new AuthProxyController.LoginRequest("user@test.com", "pass", null);
            ResponseEntity<?> response = controller.login(body);

            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        void whenCaptchaRequired_andInvalid_thenForbidden() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, true));
            when(loginProtectionService.validateCaptchaToken("bad-token")).thenReturn(false);

            var body = new AuthProxyController.LoginRequest("user@test.com", "pass", "bad-token");
            ResponseEntity<?> response = controller.login(body);

            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        void whenKeycloakFails_thenUnauthorized() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, false));
            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenThrow(new RuntimeException("Invalid credentials"));
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, false));

            var body = new AuthProxyController.LoginRequest("user@test.com", "pass", null);
            ResponseEntity<?> response = controller.login(body);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
            verify(loginProtectionService).recordFailedAttempt("user@test.com");
        }

        @Test
        void whenKeycloakSuccess_thenReturnsToken() {
            when(loginProtectionService.checkLoginAllowed("user@test.com"))
                    .thenReturn(new LoginStatus(false, 0, false));
            org.springframework.http.HttpHeaders responseHeaders = new org.springframework.http.HttpHeaders();
            responseHeaders.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            ResponseEntity<String> keycloakResponse = ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body("{\"access_token\":\"jwt\"}");
            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenReturn(keycloakResponse);

            var body = new AuthProxyController.LoginRequest("user@test.com", "pass", null);
            ResponseEntity<?> response = controller.login(body);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(loginProtectionService).recordSuccessfulLogin("user@test.com");
        }
    }

    @Nested
    @DisplayName("logout")
    class Logout {
        @Test
        void whenValidToken_thenReturnsOk() {
            ResponseEntity<String> keycloakResponse = ResponseEntity.ok().build();
            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenReturn(keycloakResponse);

            var body = new AuthProxyController.LogoutRequest("refresh-token");
            ResponseEntity<?> response = controller.logout(body);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenKeycloakFails_thenStillReturnsOk() {
            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenThrow(new RuntimeException("Keycloak down"));

            var body = new AuthProxyController.LogoutRequest("refresh-token");
            ResponseEntity<?> response = controller.logout(body);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNullBody_thenStillReturnsOk() {
            ResponseEntity<String> keycloakResponse = ResponseEntity.ok().build();
            when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                    .thenReturn(keycloakResponse);

            ResponseEntity<?> response = controller.logout(null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
