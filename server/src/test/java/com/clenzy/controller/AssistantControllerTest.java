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
                tenantContext, new ObjectMapper(), photoStorageService,
                mock(com.clenzy.service.agent.briefing.AssistantBriefingPrefService.class),
                mock(com.clenzy.service.agent.briefing.BriefingComposer.class),
                mock(com.clenzy.service.agent.briefing.BriefingDelivery.class));

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
    void serveAttachment_returnsBytes_whenOwnedAndStorageOk() {
        // Ownership : la cle 'good' appartient bien a une conv du user JWT
        when(msgRepo.findAttachmentsJsonByStorageKeyForUser("good", "user-123"))
                .thenReturn("[{\"storageKey\":\"good\",\"mediaType\":\"image/png\",\"name\":\"a.png\"}]");
        when(photoStorageService.retrieve("good")).thenReturn("hello".getBytes());

        ResponseEntity<byte[]> ok = controller.serveAttachment("good", jwt);

        assertEquals(200, ok.getStatusCode().value());
        assertArrayEquals("hello".getBytes(), ok.getBody());
        // Le MIME extrait du JSON DOIT etre utilise (pas le hardcoded image/jpeg)
        assertEquals("image/png", ok.getHeaders().getContentType().toString());
    }

    @Test
    void serveAttachment_returns404_whenStorageKeyNotOwnedByUser() {
        // La cle existe peut-etre, mais elle n'est pas reliee a une conv du user JWT
        when(msgRepo.findAttachmentsJsonByStorageKeyForUser("stranger", "user-123"))
                .thenReturn(null);

        ResponseEntity<byte[]> ko = controller.serveAttachment("stranger", jwt);

        assertEquals(404, ko.getStatusCode().value());
        // Le storage ne doit JAMAIS etre interroge si l'ownership echoue
        org.mockito.Mockito.verify(photoStorageService, org.mockito.Mockito.never()).retrieve(any());
    }

    @Test
    void serveAttachment_returns404_whenStorageMissing() {
        when(msgRepo.findAttachmentsJsonByStorageKeyForUser("good", "user-123"))
                .thenReturn("[{\"storageKey\":\"good\",\"mediaType\":\"image/jpeg\"}]");
        when(photoStorageService.retrieve("good")).thenThrow(new RuntimeException("missing"));

        ResponseEntity<byte[]> ko = controller.serveAttachment("good", jwt);

        assertEquals(404, ko.getStatusCode().value());
    }

    @Test
    void serveAttachment_fallsBackToJpeg_whenMediaTypeMissingInJson() {
        when(msgRepo.findAttachmentsJsonByStorageKeyForUser("nomedia", "user-123"))
                .thenReturn("[{\"storageKey\":\"nomedia\"}]");
        when(photoStorageService.retrieve("nomedia")).thenReturn("x".getBytes());

        ResponseEntity<byte[]> ok = controller.serveAttachment("nomedia", jwt);

        assertEquals(200, ok.getStatusCode().value());
        assertEquals("image/jpeg", ok.getHeaders().getContentType().toString());
    }

    // ============= EXTENDED =============

    @org.junit.jupiter.api.Nested
    class BriefingPrefsEndpoint {

        @org.junit.jupiter.api.Test
        void getBriefingPrefs_withExistingPref_returnsPref() {
            com.clenzy.service.agent.briefing.AssistantBriefingPrefService prefService =
                mock(com.clenzy.service.agent.briefing.AssistantBriefingPrefService.class);
            com.clenzy.service.agent.briefing.BriefingComposer composer =
                mock(com.clenzy.service.agent.briefing.BriefingComposer.class);
            com.clenzy.service.agent.briefing.BriefingDelivery delivery =
                mock(com.clenzy.service.agent.briefing.BriefingDelivery.class);
            controller = new AssistantController(orchestrator, convRepo, msgRepo, tenantContext,
                new ObjectMapper(), photoStorageService, prefService, composer, delivery);

            com.clenzy.model.AssistantBriefingPref pref = new com.clenzy.model.AssistantBriefingPref(1L, "user-123");
            pref.setEnabled(true);
            pref.setFrequencyEnum(com.clenzy.model.AssistantBriefingPref.Frequency.DAILY_MORNING);
            pref.setTimeLocal(java.time.LocalTime.of(9, 0));
            pref.setTimezone("Europe/Paris");

            when(prefService.get("user-123")).thenReturn(Optional.of(pref));
            when(prefService.parseChannels(pref)).thenReturn(List.of("in_app"));

            ResponseEntity<Map<String, Object>> response = controller.getBriefingPrefs(jwt);

            assertEquals(200, response.getStatusCode().value());
            assertEquals(true, response.getBody().get("enabled"));
            assertEquals("09:00", response.getBody().get("timeLocal"));
        }

        @org.junit.jupiter.api.Test
        void getBriefingPrefs_noPref_returnsDefault() {
            com.clenzy.service.agent.briefing.AssistantBriefingPrefService prefService =
                mock(com.clenzy.service.agent.briefing.AssistantBriefingPrefService.class);
            controller = new AssistantController(orchestrator, convRepo, msgRepo, tenantContext,
                new ObjectMapper(), photoStorageService, prefService,
                mock(com.clenzy.service.agent.briefing.BriefingComposer.class),
                mock(com.clenzy.service.agent.briefing.BriefingDelivery.class));

            com.clenzy.model.AssistantBriefingPref defaultPref =
                new com.clenzy.model.AssistantBriefingPref(1L, "user-123");
            defaultPref.setFrequencyEnum(com.clenzy.model.AssistantBriefingPref.Frequency.DAILY_MORNING);
            defaultPref.setTimezone("Europe/Paris");

            when(prefService.get("user-123")).thenReturn(Optional.empty());
            when(prefService.getDefaultPrefs(1L, "user-123")).thenReturn(defaultPref);
            when(prefService.parseChannels(defaultPref)).thenReturn(List.of("in_app"));

            ResponseEntity<Map<String, Object>> response = controller.getBriefingPrefs(jwt);

            assertEquals(200, response.getStatusCode().value());
            // default time
            assertEquals("08:00", response.getBody().get("timeLocal"));
        }

        @org.junit.jupiter.api.Test
        void updateBriefingPrefs_withValidBody_upsertsAndReturnsDto() {
            com.clenzy.service.agent.briefing.AssistantBriefingPrefService prefService =
                mock(com.clenzy.service.agent.briefing.AssistantBriefingPrefService.class);
            controller = new AssistantController(orchestrator, convRepo, msgRepo, tenantContext,
                new ObjectMapper(), photoStorageService, prefService,
                mock(com.clenzy.service.agent.briefing.BriefingComposer.class),
                mock(com.clenzy.service.agent.briefing.BriefingDelivery.class));

            com.clenzy.model.AssistantBriefingPref pref = new com.clenzy.model.AssistantBriefingPref(1L, "user-123");
            pref.setEnabled(true);
            pref.setFrequencyEnum(com.clenzy.model.AssistantBriefingPref.Frequency.DAILY_MORNING);
            pref.setTimezone("Europe/Paris");
            when(prefService.upsert(eq(1L), eq("user-123"), anyBoolean(), any(), any(), any(), anyString()))
                .thenReturn(pref);
            when(prefService.parseChannels(any())).thenReturn(List.of("in_app"));

            AssistantController.BriefingPrefsBody body = new AssistantController.BriefingPrefsBody(
                true, "daily_morning", List.of("in_app"), "09:30", "Europe/Paris");

            ResponseEntity<Map<String, Object>> response = controller.updateBriefingPrefs(body, jwt);

            assertEquals(200, response.getStatusCode().value());
        }

        @org.junit.jupiter.api.Test
        void updateBriefingPrefs_invalidTimeLocal_throws() {
            com.clenzy.service.agent.briefing.AssistantBriefingPrefService prefService =
                mock(com.clenzy.service.agent.briefing.AssistantBriefingPrefService.class);
            controller = new AssistantController(orchestrator, convRepo, msgRepo, tenantContext,
                new ObjectMapper(), photoStorageService, prefService,
                mock(com.clenzy.service.agent.briefing.BriefingComposer.class),
                mock(com.clenzy.service.agent.briefing.BriefingDelivery.class));

            AssistantController.BriefingPrefsBody body = new AssistantController.BriefingPrefsBody(
                true, "daily_morning", List.of("in_app"), "not-a-time", "Europe/Paris");

            assertThrows(IllegalArgumentException.class, () -> controller.updateBriefingPrefs(body, jwt));
        }

        @org.junit.jupiter.api.Test
        void triggerBriefing_composerReturnsNull_returns503() {
            com.clenzy.service.agent.briefing.AssistantBriefingPrefService prefService =
                mock(com.clenzy.service.agent.briefing.AssistantBriefingPrefService.class);
            com.clenzy.service.agent.briefing.BriefingComposer composer =
                mock(com.clenzy.service.agent.briefing.BriefingComposer.class);
            controller = new AssistantController(orchestrator, convRepo, msgRepo, tenantContext,
                new ObjectMapper(), photoStorageService, prefService, composer,
                mock(com.clenzy.service.agent.briefing.BriefingDelivery.class));

            com.clenzy.model.AssistantBriefingPref pref = new com.clenzy.model.AssistantBriefingPref(1L, "user-123");
            when(prefService.get("user-123")).thenReturn(Optional.of(pref));
            when(composer.compose(pref)).thenReturn(null);

            ResponseEntity<Map<String, Object>> response = controller.triggerBriefing(jwt);
            assertEquals(503, response.getStatusCode().value());
        }

        @org.junit.jupiter.api.Test
        void triggerBriefing_success_dispatchesAndReturnsConvoId() {
            com.clenzy.service.agent.briefing.AssistantBriefingPrefService prefService =
                mock(com.clenzy.service.agent.briefing.AssistantBriefingPrefService.class);
            com.clenzy.service.agent.briefing.BriefingComposer composer =
                mock(com.clenzy.service.agent.briefing.BriefingComposer.class);
            com.clenzy.service.agent.briefing.BriefingDelivery delivery =
                mock(com.clenzy.service.agent.briefing.BriefingDelivery.class);
            controller = new AssistantController(orchestrator, convRepo, msgRepo, tenantContext,
                new ObjectMapper(), photoStorageService, prefService, composer, delivery);

            com.clenzy.model.AssistantBriefingPref pref = new com.clenzy.model.AssistantBriefingPref(1L, "user-123");
            when(prefService.get("user-123")).thenReturn(Optional.of(pref));
            com.clenzy.service.agent.briefing.BriefingComposer.BriefingResult composeResult =
                mock(com.clenzy.service.agent.briefing.BriefingComposer.BriefingResult.class);
            when(composeResult.conversationId()).thenReturn(99L);
            when(composer.compose(pref)).thenReturn(composeResult);
            when(prefService.parseChannels(pref)).thenReturn(List.of("in_app", "email"));
            when(delivery.dispatch(composeResult, "user-123", 1L, List.of("in_app", "email")))
                .thenReturn(List.of("in_app"));

            ResponseEntity<Map<String, Object>> response = controller.triggerBriefing(jwt);
            assertEquals(200, response.getStatusCode().value());
            assertEquals(99L, response.getBody().get("conversationId"));
            assertEquals(List.of("in_app"), response.getBody().get("delivered"));
        }
    }

    @SuppressWarnings("unused")
    private static AgentContext unused() {
        return null; // silence l'import non utilise via verifications futures
    }

    private static long anyLong() { return org.mockito.ArgumentMatchers.anyLong(); }
    private static <T> T eq(T value) { return org.mockito.ArgumentMatchers.eq(value); }
    private static boolean anyBoolean() { return org.mockito.ArgumentMatchers.anyBoolean(); }

    // ============= EXTENDED COVERAGE =============

    @Test
    void confirmTool_nullBody_throws() {
        assertThrows(IllegalArgumentException.class, () -> controller.confirmTool(null, jwt));
    }

    @Test
    void confirmTool_blankToolCallId_throws() {
        AssistantController.ToolConfirmBody body = new AssistantController.ToolConfirmBody("", true);
        assertThrows(IllegalArgumentException.class, () -> controller.confirmTool(body, jwt));
    }

    @Test
    void confirmTool_nullToolCallId_throws() {
        AssistantController.ToolConfirmBody body = new AssistantController.ToolConfirmBody(null, true);
        assertThrows(IllegalArgumentException.class, () -> controller.confirmTool(body, jwt));
    }

    @Test
    void confirmTool_validBody_returnsSseEmitter() {
        AssistantController.ToolConfirmBody body = new AssistantController.ToolConfirmBody("toolu_1", true);
        // Should not throw — returns SseEmitter
        assertDoesNotThrow(() -> controller.confirmTool(body, jwt));
    }

    @Test
    void chat_messageWithOnlyWhitespace_andNoAttachments_throws() {
        AssistantController.ChatRequestBody body = new AssistantController.ChatRequestBody(
            null, "   ", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> controller.chat(body, jwt));
    }

    @Test
    void listConversations_smallSize_passesThroughIfPositive() {
        when(convRepo.findActiveByUser(anyString(), any()))
            .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(5), 0));

        controller.listConversations(jwt, 0, 5);
        verify(convRepo).findActiveByUser(eq("user-123"), any());
    }

    @Test
    void upload_emptyFilename_storesWithFallback() {
        MockMultipartFile noName = new MockMultipartFile(
            "file", "", "image/png", "x".getBytes());
        when(photoStorageService.store(any(byte[].class), eq("image/png"), anyString()))
            .thenReturn("key-x");
        ResponseEntity<Map<String, Object>> response = controller.upload(noName, jwt);
        assertEquals(201, response.getStatusCode().value());
    }

    @Test
    void upload_nullFilename_storesWithFallback() {
        MockMultipartFile nullName = new MockMultipartFile(
            "file", null, "image/png", "x".getBytes()) {
            @Override public String getOriginalFilename() { return null; }
        };
        when(photoStorageService.store(any(byte[].class), eq("image/png"), anyString()))
            .thenReturn("key-y");
        ResponseEntity<Map<String, Object>> response = controller.upload(nullName, jwt);
        assertEquals(201, response.getStatusCode().value());
    }
}
