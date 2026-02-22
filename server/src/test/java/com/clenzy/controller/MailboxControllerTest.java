package com.clenzy.controller;

import com.clenzy.service.MailReceiverService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MailboxControllerTest {

    @Mock private MailReceiverService mailReceiverService;

    private MailboxController controller;

    @BeforeEach
    void setUp() {
        controller = new MailboxController(mailReceiverService);
    }

    @Nested
    @DisplayName("getStatus")
    class Status {
        @Test
        void whenConnected_thenReturnsOk() {
            when(mailReceiverService.testConnection()).thenReturn(true);

            ResponseEntity<?> response = controller.getStatus();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("imapConnected")).isEqualTo(true);
        }

        @Test
        void whenNotConnected_thenReturnsOkWithFalse() {
            when(mailReceiverService.testConnection()).thenReturn(false);

            ResponseEntity<?> response = controller.getStatus();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("imapConnected")).isEqualTo(false);
        }
    }

    @Nested
    @DisplayName("listFolders")
    class Folders {
        @Test
        void whenSuccess_thenReturnsList() {
            when(mailReceiverService.listFolders()).thenReturn(List.of(
                    Map.of("name", (Object) "INBOX"),
                    Map.of("name", (Object) "SENT")));

            ResponseEntity<?> response = controller.listFolders();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("listEmails")
    class ListEmails {
        @Test
        void whenSuccess_thenReturnsEmails() {
            when(mailReceiverService.listEmails("INBOX", 0, 20)).thenReturn(Map.of("total", 5));

            ResponseEntity<?> response = controller.listEmails("INBOX", 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getEmail")
    class GetEmail {
        @Test
        void whenFound_thenReturnsOk() {
            when(mailReceiverService.getEmail("INBOX", 1)).thenReturn(Map.of("subject", "Test"));

            ResponseEntity<?> response = controller.getEmail(1, "INBOX");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenError_thenBadRequest() {
            when(mailReceiverService.getEmail("INBOX", 1)).thenReturn(Map.of("error", "Message not found"));

            ResponseEntity<?> response = controller.getEmail(1, "INBOX");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }
}
