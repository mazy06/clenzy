package com.clenzy.service.agent.supervision;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.GuestReview;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.tenant.KafkaTenantScope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Fait naître la carte « avis sans réponse » à l'arrivée de l'avis.
 *
 * <p>Auparavant, ces cartes ne pouvaient venir que du balayage horaire de
 * {@code SupervisionAutonomousScanner} ou d'un scan lancé à la main : un avis
 * reçu à 9 h 05 n'apparaissait pas avant l'heure suivante, et pas du tout si le
 * balayage était désactivé. L'événement rend l'apparition immédiate.</p>
 *
 * <p><b>Aucun modèle n'est appelé ici.</b> Le scan de modération est
 * déterministe : il pose la carte, et c'est l'opérateur qui décide ensuite de
 * demander un brouillon à l'agent ou d'écrire sa réponse lui-même. Faire
 * rédiger l'IA dès la réception consommerait des crédits pour des avis que
 * personne n'a encore regardés.</p>
 *
 * <p>Politique tenant : l'organisation est <b>re-dérivée de l'avis en base</b> et
 * l'organisation annoncée dans le message n'est qu'un contrôle de cohérence —
 * l'émetteur ne choisit jamais le tenant (règle d'audit P1-03/P1-04).</p>
 */
@Component
public class ReviewSupervisionTriggerListener {

    private static final Logger log = LoggerFactory.getLogger(ReviewSupervisionTriggerListener.class);

    private final GuestReviewRepository reviewRepository;
    private final ReviewModerationScanner reviewModerationScanner;
    private final KafkaTenantScope kafkaTenantScope;

    public ReviewSupervisionTriggerListener(GuestReviewRepository reviewRepository,
                                            ReviewModerationScanner reviewModerationScanner,
                                            KafkaTenantScope kafkaTenantScope) {
        this.reviewRepository = reviewRepository;
        this.reviewModerationScanner = reviewModerationScanner;
        this.kafkaTenantScope = kafkaTenantScope;
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_REVIEWS_SYNC, groupId = "clenzy-review-supervision")
    public void onReviewReceived(Map<String, Object> event) {
        final Long reviewId = asLong(event.get("reviewId"));
        if (reviewId == null) {
            return;
        }

        // La source de vérité est l'avis lui-même, pas le message : org et
        // logement en sont relus, ce qui ferme la porte à un événement forgé.
        final GuestReview review = reviewRepository.findById(reviewId).orElse(null);
        if (review == null || review.getPropertyId() == null) {
            log.debug("REVIEW_RECEIVED ignoré : avis {} introuvable ou sans logement", reviewId);
            return;
        }
        if (review.getHostResponse() != null) {
            // Répondu entre-temps : plus rien à proposer.
            return;
        }

        final Long orgId = review.getOrganizationId();
        final Long propertyId = review.getPropertyId();
        kafkaTenantScope.run(KafkaConfig.TOPIC_REVIEWS_SYNC, orgId, asLong(event.get("orgId")),
                () -> reviewModerationScanner.scanProperty(orgId, propertyId));
    }

    private static Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
