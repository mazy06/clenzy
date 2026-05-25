package com.clenzy.controller;

import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
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
    private AssistantController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        orchestrator = mock(AgentOrchestrator.class);
        convRepo = mock(AssistantConversationRepository.class);
        msgRepo = mock(AssistantMessageRepository.class);
        tenantContext = mock(TenantContext.class);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

        controller = new AssistantController(orchestrator, convRepo, msgRepo,
                tenantContext, new ObjectMapper());

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
                null, "", null, null);
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

    private static long anyLong() { return org.mockito.ArgumentMatchers.anyLong(); }
}
