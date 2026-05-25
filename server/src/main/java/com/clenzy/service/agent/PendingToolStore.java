package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Store en memoire des executions de tools en attente de confirmation user.
 *
 * <p>Quand l'orchestrateur croise un tool {@code requiresConfirmation=true},
 * il emet un evenement SSE {@code tool_confirmation_request} et persiste le
 * contexte d'execution dans ce store. Le frontend renvoie la decision via
 * {@code POST /assistant/tool-confirm} qui consulte le store, reprend
 * l'execution (ou ecrit un resultat "annule par user").</p>
 *
 * <p><b>TTL</b> : 10 minutes par defaut. Si l'utilisateur tarde, l'entree est
 * nettoyee — il devra recommencer la conversation. Pas d'enjeu de persistance
 * BDD : une conversation en pause expiree est annulee silencieusement.</p>
 *
 * <p><b>Pas de Redis</b> : on tient en memoire JVM. C'est OK car les tools
 * de confirmation sont temporaires (utilisateur attend juste sa reponse).
 * Si le pms-server reboot pendant qu'un user a un dialog ouvert, il aura
 * juste un message d'erreur "session expiree" — comportement acceptable.</p>
 */
@Service
public class PendingToolStore {

    private static final Logger log = LoggerFactory.getLogger(PendingToolStore.class);
    private static final long TTL_MS = 10 * 60_000L; // 10 minutes

    private final Map<String, PendingTool> store = new ConcurrentHashMap<>();

    /**
     * Enregistre un tool en attente de confirmation. Cle = toolCallId (unique
     * par tour de LLM, fourni par Anthropic dans le tool_use block).
     *
     * <p>Si une entree existe deja avec ce toolCallId, elle est ecrasee — ne
     * doit pas arriver en pratique car Anthropic genere des IDs uniques.</p>
     */
    public void put(String toolCallId,
                     Long conversationId,
                     Long organizationId,
                     String keycloakId,
                     String toolName,
                     String argsJson,
                     List<ChatMessage> pendingHistory) {
        cleanupExpired();
        store.put(toolCallId, new PendingTool(
                toolCallId, conversationId, organizationId, keycloakId,
                toolName, argsJson, pendingHistory,
                Instant.now().plusMillis(TTL_MS)
        ));
        log.debug("PendingToolStore.put toolCallId={} tool={} (store size={})",
                toolCallId, toolName, store.size());
    }

    /**
     * Recupere une entree par toolCallId, en validant l'ownership user.
     *
     * @return present si l'entree existe, n'est pas expiree, et appartient au user.
     */
    public Optional<PendingTool> consume(String toolCallId, String requestKeycloakId) {
        cleanupExpired();
        PendingTool tool = store.remove(toolCallId);
        if (tool == null) {
            log.debug("PendingToolStore.consume miss for toolCallId={}", toolCallId);
            return Optional.empty();
        }
        if (!tool.keycloakId().equals(requestKeycloakId)) {
            log.warn("PendingToolStore: ownership mismatch on consume of toolCallId={} (expected={}, actual={})",
                    toolCallId, tool.keycloakId(), requestKeycloakId);
            return Optional.empty();
        }
        if (Instant.now().isAfter(tool.expiresAt())) {
            log.debug("PendingToolStore.consume expired for toolCallId={}", toolCallId);
            return Optional.empty();
        }
        return Optional.of(tool);
    }

    /** Visible for testing. */
    int size() { return store.size(); }

    private void cleanupExpired() {
        Instant now = Instant.now();
        store.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt()));
    }

    /**
     * Snapshot d'une execution de tool suspendue. Immutable.
     *
     * @param toolCallId      id du tool_use Anthropic
     * @param conversationId  id de la conv pour reprendre la persistance
     * @param organizationId  org du user (multi-tenant safety)
     * @param keycloakId      sujet du user — pour valider l'ownership a la reprise
     * @param toolName        nom du tool a executer si user confirme
     * @param argsJson        arguments JSON (sera reparse a l'execution)
     * @param pendingHistory  historique de la conversation jusqu'au point de pause
     *                        (necessaire pour le LLM call suivant)
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
            Instant expiresAt
    ) {}
}
