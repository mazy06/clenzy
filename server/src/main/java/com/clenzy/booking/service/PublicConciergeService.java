package com.clenzy.booking.service;

import com.clenzy.booking.dto.ConciergeAnswerDto;
import com.clenzy.booking.dto.ConciergeRequestDto;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.config.ai.AiRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiProviderRouter;
import com.clenzy.service.AiProviderRouter.RoutedResponse;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.service.agent.kb.KbSearchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Concierge IA du site public (2.13) — chat voyageurs en RAG sur le contenu de l'org : base de
 * connaissances (embeddings/pgvector, réutilise {@link KbSearchService}) + résumé des hébergements
 * proposés. Réutilise l'infra IA partagée (gating/budget {@link AiTokenBudgetService} + BYOK,
 * feature {@link AiFeature#ASSISTANT_CHAT}). Org résolue par la clé API publique (X-Booking-Key) ;
 * aucune donnée sensible (le contexte = ce qui est déjà public). Répond UNIQUEMENT depuis le contexte.
 */
@Service
public class PublicConciergeService {

    private static final Logger log = LoggerFactory.getLogger(PublicConciergeService.class);
    private static final String PROVIDER = "anthropic";
    private static final int MAX_TOKENS = 500;
    private static final int KB_TOP_K = 5;
    private static final int MAX_PROPERTIES = 12;
    private static final int MAX_HISTORY = 6;
    private static final int MAX_QUESTION_LEN = 1000;

    private final KbSearchService kbSearchService;
    private final AiProviderRouter aiProviderRouter;
    private final AiTokenBudgetService tokenBudgetService;
    private final PublicBookingService bookingService;

    public PublicConciergeService(KbSearchService kbSearchService,
                                  AiProviderRouter aiProviderRouter,
                                  AiTokenBudgetService tokenBudgetService,
                                  PublicBookingService bookingService) {
        this.kbSearchService = kbSearchService;
        this.aiProviderRouter = aiProviderRouter;
        this.tokenBudgetService = tokenBudgetService;
        this.bookingService = bookingService;
    }

    /** Le concierge est proposé si l'org a activé l'IA conversationnelle (sinon le widget reste caché). */
    public boolean isAvailable(Long orgId) {
        return tokenBudgetService.isFeatureEnabled(orgId, AiFeature.ASSISTANT_CHAT);
    }

    public ConciergeAnswerDto answer(Long orgId, ConciergeRequestDto req) {
        String question = req != null ? req.question() : null;
        if (question == null || question.isBlank()) {
            throw new IllegalArgumentException("Question requise");
        }
        if (question.length() > MAX_QUESTION_LEN) {
            question = question.substring(0, MAX_QUESTION_LEN);
        }
        // Gating non bloquant : IA désactivée ou budget atteint → réponse "indisponible" propre.
        if (!tokenBudgetService.isFeatureEnabled(orgId, AiFeature.ASSISTANT_CHAT)
            || !tokenBudgetService.hasBudget(orgId, AiFeature.ASSISTANT_CHAT)) {
            return ConciergeAnswerDto.unavailable();
        }

        String context = buildContext(orgId, question);
        String system = "Tu es le concierge virtuel de cet hébergeur de location courte durée. Réponds aux "
            + "questions des voyageurs de façon utile, chaleureuse et concise (2 à 5 phrases), UNIQUEMENT à "
            + "partir du CONTEXTE fourni. N'invente JAMAIS un fait précis (tarif exact, disponibilité, adresse "
            + "complète) : si l'information manque, dis-le et invite à contacter l'hôte ou à lancer une recherche "
            + "de dates. Réponds dans la langue de la question.";
        String user = "CONTEXTE:\n" + context + historyBlock(req.history()) + "\n\nQUESTION DU VOYAGEUR : " + question.trim();

        try {
            AiRequest request = AiRequest.withMaxTokens(system, user, MAX_TOKENS);
            RoutedResponse routed = aiProviderRouter.route(orgId, PROVIDER, AiFeature.ASSISTANT_CHAT, request);
            tokenBudgetService.recordUsage(orgId, AiFeature.ASSISTANT_CHAT, routed.providerName(), routed.response());
            String content = routed.response().content();
            return new ConciergeAnswerDto(content != null ? content.trim() : "", true);
        } catch (RuntimeException e) {
            log.warn("Concierge IA org={} : échec ({})", orgId, e.getMessage());
            return ConciergeAnswerDto.unavailable();
        }
    }

    /** Contexte RAG : extraits de la base de connaissances (org) + résumé des hébergements proposés. */
    private String buildContext(Long orgId, String question) {
        StringBuilder sb = new StringBuilder();
        try {
            List<KbSearchService.KbSearchHit> hits = kbSearchService.search(question, orgId, KB_TOP_K);
            if (!hits.isEmpty()) {
                sb.append("Documentation:\n");
                for (KbSearchService.KbSearchHit h : hits) {
                    sb.append("- ").append(h.title()).append(" : ").append(h.snippet()).append('\n');
                }
            }
        } catch (RuntimeException e) {
            log.debug("Concierge : KB indisponible org={} ({})", orgId, e.getMessage());
        }
        try {
            List<PublicPropertyDto> props = bookingService.getProperties(bookingService.resolveOrgById(orgId));
            if (!props.isEmpty()) {
                sb.append("\nHébergements proposés:\n");
                props.stream().limit(MAX_PROPERTIES).forEach(p -> sb.append(formatProperty(p)).append('\n'));
            }
        } catch (RuntimeException e) {
            log.debug("Concierge : propriétés indisponibles org={} ({})", orgId, e.getMessage());
        }
        return sb.toString();
    }

    private String formatProperty(PublicPropertyDto p) {
        StringBuilder s = new StringBuilder("• ").append(p.name());
        if (p.type() != null) s.append(" (").append(p.type()).append(')');
        if (p.city() != null) s.append(" — ").append(p.city());
        if (p.bedroomCount() != null) s.append(", ").append(p.bedroomCount()).append(" ch.");
        if (p.maxGuests() != null) s.append(", ").append(p.maxGuests()).append(" pers. max");
        if (p.priceFrom() != null) s.append(", dès ").append(p.priceFrom()).append(' ').append(p.currency());
        if (p.amenities() != null && !p.amenities().isEmpty()) {
            s.append(" — équipements : ").append(String.join(", ", p.amenities()));
        }
        if (p.checkInTime() != null || p.checkOutTime() != null) {
            s.append(" — arrivée ").append(p.checkInTime()).append(" / départ ").append(p.checkOutTime());
        }
        return s.toString();
    }

    /** Derniers tours de conversation (bornés) pour le suivi des questions de relance. */
    private String historyBlock(List<ConciergeRequestDto.Turn> history) {
        if (history == null || history.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("\n\nÉCHANGE PRÉCÉDENT:\n");
        history.stream().skip(Math.max(0, history.size() - MAX_HISTORY)).forEach(t -> {
            if (t != null && t.content() != null && !t.content().isBlank()) {
                String who = "assistant".equalsIgnoreCase(t.role()) ? "Concierge" : "Voyageur";
                sb.append(who).append(" : ").append(t.content().trim()).append('\n');
            }
        });
        return sb.toString();
    }
}
