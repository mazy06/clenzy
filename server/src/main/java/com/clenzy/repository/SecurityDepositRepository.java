package com.clenzy.repository;

import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SecurityDepositRepository extends JpaRepository<SecurityDeposit, Long> {

    /**
     * Cautions encore retenues bien après le départ du voyageur.
     *
     * <p>La libération automatique passe deux jours après le départ ; au-delà,
     * c'est qu'elle échoue en boucle (Stripe injoignable, hold antérieur au suivi
     * de son échéance). La base affirme alors {@code HELD} sans que la carte du
     * voyageur soit libérée — ou alors que plus aucun fonds n'est bloqué : fausse
     * sécurité en cas de dégât. Un hold échu est normalement sorti de HELD par
     * le scheduler des holds (EXPIRED / RELEASED).</p>
     */
    @Query("SELECT d FROM SecurityDeposit d, Reservation r "
        + "WHERE d.reservationId = r.id AND d.organizationId = :orgId "
        + "AND d.status = com.clenzy.model.SecurityDepositStatus.HELD "
        + "AND r.checkOut < :staleBefore "
        + "ORDER BY r.checkOut")
    List<SecurityDeposit> findHeldLongAfterCheckout(@Param("orgId") Long orgId,
                                                    @Param("staleBefore") LocalDate staleBefore);


    Optional<SecurityDeposit> findByOrganizationIdAndReservationId(Long organizationId, Long reservationId);

    Optional<SecurityDeposit> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Cautions encore bloquées (HELD) dont le séjour s'est terminé avant {@code cutoff}
     * — candidates à la libération automatique (scheduler). Jointure logique sur reservationId.
     */
    /** Cautions encore retenues pour un lot de réservations (départs du jour). */
    @Query("SELECT d FROM SecurityDeposit d WHERE d.reservationId IN :reservationIds "
        + "AND d.status = com.clenzy.model.SecurityDepositStatus.HELD")
    List<SecurityDeposit> findHeldByReservationIds(@Param("reservationIds") java.util.Collection<Long> reservationIds);

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
     * Cautions en attente de pré-autorisation dont la carte est enregistrée sur la réservation et
     * dont le séjour recoupe {@code [checkOutFrom, checkInUpTo]} — candidates à la pose du hold.
     * Fenêtre large en dates : l'échéance exacte se juge ensuite dans le fuseau du logement.
     */
    @Query("SELECT d FROM SecurityDeposit d, Reservation r "
        + "WHERE d.reservationId = r.id AND d.organizationId = r.organizationId "
        + "AND d.status = com.clenzy.model.SecurityDepositStatus.PENDING "
        + "AND r.stripeCustomerId IS NOT NULL AND r.stripePaymentMethodId IS NOT NULL "
        + "AND r.status <> 'cancelled' AND r.checkIn <= :checkInUpTo AND r.checkOut >= :checkOutFrom")
    List<SecurityDeposit> findPendingWithSavedCard(@Param("checkInUpTo") LocalDate checkInUpTo,
                                                   @Param("checkOutFrom") LocalDate checkOutFrom);

    /** Holds posés qui échoient avant {@code before} : à renouveler, ou déjà échus chez Stripe. */
    @Query("SELECT d FROM SecurityDeposit d WHERE d.status = com.clenzy.model.SecurityDepositStatus.HELD "
        + "AND d.holdExpiresAt IS NOT NULL AND d.holdExpiresAt <= :before ORDER BY d.holdExpiresAt")
    List<SecurityDeposit> findHeldExpiringBefore(@Param("before") Instant before);

    /** Hold posé (CAS depuis PENDING ou FAILED) : référence PSP + échéance Stripe, erreur effacée. */
    @Modifying
    @Transactional
    @Query("UPDATE SecurityDeposit d SET d.status = com.clenzy.model.SecurityDepositStatus.HELD, "
        + "d.externalRef = :externalRef, d.holdExpiresAt = :holdExpiresAt, d.holdError = NULL, "
        + "d.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE d.id = :id AND d.organizationId = :orgId AND d.status = :expectedStatus")
    int markHoldPlaced(@Param("id") Long id,
                       @Param("orgId") Long orgId,
                       @Param("expectedStatus") SecurityDepositStatus expectedStatus,
                       @Param("externalRef") String externalRef,
                       @Param("holdExpiresAt") Instant holdExpiresAt);

    /** Pré-autorisation refusée (CAS) : FAILED + motif, compteur de tentatives incrémenté. */
    @Modifying
    @Transactional
    @Query("UPDATE SecurityDeposit d SET d.status = com.clenzy.model.SecurityDepositStatus.FAILED, "
        + "d.holdError = :holdError, d.holdAttempts = d.holdAttempts + 1, d.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE d.id = :id AND d.organizationId = :orgId AND d.status = :expectedStatus")
    int markHoldFailed(@Param("id") Long id,
                       @Param("orgId") Long orgId,
                       @Param("expectedStatus") SecurityDepositStatus expectedStatus,
                       @Param("holdError") String holdError);

    /**
     * Renouvellement (CAS sur l'ANCIEN hold) : ne bascule que si la caution est toujours HELD sur
     * {@code previousRef} — une capture ou une libération concurrente fait échouer l'échange.
     */
    @Modifying
    @Transactional
    @Query("UPDATE SecurityDeposit d SET d.externalRef = :newRef, d.holdExpiresAt = :holdExpiresAt, "
        + "d.holdError = NULL, d.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE d.id = :id AND d.organizationId = :orgId "
        + "AND d.status = com.clenzy.model.SecurityDepositStatus.HELD AND d.externalRef = :previousRef")
    int markHoldRenewed(@Param("id") Long id,
                        @Param("orgId") Long orgId,
                        @Param("previousRef") String previousRef,
                        @Param("newRef") String newRef,
                        @Param("holdExpiresAt") Instant holdExpiresAt);

    /** Renouvellement refusé : le hold courant reste valide jusqu'à son échéance, le motif est noté. */
    @Modifying
    @Transactional
    @Query("UPDATE SecurityDeposit d SET d.holdError = :holdError, d.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE d.id = :id AND d.organizationId = :orgId "
        + "AND d.status = com.clenzy.model.SecurityDepositStatus.HELD AND d.externalRef = :externalRef")
    int markRenewalFailed(@Param("id") Long id,
                          @Param("orgId") Long orgId,
                          @Param("externalRef") String externalRef,
                          @Param("holdError") String holdError);

    /** Hold échu chez Stripe (CAS depuis HELD) : RELEASED si plus rien à garantir, sinon EXPIRED. */
    @Modifying
    @Transactional
    @Query("UPDATE SecurityDeposit d SET d.status = :outcome, d.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE d.id = :id AND d.organizationId = :orgId "
        + "AND d.status = com.clenzy.model.SecurityDepositStatus.HELD")
    int markHoldLapsed(@Param("id") Long id,
                       @Param("orgId") Long orgId,
                       @Param("outcome") SecurityDepositStatus outcome);

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
