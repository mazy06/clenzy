package com.clenzy.service.agent.concierge;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.dto.ConversationAnalysisDto;
import com.clenzy.model.Conversation;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.ai.RunCreditGuard;
import com.clenzy.service.messaging.ConversationAiAssistService;
import com.clenzy.tenant.TenantScopedExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Agent concierge guest — phase C1 (SUGGEST) : à chaque message guest ENTRANT,
 * prépare un <b>brouillon</b> de réponse IA attaché à la conversation. <b>Zéro
 * envoi automatique</b> — l'opérateur valide/édite/envoie (autonomie SUGGEST).
 *
 * <p>Découplé de la messagerie via un événement applicatif ; exécuté APRÈS
 * commit et en {@code @Async} (le webhook inbound rend un 200 immédiat), dans le
 * contexte tenant de l'org ({@link TenantScopedExecutor}), métré par
 * {@link RunCreditGuard}. Gaté par {@code clenzy.concierge.draft.enabled}
 * (défaut false — dormant tant que non activé, car chaque brouillon coûte un
 * appel LLM).</p>
 */
@Service
public class ConciergeAgentService {

    private static final Logger log = LoggerFactory.getLogger(ConciergeAgentService.class);
    private static final String COM_MODULE_KEY = "com";

    private final ConversationAiAssistService aiAssist;
    private final ConversationRepository conversationRepository;
    private final SupervisionActivityService activityService;
    private final NotificationService notificationService;
    private final RunCreditGuard runCreditGuard;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final ObjectMapper objectMapper;
    private final boolean draftEnabled;

    public ConciergeAgentService(ConversationAiAssistService aiAssist,
                                 ConversationRepository conversationRepository,
                                 SupervisionActivityService activityService,
                                 NotificationService notificationService,
                                 RunCreditGuard runCreditGuard,
                                 TenantScopedExecutor tenantScopedExecutor,
                                 ObjectMapper objectMapper,
                                 @Value("${clenzy.concierge.draft.enabled:false}") boolean draftEnabled) {
        this.aiAssist = aiAssist;
        this.conversationRepository = conversationRepository;
        this.activityService = activityService;
        this.notificationService = notificationService;
        this.runCreditGuard = runCreditGuard;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.objectMapper = objectMapper;
        this.draftEnabled = draftEnabled;
    }

    /**
     * Consomme l'événement de message entrant APRÈS commit (le brouillon lit une
     * conversation déjà persistée) et hors du thread du webhook ({@code @Async}).
     * Pose le contexte tenant explicitement (hors HTTP — règle audit Z2).
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInboundMessage(InboundGuestMessageEvent event) {
        if (!draftEnabled || event.organizationId() == null || event.conversationId() == null) {
            return;
        }
        tenantScopedExecutor.runAsOrganization(event.organizationId(),
                () -> generateDraft(event.organizationId(), event.conversationId()));
    }

    /**
     * Cœur testable : génère et persiste le brouillon (best-effort). Métré crédits :
     * si le solde est épuisé (pré-vol refusé), on n'appelle pas le LLM.
     */
    void generateDraft(Long orgId, Long conversationId) {
        final Conversation conversation = conversationRepository
                .findByIdAndOrganizationId(conversationId, orgId).orElse(null);
        if (conversation == null) {
            return;
        }
        if (!runCreditGuard.beginRun(orgId)) {
            log.info("Concierge C1 : brouillon non généré, crédits épuisés (org={})", orgId);
            return;
        }
        try {
            final ConversationAnalysisDto analysis = aiAssist.analyzeLastInbound(orgId, conversationId);
            final AiSuggestedResponseDto draft = aiAssist.suggestReply(orgId, conversationId);
            if (draft == null || draft.response() == null || draft.response().isBlank()) {
                return;
            }
            conversation.setAiDraftReply(draft.response());
            conversation.setAiDraftMeta(buildMeta(analysis, draft));
            conversationRepository.save(conversation);

            final Long propertyId = conversation.getProperty() != null
                    ? conversation.getProperty().getId() : null;
            if (propertyId != null) {
                activityService.recordModuleAct(orgId, propertyId, COM_MODULE_KEY,
                        "concierge_drafted", "Brouillon de réponse préparé pour le guest");
            }
            if (analysis != null && (analysis.urgent() || isNegative(analysis))) {
                escalate(orgId, conversation, analysis);
            }
        } catch (RuntimeException e) {
            log.warn("Concierge C1 : brouillon échoué (org={}, conv={}) : {}",
                    orgId, conversationId, e.getMessage());
        } finally {
            runCreditGuard.endRun();
        }
    }

    private void escalate(Long orgId, Conversation conversation, ConversationAnalysisDto analysis) {
        final String title = "Message guest à traiter en priorité";
        final String message = "Sentiment " + analysis.sentiment()
                + (analysis.urgent() ? " · urgent" : "");
        final String url = "/contact?highlight=" + conversation.getId();
        if (conversation.getAssignedToKeycloakId() != null) {
            notificationService.notify(conversation.getAssignedToKeycloakId(),
                    NotificationKey.CONCIERGE_ESCALATION, title, message, url);
        } else {
            notificationService.notifyAdminsAndManagersByOrgId(orgId,
                    NotificationKey.CONCIERGE_ESCALATION, title, message, url);
        }
    }

    private static boolean isNegative(ConversationAnalysisDto analysis) {
        return analysis.sentiment() != null
                && analysis.sentiment().toUpperCase(java.util.Locale.ROOT).contains("NEG");
    }

    private String buildMeta(ConversationAnalysisDto analysis, AiSuggestedResponseDto draft) {
        final Map<String, Object> meta = new LinkedHashMap<>();
        if (analysis != null) {
            meta.put("sentiment", analysis.sentiment());
            meta.put("sentimentScore", analysis.score());
            meta.put("urgent", analysis.urgent());
        }
        meta.put("tone", draft.tone());
        meta.put("language", draft.language());
        try {
            return objectMapper.writeValueAsString(meta);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            return "{}";
        }
    }
}
