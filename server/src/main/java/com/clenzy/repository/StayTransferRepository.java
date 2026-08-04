package com.clenzy.repository;

import com.clenzy.model.StayTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface StayTransferRepository extends JpaRepository<StayTransfer, Long> {

    /** Chemin public (lien voyageur) : le token EST l'autorisation, pas de contexte org. */
    Optional<StayTransfer> findByConfirmToken(UUID confirmToken);

    /** Une seule proposition active par séjour : pas de spam de liens concurrents. */
    boolean existsByOrganizationIdAndReservationIdAndStatus(
            Long organizationId, Long reservationId, StayTransfer.Status status);

    // Les transitions portent leur propre transaction (annotation sur l'interface :
    // le service appelant n'est pas transactionnel — le chemin public enchaîne CAS,
    // relogement sous TenantScopedExecutor, puis clôture, en transactions courtes).

    /**
     * Verrou d'exécution CAS : PROPOSED → CONFIRMED. 0 ligne = déjà confirmé/refusé/
     * périmé — le double clic du voyageur ne reloge pas deux fois.
     */
    @org.springframework.transaction.annotation.Transactional
    @Modifying
    @Query("UPDATE StayTransfer t SET t.status = 'CONFIRMED', t.confirmedAt = :now " +
           "WHERE t.id = :id AND t.status = 'PROPOSED'")
    int markConfirmed(@Param("id") Long id, @Param("now") Instant now);

    /** Clôture d'exécution : CONFIRMED → DONE une fois le relogement réellement fait. */
    @org.springframework.transaction.annotation.Transactional
    @Modifying
    @Query("UPDATE StayTransfer t SET t.status = 'DONE', t.executedAt = :now " +
           "WHERE t.id = :id AND t.status = 'CONFIRMED'")
    int markDone(@Param("id") Long id, @Param("now") Instant now);

    /** Refus voyageur ou échec d'exécution : état actif → CANCELLED. */
    @org.springframework.transaction.annotation.Transactional
    @Modifying
    @Query("UPDATE StayTransfer t SET t.status = 'CANCELLED', t.cancelledAt = :now " +
           "WHERE t.id = :id AND t.status IN ('PROPOSED', 'CONFIRMED')")
    int markCancelled(@Param("id") Long id, @Param("now") Instant now);
}
