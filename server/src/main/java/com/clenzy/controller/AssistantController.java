package com.clenzy.controller;

import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentSseEvent;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Endpoints de l'assistant conversationnel.
 *
 * <p>Toutes les routes sont {@code isAuthenticated()} minimum. L'ownership des
 * conversations est verifie au niveau service via le {@code keycloakId} extrait
 * du JWT — un user ne peut jamais lire ou continuer la conversation d'un autre.</p>
 *
 * <p>Le chat est en SSE : le client poste son message, on lui pousse les events
 * (deltas texte, tool calls, done). Pas de polling.</p>
 */
@RestController
@RequestMapping("/api/assistant")
@PreAuthorize("isAuthenticated()")
public class AssistantController {

    private static final Logger log = LoggerFactory.getLogger(AssistantController.class);
    private static final long SSE_TIMEOUT_MS = 5 * 60_000L; // 5 minutes

    private final AgentOrchestrator orchestrator;
    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;

    /** Pool dedie pour les streams SSE — evite de bloquer les threads Tomcat. */
    private final Executor sseExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "assistant-sse");
        t.setDaemon(true);
        return t;
    });

    public AssistantController(AgentOrchestrator orchestrator,
                                AssistantConversationRepository conversationRepository,
                                AssistantMessageRepository messageRepository,
                                TenantContext tenantContext,
                                ObjectMapper objectMapper) {
        this.orchestrator = orchestrator;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
    }

    // ─── Chat SSE ──────────────────────────────────────────────────────────

    /**
     * Lance un nouveau message dans une conversation (existante ou nouvelle).
     * Stream les evenements via SSE jusqu'a "done" ou "error".
     *
     * Body JSON : {"conversationId": 42, "message": "...", "currentPage": "...", "selectedPropertyId": 7}
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@RequestBody ChatRequestBody body, @AuthenticationPrincipal Jwt jwt) {
        if (body == null || body.message() == null || body.message().isBlank()) {
            throw new IllegalArgumentException("message is required");
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Long orgId = tenantContext.getRequiredOrganizationId();
        String keycloakId = jwt.getSubject();

        AgentContext context = new AgentContext(
                orgId,
                keycloakId,
                jwt,
                jwt.getClaimAsString("locale") != null ? jwt.getClaimAsString("locale") : "fr",
                body.currentPage(),
                body.selectedPropertyId()
        );

        sseExecutor.execute(() -> {
            try {
                orchestrator.handleMessage(
                        body.conversationId(),
                        body.message(),
                        context,
                        event -> sendSseEvent(emitter, event)
                );
                emitter.complete();
            } catch (IllegalArgumentException e) {
                // Owner mismatch / conversation introuvable — message clair pour le frontend
                sendSseEvent(emitter, AgentSseEvent.error(e.getMessage()));
                emitter.complete();
            } catch (Exception e) {
                log.error("AssistantController.chat failed", e);
                sendSseEvent(emitter, AgentSseEvent.error("Erreur interne : " + e.getMessage()));
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    private void sendSseEvent(SseEmitter emitter, AgentSseEvent event) {
        try {
            emitter.send(SseEmitter.event()
                    .name(event.type())
                    .data(event, MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            // Le client a probablement coupe la connexion — silencieux
            log.debug("SSE send failed (client disconnected?) : {}", e.getMessage());
        }
    }

    // ─── Tool confirmation (reprise apres pause) ──────────────────────────

    /**
     * Endpoint appele par le frontend apres confirmation/refus d'un tool
     * d'ecriture en attente. Reprend la boucle de l'assistant en SSE.
     *
     * Body JSON : {"toolCallId": "toolu_xxx", "confirmed": true}
     */
    @PostMapping(value = "/tool-confirm", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter confirmTool(@RequestBody ToolConfirmBody body, @AuthenticationPrincipal Jwt jwt) {
        if (body == null || body.toolCallId() == null || body.toolCallId().isBlank()) {
            throw new IllegalArgumentException("toolCallId is required");
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Long orgId = tenantContext.getRequiredOrganizationId();
        String keycloakId = jwt.getSubject();

        AgentContext context = new AgentContext(
                orgId,
                keycloakId,
                jwt,
                jwt.getClaimAsString("locale") != null ? jwt.getClaimAsString("locale") : "fr",
                null,
                null
        );

        sseExecutor.execute(() -> {
            try {
                orchestrator.resumeAfterConfirmation(
                        body.toolCallId(),
                        body.confirmed(),
                        context,
                        event -> sendSseEvent(emitter, event)
                );
                emitter.complete();
            } catch (IllegalArgumentException e) {
                sendSseEvent(emitter, AgentSseEvent.error(e.getMessage()));
                emitter.complete();
            } catch (Exception e) {
                log.error("AssistantController.confirmTool failed", e);
                sendSseEvent(emitter, AgentSseEvent.error("Erreur interne : " + e.getMessage()));
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    /** Body de POST /assistant/tool-confirm. */
    public record ToolConfirmBody(String toolCallId, boolean confirmed) {}

    // ─── Conversations history ─────────────────────────────────────────────

    @GetMapping("/conversations")
    public ResponseEntity<Page<Map<String, Object>>> listConversations(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AssistantConversation> p = conversationRepository.findActiveByUser(
                jwt.getSubject(), PageRequest.of(page, Math.min(50, size)));
        return ResponseEntity.ok(p.map(this::toConversationSummary));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<Map<String, Object>>> getMessages(
            @PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        // Ownership check : findByIdAndUser retourne empty si pas le proprietaire
        AssistantConversation conv = conversationRepository.findByIdAndUser(id, jwt.getSubject())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + id + " introuvable ou non autorisee"));

        List<AssistantMessage> messages = messageRepository.findByConversation(conv.getId());
        return ResponseEntity.ok(messages.stream().map(this::toMessageDto).toList());
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<Void> archive(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        AssistantConversation conv = conversationRepository.findByIdAndUser(id, jwt.getSubject())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + id + " introuvable ou non autorisee"));
        conv.setArchivedAt(java.time.LocalDateTime.now());
        conversationRepository.save(conv);
        return ResponseEntity.noContent().build();
    }

    // ─── Mapping helpers ──────────────────────────────────────────────────

    private Map<String, Object> toConversationSummary(AssistantConversation c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("title", c.getTitle());
        m.put("model", c.getModel());
        m.put("createdAt", c.getCreatedAt());
        m.put("updatedAt", c.getUpdatedAt());
        return m;
    }

    private Map<String, Object> toMessageDto(AssistantMessage msg) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", msg.getId());
        m.put("role", msg.getRole());
        if (msg.getContent() != null) m.put("content", msg.getContent());
        if (msg.getToolCalls() != null) m.put("toolCalls", msg.getToolCalls());
        if (msg.getToolCallId() != null) m.put("toolCallId", msg.getToolCallId());
        m.put("createdAt", msg.getCreatedAt());
        return m;
    }

    // ─── Request body record ───────────────────────────────────────────────

    /**
     * Corps de requete chat. {@code conversationId} null = nouvelle conversation.
     */
    public record ChatRequestBody(
            Long conversationId,
            String message,
            String currentPage,
            Long selectedPropertyId
    ) {}
}
