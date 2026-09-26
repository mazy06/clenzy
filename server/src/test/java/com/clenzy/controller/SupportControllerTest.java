package com.clenzy.controller;

import com.clenzy.service.NotificationService;
import com.clenzy.service.ReceivedFormService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportControllerTest {
    private static Map<String, String> validRequest() {
        return new HashMap<>(Map.of("name", "Jean", "email", "jean@example.test", "subject", "demo", "message", "Découvrir le planning"));
    }

    @Test
    void notificationFailureDoesNotLoseSavedRequest() {
        when(receivedFormService.recordSupportForm(any(), any(), any(), any(), anyMap(), any())).thenReturn(42L);
        doThrow(new IllegalStateException("notification unavailable")).when(notificationService)
                .notifyAllPlatformStaff(any(), any(), any(), any());
        assertThat(controller.submitSupportRequest(validRequest(), httpRequest).getStatusCode().value()).isEqualTo(200);
        verify(notificationService, never()).notifyAdminsAndManagers(any(), any(), any(), any());
    }

    @Test
    void nullAndOversizedFieldsAreRejectedBeforePersistence() {
        for (String field : new String[]{"name", "email", "subject", "message"}) {
            Map<String, String> request = validRequest();
            request.put(field, null);
            assertThat(controller.submitSupportRequest(request, httpRequest).getStatusCode().value()).isEqualTo(400);
        }
        Map<String, String> request = validRequest();
        request.put("message", "x".repeat(5001));
        assertThat(controller.submitSupportRequest(request, httpRequest).getStatusCode().value()).isEqualTo(400);
        verifyNoInteractions(receivedFormService);
    }

    @Test
    void rateLimitCannotBeBypassedWithAnUntrustedForwardedHeader() {
        when(httpRequest.getRemoteAddr()).thenReturn("203.0.113.10");
        for (int i = 0; i < 6; i++) {
            when(httpRequest.getHeader("X-Forwarded-For")).thenReturn("198.51.100." + i);
            int status = controller.submitSupportRequest(validRequest(), httpRequest).getStatusCode().value();
            assertThat(status).isEqualTo(i < 5 ? 200 : 429);
        }
        verify(receivedFormService, times(5)).recordSupportForm(any(), any(), any(), any(), anyMap(), eq("203.0.113.10"));
    }

    @Test
    void keepsExpectedContextWithoutArbitraryPayloadFields() {
        Map<String, String> request = validRequest();
        request.put("language", "ar"); request.put("source", "baitly-site"); request.put("injected", "ignored");
        controller.submitSupportRequest(request, httpRequest);
        verify(receivedFormService).recordSupportForm(any(), any(), any(), eq("Découverte du produit"), argThat(payload ->
                "ar".equals(payload.get("language")) && "baitly-site".equals(payload.get("source")) && !payload.containsKey("injected")), any());
    }

    @Test
    void honeypotDoesNotCreateARequest() {
        Map<String, String> request = validRequest(); request.put("website", "bot input");
        assertThat(controller.submitSupportRequest(request, httpRequest).getStatusCode().value()).isEqualTo(200);
        verifyNoInteractions(receivedFormService, notificationService);
    }

    @Mock private ReceivedFormService receivedFormService;
    @Mock private NotificationService notificationService;
    @Mock private HttpServletRequest httpRequest;

    private SupportController controller;

    @BeforeEach
    void setUp() {
        controller = new SupportController(receivedFormService, notificationService);
        lenient().when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        lenient().when(httpRequest.getHeader(anyString())).thenReturn(null);
    }

    @Nested
    @DisplayName("submitSupportRequest")
    class Submit {
        @Test
        void whenValidRequest_thenReturnsOk() {
            Map<String, String> body = new HashMap<>();
            body.put("name", "Jean Dupont");
            body.put("email", "jean@test.com");
            body.put("subject", "technical");
            body.put("message", "I have a problem");

            ResponseEntity<?> response = controller.submitSupportRequest(body, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(receivedFormService).recordSupportForm(
                    eq("Jean Dupont"), eq("jean@test.com"), any(), any(), anyMap(), any());
        }

        @Test
        void whenMissingName_thenBadRequest() {
            Map<String, String> body = new HashMap<>();
            body.put("email", "jean@test.com");
            body.put("subject", "technical");
            body.put("message", "msg");

            ResponseEntity<?> response = controller.submitSupportRequest(body, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenInvalidEmail_thenBadRequest() {
            Map<String, String> body = new HashMap<>();
            body.put("name", "Jean");
            body.put("email", "invalid-email");
            body.put("subject", "technical");
            body.put("message", "msg");

            ResponseEntity<?> response = controller.submitSupportRequest(body, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenMissingSubject_thenBadRequest() {
            Map<String, String> body = new HashMap<>();
            body.put("name", "Jean");
            body.put("email", "jean@test.com");
            body.put("message", "msg");

            ResponseEntity<?> response = controller.submitSupportRequest(body, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenMissingMessage_thenBadRequest() {
            Map<String, String> body = new HashMap<>();
            body.put("name", "Jean");
            body.put("email", "jean@test.com");
            body.put("subject", "technical");

            ResponseEntity<?> response = controller.submitSupportRequest(body, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenDbFails_thenReturns500() {
            when(receivedFormService.recordSupportForm(any(), any(), any(), any(), anyMap(), any()))
                    .thenThrow(new RuntimeException("DB error"));

            Map<String, String> body = new HashMap<>();
            body.put("name", "Jean");
            body.put("email", "jean@test.com");
            body.put("subject", "technical");
            body.put("message", "msg");

            ResponseEntity<?> response = controller.submitSupportRequest(body, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("clientIpExtraction")
    class ClientIp {
        @Test
        void whenXForwardedFor_thenUsesFirstIp() {
            when(httpRequest.getHeader("X-Forwarded-For")).thenReturn("10.0.0.1, 10.0.0.2");

            Map<String, String> body = new HashMap<>();
            body.put("name", "Jean");
            body.put("email", "jean@test.com");
            body.put("subject", "technical");
            body.put("message", "msg");

            ResponseEntity<?> response = controller.submitSupportRequest(body, httpRequest);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
