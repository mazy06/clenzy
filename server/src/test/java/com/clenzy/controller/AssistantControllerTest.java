package com.clenzy.controller;

import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.PhotoStorageService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AttachmentRef;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires de {@link AssistantController} — focalises sur les controles
 * d'ownership et les endpoints REST simples. Le streaming SSE est teste
 * indirectement via {@link com.clenzy.service.agent.AgentOrchestratorTest}.
 */
class AssistantControllerTest {

    private AgentOrchestrator orchestrator;
    private AssistantConversationRepository convRepo;
    private AssistantMessageRepository msgRepo;
    private TenantContext tenantContext;
    private PhotoStorageService photoStorageService;
    private AssistantController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        orchestrator = mock(AgentOrchestrator.class);
        convRepo = mock(AssistantConversationRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        tenantContext = mock(TenantContext.class);
        photoStorageService = mock(PhotoStorageService.class);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

        controller = new AssistantController(orchestrator, convRepo, msgRepo,
                tenantContext, new ObjectMapper(), photoStorageService);

        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-123")
                .claim("locale", "fr")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Test
    void chat_emptyMessage_throws() {
        AssistantController.ChatRequestBody body = new AssistantController.ChatRequestBody(
                null, "", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> controller.chat(body, jwt));
    }

    @Test
    void chat_nullBody_throws() {
        assertThrows(IllegalArgumentException.class, () -> controller.chat(null, jwt));
    }

    @Test
    void listConversations_returnsUserSpecificPage() {
        AssistantConversation c = new AssistantConversation(1L, "user-123");
        c.setId(1L);
        c.setTitle("Test");
        Page<AssistantConversation> page = new PageImpl<>(List.of(c), Pageable.ofSize(20), 1);
        when(convRepo.findActiveByUser(eq("user-123"), any())).thenReturn(page);

        ResponseEntity<Page<Map<String, Object>>> response = controller.listConversations(jwt, 0, 20);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().getContent().size());
        assertEquals(1L, response.getBody().getContent().get(0).get("id"));
        assertEquals("Test", response.getBody().getContent().get(0).get("title"));
    }

    @Test
    void listConversations_sizeClampedTo50() {
        when(convRepo.findActiveByUser(anyString(), any()))
                .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(50), 0));

        controller.listConversations(jwt, 0, 9999);

        verify(convRepo).findActiveByUser(eq("user-123"),
                argThat(p -> ((PageRequest) p).getPageSize() == 50));
    }

    @Test
    void getMessages_ownerMatch_returnsList() {
        AssistantConversation c = new AssistantConversation(1L, "user-123");
        c.setId(42L);
        when(convRepo.findByIdAndUser(42L, "user-123")).thenReturn(Optional.of(c));

        AssistantMessage m1 = AssistantMessage.user(42L, 1L, "hi");
        m1.setId(1L);
        AssistantMessage m2 = AssistantMessage.assistant(42L, 1L, "hello", null);
        m2.setId(2L);
        when(msgRepo.findByConversation(42L)).thenReturn(List.of(m1, m2));

        ResponseEntity<List<Map<String, Object>>> response = controller.getMessages(42L, jwt);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(2, response.getBody().size());
        assertEquals("user", response.getBody().get(0).get("role"));
        assertEquals("hi", response.getBody().get(0).get("content"));
        assertEquals("assistant", response.getBody().get(1).get("role"));
    }

    @Test
    void getMessages_otherOwnersConversation_throws() {
        when(convRepo.findByIdAndUser(99L, "user-123")).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> controller.getMessages(99L, jwt));
        assertTrue(ex.getMessage().contains("99"));
        verify(msgRepo, never()).findByConversation(anyLong());
    }

    @Test
    void archive_otherOwnersConversation_throws() {
        when(convRepo.findByIdAndUser(99L, "user-123")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> controller.archive(99L, jwt));
        verify(convRepo, never()).save(any());
    }

    @Test
    void archive_ownerMatch_setsArchivedAtAndSaves() {
        AssistantConversation c = new AssistantConversation(1L, "user-123");
        c.setId(42L);
        when(convRepo.findByIdAndUser(42L, "user-123")).thenReturn(Optional.of(c));

        ResponseEntity<Void> response = controller.archive(42L, jwt);

        assertEquals(204, response.getStatusCode().value());
        assertNotNull(c.getArchivedAt());
        verify(convRepo).save(c);
    }

    // ─── Upload endpoint (vision) ──────────────────────────────────────────

    @Test
    void upload_validJpeg_storesAndReturnsRef() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "frigo.jpg", "image/jpeg", "fakebytes".getBytes());
        when(photoStorageService.store(any(byte[].class), eq("image/jpeg"), eq("frigo.jpg")))
                .thenReturn("storage-key-abc");

        ResponseEntity<Map<String, Object>> response = controller.upload(file, jwt);

        assertEquals(201, response.getStatusCode().value());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("storage-key-abc", body.get("storageKey"));
        assertEquals("image/jpeg", body.get("mediaType"));
        assertEquals("frigo.jpg", body.get("name"));
        assertEquals("/api/assistant/attachments/storage-key-abc", body.get("url"));
    }

    @Test
    void upload_unsupportedMime_rejects() {
        MockMultipartFile pdf = new MockMultipartFile(
                "file", "doc.pdf", "application/pdf", "fakebytes".getBytes());
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> controller.upload(pdf, jwt));
        assertTrue(ex.getMessage().toLowerCase().contains("non supporte")
                || ex.getMessage().toLowerCase().contains("supporte"));
        verifyNoInteractions(photoStorageService);
    }

    @Test
    void upload_emptyFile_rejects() {
        MockMultipartFile empty = new MockMultipartFile(
                "file", "empty.jpg", "image/jpeg", new byte[0]);
        assertThrows(IllegalArgumentException.class, () -> controller.upload(empty, jwt));
    }

    @Test
    void upload_oversize_rejects() {
        // 6 MB > limite 5 MB
        byte[] huge = new byte[6 * 1024 * 1024];
        MockMultipartFile big = new MockMultipartFile(
                "file", "huge.jpg", "image/jpeg", huge);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> controller.upload(big, jwt));
        assertTrue(ex.getMessage().toLowerCase().contains("volumineux"));
    }

    @Test
    void upload_acceptsPng_gif_webp() {
        when(photoStorageService.store(any(byte[].class), anyString(), anyString()))
                .thenReturn("k");
        for (String mime : List.of("image/png", "image/gif", "image/webp")) {
            MockMultipartFile f = new MockMultipartFile(
                    "file", "img." + mime.substring(6), mime, "x".getBytes());
            ResponseEntity<Map<String, Object>> response = controller.upload(f, jwt);
            assertEquals(201, response.getStatusCode().value(),
                    "MIME " + mime + " devrait etre accepte");
        }
    }

    @Test
    void chat_attachmentsExceedingLimit_rejected() {
        List<AttachmentRef> tooMany = List.of(
                new AttachmentRef("k1", "image/jpeg", "/u/k1", "a.jpg"),
                new AttachmentRef("k2", "image/jpeg", "/u/k2", "b.jpg"),
                new AttachmentRef("k3", "image/jpeg", "/u/k3", "c.jpg"),
                new AttachmentRef("k4", "image/jpeg", "/u/k4", "d.jpg")
        );
        AssistantController.ChatRequestBody body = new AssistantController.ChatRequestBody(
                null, "msg", null, null, tooMany);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> controller.chat(body, jwt));
        assertTrue(ex.getMessage().toLowerCase().contains("maximum"));
    }

    @Test
    void chat_attachmentsOnly_noText_accepted() {
        List<AttachmentRef> atts = List.of(
                new AttachmentRef("k1", "image/jpeg", "/u/k1", "a.jpg")
        );
        AssistantController.ChatRequestBody body = new AssistantController.ChatRequestBody(
                null, "", null, null, atts);
        // Ne doit pas throw (l'orchestrator est mocke, le SSE renvoie un emitter
        // mais le test verifie surtout que la validation passe).
        assertDoesNotThrow(() -> controller.chat(body, jwt));
    }

    @Test
    void serveAttachment_returnsBytes_orNotFound() {
        when(photoStorageService.retrieve("good")).thenReturn("hello".getBytes());
        when(photoStorageService.retrieve("bad")).thenThrow(new RuntimeException("missing"));

        ResponseEntity<byte[]> ok = controller.serveAttachment("good");
        assertEquals(200, ok.getStatusCode().value());
        assertArrayEquals("hello".getBytes(), ok.getBody());

        ResponseEntity<byte[]> ko = controller.serveAttachment("bad");
        assertEquals(404, ko.getStatusCode().value());
    }

    @SuppressWarnings("unused")
    private static AgentContext unused() {
        return null; // silence l'import non utilise via verifications futures
    }

    private static long anyLong() { return org.mockito.ArgumentMatchers.anyLong(); }
    private static <T> T eq(T value) { return org.mockito.ArgumentMatchers.eq(value); }
}
