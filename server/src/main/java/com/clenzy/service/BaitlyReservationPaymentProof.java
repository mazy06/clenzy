package com.clenzy.service;

import com.clenzy.model.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Objects;

/** Preuve métier des encaissements orchestrés, sous le verrou partagé avec les annulations. */
@Service
public class BaitlyReservationPaymentProof {
    private final EntityManager em;
    public BaitlyReservationPaymentProof(EntityManager em) { this.em = em; }

    /** Conserve le verrou jusqu'à la confirmation et ses écritures ; false pour un rejeu déjà appliqué. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean requireConfirmation(PaymentTransaction payment, String source) {
        require(payment != null && payment.getPaymentType() == TransactionType.CHECKOUT
                && payment.getStatus() == TransactionStatus.COMPLETED, "Encaissement non confirmé");
        require(source.equals(payment.getSourceType()) && payment.getSourceId() != null
                && payment.getOrganizationId() != null, "Origine de l'encaissement incohérente");
        require(payment.getProviderTxId() != null && !payment.getProviderTxId().isBlank(), "Session de paiement absente");
        Reservation stay = em.find(Reservation.class, payment.getSourceId(), LockModeType.PESSIMISTIC_WRITE);
        require(stay != null && Objects.equals(stay.getOrganizationId(), payment.getOrganizationId()),
                "Réservation hors organisation");
        // find() peut retourner une entité déjà chargée avant l'attente du verrou.
        em.refresh(stay, LockModeType.PESSIMISTIC_WRITE);
        em.refresh(payment, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(stay.getOrganizationId(), payment.getOrganizationId()), "Réservation hors organisation");
        require(payment.getStatus() == TransactionStatus.COMPLETED && payment.getPaymentType() == TransactionType.CHECKOUT
                && source.equals(payment.getSourceType()) && Objects.equals(stay.getId(), payment.getSourceId()),
                "Encaissement modifié : rapprochement requis");
        require(payment.getCurrency() != null && stay.getCurrency() != null
                && payment.getCurrency().equalsIgnoreCase(stay.getCurrency()), "Devise de paiement incohérente");
        require(positive(payment.getAmount()) && positive(stay.getTotalPrice()), "Montant de paiement incohérent");
        require(stay.getCancelledAt() == null && !"cancelled".equalsIgnoreCase(stay.getStatus()) && !"canceled".equalsIgnoreCase(stay.getStatus()),
                "Réservation annulée : rapprochement requis");
        require(payment.getDisputedAmount() == null || payment.getDisputedAmount().signum() == 0,
                "Encaissement contesté : rapprochement requis");
        require(payment.getMetadata() == null || !Boolean.TRUE.equals(payment.getMetadata().get("reviewRequired")),
                "Encaissement à rapprocher");
        if (stay.getPaymentStatus() == PaymentStatus.PAID) {
            require(payment.getProviderTxId().equals(stay.getStripeSessionId()), "Réservation déjà réglée par une autre session");
            return false;
        }
        if ("BOOKING_BALANCE".equals(source)) {
            requireOutstandingBalance(stay);
            require(payment.getAmount().compareTo(stay.getAmountDue()) == 0, "Solde encaissé différent du solde dû");
        } else {
            require(ReservationPaymentService.SOURCE_TYPE.equals(source), "Origine de paiement inconnue");
            require(stay.getPaymentStatus() == PaymentStatus.PENDING || stay.getPaymentStatus() == PaymentStatus.PROCESSING
                    || stay.getPaymentStatus() == PaymentStatus.FAILED, "État financier incompatible avec cet encaissement");
            require(payment.getProviderTxId().equals(stay.getStripeSessionId()), "Session différente de la réservation");
            require(payment.getAmount().compareTo(com.clenzy.booking.service.BaitlyReservationCredit.cash(stay)) == 0, "Montant encaissé différent du séjour");
        }
        if (com.clenzy.booking.service.BaitlyReservationCredit.applied(stay).signum() > 0) {
            require(ReservationPaymentService.SOURCE_TYPE.equals(source), "Acompte avec crédit à rapprocher");
            com.clenzy.booking.service.BaitlyReservationCredit.requireIntent(stay, payment);
        }
        return true;
    }

    public static void requireOutstandingBalance(Reservation stay) {
        require(stay.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID
                && positive(stay.getAmountPaid()) && positive(stay.getAmountDue()) && positive(stay.getTotalPrice())
                && stay.getAmountPaid().add(stay.getAmountDue()).compareTo(stay.getTotalPrice()) == 0,
                "Acompte et solde incohérents : rapprochement requis");
        require(stay.getCancelledAt() == null && !"cancelled".equalsIgnoreCase(stay.getStatus()) && !"canceled".equalsIgnoreCase(stay.getStatus()),
                "Réservation annulée : rapprochement requis");
    }
    private static boolean positive(BigDecimal amount) { return amount != null && amount.signum() > 0; }
    private static void require(boolean valid, String reason) { if (!valid) throw new IllegalStateException(reason); }
}
