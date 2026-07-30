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
import org.springframework.beans.factory.ObjectProvider;
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
    /** Proxy de soi-meme : indispensable pour que les etapes transactionnelles le soient vraiment. */
    private final ObjectProvider<ReviewReplyDraftService> self;

    public ReviewReplyDraftService(GuestReviewRepository reviewRepository,
                                   ChatLLMProvider chatProvider,
                                   AiTargetResolver targetResolver,
                                   TierModelResolver tierModelResolver,
                                   Clock clock,
                                   ObjectProvider<ReviewReplyDraftService> self) {
        this.reviewRepository = reviewRepository;
        this.chatProvider = chatProvider;
        this.targetResolver = targetResolver;
        this.tierModelResolver = tierModelResolver;
        this.clock = clock;
        this.self = self;
    }

    /** Ce dont le prompt a besoin, extrait sous transaction courte. */
    private record ReviewSnapshot(Integer rating, String guestName, String reviewText) {}

    /**
     * Génère et enregistre un brouillon de réponse pour l'avis. Ne publie rien :
     * écrit seulement {@code host_response_draft}.
     *
     * <p><b>Pas de {@code @Transactional} ici, volontairement.</b> L'appel LLM dure
     * plusieurs secondes ; l'englober dans une transaction immobiliserait une
     * connexion Hikari pendant tout ce temps — c'est l'interdit n°2 du CLAUDE.md
     * (jamais d'appel externe DANS une transaction). Le travail est donc découpé :
     * lecture courte, appel hors transaction, écriture courte. L'ownership org est
     * revalidé <b>dans chacune</b> des deux transactions, l'état ayant pu changer
     * entre-temps (règle d'audit n°3).</p>
     */
    public void generateDraft(Long orgId, Long reviewId) {
        final ReviewSnapshot snapshot = self.getObject().loadSnapshot(orgId, reviewId);
        final String draft = callLlm(orgId, snapshot);
        if (draft == null || draft.isBlank()) {
            throw new IllegalStateException("Brouillon de réponse non généré (LLM indisponible)");
        }
        self.getObject().persistDraft(orgId, reviewId, draft.strip());
        log.info("REVIEW_DRAFT_REPLY brouillon généré org={} review={}", orgId, reviewId);
    }

    /**
     * Étape 1 — lecture. Public et appelé via {@code self} : une invocation
     * directe ne passerait pas par le proxy Spring et perdrait la transaction
     * (CLAUDE.md, piège d'auto-invocation).
     */
    @Transactional(readOnly = true)
    public ReviewSnapshot loadSnapshot(Long orgId, Long reviewId) {
        final GuestReview review = requireInOrg(orgId, reviewId);
        // On ne laisse PAS l'entité sortir de la transaction : un record de
        // valeurs, donc aucun accès paresseux hors session.
        return new ReviewSnapshot(review.getRating(), review.getGuestName(), review.getReviewText());
    }

    /** Étape 3 — écriture, après l'appel externe. */
    @Transactional
    public void persistDraft(Long orgId, Long reviewId, String draft) {
        final GuestReview review = requireInOrg(orgId, reviewId);
        review.setHostResponseDraft(draft);
        review.setHostResponseDraftAt(clock.instant());
        reviewRepository.save(review);
    }

    private GuestReview requireInOrg(Long orgId, Long reviewId) {
        final GuestReview review = reviewRepository.findById(reviewId).orElseThrow(
                () -> new IllegalStateException("Avis introuvable : " + reviewId));
        if (!orgId.equals(review.getOrganizationId())) {
            throw new IllegalStateException("Avis " + reviewId + " hors organisation " + orgId);
        }
        return review;
    }

    private String callLlm(Long orgId, ReviewSnapshot review) {
        final ResolvedTarget target = targetResolver.resolvePrimary(orgId, AiFeature.ASSISTANT_CHAT, null);
        final String model = tierModelResolver != null
                ? tierModelResolver.resolveModel(AgentTier.SMALL, target.provider(), target.model())
                : target.model();
        final String userPrompt = "Avis ("
                + (review.rating() != null ? review.rating() + "/5" : "note inconnue") + ") de "
                + (review.guestName() != null && !review.guestName().isBlank()
                        ? review.guestName() : "un voyageur") + " :\n"
                + (review.reviewText() != null && !review.reviewText().isBlank()
                        ? review.reviewText() : "(pas de texte)");
        final ChatRequest request = new ChatRequest(
                SYSTEM_PROMPT, List.of(ChatMessage.user(userPrompt)), List.of(),
                model, 0.5, MAX_TOKENS, null, target.provider(), target.baseUrl());
        final StringBuilder deltas = new StringBuilder();
        final StringBuilder complete = new StringBuilder();
        // `Done.fullText()` est DÉJÀ la concaténation de tous les `TextDelta`
        // (cf. son javadoc) : accumuler les deux écrivait le texte en double,
        // recollé sans séparateur. On garde les deux flux à part et on tranche
        // à la fin, `fullText` faisant foi quand il est présent.
        final Consumer<ChatEvent> handler = event -> {
            if (event instanceof ChatEvent.Done done) {
                complete.append(done.fullText() == null ? "" : done.fullText());
            } else if (event instanceof ChatEvent.TextDelta td) {
                deltas.append(td.delta());
            }
        };
        if (target.apiKey() != null) {
            chatProvider.streamChat(request, handler, target.apiKey());
        } else {
            chatProvider.streamChat(request, handler);
        }
        return complete.length() > 0 ? complete.toString() : deltas.toString();
    }
}
