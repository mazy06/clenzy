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

    Optional<HousekeeperPayoutRecord> findByInterventionId(Long interventionId);

    List<HousekeeperPayoutRecord> findByUserIdAndOrganizationIdOrderByCreatedAtDesc(Long userId, Long organizationId);

    List<HousekeeperPayoutRecord> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

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
