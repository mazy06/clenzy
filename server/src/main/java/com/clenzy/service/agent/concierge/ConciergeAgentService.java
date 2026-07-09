package com.clenzy.service.agent.concierge;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.dto.ConversationAnalysisDto;
import com.clenzy.model.Conversation;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.User;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PlatformSettingsService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.ai.RunCreditGuard;
import com.clenzy.service.messaging.ConversationAiAssistService;
import com.clenzy.service.messaging.ConversationService;
import com.clenzy.tenant.TenantScopedExecutor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
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
 * ({@link TenantScopedExecutor}), métré par {@link RunCreditGuard}. Activation pilotée
 * <b>en base</b> ({@code platform_settings}, cf. {@link PlatformSettingsService}) —
 * modifiable depuis la plateforme sans redéploiement. Le brouillon suppose le master
 * plateforme {@code conciergeDraftEnabled} ET le module « com » de l'org non désactivé.
 * L'auto-envoi ajoute une garde : master {@code conciergeAutosendEnabled} ET autonomie
 * « com » ≥ NOTIFY ET classifieur conservateur ET palier premium atteint. Il est
 * sérialisé par conversation (verrou Redis) — jamais deux réponses.</p>
 */
@Service
public class ConciergeAgentService {

    private static final Logger log = LoggerFactory.getLogger(ConciergeAgentService.class);
    private static final String COM_MODULE_KEY = "com";
    private static final Duration LOCK_TTL = Duration.ofSeconds(30);
    /** Ordre croissant des forfaits — le palier premium borne l'auto-envoi (C4). */
    private static final List<String> FORFAIT_ORDER = List.of("essentiel", "confort", "premium");

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
    private final UserRepository userRepository;
    /**
     * Masters concierge (brouillon / auto-envoi / palier premium) pilotés en base
     * ({@code platform_settings}) — modifiables depuis la plateforme sans redéploiement,
     * pris en compte au prochain message guest entrant.
     */
    private final PlatformSettingsService platformSettings;

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
                                 UserRepository userRepository,
                                 PlatformSettingsService platformSettings) {
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
        this.userRepository = userRepository;
        this.platformSettings = platformSettings;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInboundMessage(InboundGuestMessageEvent event) {
        // Master plateforme (DB, hot-reload) : concierge coupé globalement → rien.
        if (!platformSettings.isConciergeDraftEnabled()
                || event.organizationId() == null || event.conversationId() == null) {
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
        // Réglage PAR ORG (module « Communication ») : un org peut couper son concierge
        // même si le master plateforme est actif. Absent → activé par défaut. Lu une
        // seule fois (sert aussi à résoudre l'autonomie pour l'auto-envoi).
        final SupervisionModuleSettings comSettings = moduleSettingsRepository
                .findByOrganizationIdAndModuleKey(orgId, COM_MODULE_KEY).orElse(null);
        if (comSettings != null && !comSettings.isEnabled()) {
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

            // Classification (déterministe, gratuite) : décide l'auto-envoi (C2) et
            // détecte les demandes cross-domaine à coordonner (C3).
            final ConciergeDecision decision =
                    classifier.classify(conversation.getLastMessagePreview(), analysis);
            // C2/C4 — auto-envoi sous quadruple garde. Évaluation courte-circuitée :
            // C1 reste un simple brouillon si l'auto-envoi est off. Le palier premium
            // (planAllowsAutosend) est vérifié en dernier — monétisation C4.
            final SupervisionAutonomy autonomy = comSettings != null
                    ? comSettings.getAutonomyLevel() : SupervisionAutonomy.SUGGEST;
            final boolean autoSend = platformSettings.isConciergeAutosendEnabled()
                    && autonomy != SupervisionAutonomy.SUGGEST
                    && decision.autoSendSafe()
                    && planAllowsAutosend(orgId);

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
            // C3 — demande à impact ops/revenue : escalade de coordination dédiée
            // (l'humain vérifie calendrier/prestataire). Sinon escalade sur négatif/urgent.
            if ("cross_domain".equals(decision.reason())) {
                escalateCoordination(orgId, conversation);
            } else if (analysis != null && (analysis.urgent() || isNegative(analysis))) {
                escalate(orgId, conversation, analysis);
            }
        } catch (RuntimeException e) {
            log.warn("Concierge : tour échoué (org={}, conv={}) : {}", orgId, conversationId, e.getMessage());
        } finally {
            runCreditGuard.endRun();
        }
    }

    /**
     * Palier premium (C4) : l'auto-envoi n'est ouvert qu'aux orgs dont le forfait
     * atteint le seuil configuré en base (défaut « premium »). Conservateur : forfait
     * inconnu / seuil mal configuré → refus (draft only).
     */
    private boolean planAllowsAutosend(Long orgId) {
        final String forfait = userRepository
                .findFirstByOrganizationIdAndStripeSubscriptionIdIsNotNull(orgId)
                .map(User::getForfait)
                .map(f -> f.toLowerCase(Locale.ROOT))
                .orElse("");
        final int have = FORFAIT_ORDER.indexOf(forfait);
        final int need = FORFAIT_ORDER.indexOf(
                platformSettings.getConciergeAutosendMinForfait().toLowerCase(Locale.ROOT));
        return have >= 0 && need >= 0 && have >= need;
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
        notifyOwner(orgId, conversation, "Message guest à traiter en priorité",
                "Sentiment " + analysis.sentiment() + (analysis.urgent() ? " · urgent" : ""));
    }

    /** C3 — la demande engage l'ops/revenue : l'humain coordonne avant de répondre. */
    private void escalateCoordination(Long orgId, Conversation conversation) {
        notifyOwner(orgId, conversation, "Demande guest à coordonner (ops / revenue)",
                "Impact calendrier / prestataire (prolongation, late checkout…). "
                        + "À vérifier et confirmer avant de répondre — un brouillon est prêt.");
    }

    private void notifyOwner(Long orgId, Conversation conversation, String title, String message) {
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
