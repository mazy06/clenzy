package com.clenzy.service.agent.supervision;

import com.clenzy.config.ai.ChatEvent;
import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ChatRequest;
import com.clenzy.model.AiFeature;
import com.clenzy.model.GuestReview;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.AiTargetResolver;
import com.clenzy.service.ResolvedTarget;
import com.clenzy.service.agent.AgentTier;
import com.clenzy.service.agent.TierModelResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.function.Consumer;

/**
 * Génère un BROUILLON de réponse d'avis via LLM (REP) et l'enregistre dans
 * {@code guest_reviews.host_response_draft} — JAMAIS publié automatiquement.
 *
 * <p>L'agent Réputation ne publie pas : il propose un brouillon à valider (sûr sur un
 * avis négatif). L'opérateur le relit/édite puis publie (respondToReview → host_response).
 * Appel LLM one-shot (tier SMALL), calqué sur {@code ConversationSummaryService}.</p>
 */
@Service
public class ReviewReplyDraftService {

    private static final Logger log = LoggerFactory.getLogger(ReviewReplyDraftService.class);
    private static final int MAX_TOKENS = 400;
    private static final String SYSTEM_PROMPT = """
            Tu es le gestionnaire d'un logement de location courte durée. Rédige une réponse
            PUBLIQUE, professionnelle et empathique à un avis de voyageur, dans la langue de
            l'avis (français par défaut). Reconnais le retour, remercie, réponds au(x) point(s)
            soulevé(s) avec sincérité, propose une amélioration concrète si pertinent, reste
            courtois et bref (max ~120 mots). N'invente aucun fait, ne promets rien d'impossible,
            pas de jargon. Retourne UNIQUEMENT le texte de la réponse, sans préambule.""";

    private final GuestReviewRepository reviewRepository;
    private final ChatLLMProvider chatProvider;
    private final AiTargetResolver targetResolver;
    private final TierModelResolver tierModelResolver;
    private final Clock clock;

    public ReviewReplyDraftService(GuestReviewRepository reviewRepository,
                                   ChatLLMProvider chatProvider,
                                   AiTargetResolver targetResolver,
                                   TierModelResolver tierModelResolver,
                                   Clock clock) {
        this.reviewRepository = reviewRepository;
        this.chatProvider = chatProvider;
        this.targetResolver = targetResolver;
        this.tierModelResolver = tierModelResolver;
        this.clock = clock;
    }

    /**
     * Génère et enregistre un brouillon de réponse pour l'avis. EFFET EXTERNE (appel LLM) :
     * exécuté HORS transaction d'apply. L'état de l'avis est relu, l'ownership org re-validé
     * (règle audit n°3). Ne publie rien : écrit seulement {@code host_response_draft}.
     */
    @Transactional
    public void generateDraft(Long orgId, Long reviewId) {
        final GuestReview review = reviewRepository.findById(reviewId).orElseThrow(
                () -> new IllegalStateException("Avis introuvable : " + reviewId));
        if (!orgId.equals(review.getOrganizationId())) {
            throw new IllegalStateException("Avis " + reviewId + " hors organisation " + orgId);
        }
        final String draft = callLlm(orgId, review);
        if (draft == null || draft.isBlank()) {
            throw new IllegalStateException("Brouillon de réponse non généré (LLM indisponible)");
        }
        review.setHostResponseDraft(draft.strip());
        review.setHostResponseDraftAt(clock.instant());
        reviewRepository.save(review);
        log.info("REVIEW_DRAFT_REPLY brouillon généré org={} review={}", orgId, reviewId);
    }

    private String callLlm(Long orgId, GuestReview review) {
        final ResolvedTarget target = targetResolver.resolvePrimary(orgId, AiFeature.ASSISTANT_CHAT, null);
        final String model = tierModelResolver != null
                ? tierModelResolver.resolveModel(AgentTier.SMALL, target.provider(), target.model())
                : target.model();
        final String userPrompt = "Avis ("
                + (review.getRating() != null ? review.getRating() + "/5" : "note inconnue") + ") de "
                + (review.getGuestName() != null && !review.getGuestName().isBlank()
                        ? review.getGuestName() : "un voyageur") + " :\n"
                + (review.getReviewText() != null && !review.getReviewText().isBlank()
                        ? review.getReviewText() : "(pas de texte)");
        final ChatRequest request = new ChatRequest(
                SYSTEM_PROMPT, List.of(ChatMessage.user(userPrompt)), List.of(),
                model, 0.5, MAX_TOKENS, null, target.provider(), target.baseUrl());
        final StringBuilder text = new StringBuilder();
        final Consumer<ChatEvent> handler = event -> {
            if (event instanceof ChatEvent.Done done) {
                text.append(done.fullText());
            } else if (event instanceof ChatEvent.TextDelta td) {
                text.append(td.delta());
            }
        };
        if (target.apiKey() != null) {
            chatProvider.streamChat(request, handler, target.apiKey());
        } else {
            chatProvider.streamChat(request, handler);
        }
        return text.toString();
    }
}
