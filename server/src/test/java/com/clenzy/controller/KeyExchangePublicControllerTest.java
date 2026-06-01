package com.clenzy.controller;

import com.clenzy.exception.TooManyVerificationAttemptsException;
import com.clenzy.service.KeyExchangeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KeyExchangePublicControllerTest {

    @Mock private KeyExchangeService keyExchangeService;

    @InjectMocks
    private KeyExchangePublicController controller;

    @Test
    void verifyCode_success_returnsOk() {
        Map<String, Object> result = Map.of("valid", true, "guestName", "John");
        when(keyExchangeService.verifyCodePublic("token-1", "ABC123")).thenReturn(result);

        ResponseEntity<?> response = controller.verifyCode("token-1", "ABC123");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(result, response.getBody());
    }

    @Test
    void verifyCode_illegalArgument_returnsBadRequest() {
        when(keyExchangeService.verifyCodePublic("token-1", "BAD"))
            .thenThrow(new IllegalArgumentException("Lien de verification invalide"));

        ResponseEntity<?> response = controller.verifyCode("token-1", "BAD");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("invalid", body.get("error"));
        assertEquals("Lien de verification invalide", body.get("message"));
    }

    @Test
    void verifyCode_unexpectedException_returnsServerError() {
        when(keyExchangeService.verifyCodePublic("token-1", "OK"))
            .thenThrow(new RuntimeException("boom"));

        ResponseEntity<?> response = controller.verifyCode("token-1", "OK");

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals("server_error", body.get("error"));
    }

    @Test
    void verifyCode_tooManyAttempts_returns429WithRetryAfter() {
        when(keyExchangeService.verifyCodePublic("token-1", "123456"))
            .thenThrow(new TooManyVerificationAttemptsException(300));

        ResponseEntity<?> response = controller.verifyCode("token-1", "123456");

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("300", response.getHeaders().getFirst("Retry-After"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("too_many_attempts", body.get("error"));
    }

    @Test
    void confirmKeyMovement_success_returnsOk() {
        Map<String, String> body = Map.of("code", "ABC", "action", "collected");
        doNothing().when(keyExchangeService).confirmKeyMovement("token", "ABC", "collected");

        ResponseEntity<?> response = controller.confirmKeyMovement("token", body);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> resp = (Map<String, Object>) response.getBody();
        assertEquals("confirmed", resp.get("status"));
        verify(keyExchangeService).confirmKeyMovement("token", "ABC", "collected");
    }

    @Test
    void confirmKeyMovement_missingCode_returnsBadRequest() {
        Map<String, String> body = Map.of("action", "collected");

        ResponseEntity<?> response = controller.confirmKeyMovement("token", body);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> respBody = (Map<String, Object>) response.getBody();
        assertEquals("missing_fields", respBody.get("error"));
        verifyNoInteractions(keyExchangeService);
    }

    @Test
    void confirmKeyMovement_missingAction_returnsBadRequest() {
        Map<String, String> body = Map.of("code", "ABC");

        ResponseEntity<?> response = controller.confirmKeyMovement("token", body);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void confirmKeyMovement_illegalState_returnsBadRequest() {
        Map<String, String> body = Map.of("code", "ABC", "action", "deposited");
        doThrow(new IllegalStateException("invalid status"))
            .when(keyExchangeService).confirmKeyMovement(eq("token"), eq("ABC"), eq("deposited"));

        ResponseEntity<?> response = controller.confirmKeyMovement("token", body);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> respBody = (Map<String, Object>) response.getBody();
        assertEquals("invalid", respBody.get("error"));
        assertEquals("invalid status", respBody.get("message"));
    }

    @Test
    void confirmKeyMovement_unexpectedException_returnsServerError() {
        Map<String, String> body = Map.of("code", "ABC", "action", "collected");
        doThrow(new RuntimeException("boom"))
            .when(keyExchangeService).confirmKeyMovement(eq("token"), eq("ABC"), eq("collected"));

        ResponseEntity<?> response = controller.confirmKeyMovement("token", body);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> respBody = (Map<String, Object>) response.getBody();
        assertEquals("server_error", respBody.get("error"));
    }

    @Test
    void confirmKeyMovement_tooManyAttempts_returns429WithRetryAfter() {
        Map<String, String> body = Map.of("code", "123456", "action", "collected");
        doThrow(new TooManyVerificationAttemptsException(120))
            .when(keyExchangeService).confirmKeyMovement(eq("token"), eq("123456"), eq("collected"));

        ResponseEntity<?> response = controller.confirmKeyMovement("token", body);

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("120", response.getHeaders().getFirst("Retry-After"));
        @SuppressWarnings("unchecked")
        Map<String, Object> respBody = (Map<String, Object>) response.getBody();
        assertEquals("too_many_attempts", respBody.get("error"));
    }
}
