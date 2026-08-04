package com.clenzy.service.messaging;

import com.clenzy.config.ai.AiRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.MessageDirection;
import com.clenzy.model.MessageIntent;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.MessageIntentRepository;
import com.clenzy.service.AiAnonymizationService;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.service.agent.concierge.InboundGuestMessageEvent;
import com.clenzy.tenant.TenantScopedExecutor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;

/**
 * M8 — classification des messages ENTRANTS de voyageurs en intentions structurées
 * ({@link MessageIntent}). Écoute le même événement que le concierge IA, dans son
 * propre thread : la classification n'est PAS sur le chemin du message.
 *
 * <p>Best-effort assumé : budget IA épuisé, feature coupée, LLM en échec ou JSON
 * illisible → pas d'intent, jamais d'erreur remontée. Gates : conversation liée à
 * un séjour actif/à venir, dédup stricte par message. La sortie alimente les cartes
 * LATE_CHECKOUT_APPROVAL / STAY_MODIFICATION et le producteur « réclamation » de
 * CONVERSATION_TAKEOVER — qui re-vérifient TOUT côté scanner/apply : l'intent est
 * un signal, pas une décision.</p>
 */
@Service
public class MessageIntentClassifier {

    private static final Logger log = LoggerFactory.getLogger(MessageIntentClassifier.class);

    static final String SYSTEM_PROMPT = """
            Tu classifies un message de voyageur (location courte durée) en intention.
            Réponds UNIQUEMENT un objet JSON strict, sans texte autour :
            {"intent":"LATE_CHECKOUT_REQUEST|EARLY_CHECKIN_REQUEST|STAY_CHANGE_REQUEST|CANCELLATION_REQUEST|COMPLAINT|QUESTION|OTHER",
             "confidence":0.0,
             "extracted":{"requestedTime":"HH:mm ou null","newCheckIn":"YYYY-MM-DD ou null","newCheckOut":"YYYY-MM-DD ou null"}}
            Règles : confidence entre 0 et 1 ; n'extrais une date/heure QUE si le message
            la donne explicitement ; STAY_CHANGE_REQUEST = demande de changer les dates du
            séjour ; COMPLAINT = insatisfaction/problème sérieux, pas une simple question.""";

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final MessageIntentRepository intentRepository;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final AiAnonymizationService anonymizationService;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public MessageIntentClassifier(ConversationRepository conversationRepository,
                                   ConversationMessageRepository messageRepository,
                                   MessageIntentRepository intentRepository,
                                   AiProviderRouter aiProviderRouter,
                                   AiTokenBudgetService tokenBudgetService,
                                   AiAnonymizationService anonymizationService,
                                   TenantScopedExecutor tenantScopedExecutor,
                                   ObjectMapper objectMapper,
                                   Clock clock) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.intentRepository = intentRepository;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.anonymizationService = anonymizationService;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInboundMessage(InboundGuestMessageEvent event) {
        if (event.organizationId() == null || event.conversationId() == null) {
            return;
        }
        try {
            tenantScopedExecutor.runAsOrganization(event.organizationId(),
                    () -> classifyLastInbound(event.organizationId(), event.conversationId()));
        } catch (Exception e) {
            // Best-effort par contrat M8 : un échec de classification ne doit jamais
            // perturber le flux du message (le concierge, lui, a son propre listener).
            log.warn("Classification d'intent en échec (org={}, conversation={}) : {}",
                    event.organizationId(), event.conversationId(), e.getMessage());
        }
    }

    /** Cœur testable. Toutes les gates sont silencieuses (best-effort). */
    void classifyLastInbound(Long orgId, Long conversationId) {
        final Conversation conversation = conversationRepository
                .findByIdAndOrganizationId(conversationId, orgId).orElse(null);
        if (conversation == null || !hasActiveOrUpcomingStay(conversation)) {
            return;
        }
        final ConversationMessage message = messageRepository
                .findTopByConversationIdAndDirectionOrderBySentAtDesc(conversationId, MessageDirection.INBOUND)
                .orElse(null);
        if (message == null || message.getContent() == null || message.getContent().isBlank()
                || intentRepository.existsByMessageId(message.getId())) {
            return;
        }
        if (!tokenBudgetService.isFeatureEnabled(orgId, AiFeature.MESSAGING)
                || !tokenBudgetService.hasBudget(orgId, AiFeature.MESSAGING)) {
            return;
        }

        final String anonymized = anonymizationService.anonymize(message.getContent());
        final AiRequest request = AiRequest.jsonWithMaxTokens(SYSTEM_PROMPT, anonymized, 300);
        final AiProviderRouter.RoutedResponse routed =
                aiProviderRouter.route(orgId, "anthropic", AiFeature.MESSAGING, request);
        tokenBudgetService.recordUsage(orgId, AiFeature.MESSAGING, routed.providerName(), routed.response());

        final MessageIntent parsed = parse(routed.response().content(), routed.response().model());
        if (parsed == null) {
            return;
        }
        parsed.setOrganizationId(orgId);
        parsed.setConversationId(conversationId);
        parsed.setMessageId(message.getId());
        try {
            intentRepository.save(parsed);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Course entre deux listeners sur le même message : l'unique DB tranche.
            log.debug("Intent déjà classifié pour le message {}", message.getId());
        }
    }

    /** Séjour actif ou à venir : checkout pas encore passé, réservation non annulée. */
    private boolean hasActiveOrUpcomingStay(Conversation conversation) {
        final Reservation reservation = conversation.getReservation();
        if (reservation == null || reservation.getCheckOut() == null) {
            return false;
        }
        final String status = reservation.getStatus();
        if (status != null && (status.equalsIgnoreCase("CANCELLED") || status.equalsIgnoreCase("REFUSED"))) {
            return false;
        }
        return !reservation.getCheckOut().isBefore(LocalDate.now(clock));
    }

    /** Parsing tolérant (Anthropic n'a pas de response_format) : illisible → null. */
    private MessageIntent parse(String content, String model) {
        try {
            final String json = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
            final JsonNode node = objectMapper.readTree(json);
            final MessageIntent intent = new MessageIntent();
            intent.setIntent(MessageIntent.Intent.valueOf(node.path("intent").asText("OTHER")));
            final double confidence = node.path("confidence").asDouble(0);
            intent.setConfidence(BigDecimal.valueOf(Math.max(0, Math.min(1, confidence))));
            final JsonNode extracted = node.get("extracted");
            intent.setExtracted(extracted != null && extracted.isObject() ? extracted.toString() : null);
            intent.setModel(model);
            return intent;
        } catch (Exception e) {
            log.debug("Réponse d'intent illisible : {}", e.getMessage());
            return null;
        }
    }
}
