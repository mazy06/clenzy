package com.clenzy.service.payout;

import com.clenzy.model.HousekeeperPayoutConfig;
import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.model.Intervention;
import com.clenzy.model.PayoutBeneficiary;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Opérations TRANSACTIONNELLES du payout housekeeper, dans un bean SÉPARÉ de
 * {@link HousekeeperPayoutService} : l'auto-invocation d'une méthode
 * {@code @Transactional} de la même classe ne passe pas par le proxy Spring
 * (audit règle 6 — transaction silencieusement absente). Aucun appel Stripe ici.
 */
@Service
public class HousekeeperPayoutRecorder {

    private final HousekeeperPayoutRecordRepository recordRepository;
    private final HousekeeperPayoutConfigRepository configRepository;
    private final ProviderPayoutBeneficiaryService beneficiaries;
    private final BaitlyProviderPayoutGuard fundingGuard;

    public HousekeeperPayoutRecorder(HousekeeperPayoutRecordRepository recordRepository,
                                     HousekeeperPayoutConfigRepository configRepository,
                                     ProviderPayoutBeneficiaryService beneficiaries, BaitlyProviderPayoutGuard fundingGuard) {
        this.recordRepository = recordRepository;
        this.configRepository = configRepository;
        this.beneficiaries = beneficiaries;
        this.fundingGuard = fundingGuard;
    }

    /**
     * Insert du record en transaction dédiée (REQUIRES_NEW : le verrou UNIQUE doit
     * être posé/constaté même si l'appelant est en transaction ; une violation ne
     * doit pas marquer rollback-only la transaction du lifecycle).
     * @return true si inséré, false si un record existe déjà (anti-double-payout).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean insertRecord(Intervention intervention, PayoutBeneficiary beneficiary, BigDecimal amount,
                                BigDecimal commission, Status status, String reason) {
        beneficiaries.lockAndRequireRecipient(intervention.getId(), intervention.getOrganizationId(), beneficiary);
        if (recordRepository.findByInterventionId(intervention.getId()).isPresent()) {
            return false; // pré-check informatif ; la contrainte UNIQUE reste l'arbitre.
        }
        // La décision de remboursement conserve ce même verrou jusqu'au commit.
        // Revalider ici : le contrôle effectué avant d'obtenir le verrou peut être périmé.
        if (status == Status.PENDING) fundingGuard.requireFunding(intervention.getId(), intervention.getOrganizationId(),
                beneficiary, amount, commission);
        HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(
                    intervention.getOrganizationId(), beneficiary.userId(), intervention.getId(),
                    amount, commission, status);
        record.setBeneficiaryOrganizationId(beneficiary.organizationId());
        record.setFailureReason(reason);
        // Le verrou partagé sérialise les préparations. Une erreur DB doit rester visible,
        // et non être avalée dans une transaction déjà marquée rollback-only.
        recordRepository.saveAndFlush(record);
        return true;
    }

    /** CAS PENDING → SENT (retour 0 = un concurrent a déjà transitionné → ne rien faire). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int markSent(Long recordId, String transferId) {
        return recordRepository.transitionStatus(recordId, Status.PENDING, Status.SENT, transferId, null);
    }

    /** CAS PENDING → FAILED avec raison tronquée. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int markFailed(Long recordId, String reason) {
        String truncated = reason != null && reason.length() > 250 ? reason.substring(0, 250) : reason;
        return recordRepository.transitionStatus(recordId, Status.PENDING, Status.FAILED, null, truncated);
    }

    /** Une réponse PSP inconnue exige une vérification, jamais une nouvelle émission. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int markReconciliationRequired(Long recordId) {
        return recordRepository.transitionStatus(recordId, Status.PENDING, Status.BLOCKED, null, "RECONCILIATION_REQUIRED");
    }

    /** CAS FAILED|BLOCKED → PENDING (relance admin) + refixe le montant. */
    @Transactional
    public int requeueRecord(Long recordId, Status from, BigDecimal net, BigDecimal commission) {
        if (from != Status.FAILED && from != Status.BLOCKED) throw new IllegalArgumentException("État non relançable.");
        var before = recordRepository.findById(recordId).orElseThrow();
        fundingGuard.requireFunding(before.getInterventionId(), before.getOrganizationId(), before.beneficiary(), net, commission);
        var current = fundingGuard.lockRecord(before);
        if (current.getStatus() != from) return 0;
        if (current.getStripeTransferId() != null || "RECONCILIATION_REQUIRED".equals(current.getFailureReason()))
            throw new IllegalStateException("Le transfert existant doit être rapproché avant toute relance.");
        int updated = recordRepository.transitionStatus(recordId, from, Status.PENDING, null, null);
        if (updated > 0) {
            // Le CAS bulk n'actualise pas l'entité déjà chargée. Sans refresh, le flush
            // du nouveau montant réécrirait son ancien statut BLOCKED/FAILED.
            current = fundingGuard.lockRecord(current);
            current.setAmount(net);
            current.setCommissionAmount(commission);
            recordRepository.save(current);
        }
        return updated;
    }

    /** Persistance du compte Connect créé (transaction courte — aucun appel Stripe). */
    @Transactional
    public void persistAccountId(Long userId, Long orgId, String accountId) {
        HousekeeperPayoutConfig config = configRepository
                .findByUserIdAndOrganizationId(userId, orgId)
                .orElseGet(() -> {
                    HousekeeperPayoutConfig c = new HousekeeperPayoutConfig();
                    c.setUserId(userId);
                    c.setOrganizationId(orgId);
                    return c;
                });
        config.setStripeAccountId(accountId);
        configRepository.save(config);
    }

    /** Persistance du statut d'onboarding (refresh manuel). */
    @Transactional
    public void markOnboarding(Long configId, boolean complete) {
        configRepository.findById(configId).ifPresent(c -> {
            c.setOnboardingCompleted(complete);
            configRepository.save(c);
        });
    }
}
