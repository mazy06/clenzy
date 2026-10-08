package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SuggestionPreviewDto;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.payout.HousekeeperPayoutService;
import com.clenzy.service.payout.ProviderPayoutBeneficiaryService;
import com.clenzy.service.payout.ProviderPayoutBeneficiaryService.Review;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Finance propose ; seul le staff confirme le bénéficiaire contractuel. Aucun choix autonome. */
@Service
public class ProviderBeneficiarySupervision {
    private static final Logger log = LoggerFactory.getLogger(ProviderBeneficiarySupervision.class);
    private final InterventionRepository interventions;
    private final ProviderPayoutBeneficiaryService beneficiaries;
    private final HousekeeperPayoutService payouts;
    private final SupervisionSuggestionService suggestions;
    private final SupervisionSuggestionRepository cards;
    private final SupervisionRealtimePublisher realtime;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final TransactionTemplate transactions;

    public ProviderBeneficiarySupervision(InterventionRepository interventions,
            ProviderPayoutBeneficiaryService beneficiaries, HousekeeperPayoutService payouts,
            SupervisionSuggestionService suggestions, SupervisionSuggestionRepository cards,
            SupervisionRealtimePublisher realtime, ObjectMapper mapper, Clock clock,
            PlatformTransactionManager transactionManager) {
        this.interventions = interventions;
        this.beneficiaries = beneficiaries;
        this.payouts = payouts;
        this.suggestions = suggestions;
        this.cards = cards;
        this.realtime = realtime;
        this.mapper = mapper;
        this.clock = clock;
        this.transactions = new TransactionTemplate(transactionManager);
        this.transactions.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) return;
        try {
            scan(orgId, propertyId);
        } catch (RuntimeException failure) {
            log.warn("Scan des bénéficiaires indisponible org={} property={}", orgId, propertyId, failure);
        }
    }

    private void scan(Long orgId, Long propertyId) {
        Map<Long, Review> current = new LinkedHashMap<>();
        Map<Long, String> names = new LinkedHashMap<>();
        for (var mission : interventions.findByPropertyId(propertyId, orgId)) {
            if (!orgId.equals(mission.getOrganizationId()) || mission.getProperty() == null
                    || !propertyId.equals(mission.getProperty().getId())) continue;
            try {
                beneficiaries.review(mission.getId(), orgId).ifPresent(review -> {
                    current.put(mission.getId(), review);
                    names.put(mission.getId(), mission.getTitle());
                });
            } catch (RuntimeException failure) {
                log.debug("Bénéficiaire de la mission {} à rapprocher : {}", mission.getId(), failure.getMessage());
            }
        }
        for (var card : pending(orgId, propertyId)) {
            var expected = readReview(card);
            if (expected == null || !expected.equals(current.get(expected.missionId()))) retire(card);
        }
        current.forEach((missionId, review) -> {
            try {
                var choice = beneficiaries.choice(missionId, orgId);
                String company = choice.organizationName() == null ? "Organisation #" + review.organizationId() : choice.organizationName();
                suggestions.recordActionable(orgId, propertyId, "fin",
                        "Bénéficiaire du versement · mission #" + missionId,
                        company + " est l'organisation du prestataire affecté à « " + names.get(missionId)
                                + " ». Vérifiez qu'elle facture cette prestation avant de la désigner comme bénéficiaire."
                                + " Le choix sera figé ; une mission terminée et éligible pourra ensuite être reversée.",
                        SupervisionActionType.PROVIDER_PAYOUT_BENEFICIARY,
                        mapper.writeValueAsString(review), null, "info");
            } catch (Exception failure) {
                log.warn("Proposition de bénéficiaire indisponible pour la mission {}", missionId, failure);
            }
        });
    }

    /** Les paramètres de cette décision proviennent uniquement de la carte persistée. */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public void apply(SupervisionSuggestion card) {
        String actor = card.getAppliedBy();
        if (actor == null || !actor.startsWith(SupervisionSuggestion.APPLIED_BY_USER_PREFIX)
                || actor.length() == SupervisionSuggestion.APPLIED_BY_USER_PREFIX.length())
            throw new AccessDeniedException("La désignation du bénéficiaire exige une validation humaine.");
        Review expected = requireReview(card);
        beneficiaries.selectReviewedOrganization(card.getOrganizationId(), expected,
                actor.substring(SupervisionSuggestion.APPLIED_BY_USER_PREFIX.length()));
        // Même circuit que la fiche : décision commitée, puis contrôles et versement éventuel hors transaction.
        payouts.processCompletedMission(expected.missionId(), card.getOrganizationId());
    }

    public SuggestionPreviewDto preview(SupervisionSuggestion card) {
        try {
            Review expected = requireReview(card);
            if (!SupervisionSuggestion.STATUS_PENDING.equals(card.getStatus())
                    || !beneficiaries.review(expected.missionId(), card.getOrganizationId()).filter(expected::equals).isPresent())
                throw new IllegalStateException("La situation a changé. Actualisez la constellation avant de valider.");
            var choice = beneficiaries.choice(expected.missionId(), card.getOrganizationId());
            String company = choice.organizationName() == null ? "Organisation #" + expected.organizationId() : choice.organizationName();
            return new SuggestionPreviewDto("Bénéficiaire", List.of(company), "Mission #" + expected.missionId(),
                    null, false, List.of("L'organisation doit être le bénéficiaire contractuel de cette prestation.",
                    "Ce choix sera figé. Une mission terminée ne sera reversée que si tous les contrôles sont validés."), null);
        } catch (RuntimeException failure) {
            return new SuggestionPreviewDto("Bénéficiaire", List.of(), null, null, false, List.of(),
                    "Proposition obsolète ou déjà traitée. Actualisez la constellation.");
        }
    }

    /** Une validation depuis la fiche retire aussi la carte, seulement après commit réussi. */
    @TransactionalEventListener
    public void selected(ProviderPayoutBeneficiaryService.Selected event) {
        if (event.propertyId() == null) return;
        try {
            for (var card : pending(event.organizationId(), event.propertyId())) {
                var review = readReview(card);
                if (review != null && event.missionId().equals(review.missionId())) retire(card);
            }
        } catch (RuntimeException failure) {
            // La sélection est déjà commitée ; le prochain scan terminera le retrait.
            log.warn("Actualisation du bénéficiaire à reprendre pour la mission {}", event.missionId(), failure);
        }
    }

    private List<SupervisionSuggestion> pending(Long orgId, Long propertyId) {
        return cards.findByOrganizationIdAndPropertyIdAndActionTypeAndStatus(orgId, propertyId,
                SupervisionActionType.PROVIDER_PAYOUT_BENEFICIARY, SupervisionSuggestion.STATUS_PENDING);
    }

    private void retire(SupervisionSuggestion card) {
        Integer changed = transactions.execute(status -> cards.retireObsolete(card.getId(), card.getOrganizationId()));
        if (Integer.valueOf(1).equals(changed))
            realtime.publishPendingResolved(card.getPropertyId(), card.getId(), "edited", null);
    }

    private Review requireReview(SupervisionSuggestion card) {
        Review review = readReview(card);
        if (review == null || review.missionId() == null || review.organizationId() == null
                || !Objects.equals(card.getPropertyId(), review.propertyId())
                || card.getExpiresAt() == null || !card.getExpiresAt().isAfter(clock.instant()))
            throw new IllegalStateException("Proposition de bénéficiaire invalide ou expirée.");
        return review;
    }

    private Review readReview(SupervisionSuggestion card) {
        try { return mapper.readValue(card.getActionParams(), Review.class); }
        catch (Exception ignored) { return null; }
    }
}
