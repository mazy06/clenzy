package com.clenzy.repository;

import com.clenzy.model.StayModification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface StayModificationRepository extends JpaRepository<StayModification, Long> {

    /** Chemin public (lien voyageur) : le token EST l'autorisation. */
    Optional<StayModification> findByConfirmToken(UUID confirmToken);

    /** Une seule proposition active par séjour. */
    boolean existsByOrganizationIdAndReservationIdAndStatus(
            Long organizationId, Long reservationId, StayModification.Status status);

    // Transitions transactionnelles portées par l'interface (le service public
    // enchaîne CAS → reschedule sous TenantScopedExecutor → clôture).

    /** Verrou CAS : PROPOSED → CONFIRMED — un double clic n'exécute pas deux fois. */
    @org.springframework.transaction.annotation.Transactional
    @Modifying
    @Query("UPDATE StayModification m SET m.status = 'CONFIRMED', m.confirmedAt = :now " +
           "WHERE m.id = :id AND m.status = 'PROPOSED'")
    int markConfirmed(@Param("id") Long id, @Param("now") Instant now);

    /** Clôture : CONFIRMED → DONE une fois l'avenant réellement appliqué. */
    @org.springframework.transaction.annotation.Transactional
    @Modifying
    @Query("UPDATE StayModification m SET m.status = 'DONE', m.executedAt = :now, " +
           "m.newTotal = :newTotal, m.priceDelta = :priceDelta " +
           "WHERE m.id = :id AND m.status = 'CONFIRMED'")
    int markDone(@Param("id") Long id, @Param("now") Instant now,
                 @Param("newTotal") java.math.BigDecimal newTotal,
                 @Param("priceDelta") java.math.BigDecimal priceDelta);

    /** Refus voyageur ou échec d'exécution : état actif → CANCELLED. */
    @org.springframework.transaction.annotation.Transactional
    @Modifying
    @Query("UPDATE StayModification m SET m.status = 'CANCELLED', m.cancelledAt = :now " +
           "WHERE m.id = :id AND m.status IN ('PROPOSED', 'CONFIRMED')")
    int markCancelled(@Param("id") Long id, @Param("now") Instant now);
}
