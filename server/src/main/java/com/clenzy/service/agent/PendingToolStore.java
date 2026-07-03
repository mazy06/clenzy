package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.service.agent.multiagent.MultiAgentPendingContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Store des executions de tools en attente de confirmation user (HITL).
 *
 * <p>Quand l'orchestrateur croise un tool {@code requiresConfirmation=true},
 * il emet un evenement SSE {@code tool_confirmation_request} et persiste le
 * contexte d'execution dans ce store. Le frontend renvoie la decision via le
 * {@code resume} AG-UI ({@code POST /api/agui/run}) qui consulte le store,
 * reprend l'execution (ou ecrit un resultat "annule par user").</p>
 *
 * <h2>Deux niveaux de persistance</h2>
 * <ul>
 *   <li><b>Etat de reprise (in-memory)</b> : le graphe complet necessaire au
 *       resume — historique conversationnel, JWT, contexte multi-agent — reste
 *       en memoire JVM ({@link #store}). Il est volatil : un reboot du
 *       pms-server pendant qu'un user a un dialog ouvert invalide la reprise
 *       (message "session expiree", comportement deja accepte). Ce graphe porte
 *       un {@code Jwt} + des objets de moteur multi-agent non serialisables
 *       proprement — on ne tente PAS de le persister.</li>
 *   <li><b>Index "en attente" (Redis, scope user)</b> : une vue legere
 *       ({@link PendingActionDto}) de chaque action en attente est ecrite dans
 *       un hash Redis keye par {@code keycloakId}. Elle survit a un reload de
 *       page : le front interroge {@code GET /api/agui/pending} pour reafficher
 *       les confirmations en suspens. Les ecritures/lectures Redis sont
 *       best-effort — une panne Redis ne casse JAMAIS le flow pause/confirm/resume.</li>
 * </ul>
 *
 * <p><b>TTL</b> : 30 minutes (aligne entre l'expiration in-memory et le TTL
 * Redis). Au-dela, l'action est consideree abandonnee.</p>
 */
@Service
public class PendingToolStore {

    private static final Logger log = LoggerFactory.getLogger(PendingToolStore.class);
    static final Duration TTL = Duration.ofMinutes(30);
    private static final long TTL_MS = TTL.toMillis();
    /** Prefixe des cles Redis ; un hash par user (field = toolCallId, value = JSON DTO). */
    private static final String REDIS_KEY_PREFIX = "agui:pending:";
    /** Coupe le resume des arguments pour eviter de stocker des payloads volumineux. */
    private static final int ARGS_SUMMARY_MAX_LEN = 500;

    private final Map<String, PendingTool> store = new ConcurrentHashMap<>();
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    /**
     * Journal durable des pauses (X1) : reprise mono post-reboot, fallback
     * d'affichage si Redis est perdu, et donnee d'apprentissage X2 (outcomes).
     * Nullable (tests) — toutes les ecritures sont best-effort.
     */
    private final com.clenzy.repository.AgentPendingActionRepository pendingActionRepository;

    @Autowired
    public PendingToolStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper,
                            com.clenzy.repository.AgentPendingActionRepository pendingActionRepository) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.pendingActionRepository = pendingActionRepository;
    }

    /** Retro-compat (pre-X1) : sans journal durable. */
    public PendingToolStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this(redisTemplate, objectMapper, null);
    }

    /**
     * Constructeur "in-memory uniquement" (pas d'index Redis ni de journal
     * durable). Réservé aux tests qui ne couvrent que le flux
     * pause/confirm/resume mono ou multi-agent.
     */
    public PendingToolStore() {
        this(null, null, null);
    }

    private boolean redisEnabled() {
        return redisTemplate != null && objectMapper != null;
    }

    /**
     * Enregistre un tool en attente de confirmation. Cle = toolCallId (unique
     * par tour de LLM, fourni par le provider dans le tool_use block).
     *
     * <p>Si une entree existe deja avec ce toolCallId, elle est ecrasee — ne
     * doit pas arriver en pratique car les IDs sont uniques.</p>
     */
    public void put(String toolCallId,
                     Long conversationId,
                     Long organizationId,
                     String keycloakId,
                     String toolName,
                     String argsJson,
                     List<ChatMessage> pendingHistory) {
        put(toolCallId, conversationId, organizationId, keycloakId,
                toolName, argsJson, pendingHistory, null, null);
    }

    /**
     * Variante HITL multi-agent : porte en plus un {@link MultiAgentPendingContext}
     * decrivant l'etat d'orchestration a reprendre. Quand ce contexte est present,
     * {@code AgentOrchestrator.resumeAfterConfirmation} re-entre dans le flow
     * multi-agent au lieu du mono-agent.
     */
    public void put(String toolCallId,
                     Long conversationId,
                     Long organizationId,
                     String keycloakId,
                     String toolName,
                     String argsJson,
                     List<ChatMessage> pendingHistory,
                     MultiAgentPendingContext multiAgentContext) {
        put(toolCallId, conversationId, organizationId, keycloakId,
                toolName, argsJson, pendingHistory, multiAgentContext, null);
    }

    /**
     * Forme complete : porte en plus une {@code description} lisible du tool,
     * utilisee uniquement pour l'index Redis "en attente" (re-affichage front).
     *
     * <p>Le flux mono-agent et le flux multi-agent passent par cette methode ;
     * leur comportement de reprise reste strictement inchange (l'index Redis est
     * un effet de bord best-effort, jamais sur le chemin critique).</p>
     */
    public void put(String toolCallId,
                     Long conversationId,
                     Long organizationId,
                     String keycloakId,
                     String toolName,
                     String argsJson,
                     List<ChatMessage> pendingHistory,
                     MultiAgentPendingContext multiAgentContext,
                     String description) {
        cleanupExpired();
        Instant createdAt = Instant.now();
        Instant expiresAt = createdAt.plusMillis(TTL_MS);
        store.put(toolCallId, new PendingTool(
                toolCallId, conversationId, organizationId, keycloakId,
                toolName, argsJson, pendingHistory, multiAgentContext,
                expiresAt
        ));
        indexInRedis(keycloakId, new PendingActionDto(
                toolCallId, toolName, description, summarizeArgs(argsJson),
                conversationId, createdAt,
                multiAgentContext != null ? multiAgentContext.specialistName() : null));
        persistDurable(toolCallId, conversationId, organizationId, keycloakId,
                toolName, argsJson, description, pendingHistory, multiAgentContext, expiresAt);
        log.debug("PendingToolStore.put toolCallId={} tool={} multiAgent={} (store size={})",
                toolCallId, toolName, multiAgentContext != null, store.size());
    }

    /**
     * Recupere une entree par toolCallId, en validant l'ownership user, et la
     * retire de l'index Redis "en attente".
     *
     * @return present si l'entree existe, n'est pas expiree, et appartient au user.
     */
    public Optional<PendingTool> consume(String toolCallId, String requestKeycloakId) {
        cleanupExpired();
        PendingTool tool = store.remove(toolCallId);
        if (tool == null) {
            // X1 : reprise post-reboot — le flux MONO est reconstruit depuis le
            // journal durable (le multi porte un etat moteur volatil, non couvert).
            Optional<PendingTool> recovered = recoverFromDatabase(toolCallId, requestKeycloakId);
            if (recovered.isPresent()) {
                removeFromRedis(requestKeycloakId, toolCallId);
                return recovered;
            }
            log.debug("PendingToolStore.consume miss for toolCallId={}", toolCallId);
            // Best-effort : nettoyer un eventuel residu Redis (resume apres reboot
            // ou entree orpheline) pour que le front ne re-affiche pas une action
            // qui n'est plus reprenable.
            removeFromRedis(requestKeycloakId, toolCallId);
            return Optional.empty();
        }
        if (!tool.keycloakId().equals(requestKeycloakId)) {
            log.warn("PendingToolStore: ownership mismatch on consume of toolCallId={} (expected={}, actual={})",
                    toolCallId, tool.keycloakId(), requestKeycloakId);
            // On a deja retire l'entree memoire (remove) : la remettre serait
            // racy et l'ownership a echoue de toute facon. On ne touche PAS a
            // l'index Redis du proprietaire legitime.
            return Optional.empty();
        }
        removeFromRedis(tool.keycloakId(), toolCallId);
        if (Instant.now().isAfter(tool.expiresAt())) {
            log.debug("PendingToolStore.consume expired for toolCallId={}", toolCallId);
            return Optional.empty();
        }
        return Optional.of(tool);
    }

    /**
     * Liste les actions en attente du user courant (ownership strict : un user
     * ne voit QUE ses propres actions, garanti par le scope de la cle Redis).
     *
     * <p>Lecture read-only depuis l'index Redis : survit a un reload de page.
     * Les entrees expirees sont filtrees. En cas d'indisponibilite Redis, on
     * renvoie une liste vide plutot que de propager une erreur.</p>
     */
    public List<PendingActionDto> listForUser(String keycloakId) {
        if (keycloakId == null || keycloakId.isBlank()) {
            return List.of();
        }
        if (!redisEnabled()) {
            // X1 : sans index Redis, le journal durable fait autorite.
            return listFromDatabase(keycloakId);
        }
        try {
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(redisKey(keycloakId));
            if (entries == null || entries.isEmpty()) {
                // X1 : index Redis vide/perdu → fallback sur le journal durable
                // (fin de la « perte silencieuse » relevee par l'audit Phase 0).
                return listFromDatabase(keycloakId);
            }
            List<PendingActionDto> result = new ArrayList<>(entries.size());
            for (Object value : entries.values()) {
                if (value == null) {
                    continue;
                }
                try {
                    result.add(objectMapper.readValue(value.toString(), PendingActionDto.class));
                } catch (Exception parseError) {
                    log.warn("PendingToolStore: entree Redis illisible pour user={}, ignoree : {}",
                            keycloakId, parseError.getMessage());
                }
            }
            result.sort(Comparator.comparing(
                    PendingActionDto::createdAt, Comparator.nullsLast(Comparator.naturalOrder())));
            return result;
        } catch (Exception e) {
            log.warn("PendingToolStore.listForUser: lecture Redis impossible (user={}) : {}",
                    keycloakId, e.getMessage());
            return listFromDatabase(keycloakId);
        }
    }

    /**
     * Consigne la resolution d'une action (X1) : CONFIRMED/REFUSED au journal
     * durable — la matiere premiere des Regles de Confiance (X2). Best-effort.
     */
    public void markResolved(String toolCallId, boolean confirmed) {
        if (pendingActionRepository == null || toolCallId == null) {
            return;
        }
        try {
            pendingActionRepository.findById(toolCallId).ifPresent(action -> {
                if (com.clenzy.model.AgentPendingAction.STATUS_PENDING.equals(action.getStatus())) {
                    action.resolve(confirmed
                            ? com.clenzy.model.AgentPendingAction.STATUS_CONFIRMED
                            : com.clenzy.model.AgentPendingAction.STATUS_REFUSED);
                    pendingActionRepository.save(action);
                }
            });
        } catch (Exception e) {
            log.warn("PendingToolStore.markResolved: journalisation impossible pour {} : {}",
                    toolCallId, e.getMessage());
        }
    }

    /** Visible for testing. */
    int size() { return store.size(); }

    // ─── Journal durable Postgres (X1, best-effort) ─────────────────────────

    private void persistDurable(String toolCallId, Long conversationId, Long organizationId,
                                String keycloakId, String toolName, String argsJson,
                                String description, List<ChatMessage> pendingHistory,
                                MultiAgentPendingContext multiAgentContext, Instant expiresAt) {
        if (pendingActionRepository == null) {
            return;
        }
        try {
            boolean multiAgent = multiAgentContext != null;
            // Le multi-agent porte un etat moteur + JWT non serialisables → pas
            // de payload de reprise (journalise pour l'affichage + l'apprentissage X2).
            String historyJson = multiAgent ? null : serializeHistoryStripped(pendingHistory);
            pendingActionRepository.save(new com.clenzy.model.AgentPendingAction(
                    toolCallId, organizationId, keycloakId, conversationId, toolName,
                    argsJson, description,
                    multiAgent ? multiAgentContext.specialistName() : null,
                    multiAgent, historyJson, expiresAt));
        } catch (Exception e) {
            log.warn("PendingToolStore.persistDurable: journalisation impossible pour {} : {}",
                    toolCallId, e.getMessage());
        }
    }

    /**
     * Reprise post-reboot (X1, flux MONO uniquement) : reconstruit le
     * {@link PendingTool} depuis le journal durable. Ownership + expiration
     * valides ici — memes garanties que le chemin memoire.
     */
    private Optional<PendingTool> recoverFromDatabase(String toolCallId, String requestKeycloakId) {
        if (pendingActionRepository == null || objectMapper == null) {
            return Optional.empty();
        }
        try {
            var row = pendingActionRepository.findById(toolCallId).orElse(null);
            if (row == null
                    || !com.clenzy.model.AgentPendingAction.STATUS_PENDING.equals(row.getStatus())
                    || Instant.now().isAfter(row.getExpiresAt())) {
                return Optional.empty();
            }
            if (!row.getKeycloakUserId().equals(requestKeycloakId)) {
                log.warn("PendingToolStore: ownership mismatch on DB recovery of toolCallId={}", toolCallId);
                return Optional.empty();
            }
            if (row.isMultiAgent() || row.getPayloadHistoryJson() == null) {
                log.info("PendingToolStore: reprise post-reboot impossible pour {} (multi-agent "
                        + "ou payload absent) — l'action expirera", toolCallId);
                return Optional.empty();
            }
            List<ChatMessage> history = objectMapper.readValue(row.getPayloadHistoryJson(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, ChatMessage.class));
            log.info("PendingToolStore: reprise post-reboot du toolCallId={} depuis le journal durable",
                    toolCallId);
            return Optional.of(new PendingTool(
                    row.getToolCallId(), row.getConversationId(), row.getOrganizationId(),
                    row.getKeycloakUserId(), row.getToolName(), row.getArgsJson(),
                    history, null, row.getExpiresAt()));
        } catch (Exception e) {
            log.warn("PendingToolStore.recoverFromDatabase: echec pour {} : {}",
                    toolCallId, e.getMessage());
            return Optional.empty();
        }
    }

    private List<PendingActionDto> listFromDatabase(String keycloakId) {
        if (pendingActionRepository == null) {
            return List.of();
        }
        try {
            return pendingActionRepository
                    .findByKeycloakUserIdAndStatusAndExpiresAtAfterOrderByCreatedAtAsc(
                            keycloakId, com.clenzy.model.AgentPendingAction.STATUS_PENDING, Instant.now())
                    .stream()
                    .map(a -> new PendingActionDto(a.getToolCallId(), a.getToolName(),
                            a.getDescription(), summarizeArgs(a.getArgsJson()),
                            a.getConversationId(), a.getCreatedAt(), a.getSpecialist()))
                    .toList();
        } catch (Exception e) {
            log.warn("PendingToolStore.listFromDatabase: lecture impossible (user={}) : {}",
                    keycloakId, e.getMessage());
            return List.of();
        }
    }

    /**
     * Serialise l'historique de reprise en strippant les images base64 (poids +
     * PII) — remplacees par le placeholder etabli en T-04. La reprise mono
     * post-reboot se fait alors sans le visuel, l'analyse du tour 1 etant deja
     * dans l'historique.
     */
    private String serializeHistoryStripped(List<ChatMessage> pendingHistory) {
        if (pendingHistory == null || objectMapper == null) {
            return null;
        }
        try {
            List<ChatMessage> stripped = pendingHistory.stream()
                    .map(m -> (m.attachments() == null || m.attachments().isEmpty()) ? m
                            : new ChatMessage(m.role(),
                                    (m.content() == null || m.content().isBlank()
                                            ? ConversationHistoryMapper.PAST_IMAGE_PLACEHOLDER
                                            : m.content() + "\n" + ConversationHistoryMapper.PAST_IMAGE_PLACEHOLDER),
                                    m.toolCalls(), m.toolCallId(), null))
                    .toList();
            return objectMapper.writeValueAsString(stripped);
        } catch (Exception e) {
            log.warn("PendingToolStore: serialisation de l'historique impossible : {}", e.getMessage());
            return null;
        }
    }

    private void cleanupExpired() {
        Instant now = Instant.now();
        store.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));
    }

    // ─── Index Redis (best-effort, hors chemin critique) ────────────────────

    private void indexInRedis(String keycloakId, PendingActionDto dto) {
        if (!redisEnabled() || keycloakId == null || keycloakId.isBlank()) {
            return;
        }
        try {
            String key = redisKey(keycloakId);
            redisTemplate.opsForHash().put(key, dto.toolCallId(),
                    objectMapper.writeValueAsString(dto));
            // TTL rafraichi sur la cle entiere a chaque put : la fenetre glisse
            // tant que de nouvelles actions arrivent (acceptable — TTL = garde-fou).
            redisTemplate.expire(key, TTL);
        } catch (Exception e) {
            log.warn("PendingToolStore: indexation Redis echouee pour toolCallId={} : {}",
                    dto.toolCallId(), e.getMessage());
        }
    }

    private void removeFromRedis(String keycloakId, String toolCallId) {
        if (!redisEnabled() || keycloakId == null || keycloakId.isBlank()) {
            return;
        }
        try {
            redisTemplate.opsForHash().delete(redisKey(keycloakId), toolCallId);
        } catch (Exception e) {
            log.warn("PendingToolStore: suppression Redis echouee pour toolCallId={} : {}",
                    toolCallId, e.getMessage());
        }
    }

    private static String redisKey(String keycloakId) {
        return REDIS_KEY_PREFIX + keycloakId;
    }

    private static String summarizeArgs(String argsJson) {
        if (argsJson == null || argsJson.isBlank()) {
            return null;
        }
        String trimmed = argsJson.trim();
        return trimmed.length() <= ARGS_SUMMARY_MAX_LEN
                ? trimmed
                : trimmed.substring(0, ARGS_SUMMARY_MAX_LEN) + "…";
    }

    /**
     * Snapshot d'une execution de tool suspendue. Immutable.
     *
     * @param toolCallId      id du tool_use
     * @param conversationId  id de la conv pour reprendre la persistance
     * @param organizationId  org du user (multi-tenant safety)
     * @param keycloakId      sujet du user — pour valider l'ownership a la reprise
     * @param toolName        nom du tool a executer si user confirme
     * @param argsJson        arguments JSON (sera reparse a l'execution)
     * @param pendingHistory  historique de la conversation jusqu'au point de pause
     *                        (necessaire pour le LLM call suivant). En mode multi-agent,
     *                        c'est l'historique de l'AgentOrchestrator BDD (persistance) ;
     *                        l'etat de reprise du moteur multi-agent est dans
     *                        {@code multiAgentContext}.
     * @param multiAgentContext contexte de reprise du flow multi-agent (null = flux
     *                        mono-agent classique). Quand present, la reprise re-entre
     *                        dans le multi-agent (specialist + orchestrator).
     * @param expiresAt       expiration (au-dela, le tool est considere comme abandonne)
     */
    public record PendingTool(
            String toolCallId,
            Long conversationId,
            Long organizationId,
            String keycloakId,
            String toolName,
            String argsJson,
            List<ChatMessage> pendingHistory,
            MultiAgentPendingContext multiAgentContext,
            Instant expiresAt
    ) {
        /** {@code true} si la reprise doit re-entrer dans le flow multi-agent. */
        public boolean isMultiAgent() {
            return multiAgentContext != null;
        }
    }
}
