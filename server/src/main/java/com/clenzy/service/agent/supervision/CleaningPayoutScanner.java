package com.clenzy.service.agent.supervision;

import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.Intervention;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.payout.HousekeeperPayoutService;
import com.clenzy.service.payout.ProviderPayoutAccountResolver;
import com.clenzy.service.payout.ProviderPayoutBeneficiaryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Règle de scan DÉTERMINISTE (agent Opérations « ops », constellation métiers Phase 2) :
 * versements prestataires de tous métiers BLOQUÉS dont la condition est désormais RÉUNIE (preuve photo arrivée
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
    private final ProviderPayoutAccountResolver accounts;
    private final ProviderPayoutBeneficiaryService beneficiaries;
    private final HousekeeperPayoutService payoutService;
    private final SupervisionSuggestionService suggestionService;

    public CleaningPayoutScanner(HousekeeperPayoutRecordRepository recordRepository,
                                 InterventionRepository interventionRepository,
                                 ProviderPayoutAccountResolver accounts,
                                 ProviderPayoutBeneficiaryService beneficiaries,
                                 HousekeeperPayoutService payoutService,
                                 SupervisionSuggestionService suggestionService) {
        this.recordRepository = recordRepository;
        this.interventionRepository = interventionRepository;
        this.accounts = accounts;
        this.beneficiaries = beneficiaries;
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
                try {
                    final Intervention intervention = interventionRepository
                            .findById(record.getInterventionId()).orElse(null);
                    if (intervention == null || intervention.getProperty() == null
                            || !propertyId.equals(intervention.getProperty().getId())
                            || !orgId.equals(intervention.getOrganizationId())
                            || !orgId.equals(record.getOrganizationId())
                            || intervention.getStatus() != com.clenzy.model.InterventionStatus.COMPLETED
                            || intervention.getPaymentStatus() != com.clenzy.model.PaymentStatus.PAID) {
                        continue;
                    }
                    var recipient = beneficiaries.resolve(intervention.getId(), orgId).orElse(null);
                    if (recipient == null || !record.beneficiary().equals(recipient.beneficiary())
                            || !retryLooksUnblocked(record, intervention)) {
                        continue; // condition toujours manquante → la carte serait du bruit
                    }
                    emitPayoutCard(orgId, propertyId, record, intervention);
                } catch (RuntimeException failure) {
                    // Une affectation obsolète exige un rapprochement, sans masquer les autres missions.
                    log.warn("Versement prestataire {} non proposé à la relance : {}", record.getId(), failure.getMessage());
                }
            }
        } catch (Exception e) {
            log.debug("Scan des versements prestataires indisponible org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * {@code true} si la preuve et le compte du bénéficiaire figé sont prêts.
     * Les blocages financiers structurels ou un résultat PSP incertain restent muets.
     */
    private boolean retryLooksUnblocked(HousekeeperPayoutRecord record,
                                        Intervention intervention) {
        final String reason = record.getFailureReason();
        if (record.getStatus() != HousekeeperPayoutRecord.Status.FAILED
                && !HousekeeperPayoutRecord.REASON_PROOF_MISSING.equals(reason)
                && !HousekeeperPayoutRecord.REASON_ONBOARDING_INCOMPLETE.equals(reason)) {
            return false;
        }
        return payoutService.isProofComplete(intervention)
                && accounts.resolve(intervention, record.beneficiary())
                    .map(c -> c.getStripeAccountId() != null && c.isOnboardingCompleted()).orElse(false);
    }

    private void emitPayoutCard(Long orgId, Long propertyId,
                                HousekeeperPayoutRecord record, Intervention intervention) {
        final String pro = record.getBeneficiaryOrganizationId() != null
                ? "l'organisation prestataire #" + record.getBeneficiaryOrganizationId()
                : intervention.getAssignedUser() != null && intervention.getAssignedUser().getFullName() != null
                    ? intervention.getAssignedUser().getFullName() : "le prestataire désigné";
        final BigDecimal gross = intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost();
        final Long impactCents = gross != null
                ? gross.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact()
                : null;
        final boolean failed = record.getStatus() == HousekeeperPayoutRecord.Status.FAILED;
        suggestionService.recordActionable(
                orgId, propertyId, MODULE_OPS,
                // Conserve la clé de déduplication historique pour les missions ménage.
                "Versement " + ("CLEANING".equals(intervention.getType()) ? "ménage" : "prestataire")
                        + " à " + (failed ? "relancer" : "débloquer")
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
