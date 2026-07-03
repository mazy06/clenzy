package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.service.WelcomeGuideService;
import com.clenzy.service.messaging.GuestMessagingService;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * F4a SEND_REVIEW_REQUEST : demande d'avis post-sejour ({reviewLink}), declenchable a
 * CHECK_OUT_DAY / CHECK_OUT_PASSED, avec relance REVIEW_REMINDER J+X qui ne part QUE si
 * aucun avis n'a ete recu pour le sejour.
 */
@Service
public class SendReviewRequestExecutor extends AbstractGuestMessageExecutor {

    private final WelcomeGuideService welcomeGuideService;
    private final GuestReviewRepository guestReviewRepository;

    public SendReviewRequestExecutor(GuestMessagingService messagingService,
                                     WelcomeGuideService welcomeGuideService,
                                     GuestReviewRepository guestReviewRepository) {
        super(messagingService);
        this.welcomeGuideService = welcomeGuideService;
        this.guestReviewRepository = guestReviewRepository;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_REVIEW_REQUEST;
    }

    /**
     * La relance (REVIEW_REMINDER) est verifiee a l'EXECUTION, pas a la planification :
     * l'avis peut arriver entre le check-out et le J+X de la relance. La premiere demande
     * (CHECK_OUT_DAY / CHECK_OUT_PASSED) part sans verification — aucun avis ne peut
     * preceder le depart.
     */
    @Override
    protected ExecutionResult shouldSkip(AutomationRule rule, Reservation reservation, Long orgId) {
        if (rule.getTriggerType() == AutomationTrigger.REVIEW_REMINDER
                && hasReceivedReview(reservation, orgId)) {
            return ExecutionResult.skipped(
                "Avis deja recu pour la reservation " + reservation.getId());
        }
        return null;
    }

    @Override
    protected Map<String, String> extraVariables(Reservation reservation) {
        String reviewLink = welcomeGuideService.reviewLinkForReservation(reservation)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun livret d'accueil publié pour la demande d'avis (réservation "
                    + reservation.getId() + ")"));
        // Les deux variables : compatibilite avec les templates existants qui utilisent {guideLink}.
        return Map.of("guideLink", reviewLink, "reviewLink", reviewLink);
    }

    /**
     * Lien direct par reservation d'abord ; repli par logement : les avis importes des OTA
     * n'ont pas toujours le lien reservation — un avis sur le logement date apres le
     * check-out du sejour compte comme recu.
     */
    private boolean hasReceivedReview(Reservation reservation, Long orgId) {
        if (guestReviewRepository.existsByReservationIdAndOrganizationId(reservation.getId(), orgId)) {
            return true;
        }
        if (reservation.getProperty() == null || reservation.getCheckOut() == null) {
            return false;
        }
        return guestReviewRepository.existsByPropertyIdAndOrganizationIdAndReviewDateGreaterThanEqual(
            reservation.getProperty().getId(), orgId, reservation.getCheckOut());
    }
}
