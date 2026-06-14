package com.clenzy.service.messaging;

import com.clenzy.dto.AiSuggestedResponseDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.MessageDirection;
import com.clenzy.service.AiMessagingService;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.kb.KbSearchService.KbSearchHit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Copilote de réponse messagerie (CLZ Domaine 6) : génère un <b>brouillon</b> de réponse pour une
 * conversation, ancré sur le dernier message du voyageur + la <b>base de connaissances</b> (RAG).
 * Ne fait qu'assister — l'envoi reste manuel.
 *
 * <p>Réutilise l'existant : {@link AiMessagingService#generateSuggestedResponseAi} (feature-flag,
 * budget de tokens, anonymisation, routing LLM déjà gérés) + {@link KbSearchService} (RAG org-scopé,
 * dégradation propre si embeddings off). Ownership via {@link ConversationService#getById}.</p>
 */
@Service
public class ConversationAiAssistService {

    private static final int RECENT_MESSAGES = 30;
    private static final int KB_TOP_K = 3;

    private final ConversationService conversationService;
    private final AiMessagingService aiMessagingService;
    private final KbSearchService kbSearchService;

    public ConversationAiAssistService(ConversationService conversationService,
                                       AiMessagingService aiMessagingService,
                                       KbSearchService kbSearchService) {
        this.conversationService = conversationService;
        this.aiMessagingService = aiMessagingService;
        this.kbSearchService = kbSearchService;
    }

    /**
     * Génère un brouillon de réponse pour la conversation (org-scopé). Ne l'envoie pas.
     *
     * @throws NotFoundException si la conversation n'existe pas dans l'org
     */
    public AiSuggestedResponseDto suggestReply(Long orgId, Long conversationId) {
        Conversation conversation = conversationService.getById(conversationId, orgId)
            .orElseThrow(() -> new NotFoundException("Conversation not found: " + conversationId));

        String lastGuestMessage = lastInboundContent(conversationId, orgId, conversation);
        List<KbSearchHit> kbHits = kbSearchService.search(lastGuestMessage, orgId, KB_TOP_K);
        String context = buildContext(conversation, kbHits);
        // Langue laissee a null : le LLM la deduit du message du voyageur (multilingue).
        return aiMessagingService.generateSuggestedResponseAi(lastGuestMessage, context, null, orgId);
    }

    private String lastInboundContent(Long conversationId, Long orgId, Conversation conversation) {
        Page<ConversationMessage> page = conversationService.getMessages(
            conversationId, orgId, PageRequest.of(0, RECENT_MESSAGES));
        String last = null;
        for (ConversationMessage m : page.getContent()) {
            if (m.getDirection() == MessageDirection.INBOUND && m.getContent() != null) {
                last = m.getContent();
            }
        }
        if (last != null) return last;
        // Repli : aperçu du dernier message si aucun message inbound chargé
        return conversation.getLastMessagePreview() != null ? conversation.getLastMessagePreview() : "";
    }

    private String buildContext(Conversation conversation, List<KbSearchHit> kbHits) {
        StringBuilder ctx = new StringBuilder();
        if (conversation.getProperty() != null && conversation.getProperty().getName() != null) {
            ctx.append("Logement : ").append(conversation.getProperty().getName()).append("\n");
        }
        if (conversation.getReservation() != null) {
            var r = conversation.getReservation();
            if (r.getCheckIn() != null && r.getCheckOut() != null) {
                ctx.append("Sejour : ").append(r.getCheckIn()).append(" -> ").append(r.getCheckOut()).append("\n");
            }
        }
        if (kbHits != null && !kbHits.isEmpty()) {
            ctx.append("\nBase de connaissances (extraits pertinents) :\n");
            for (KbSearchHit hit : kbHits) {
                ctx.append("- ").append(hit.title() != null ? hit.title() + " : " : "")
                   .append(hit.snippet()).append("\n");
            }
        }
        return ctx.toString();
    }
}
