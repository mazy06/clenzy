package com.clenzy.service.payout;

import com.clenzy.model.HousekeeperPayoutConfig;
import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.model.Intervention;
import com.clenzy.model.User;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
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

    private static final Logger log = LoggerFactory.getLogger(HousekeeperPayoutRecorder.class);

    private final HousekeeperPayoutRecordRepository recordRepository;
    private final HousekeeperPayoutConfigRepository configRepository;

    public HousekeeperPayoutRecorder(HousekeeperPayoutRecordRepository recordRepository,
                                     HousekeeperPayoutConfigRepository configRepository) {
        this.recordRepository = recordRepository;
        this.configRepository = configRepository;
    }

    /**
     * Insert du record en transaction dédiée (REQUIRES_NEW : le verrou UNIQUE doit
     * être posé/constaté même si l'appelant est en transaction ; une violation ne
     * doit pas marquer rollback-only la transaction du lifecycle).
     * @return true si inséré, false si un record existe déjà (anti-double-payout).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean insertRecord(Intervention intervention, User pro, BigDecimal amount,
                                BigDecimal commission, Status status, String reason) {
        if (recordRepository.findByInterventionId(intervention.getId()).isPresent()) {
            return false; // pré-check informatif ; la contrainte UNIQUE reste l'arbitre.
        }
        try {
            HousekeeperPayoutRecord record = new HousekeeperPayoutRecord(
                    intervention.getOrganizationId(), pro.getId(), intervention.getId(),
                    amount, commission, status);
            record.setFailureReason(reason);
            recordRepository.save(record);
            return true;
        } catch (DataIntegrityViolationException e) {
            log.info("Payout intervention {} : record concurrent détecté (unique) — aucun doublon",
                    intervention.getId());
            return false;
        }
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

    /** CAS FAILED|BLOCKED → PENDING (relance admin) + refixe le montant. */
    @Transactional
    public int requeueRecord(Long recordId, Status from, BigDecimal net, BigDecimal commission) {
        int updated = recordRepository.transitionStatus(recordId, from, Status.PENDING, null, null);
        if (updated > 0) {
            recordRepository.findById(recordId).ifPresent(r -> {
                r.setAmount(net);
                r.setCommissionAmount(commission);
                recordRepository.save(r);
            });
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
