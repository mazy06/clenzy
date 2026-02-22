package com.clenzy.controller;

import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    @Mock private ReceivedFormRepository receivedFormRepository;
    @Mock private NotificationService notificationService;
    @Mock private HttpServletRequest httpRequest;

    private SupportController controller;

    @BeforeEach
    void setUp() {
        controller = new SupportController(receivedFormRepository, new ObjectMapper(), notificationService);
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
            verify(receivedFormRepository).save(any(ReceivedForm.class));
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
            when(receivedFormRepository.save(any())).thenThrow(new RuntimeException("DB error"));

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
