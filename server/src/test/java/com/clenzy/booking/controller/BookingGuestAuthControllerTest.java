package com.clenzy.booking.controller;

import com.clenzy.booking.dto.GuestAuthResponse;
import com.clenzy.booking.dto.GuestLoginRequest;
import com.clenzy.booking.dto.GuestProfileDto;
import com.clenzy.booking.dto.GuestRegisterRequest;
import com.clenzy.booking.service.BookingGuestAuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingGuestAuthControllerTest {

    @Mock private BookingGuestAuthService authService;

    private BookingGuestAuthController controller;

    @BeforeEach
    void setUp() {
        controller = new BookingGuestAuthController(authService);
    }

    private GuestRegisterRequest regReq() {
        return new GuestRegisterRequest("guest@test.com", "password123", "John", "Doe", "0600", 1L);
    }

    private GuestAuthResponse authResp() {
        return new GuestAuthResponse("at", "rt", 3600L,
                new GuestProfileDto(1L, "guest@test.com", "John", "Doe", "0600", 1L, true));
    }

    @Test
    void register_success_201() {
        GuestRegisterRequest req = regReq();
        when(authService.register(req)).thenReturn(authResp());

        ResponseEntity<?> response = controller.register(req);
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).isInstanceOf(GuestAuthResponse.class);
    }

    @Test
    void register_duplicate_409() {
        GuestRegisterRequest req = regReq();
        when(authService.register(req)).thenThrow(new IllegalArgumentException("email exists"));

        ResponseEntity<?> response = controller.register(req);
        assertThat(response.getStatusCode().value()).isEqualTo(409);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("error", "email exists");
    }

    @Test
    void register_unexpectedError_500() {
        GuestRegisterRequest req = regReq();
        when(authService.register(req)).thenThrow(new RuntimeException("kc down"));

        ResponseEntity<?> response = controller.register(req);
        assertThat(response.getStatusCode().value()).isEqualTo(500);
    }

    @Test
    void login_success_200() {
        GuestLoginRequest req = new GuestLoginRequest("guest@test.com", "password", 1L);
        when(authService.login(req)).thenReturn(authResp());

        ResponseEntity<?> response = controller.login(req);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void login_invalid_401() {
        GuestLoginRequest req = new GuestLoginRequest("guest@test.com", "wrong", 1L);
        when(authService.login(req)).thenThrow(new IllegalArgumentException("bad creds"));

        ResponseEntity<?> response = controller.login(req);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void login_error_500() {
        GuestLoginRequest req = new GuestLoginRequest("guest@test.com", "x", 1L);
        when(authService.login(req)).thenThrow(new RuntimeException("kc down"));

        ResponseEntity<?> response = controller.login(req);
        assertThat(response.getStatusCode().value()).isEqualTo(500);
    }

    @Test
    void refresh_success_200() {
        when(authService.refreshToken("rt", 1L, "kc-id")).thenReturn(authResp());
        Map<String, Object> body = new HashMap<>();
        body.put("refreshToken", "rt");
        body.put("organizationId", 1);
        body.put("keycloakId", "kc-id");

        ResponseEntity<?> response = controller.refresh(body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void refresh_missingFields_400() {
        Map<String, Object> body = new HashMap<>();
        body.put("refreshToken", "rt");
        // no orgId nor keycloakId

        ResponseEntity<?> response = controller.refresh(body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void refresh_nullToken_400() {
        Map<String, Object> body = new HashMap<>();
        body.put("organizationId", 1);
        body.put("keycloakId", "kc-id");

        ResponseEntity<?> response = controller.refresh(body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void refresh_invalid_401() {
        when(authService.refreshToken("rt", 1L, "kc-id")).thenThrow(new IllegalArgumentException("invalid"));
        Map<String, Object> body = new HashMap<>();
        body.put("refreshToken", "rt");
        body.put("organizationId", 1);
        body.put("keycloakId", "kc-id");

        ResponseEntity<?> response = controller.refresh(body);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void refresh_error_500() {
        when(authService.refreshToken("rt", 1L, "kc-id")).thenThrow(new RuntimeException("down"));
        Map<String, Object> body = new HashMap<>();
        body.put("refreshToken", "rt");
        body.put("organizationId", 1);
        body.put("keycloakId", "kc-id");

        ResponseEntity<?> response = controller.refresh(body);
        assertThat(response.getStatusCode().value()).isEqualTo(500);
    }

    @Test
    void forgotPassword_success_200() {
        Map<String, Object> body = new HashMap<>();
        body.put("email", "guest@test.com");
        body.put("organizationId", 1);

        ResponseEntity<?> response = controller.forgotPassword(body);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(authService).sendPasswordResetEmail("guest@test.com", 1L);
    }

    @Test
    void forgotPassword_missingEmail_400() {
        Map<String, Object> body = new HashMap<>();
        body.put("organizationId", 1);

        ResponseEntity<?> response = controller.forgotPassword(body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void forgotPassword_blankEmail_400() {
        Map<String, Object> body = new HashMap<>();
        body.put("email", " ");
        body.put("organizationId", 1);

        ResponseEntity<?> response = controller.forgotPassword(body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void forgotPassword_missingOrg_400() {
        Map<String, Object> body = new HashMap<>();
        body.put("email", "x@x.com");

        ResponseEntity<?> response = controller.forgotPassword(body);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void forgotPassword_serviceError_stillReturns200() {
        Map<String, Object> body = new HashMap<>();
        body.put("email", "guest@test.com");
        body.put("organizationId", 1);
        doThrow(new RuntimeException("kc down")).when(authService).sendPasswordResetEmail("guest@test.com", 1L);

        ResponseEntity<?> response = controller.forgotPassword(body);
        // intentionally always 200 (no leak)
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }
}
