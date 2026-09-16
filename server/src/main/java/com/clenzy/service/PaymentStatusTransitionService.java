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

    private final DocumentGenerationOutbox documentOutbox;
    private final EntityManager entityManager;
    private final InterventionRepository interventionRepository;

    public PaymentStatusTransitionService(EntityManager entityManager,
                                          InterventionRepository interventionRepository, DocumentGenerationOutbox documentOutbox) {
        this.documentOutbox = documentOutbox;
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

    /** Partage le verrou de l'annulation ; le contexte chargé avant le verrou est rafraîchi. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void lockServiceRequestPayment(com.clenzy.model.ServiceRequest request) {
        entityManager.refresh(request, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
    }

    /** Ordre commun : demandes triées, puis missions triées ; verrous conservés jusqu'au commit. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void lockInterventionPayments(java.util.List<Intervention> missions) {
        var requests = new java.util.TreeMap<Long, com.clenzy.model.ServiceRequest>();
        for (var mission : missions) {
            if (mission.getServiceRequest() != null) {
                var request = mission.getServiceRequest();
                requests.put(request.getId(), request);
            }
        }
        requests.values().forEach(this::lockServiceRequestPayment);
        missions.stream().sorted(java.util.Comparator.comparing(Intervention::getId)).forEach(mission -> {
            entityManager.refresh(mission, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            if (mission.getServiceRequest() != null && !requests.containsKey(mission.getServiceRequest().getId())) {
                throw new IllegalStateException("La demande liée à la mission a changé ; réessayer le paiement");
            }
        });
    }

    private boolean markPaid(String entityName, Long id) {
        int updated = entityManager.createQuery(
                "UPDATE " + entityName + " e SET e.paymentStatus = :paid, e.paidAt = :now "
                + "WHERE e.id = :id AND (e.paymentStatus IS NULL OR (e.paymentStatus <> :paid AND e.paymentStatus <> :refunded))")
            .setParameter("paid", PaymentStatus.PAID)
            .setParameter("refunded", PaymentStatus.REFUNDED)
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

        if (intervention.getStatus() == com.clenzy.model.InterventionStatus.CANCELLED) {
            throw new IllegalStateException("Utilisez le dossier financier de l'accord annulé pour décider du remboursement");
        }

        if (intervention.getPaymentStatus() != PaymentStatus.PAID) {
            throw new IllegalStateException(
                "Seuls les paiements confirmes peuvent etre rembourses. Statut actuel: "
                + intervention.getPaymentStatus());
        }

        String sessionId = intervention.getStripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalStateException("Aucune session Stripe associee a cette intervention");
        }
        if (interventionRepository.existsByStripeSessionIdAndIdNot(sessionId, interventionId)) {
            throw new IllegalStateException("Paiement partagé entre plusieurs missions : rapprochement financier requis");
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
        Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new IllegalStateException("Intervention introuvable"));
        int updated = entityManager.createQuery(
                "UPDATE Intervention e SET e.paymentStatus = :refunded WHERE e.id = :id AND (e.paymentStatus IS NULL OR e.paymentStatus <> :refunded)")
            .setParameter("refunded", PaymentStatus.REFUNDED)
            .setParameter("id", interventionId)
            .executeUpdate();
        if (updated == 0) return; // Déjà remboursée, y compris par une transaction concurrente.
        String email = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                ? intervention.getProperty().getOwner().getEmail() : null;
        documentOutbox.requestRefundReceipt(interventionId, intervention.getOrganizationId(), email);
    }
}
