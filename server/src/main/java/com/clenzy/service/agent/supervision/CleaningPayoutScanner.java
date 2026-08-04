package com.clenzy.service.agent.supervision;

import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.Intervention;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.payout.HousekeeperPayoutService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Règle de scan DÉTERMINISTE (agent Opérations « ops », constellation métiers Phase 2) :
 * versements ménage BLOQUÉS dont la condition est désormais RÉUNIE (preuve photo arrivée
 * après la complétion, onboarding Connect terminé) ou versements en ÉCHEC à relancer →
 * carte HITL {@code CLEANING_PAYOUT} « Verser ».
 *
 * <p>La carte ne porte qu'un montant INDICATIF : l'apply passe par
 * {@code HousekeeperPayoutService.retryPayout} qui re-gate tout et re-résout les montants
 * depuis l'intervention (règle audit n°1). Les blocages structurels (montant non positif)
 * ne produisent PAS de carte : la relance échouerait à l'identique, ce serait du bruit.</p>
 *
 * <p>Zéro coût token. Dédup par intitulé stable (id de record). Best-effort.</p>
 */
@Service
public class CleaningPayoutScanner {

    private static final Logger log = LoggerFactory.getLogger(CleaningPayoutScanner.class);
    private static final String MODULE_OPS = "ops";

    private final HousekeeperPayoutRecordRepository recordRepository;
    private final InterventionRepository interventionRepository;
    private final HousekeeperPayoutConfigRepository configRepository;
    private final HousekeeperPayoutService payoutService;
    private final SupervisionSuggestionService suggestionService;

    public CleaningPayoutScanner(HousekeeperPayoutRecordRepository recordRepository,
                                 InterventionRepository interventionRepository,
                                 HousekeeperPayoutConfigRepository configRepository,
                                 HousekeeperPayoutService payoutService,
                                 SupervisionSuggestionService suggestionService) {
        this.recordRepository = recordRepository;
        this.interventionRepository = interventionRepository;
        this.configRepository = configRepository;
        this.payoutService = payoutService;
        this.suggestionService = suggestionService;
    }

    /** Évalue la règle pour un logement et émet les cartes HITL correspondantes. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            final List<HousekeeperPayoutRecord> stuck = recordRepository
                    .findByOrganizationIdAndStatusInOrderByCreatedAtDesc(orgId, Set.of(
                            HousekeeperPayoutRecord.Status.BLOCKED,
                            HousekeeperPayoutRecord.Status.FAILED));
            for (HousekeeperPayoutRecord record : stuck) {
                final Intervention intervention = interventionRepository
                        .findById(record.getInterventionId()).orElse(null);
                if (intervention == null || intervention.getProperty() == null
                        || !propertyId.equals(intervention.getProperty().getId())
                        || intervention.getAssignedUser() == null) {
                    continue; // autre logement, ou mission sans prestataire résoluble
                }
                if (!retryLooksUnblocked(record, intervention, orgId)) {
                    continue; // condition toujours manquante → la carte serait du bruit
                }
                emitPayoutCard(orgId, propertyId, record, intervention);
            }
        } catch (Exception e) {
            log.debug("cleaning payout scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * {@code true} si la relance a une chance d'aboutir : FAILED = toujours relançable ;
     * BLOCKED preuve manquante = preuve désormais présente ; BLOCKED onboarding =
     * onboarding désormais complet. Les autres motifs (montant non positif) restent muets.
     */
    private boolean retryLooksUnblocked(HousekeeperPayoutRecord record,
                                        Intervention intervention, Long orgId) {
        if (record.getStatus() == HousekeeperPayoutRecord.Status.FAILED) {
            return true;
        }
        final String reason = record.getFailureReason();
        if (HousekeeperPayoutRecord.REASON_PROOF_MISSING.equals(reason)) {
            return payoutService.isProofComplete(intervention);
        }
        if (HousekeeperPayoutRecord.REASON_ONBOARDING_INCOMPLETE.equals(reason)) {
            return configRepository
                    .findByUserIdAndOrganizationId(intervention.getAssignedUser().getId(), orgId)
                    .map(c -> c.getStripeAccountId() != null && c.isOnboardingCompleted())
                    .orElse(false);
        }
        return false;
    }

    private void emitPayoutCard(Long orgId, Long propertyId,
                                HousekeeperPayoutRecord record, Intervention intervention) {
        final String pro = intervention.getAssignedUser().getFullName() != null
                ? intervention.getAssignedUser().getFullName() : "le prestataire";
        final BigDecimal gross = intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost();
        final Long impactCents = gross != null
                ? gross.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
                : null;
        final boolean failed = record.getStatus() == HousekeeperPayoutRecord.Status.FAILED;
        suggestionService.recordActionable(
                orgId, propertyId, MODULE_OPS,
                "Versement ménage à " + (failed ? "relancer" : "débloquer")
                        + " (mission #" + intervention.getId() + ")",
                (failed
                        ? "Le transfert précédent a échoué. "
                        : "La condition qui bloquait le versement est désormais réunie "
                                + "(preuve photo / compte de versement). ")
                        + "« Verser » re-vérifie preuve, onboarding et montants au moment du "
                        + "transfert, puis paie " + pro + ".",
                SupervisionActionType.CLEANING_PAYOUT,
                "{\"recordId\":" + record.getId() + "}", impactCents, "info");
    }
}
