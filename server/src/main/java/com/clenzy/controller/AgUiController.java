package com.clenzy.controller;

import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentSseEvent;
import com.clenzy.service.agent.AttachmentRef;
import com.clenzy.service.agent.PendingActionDto;
import com.clenzy.service.agent.PendingToolStore;
import com.clenzy.service.agent.agui.AgUiEvent;
import com.clenzy.service.agent.agui.AgentSseEventToAgUi;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Endpoint AG-UI (<a href="https://docs.ag-ui.com">protocole ouvert</a>) exposant
 * l'assistant multi-agent au front CopilotKit en mode <b>direct</b> (zéro runtime
 * Node). Réutilise tel quel {@link AgentOrchestrator} (moteur multi-agent activé
 * en dev via {@code clenzy.assistant.multi-agent.enabled}) et traduit son flux
 * {@link AgentSseEvent} vers les événements AG-UI via {@link AgentSseEventToAgUi}.
 *
 * <p><b>Phase 0 (spike)</b> : prouve la boucle front CopilotKit ↔ AG-UI ↔ moteur
 * multi-agent existant ↔ HITL, sans toucher à {@code /api/assistant/chat}.</p>
 *
 * <p>Contrat HITL (resume) : le front renvoie un run avec
 * {@code forwardedProps.resume = { toolCallId, confirmed }} → mappé sur
 * {@link AgentOrchestrator#resumeAfterConfirmation}.</p>
 */
@RestController
@RequestMapping("/api/agui")
// RBAC Superviseur : l'agent peut lire des donnees financieres, creer/annuler des
// reservations, bloquer des calendriers, ajuster des tarifs. On restreint donc l'acces
// aux roles de gestion, alignes sur SUPERVISION_OPERATOR_ROLES du front
// (client/src/modules/supervision/roles.ts). Les autres roles (TECHNICIAN, HOUSEKEEPER,
// LAUNDRY, EXTERIOR_TECH) n'ont PAS acces a l'orchestrateur multi-agent.
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','SUPERVISOR')")
public class AgUiController {

    private static final Logger log = LoggerFactory.getLogger(AgUiController.class);
    private static final long SSE_TIMEOUT_MS = 5 * 60_000L;
    private static final String AGENT_NAME = "clenzy-supervisor";

    private final AgentOrchestrator orchestrator;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;
    private final PendingToolStore pendingToolStore;
    private final com.clenzy.service.agent.supervision.SupervisionActivityService supervisionActivityService;

    /** Pool SSE borné, même politique que {@code AssistantController}. */
    private final Executor sseExecutor = new ThreadPoolExecutor(
            10, 100, 60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(200),
            r -> {
                Thread t = new Thread(r, "agui-sse");
                t.setDaemon(true);
                return t;
            },
            new ThreadPoolExecutor.CallerRunsPolicy());

    public AgUiController(AgentOrchestrator orchestrator,
                          TenantContext tenantContext,
                          ObjectMapper objectMapper,
                          PendingToolStore pendingToolStore,
                          com.clenzy.service.agent.supervision.SupervisionActivityService supervisionActivityService) {
        this.orchestrator = orchestrator;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
        this.pendingToolStore = pendingToolStore;
        this.supervisionActivityService = supervisionActivityService;
    }

    /** Découverte AG-UI : liste les agents exposés par ce serveur. */
    @GetMapping("/info")
    public Map<String, Object> info() {
        return Map.of("agents", List.of(Map.of(
                "name", AGENT_NAME,
                "description", "Superviseur multi-agent Clenzy (orchestrateur + spécialistes)")));
    }

    /**
     * Liste les actions en attente de validation (HITL) du user courant.
     *
     * <p>Permet au front de réafficher les confirmations en suspens après un
     * reload de page : l'état de pause est persisté dans un index Redis scopé
     * par {@code keycloakId} (cf. {@link PendingToolStore}). Ownership strict —
     * un user ne voit QUE ses propres actions (le sujet JWT borne la lecture).</p>
     *
     * <p>Read-only : le {@code resume} (confirm/refus) reste {@code POST /api/agui/run}
     * avec {@code resume.interruptId = toolCallId}.</p>
     */
    @GetMapping("/pending")
    public List<PendingActionDto> pending(@AuthenticationPrincipal Jwt jwt) {
        return pendingToolStore.listForUser(jwt.getSubject());
    }

    /** Run AG-UI : reçoit un RunAgentInput, streame les événements AG-UI en SSE. */
    @PostMapping(value = "/run", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter run(@RequestBody JsonNode input, @AuthenticationPrincipal Jwt jwt) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        Long orgId = tenantContext.getRequiredOrganizationId();
        String keycloakId = jwt.getSubject();
        String locale = jwt.getClaimAsString("locale") != null ? jwt.getClaimAsString("locale") : "fr";

        String threadId = input.hasNonNull("threadId")
                ? input.get("threadId").asText() : "thread-" + UUID.randomUUID();

        JsonNode forwarded = input.get("forwardedProps");
        Long conversationId = nodeLong(forwarded, "conversationId");
        String currentPage = nodeText(forwarded, "currentPage");
        Long selectedPropertyId = nodeLong(forwarded, "selectedPropertyId");
        // HITL : le client AG-UI (useInterrupt) renvoie un tableau `resume` au
        // niveau RACINE du RunAgentInput (ResumeEntry[]). Repli historique :
        // forwardedProps.resume. La forme exacte de ResumeEntry est tracée au
        // 1er test (log dans le run) pour affiner le mapping.
        JsonNode resumeRoot = input.get("resume");
        final JsonNode resumeEntry = (resumeRoot != null && resumeRoot.isArray() && resumeRoot.size() > 0)
                ? resumeRoot.get(0)
                : (forwarded != null ? forwarded.get("resume") : null);
        String lastUserMessage = extractLastUserMessage(input);

        AgentContext context = new AgentContext(orgId, keycloakId, jwt, locale, currentPage, selectedPropertyId);

        // Capture tenant + security AVANT le switch de thread (cf. AssistantController).
        final boolean superAdmin = tenantContext.isSuperAdmin();
        final boolean systemOrg = tenantContext.isSystemOrg();
        final String countryCode = tenantContext.getCountryCode();
        final String defaultCurrency = tenantContext.getDefaultCurrency();
        final boolean vatRegistered = tenantContext.isVatRegistered();
        final SecurityContext capturedSecurity = SecurityContextHolder.getContext();

        final AgentSseEventToAgUi translator = new AgentSseEventToAgUi(threadId, objectMapper);

        sseExecutor.execute(() -> {
            tenantContext.setOrganizationId(orgId);
            tenantContext.setSuperAdmin(superAdmin);
            tenantContext.setSystemOrg(systemOrg);
            tenantContext.setCountryCode(countryCode);
            tenantContext.setDefaultCurrency(defaultCurrency);
            tenantContext.setVatRegistered(vatRegistered);
            if (capturedSecurity != null) {
                SecurityContextHolder.setContext(capturedSecurity);
            }
            try {
                translator.onStart().forEach(ev -> send(emitter, ev));
                Consumer<AgentSseEvent> consumer = e -> {
                    // Journalise l'activité réelle (best-effort) pour le feed/métriques
                    // de la constellation : un agent « agit » → une ligne d'activité.
                    if ("agent_activity".equals(e.type()) && "acting".equals(e.finishReason())
                            && selectedPropertyId != null) {
                        supervisionActivityService.recordAct(orgId, selectedPropertyId,
                                e.toolName(), e.displayHint(), e.toolResult());
                    }
                    translator.translate(e).forEach(ev -> send(emitter, ev));
                };

                if (resumeEntry != null && !resumeEntry.isNull()) {
                    log.info("AG-UI resume reçu (forme à confirmer) : {}", resumeEntry);
                    String toolCallId = firstText(resumeEntry, "interruptId", "id", "toolCallId");
                    String status = resumeEntry.path("status").asText("");
                    boolean confirmed = "cancelled".equals(status)
                            ? false
                            : "resolved".equals(status)
                                    ? resumeEntry.path("payload").path("confirmed").asBoolean(true)
                                    : resumeEntry.path("confirmed").asBoolean(false);
                    if (toolCallId != null) {
                        orchestrator.resumeAfterConfirmation(toolCallId, confirmed, context, consumer);
                    } else {
                        orchestrator.handleMessage(
                                conversationId, lastUserMessage, List.<AttachmentRef>of(), context, consumer);
                    }
                } else {
                    orchestrator.handleMessage(
                            conversationId, lastUserMessage, List.<AttachmentRef>of(), context, consumer);
                }
                emitter.complete();
            } catch (IllegalArgumentException e) {
                send(emitter, AgUiEvent.runError(e.getMessage()));
                emitter.complete();
            } catch (Exception e) {
                log.error("AgUiController.run failed", e);
                send(emitter, AgUiEvent.runError("Erreur interne : " + e.getMessage()));
                emitter.complete();
            } finally {
                tenantContext.clear();
                SecurityContextHolder.clearContext();
            }
        });

        return emitter;
    }

    /** Dernier message de rôle "user" du RunAgentInput (contenu texte). */
    private String extractLastUserMessage(JsonNode input) {
        JsonNode messages = input.get("messages");
        if (messages == null || !messages.isArray()) {
            return "";
        }
        String last = "";
        for (JsonNode m : messages) {
            if ("user".equals(m.path("role").asText())) {
                JsonNode content = m.get("content");
                last = content != null ? content.asText("") : "";
            }
        }
        return last;
    }

    private static Long nodeLong(JsonNode parent, String field) {
        return parent != null && parent.hasNonNull(field) ? parent.get(field).asLong() : null;
    }

    private static String nodeText(JsonNode parent, String field) {
        return parent != null && parent.hasNonNull(field) ? parent.get(field).asText() : null;
    }

    /** Premier champ texte non-nul parmi {@code fields} (forme ResumeEntry incertaine, cf. run). */
    private static String firstText(JsonNode node, String... fields) {
        for (String f : fields) {
            if (node.hasNonNull(f)) {
                return node.get(f).asText();
            }
        }
        return null;
    }

    /** Frame AG-UI : {@code data: {json}} (le client lit le champ {@code type} dans le JSON). */
    private void send(SseEmitter emitter, AgUiEvent event) {
        try {
            emitter.send(SseEmitter.event().data(objectMapper.writeValueAsString(event.payload())));
        } catch (IOException e) {
            log.debug("AG-UI SSE send failed (client disconnected?) : {}", e.getMessage());
        } catch (Exception e) {
            log.warn("AG-UI event serialization failed: {}", e.getMessage());
        }
    }
}
