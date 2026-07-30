package com.clenzy.service.agent.supervision;

import com.clenzy.model.GuestReview;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.tenant.KafkaTenantScope;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Arrivée d'un avis → carte de modération, sans attendre le balayage.
 */
@ExtendWith(MockitoExtension.class)
class ReviewSupervisionTriggerListenerTest {

    private static final Long ORG = 4L;
    private static final Long PROPERTY = 55L;
    private static final Long REVIEW = 900L;

    @Mock private GuestReviewRepository reviewRepository;
    @Mock private ReviewModerationScanner reviewModerationScanner;
    @Mock private KafkaTenantScope kafkaTenantScope;

    @InjectMocks private ReviewSupervisionTriggerListener listener;

    private static GuestReview review(String hostResponse) {
        GuestReview review = new GuestReview();
        review.setId(REVIEW);
        review.setOrganizationId(ORG);
        review.setPropertyId(PROPERTY);
        review.setHostResponse(hostResponse);
        return review;
    }

    @Test
    void whenReviewArrives_thenTheOrgComesFromTheDatabaseNotThePayload() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.of(review(null)));

        // Le message annonce une AUTRE organisation : elle n'est transmise que
        // comme contrôle de cohérence. L'organisation de confiance reste celle
        // de l'avis relu en base — un émetteur ne choisit jamais le tenant.
        listener.onReviewReceived(Map.of("reviewId", REVIEW, "orgId", 999));

        verify(kafkaTenantScope).run(eq("reviews.sync"), eq(ORG), eq(999L), any(Runnable.class));
    }

    @Test
    void whenReviewIsUnknown_thenNothingIsScanned() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.empty());

        listener.onReviewReceived(Map.of("reviewId", REVIEW));

        verifyNoInteractions(kafkaTenantScope, reviewModerationScanner);
    }

    @Test
    void whenReviewWasAnsweredMeanwhile_thenNoCardIsRaised() {
        when(reviewRepository.findById(REVIEW)).thenReturn(Optional.of(review("Merci !")));

        listener.onReviewReceived(Map.of("reviewId", REVIEW));

        verifyNoInteractions(kafkaTenantScope, reviewModerationScanner);
    }

    @Test
    void whenPayloadCarriesNoReviewId_thenTheEventIsDropped() {
        listener.onReviewReceived(Map.of("propertyId", PROPERTY));

        verify(reviewRepository, never()).findById(any());
        verifyNoInteractions(kafkaTenantScope, reviewModerationScanner);
    }
}
