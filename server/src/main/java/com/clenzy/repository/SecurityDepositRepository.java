package com.clenzy.repository;

import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SecurityDepositRepository extends JpaRepository<SecurityDeposit, Long> {

    Optional<SecurityDeposit> findByOrganizationIdAndReservationId(Long organizationId, Long reservationId);

    Optional<SecurityDeposit> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Cautions encore bloquées (HELD) dont le séjour s'est terminé avant {@code cutoff}
     * — candidates à la libération automatique (scheduler). Jointure logique sur reservationId.
     */
    @Query("SELECT d FROM SecurityDeposit d WHERE d.status = com.clenzy.model.SecurityDepositStatus.HELD "
        + "AND EXISTS (SELECT 1 FROM Reservation r WHERE r.id = d.reservationId AND r.checkOut < :cutoff)")
    List<SecurityDeposit> findHeldWithCheckoutBefore(@Param("cutoff") LocalDate cutoff);

    /**
     * Transition de statut atomique (CAS, audit #8) : ne modifie que si encore dans
     * {@code expectedStatus} et appartenant à l'org. Renvoie le nombre de lignes affectées
     * (1 = succès, 0 = course perdue / état déjà changé). Peut poser la référence PSP du hold.
     */
    @Modifying
    @Query("UPDATE SecurityDeposit d SET d.status = :newStatus, "
        + "d.externalRef = COALESCE(:externalRef, d.externalRef), d.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE d.id = :id AND d.organizationId = :orgId AND d.status = :expectedStatus")
    int transitionStatus(@Param("id") Long id,
                         @Param("orgId") Long orgId,
                         @Param("expectedStatus") SecurityDepositStatus expectedStatus,
                         @Param("newStatus") SecurityDepositStatus newStatus,
                         @Param("externalRef") String externalRef);

    /**
     * Capture atomique (CAS) : passe HELD → CAPTURED en fixant le montant encaissé + le motif,
     * uniquement si encore HELD et dans l'org. Renvoie le nombre de lignes affectées.
     */
    @Modifying
    @Query("UPDATE SecurityDeposit d SET d.status = com.clenzy.model.SecurityDepositStatus.CAPTURED, "
        + "d.capturedAmount = :capturedAmount, d.reason = :reason, d.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE d.id = :id AND d.organizationId = :orgId "
        + "AND d.status = com.clenzy.model.SecurityDepositStatus.HELD")
    int capture(@Param("id") Long id,
                @Param("orgId") Long orgId,
                @Param("capturedAmount") BigDecimal capturedAmount,
                @Param("reason") String reason);
}
