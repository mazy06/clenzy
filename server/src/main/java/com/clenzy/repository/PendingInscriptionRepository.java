package com.clenzy.repository;

import com.clenzy.model.PendingInscription;
import com.clenzy.model.PendingInscriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PendingInscriptionRepository extends JpaRepository<PendingInscription, Long> {
    Optional<PendingInscription> findByRequestId(java.util.UUID requestId);
    boolean existsByEmailIgnoreCaseAndStatusIn(String email, java.util.Collection<PendingInscriptionStatus> statuses);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from PendingInscription p where p.id=:id")
    Optional<PendingInscription> lockById(@org.springframework.data.repository.query.Param("id") Long id);

    /**
     * Rechercher une inscription en attente par l'ID de session Stripe
     */
    Optional<PendingInscription> findByStripeSessionId(String stripeSessionId);

    /**
     * Rechercher une inscription en attente par email
     */
    Optional<PendingInscription> findByEmailAndStatus(String email, PendingInscriptionStatus status);

    /**
     * Verifier si un email a deja une inscription en attente de paiement
     */
    boolean existsByEmailAndStatus(String email, PendingInscriptionStatus status);

    /**
     * Rechercher une inscription par le hash du token de confirmation email
     */
    Optional<PendingInscription> findByConfirmationTokenHash(String confirmationTokenHash);

    /**
     * Rechercher les inscriptions expirees pour nettoyage
     */
    List<PendingInscription> findByStatusAndExpiresAtBefore(PendingInscriptionStatus status, LocalDateTime dateTime);

    /**
     * Supprimer les inscriptions expirees
     */
    void deleteByStatusAndExpiresAtBefore(PendingInscriptionStatus status, LocalDateTime dateTime);
}
