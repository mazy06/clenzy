package com.clenzy.repository;

import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface HousekeeperPayoutRecordRepository extends JpaRepository<HousekeeperPayoutRecord, Long> {
    @Query(value = "SELECT EXISTS (SELECT 1 FROM payment_transactions WHERE organization_id=:org "
            + "AND source_type='INTERVENTION' AND source_id=:mission AND payment_type='REFUND' "
            + "AND status NOT IN ('FAILED','CANCELLED'))", nativeQuery = true)
    boolean hasReservedRefund(@Param("org") Long org, @Param("mission") Long mission);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from HousekeeperPayoutRecord p where p.interventionId = :id and p.organizationId = :orgId")
    Optional<HousekeeperPayoutRecord> lockForReconciliation(@Param("id") Long id, @Param("orgId") Long orgId);

    Optional<HousekeeperPayoutRecord> findByInterventionId(Long interventionId);

    List<HousekeeperPayoutRecord> findByUserIdAndOrganizationIdOrderByCreatedAtDesc(Long userId, Long organizationId);

    List<HousekeeperPayoutRecord> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /** Records à débloquer/relancer (scanner CLEANING_PAYOUT de la constellation). */
    List<HousekeeperPayoutRecord> findByOrganizationIdAndStatusInOrderByCreatedAtDesc(
            Long organizationId, java.util.Collection<HousekeeperPayoutRecord.Status> statuses);

    /**
     * Transition de statut par UPDATE CONDITIONNEL (CAS — check-then-act interdit,
     * audit règle 8) : ne s'applique que si le record est encore dans {@code from}.
     * Retour 0 = un concurrent a déjà transitionné → l'appelant NE FAIT RIEN.
     */
    @Modifying
    @Query("UPDATE HousekeeperPayoutRecord r SET r.status = :to, r.stripeTransferId = :transferId, " +
           "r.failureReason = :reason, r.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE r.id = :id AND r.status = :from")
    int transitionStatus(@Param("id") Long id,
                         @Param("from") Status from,
                         @Param("to") Status to,
                         @Param("transferId") String transferId,
                         @Param("reason") String reason);
}
