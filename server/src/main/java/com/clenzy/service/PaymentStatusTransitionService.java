package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.repository.InterventionRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Transitions d'etat de paiement gardees (idempotence — Z3-BUGS-01 / Z3-SEC-02).
 *
 * <p>Chaque methode {@code markXxxPaid} execute un UPDATE conditionnel
 * (compare-and-set) : la ligne n'est modifiee que si le statut n'est pas deja
 * {@code PAID}. Sous PostgreSQL (READ COMMITTED), deux transactions concurrentes
 * — webhook Stripe rejoue (livraison at-least-once) et fallback authentifie
 * {@code getSessionStatus} — se serialisent sur le verrou de ligne : une seule
 * obtient {@code true}, l'autre {@code false} et doit abandonner le traitement.
 * Cela empeche le double credit ledger/split pour une meme reference.</p>
 *
 * <p>Le chargement du contexte de remboursement et la persistance du statut
 * REFUNDED sont egalement centralises ici afin que {@code StripeService} puisse
 * appeler Stripe HORS transaction (Z3-BUGS-06).</p>
 */
@Service
public class PaymentStatusTransitionService {

    private final EntityManager entityManager;
    private final InterventionRepository interventionRepository;

    public PaymentStatusTransitionService(EntityManager entityManager,
                                          InterventionRepository interventionRepository) {
        this.entityManager = entityManager;
        this.interventionRepository = interventionRepository;
    }

    /** @return {@code true} si la transition vers PAID a ete effectuee par cet appel. */
    @Transactional
    public boolean markInterventionPaid(Long interventionId) {
        return markPaid("Intervention", interventionId);
    }

    /** @return {@code true} si la transition vers PAID a ete effectuee par cet appel. */
    @Transactional
    public boolean markReservationPaid(Long reservationId) {
        return markPaid("Reservation", reservationId);
    }

    /** @return {@code true} si la transition vers PAID a ete effectuee par cet appel. */
    @Transactional
    public boolean markServiceRequestPaid(Long serviceRequestId) {
        return markPaid("ServiceRequest", serviceRequestId);
    }

    private boolean markPaid(String entityName, Long id) {
        int updated = entityManager.createQuery(
                "UPDATE " + entityName + " e SET e.paymentStatus = :paid, e.paidAt = :now "
                + "WHERE e.id = :id AND (e.paymentStatus IS NULL OR e.paymentStatus <> :paid)")
            .setParameter("paid", PaymentStatus.PAID)
            .setParameter("now", LocalDateTime.now())
            .setParameter("id", id)
            .executeUpdate();
        return updated == 1;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Remboursement intervention (support du pattern hors-transaction)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Donnees extraites en transaction (associations lazy resolues) pour piloter
     * un remboursement Stripe hors transaction.
     */
    public record InterventionRefundContext(Long interventionId,
                                            String stripeSessionId,
                                            String title,
                                            String ownerKeycloakId,
                                            String ownerEmail) {}

    /**
     * Charge et valide l'intervention remboursable dans une transaction courte
     * en lecture seule, puis en extrait les scalaires necessaires au flux de
     * remboursement (notifications, Kafka) — aucune entite detachee ne sort.
     */
    @Transactional(readOnly = true)
    public InterventionRefundContext loadRefundableIntervention(Long interventionId) {
        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new IllegalArgumentException("Intervention non trouvee: " + interventionId));

        if (intervention.getPaymentStatus() != PaymentStatus.PAID) {
            throw new IllegalStateException(
                "Seuls les paiements confirmes peuvent etre rembourses. Statut actuel: "
                + intervention.getPaymentStatus());
        }

        String sessionId = intervention.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalStateException("Aucune session Stripe associee a cette intervention");
        }

        String ownerKeycloakId = null;
        String ownerEmail = null;
        if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null) {
            ownerKeycloakId = intervention.getProperty().getOwner().getKeycloakId();
            ownerEmail = intervention.getProperty().getOwner().getEmail();
        }

        return new InterventionRefundContext(interventionId, sessionId,
            intervention.getTitle(), ownerKeycloakId, ownerEmail);
    }

    /** Persiste le statut REFUNDED dans une nouvelle transaction courte. */
    @Transactional
    public void markInterventionRefunded(Long interventionId) {
        int updated = entityManager.createQuery(
                "UPDATE Intervention e SET e.paymentStatus = :refunded WHERE e.id = :id")
            .setParameter("refunded", PaymentStatus.REFUNDED)
            .setParameter("id", interventionId)
            .executeUpdate();
        if (updated != 1) {
            throw new IllegalStateException(
                "Intervention introuvable lors de la persistance du remboursement: " + interventionId);
        }
    }
}
