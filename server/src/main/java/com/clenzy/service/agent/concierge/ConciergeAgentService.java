package com.clenzy.service.agent.concierge;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.dto.ConversationAnalysisDto;
import com.clenzy.model.Conversation;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.ai.RunCreditGuard;
import com.clenzy.service.messaging.ConversationAiAssistService;
import com.clenzy.service.messaging.ConversationService;
import com.clenzy.tenant.TenantScopedExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Agent concierge guest.
 *
 * <ul>
 *   <li><b>C1 (SUGGEST)</b> — à chaque message guest entrant, prépare un
 *       <b>brouillon</b> de réponse IA attaché à la conversation (zéro envoi) ;</li>
 *   <li><b>C2 (NOTIFY/FULL)</b> — si l'org l'autorise ET que le message est une
 *       intention FAQ sûre, <b>envoie</b> la réponse automatiquement, étiquetée IA ;
 *       sinon retombe sur le brouillon + escalade sur signal négatif/urgent.</li>
 * </ul>
 *
 * <p>Exécuté APRÈS commit, en {@code @Async}, dans le contexte tenant de l'org
 * ({@link TenantScopedExecutor}), métré par {@link RunCreditGuard}. Double garde
 * pour l'auto-envoi (risque de marque) : flag {@code clenzy.concierge.autosend.enabled}
 * (défaut false) ET autonomie du module « com » ≥ NOTIFY ET classifieur conservateur.
 * L'auto-envoi est sérialisé par conversation (verrou Redis) — jamais deux réponses.</p>
 */
@Service
public class ConciergeAgentService {

    private static final Logger log = LoggerFactory.getLogger(ConciergeAgentService.class);
    private static final String COM_MODULE_KEY = "com";
    private static final Duration LOCK_TTL = Duration.ofSeconds(30);

    private final ConversationAiAssistService aiAssist;
    private final ConversationRepository conversationRepository;
    private final ConversationService conversationService;
    private final SupervisionModuleSettingsRepository moduleSettingsRepository;
    private final ConciergeIntentClassifier classifier;
    private final SupervisionActivityService activityService;
    private final NotificationService notificationService;
    private final RunCreditGuard runCreditGuard;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final boolean draftEnabled;
    private final boolean autosendEnabled;

    public ConciergeAgentService(ConversationAiAssistService aiAssist,
                                 ConversationRepository conversationRepository,
                                 ConversationService conversationService,
                                 SupervisionModuleSettingsRepository moduleSettingsRepository,
                                 ConciergeIntentClassifier classifier,
                                 SupervisionActivityService activityService,
                                 NotificationService notificationService,
                                 RunCreditGuard runCreditGuard,
                                 TenantScopedExecutor tenantScopedExecutor,
                                 StringRedisTemplate redisTemplate,
                                 ObjectMapper objectMapper,
                                 @Value("${clenzy.concierge.draft.enabled:false}") boolean draftEnabled,
                                 @Value("${clenzy.concierge.autosend.enabled:false}") boolean autosendEnabled) {
        this.aiAssist = aiAssist;
        this.conversationRepository = conversationRepository;
        this.conversationService = conversationService;
        this.moduleSettingsRepository = moduleSettingsRepository;
        this.classifier = classifier;
        this.activityService = activityService;
        this.notificationService = notificationService;
        this.runCreditGuard = runCreditGuard;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.draftEnabled = draftEnabled;
        this.autosendEnabled = autosendEnabled;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInboundMessage(InboundGuestMessageEvent event) {
        if (!draftEnabled || event.organizationId() == null || event.conversationId() == null) {
            return;
        }
        tenantScopedExecutor.runAsOrganization(event.organizationId(),
                () -> processInbound(event.organizationId(), event.conversationId()));
    }

    /** Cœur testable : brouillon (C1) ou auto-envoi gardé (C2). Best-effort, métré. */
    void processInbound(Long orgId, Long conversationId) {
        final Conversation conversation = conversationRepository
                .findByIdAndOrganizationId(conversationId, orgId).orElse(null);
        if (conversation == null) {
            return;
        }
        if (!runCreditGuard.beginRun(orgId)) {
            log.info("Concierge : run refusé, crédits épuisés (org={})", orgId);
            return;
        }
        try {
            final ConversationAnalysisDto analysis = aiAssist.analyzeLastInbound(orgId, conversationId);
            final AiSuggestedResponseDto draft = aiAssist.suggestReply(orgId, conversationId);
            if (draft == null || draft.response() == null || draft.response().isBlank()) {
                return;
            }

            // C2 — décision d'auto-envoi (triple garde). Non évaluée si l'auto-envoi
            // est désactivé → comportement C1 strict (brouillon).
            boolean autoSend = false;
            if (autosendEnabled && resolveAutonomy(orgId) != SupervisionAutonomy.SUGGEST) {
                autoSend = classifier.classify(conversation.getLastMessagePreview(), analysis).autoSendSafe();
            }

            if (autoSend && acquireLock(conversationId)) {
                try {
                    conversationService.sendAutonomousMessage(conversation, draft.response());
                    conversation.setAiDraftReply(null);
                    conversation.setAiDraftMeta(null);
                    conversationRepository.save(conversation);
                    recordFeed(orgId, conversation, "concierge_replied",
                            "Réponse envoyée automatiquement au guest");
                } finally {
                    releaseLock(conversationId);
                }
                return;
            }

            // C1 — brouillon (jamais envoyé sans validation).
            conversation.setAiDraftReply(draft.response());
            conversation.setAiDraftMeta(buildMeta(analysis, draft));
            conversationRepository.save(conversation);
            recordFeed(orgId, conversation, "concierge_drafted",
                    "Brouillon de réponse préparé pour le guest");
            if (analysis != null && (analysis.urgent() || isNegative(analysis))) {
                escalate(orgId, conversation, analysis);
            }
        } catch (RuntimeException e) {
            log.warn("Concierge : tour échoué (org={}, conv={}) : {}", orgId, conversationId, e.getMessage());
        } finally {
            runCreditGuard.endRun();
        }
    }

    private SupervisionAutonomy resolveAutonomy(Long orgId) {
        return moduleSettingsRepository.findByOrganizationIdAndModuleKey(orgId, COM_MODULE_KEY)
                .map(SupervisionModuleSettings::getAutonomyLevel)
                .orElse(SupervisionAutonomy.SUGGEST);
    }

    private boolean acquireLock(Long conversationId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.opsForValue()
                    .setIfAbsent("concierge:lock:" + conversationId, "1", LOCK_TTL));
        } catch (RuntimeException e) {
            // Redis indisponible : on NE prend PAS le risque d'un double envoi.
            log.warn("Concierge : verrou Redis indisponible (conv={}) — auto-envoi ignoré", conversationId);
            return false;
        }
    }

    private void releaseLock(Long conversationId) {
        try {
            redisTemplate.delete("concierge:lock:" + conversationId);
        } catch (RuntimeException ignored) {
            // Le TTL relâchera le verrou.
        }
    }

    private void recordFeed(Long orgId, Conversation conversation, String tool, String summary) {
        final Long propertyId = conversation.getProperty() != null
                ? conversation.getProperty().getId() : null;
        if (propertyId != null) {
            activityService.recordModuleAct(orgId, propertyId, COM_MODULE_KEY, tool, summary);
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
                && analysis.sentiment().toUpperCase(Locale.ROOT).contains("NEG");
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
