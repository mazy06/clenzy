package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.repository.ReservationRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

/** Empêche l'ancien remboursement gestionnaire et l'annulation publique de dépenser la même dette. */
@Service
public class ReservationRefundCoordination {
    public static final String SOURCE = "RESERVATION_REFUND_GUARD";
    private final ReservationRepository reservations;
    private final PaymentTransactionRepository payments;
    private final EntityManager em;
    public ReservationRefundCoordination(ReservationRepository reservations, PaymentTransactionRepository payments, EntityManager em) {
        this.reservations = reservations; this.payments = payments; this.em = em;
    }
    @Transactional
    public void reserve(Long org, Long id, String session, BigDecimal amount, String key) {
        var r = reservations.findById(id).orElseThrow();
        if (!Objects.equals(org, r.getOrganizationId())) throw new IllegalStateException("Réservation introuvable");
        em.refresh(r, LockModeType.PESSIMISTIC_WRITE);
        if (em.createQuery("select count(c) from OwnerPayoutReservation c where c.reservationId=:id", Long.class)
                .setParameter("id", id).getSingleResult() != 0) {
            throw new IllegalStateException("Séjour déjà attribué à un reversement : rapprochement requis avant remboursement.");
        }
        if (!Objects.equals(org, r.getOrganizationId()) || !Objects.equals(session, r.getStripeSessionId())
                || r.getPaymentCollection() != PaymentCollection.PMS || amount == null || amount.signum() <= 0
                || r.getTotalPrice() == null || amount.compareTo(r.getTotalPrice().subtract(
                    r.getCreditApplied() == null ? BigDecimal.ZERO : r.getCreditApplied())) > 0
                || "cancelled".equalsIgnoreCase(r.getStatus()) || r.getPaymentStatus() != PaymentStatus.PAID
                || !payments.findByOrganizationIdAndSourceTypeAndSourceId(org, "BOOKING_CANCELLATION", id).isEmpty())
            throw new IllegalStateException("Une annulation ou un remboursement doit être rapproché");
        var prior = payments.findByOrganizationIdAndSourceTypeAndSourceId(org, SOURCE, id);
        if (!prior.isEmpty()) {
            if (prior.size() != 1 || !key.equals(prior.get(0).getIdempotencyKey())
                    || !Objects.equals(prior.get(0).getCurrency(), r.getCurrency())
                    || prior.get(0).getMetadata() == null
                    || !Objects.equals(prior.get(0).getMetadata().get("checkoutSessionId"), session)
                    || prior.get(0).getAmount().compareTo(amount) != 0
                    || prior.get(0).getCreatedAt().isBefore(LocalDateTime.now().minusHours(23)))
                throw new IllegalStateException("Remboursement antérieur à rapprocher avant une nouvelle demande");
            return;
        }
        var guard = new PaymentTransaction(); guard.setOrganizationId(org); guard.setTransactionRef("RRG-" + UUID.randomUUID());
        guard.setSourceType(SOURCE); guard.setSourceId(id); guard.setPaymentType(TransactionType.REFUND);
        guard.setProviderType(PaymentProviderType.STRIPE); guard.setStatus(TransactionStatus.PROCESSING);
        guard.setIdempotencyKey(key); guard.setAmount(amount); guard.setCurrency(r.getCurrency());
        guard.setMetadata(java.util.Map.of("checkoutSessionId", session, "reviewRequired", true));
        payments.save(guard);
    }
}
