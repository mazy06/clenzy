package com.clenzy.controller;

import com.clenzy.dto.*;
import com.clenzy.service.ContactMessageService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContactControllerTest {

    @Mock private ContactMessageService contactMessageService;

    private ContactController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new ContactController(contactMessageService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("getInboxMessages")
    class GetInbox {

        @Test
        @DisplayName("returns page of inbox messages")
        void whenCalled_thenReturnsPage() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            Page<ContactMessageDto> page = new PageImpl<>(List.of(dto));
            when(contactMessageService.listMessages(eq("inbox"), any(), eq(jwt))).thenReturn(page);

            // Act
            ResponseEntity<Page<ContactMessageDto>> response = controller.getInboxMessages(jwt, 0, 20);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getSentMessages")
    class GetSent {

        @Test
        @DisplayName("returns page of sent messages")
        void whenCalled_thenReturnsPage() {
            // Arrange
            Page<ContactMessageDto> page = new PageImpl<>(List.of());
            when(contactMessageService.listMessages(eq("sent"), any(), eq(jwt))).thenReturn(page);

            // Act
            ResponseEntity<Page<ContactMessageDto>> response = controller.getSentMessages(jwt, 0, 20);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getReceivedMessages")
    class GetReceived {

        @Test
        @DisplayName("aliases to inbox folder")
        void whenCalled_thenDelegatesToInbox() {
            // Arrange
            Page<ContactMessageDto> page = new PageImpl<>(List.of());
            when(contactMessageService.listMessages(eq("inbox"), any(), eq(jwt))).thenReturn(page);

            // Act
            ResponseEntity<Page<ContactMessageDto>> response = controller.getReceivedMessages(jwt, 0, 20);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(contactMessageService).listMessages(eq("inbox"), any(), eq(jwt));
        }
    }

    @Nested
    @DisplayName("getArchivedMessages")
    class GetArchived {

        @Test
        @DisplayName("returns page of archived messages")
        void whenCalled_thenReturnsPage() {
            // Arrange
            Page<ContactMessageDto> page = new PageImpl<>(List.of());
            when(contactMessageService.listMessages(eq("archived"), any(), eq(jwt))).thenReturn(page);

            // Act
            ResponseEntity<Page<ContactMessageDto>> response = controller.getArchivedMessages(jwt, 0, 20);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getRecipients")
    class GetRecipients {

        @Test
        @DisplayName("returns list of recipients")
        void whenCalled_thenReturnsList() {
            // Arrange
            ContactUserDto userDto = mock(ContactUserDto.class);
            when(contactMessageService.listRecipients(jwt)).thenReturn(List.of(userDto));

            // Act
            ResponseEntity<?> response = controller.getRecipients(jwt);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("updateMessageStatus")
    class UpdateStatus {

        @Test
        @DisplayName("returns updated message DTO")
        void whenCalled_thenReturnsUpdated() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            when(contactMessageService.updateStatus(jwt, 1L, "READ")).thenReturn(dto);

            // Act
            ResponseEntity<ContactMessageDto> response = controller.updateMessageStatus(jwt, 1L, "READ");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("archiveMessage")
    class ArchiveMessage {

        @Test
        @DisplayName("returns archived message DTO")
        void whenCalled_thenReturnsArchived() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            when(contactMessageService.archiveMessage(jwt, 1L)).thenReturn(dto);

            // Act
            ResponseEntity<ContactMessageDto> response = controller.archiveMessage(jwt, 1L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("unarchiveMessage")
    class UnarchiveMessage {

        @Test
        @DisplayName("returns unarchived message DTO")
        void whenCalled_thenReturnsUnarchived() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            when(contactMessageService.unarchiveMessage(jwt, 1L)).thenReturn(dto);

            // Act
            ResponseEntity<ContactMessageDto> response = controller.unarchiveMessage(jwt, 1L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("sendMessage (multipart)")
    class SendMessage {

        @Test
        @DisplayName("returns 201 with created message")
        void whenCalled_thenReturnsCreated() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            when(contactMessageService.sendMessage(eq(jwt), eq("recipient-1"), eq("Subject"),
                    eq("Body"), eq("MEDIUM"), eq("GENERAL"), isNull())).thenReturn(dto);

            // Act
            ResponseEntity<ContactMessageDto> response = controller.sendMessage(
                    jwt, "recipient-1", "Subject", "Body", "MEDIUM", "GENERAL", null);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }
    }

    @Nested
    @DisplayName("sendMessageJson")
    class SendMessageJson {

        @Test
        @DisplayName("returns 201 with created message")
        void whenCalled_thenReturnsCreated() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            ContactSendRequest request = new ContactSendRequest("recipient-1", "Subject", "Body", "HIGH", "URGENT");
            when(contactMessageService.sendMessage(eq(jwt), eq("recipient-1"), eq("Subject"),
                    eq("Body"), eq("HIGH"), eq("URGENT"), eq(List.of()))).thenReturn(dto);

            // Act
            ResponseEntity<ContactMessageDto> response = controller.sendMessageJson(jwt, request);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }

        @Test
        @DisplayName("defaults to MEDIUM priority and GENERAL category when null")
        void whenNullPriorityAndCategory_thenDefaultsApplied() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            ContactSendRequest request = new ContactSendRequest("recipient-1", "Subject", "Body", null, null);
            when(contactMessageService.sendMessage(eq(jwt), eq("recipient-1"), eq("Subject"),
                    eq("Body"), eq("MEDIUM"), eq("GENERAL"), eq(List.of()))).thenReturn(dto);

            // Act
            ResponseEntity<ContactMessageDto> response = controller.sendMessageJson(jwt, request);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }
    }

    @Nested
    @DisplayName("replyToMessage")
    class ReplyToMessage {

        @Test
        @DisplayName("returns 201 with reply DTO")
        void whenCalled_thenReturnsCreated() {
            // Arrange
            ContactMessageDto dto = mock(ContactMessageDto.class);
            when(contactMessageService.replyToMessage(eq(jwt), eq(1L), eq("Reply body"), isNull())).thenReturn(dto);

            // Act
            ResponseEntity<ContactMessageDto> response = controller.replyToMessage(jwt, 1L, "Reply body", null);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }
    }

    @Nested
    @DisplayName("deleteMessage")
    class DeleteMessage {

        @Test
        @DisplayName("returns 204 and delegates to service")
        void whenCalled_thenReturnsNoContent() {
            // Act
            ResponseEntity<Void> response = controller.deleteMessage(jwt, 1L);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(contactMessageService).deleteMessage(jwt, 1L);
        }
    }

    @Nested
    @DisplayName("bulkUpdateStatus")
    class BulkUpdateStatus {

        @Test
        @DisplayName("returns OK with update result map")
        void whenCalled_thenReturnsOk() {
            // Arrange
            ContactBulkStatusRequest request = new ContactBulkStatusRequest(List.of(1L, 2L), "READ");
            when(contactMessageService.bulkUpdateStatus(jwt, List.of(1L, 2L), "READ"))
                    .thenReturn(Map.of("updated", 2));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.bulkUpdateStatus(jwt, request);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("updated", 2);
        }
    }

    @Nested
    @DisplayName("bulkDelete")
    class BulkDelete {

        @Test
        @DisplayName("returns OK with delete result map")
        void whenCalled_thenReturnsOk() {
            // Arrange
            ContactBulkDeleteRequest request = new ContactBulkDeleteRequest(List.of(1L, 2L));
            when(contactMessageService.bulkDelete(jwt, List.of(1L, 2L)))
                    .thenReturn(Map.of("deleted", 2));

            // Act
            ResponseEntity<Map<String, Object>> response = controller.bulkDelete(jwt, request);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("deleted", 2);
        }
    }

    @Nested
    @DisplayName("downloadAttachment")
    class DownloadAttachment {

        @Test
        @DisplayName("returns file resource when attachment found in DB")
        void whenAttachmentFound_thenReturnsResource() {
            // Arrange
            when(contactMessageService.getAttachmentContent(jwt, 1L, "att-1"))
                    .thenReturn(new ContactAttachmentContentDto(
                            "rapport.pdf", "application/pdf", "pdf-content".getBytes()));

            // Act
            ResponseEntity<Resource> response = controller.downloadAttachment(jwt, 1L, "att-1");

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getHeaders().getFirst("Content-Type")).isEqualTo("application/pdf");
            assertThat(response.getHeaders().getFirst("Content-Disposition")).contains("rapport.pdf");
        }

        @Test
        @DisplayName("throws NoSuchElementException when attachment ID not found in metadata")
        void whenAttachmentIdNotFound_thenThrows() {
            // Arrange
            when(contactMessageService.getAttachmentContent(jwt, 1L, "nonexistent-id"))
                    .thenThrow(new NoSuchElementException("Piece jointe introuvable"));

            // Act & Assert
            assertThatThrownBy(() -> controller.downloadAttachment(jwt, 1L, "nonexistent-id"))
                    .isInstanceOf(NoSuchElementException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("throws NoSuchElementException when file not found in DB")
        void whenFileNotInDb_thenThrows() {
            // Arrange
            when(contactMessageService.getAttachmentContent(jwt, 1L, "att-1"))
                    .thenThrow(new NoSuchElementException("Fichier non disponible en telechargement"));

            // Act & Assert
            assertThatThrownBy(() -> controller.downloadAttachment(jwt, 1L, "att-1"))
                    .isInstanceOf(NoSuchElementException.class)
                    .hasMessageContaining("non disponible");
        }

        @Test
        @DisplayName("throws NoSuchElementException when attachments JSON is null")
        void whenAttachmentsNull_thenThrowsNotFound() {
            // Arrange
            when(contactMessageService.getAttachmentContent(jwt, 1L, "att-1"))
                    .thenThrow(new NoSuchElementException("Piece jointe introuvable"));

            // Act & Assert
            assertThatThrownBy(() -> controller.downloadAttachment(jwt, 1L, "att-1"))
                    .isInstanceOf(NoSuchElementException.class);
        }
    }

    // ─── threads endpoints ────────────────────────────────────────────────

    @Nested
    @DisplayName("getThreads")
    class GetThreads {
        @Test
        void returnsListOfThreads() {
            ContactThreadSummaryDto threadDto = mock(ContactThreadSummaryDto.class);
            when(contactMessageService.getThreads(jwt)).thenReturn(List.of(threadDto));

            ResponseEntity<List<ContactThreadSummaryDto>> response = controller.getThreads(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getThreadMessages")
    class GetThreadMessages {
        @Test
        void returnsListOfMessages() {
            ContactMessageDto msg = mock(ContactMessageDto.class);
            when(contactMessageService.getThreadMessages(jwt, "counterpart-1", false))
                    .thenReturn(List.of(msg));

            ResponseEntity<List<ContactMessageDto>> response =
                    controller.getThreadMessages(jwt, "counterpart-1", false);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("markThreadAsRead")
    class MarkThreadRead {
        @Test
        void returnsUpdatedCount() {
            when(contactMessageService.markThreadAsRead(jwt, "kc-1")).thenReturn(5);

            ResponseEntity<Map<String, Object>> response = controller.markThreadAsRead(jwt, "kc-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("updatedCount", 5);
        }
    }

    @Nested
    @DisplayName("getAttachmentBase64")
    class GetBase64 {
        @Test
        void returnsBase64DataUri() {
            String dataUri = "data:image/png;base64," + Base64.getEncoder().encodeToString("hello".getBytes());
            when(contactMessageService.getAttachmentAsBase64(jwt, 1L, "att-1"))
                    .thenReturn(new ContactAttachmentBase64Dto(dataUri, "image/png", "img.png", 5L));

            ResponseEntity<Map<String, Object>> response =
                    controller.getAttachmentBase64(jwt, 1L, "att-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            String data = (String) response.getBody().get("data");
            assertThat(data).startsWith("data:image/png;base64,");
            assertThat(response.getBody().get("contentType")).isEqualTo("image/png");
            assertThat(response.getBody().get("originalName")).isEqualTo("img.png");
            assertThat(response.getBody().get("size")).isEqualTo(5L);
        }

        @Test
        void whenFileMissing_throwsNotFound() {
            when(contactMessageService.getAttachmentAsBase64(jwt, 1L, "att-1"))
                    .thenThrow(new NoSuchElementException("Fichier non disponible"));

            assertThatThrownBy(() -> controller.getAttachmentBase64(jwt, 1L, "att-1"))
                    .isInstanceOf(NoSuchElementException.class);
        }

        @Test
        void whenContentTypeNull_defaultsToOctetStream() {
            String dataUri = "data:application/octet-stream;base64,"
                    + Base64.getEncoder().encodeToString("data".getBytes());
            when(contactMessageService.getAttachmentAsBase64(jwt, 1L, "att-1"))
                    .thenReturn(new ContactAttachmentBase64Dto(dataUri, "application/octet-stream", "", 0L));

            ResponseEntity<Map<String, Object>> response =
                    controller.getAttachmentBase64(jwt, 1L, "att-1");

            assertThat(response.getBody().get("contentType")).isEqualTo("application/octet-stream");
            assertThat(response.getBody().get("originalName")).isEqualTo("");
            assertThat(response.getBody().get("size")).isEqualTo(0L);
        }
    }

    @Nested
    @DisplayName("Exception handlers")
    class ExceptionHandlers {

        @Test
        @DisplayName("handleBadRequest returns 400 with error map")
        void handleBadRequest_returnsBadRequest() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleBadRequest(new IllegalArgumentException("bad input"));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).containsEntry("error", "bad input");
        }

        @Test
        @DisplayName("handleForbidden returns 403")
        void handleForbidden_returnsForbidden() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleForbidden(new SecurityException("no access"));

            assertThat(response.getStatusCode().value()).isEqualTo(403);
            assertThat(response.getBody()).containsEntry("error", "no access");
        }

        @Test
        @DisplayName("handleNotFound returns 404")
        void handleNotFound_returnsNotFound() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleNotFound(new NoSuchElementException("not here"));

            assertThat(response.getStatusCode().value()).isEqualTo(404);
            assertThat(response.getBody()).containsEntry("error", "not here");
        }

        @Test
        @DisplayName("handleGeneric returns 500 with masked message")
        void handleGeneric_returns500() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleGeneric(new RuntimeException("internal boom"));

            assertThat(response.getStatusCode().value()).isEqualTo(500);
            // Generic handler masks the error
            assertThat(response.getBody()).containsEntry("error", "Erreur interne");
        }
    }
}
