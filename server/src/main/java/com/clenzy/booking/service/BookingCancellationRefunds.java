package com.clenzy.booking.service;

import com.clenzy.booking.dto.CancellationResultDto;
import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.RefundContext;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.PaymentStatusTransitionService;
import com.clenzy.service.ReservationCancellationLedger;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Objects;
import java.util.UUID;

/** Décision figée avec l'annulation. Les appels Stripe sont assurés par un autre bean, hors transaction. */
@Service
public class BookingCancellationRefunds {
    public static final String SOURCE = "BOOKING_CANCELLATION";
    private final PaymentTransactionRepository payments;
    private final ReservationRepository reservations;
    private final EntityManager entityManager;
    private final PaymentStatusTransitionService transitions;
    private final ReservationCancellationLedger ledger;
    private final com.clenzy.repository.OwnerPayoutReservationRepository payoutClaims;
    private final GuestCreditService credits;

    public BookingCancellationRefunds(PaymentTransactionRepository payments, ReservationRepository reservations,
            EntityManager entityManager, PaymentStatusTransitionService transitions, ReservationCancellationLedger ledger,
            com.clenzy.repository.OwnerPayoutReservationRepository payoutClaims,GuestCreditService credits) {
        this.payments = payments; this.reservations = reservations; this.entityManager = entityManager;
        this.transitions = transitions; this.ledger = ledger; this.payoutClaims = payoutClaims;
        this.credits=credits;
    }

    /** Appelée sous le verrou de réservation du service public, avant le commit de l'annulation. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void prepare(Reservation reservation, CancellationRefundPreviewDto preview, BigDecimal requested) {
        requested = requested == null ? BigDecimal.ZERO : requested.max(BigDecimal.ZERO);
        if (find(reservation) != null) return;
        if (reservation.getPaymentStatus() == PaymentStatus.PENDING
                || reservation.getPaymentStatus() == PaymentStatus.NOT_REQUIRED) requested = BigDecimal.ZERO;

        var refund = new PaymentTransaction();
        refund.setOrganizationId(reservation.getOrganizationId());
        refund.setTransactionRef("BCR-" + UUID.randomUUID());
        refund.setIdempotencyKey("BOOKING-CANCEL-" + reservation.getOrganizationId() + "-" + reservation.getId());
        refund.setProviderType(PaymentProviderType.STRIPE);
        refund.setPaymentType(TransactionType.REFUND);
        refund.setSourceType(SOURCE); refund.setSourceId(reservation.getId());
        refund.setAmount(requested); refund.setCurrency(reservation.getCurrency());
        refund.setStatus(TransactionStatus.PROCESSING);
        var metadata = new HashMap<String, Object>();
        metadata.put("policyType", preview.policyType()); metadata.put("refundPercentage", preview.refundPercentage());
        metadata.put("cancellationRefund", true);
        metadata.put("paymentStatusAtCancellation", Objects.toString(reservation.getPaymentStatus(), "UNKNOWN"));
        refund.setMetadata(metadata);
        var candidates = payments.findReservationFunding(reservation.getOrganizationId(), java.util.List.of(reservation.getId()),
                com.clenzy.service.payout.ReservationPayoutFunding.SOURCES).stream()
                .filter(t -> t.getPaymentType() == TransactionType.CHECKOUT && t.getStatus() == TransactionStatus.COMPLETED).toList();
        BigDecimal cash = cash(reservation);
        boolean eligible = payoutClaims.findClaimedReservationIds(java.util.List.of(reservation.getId())).isEmpty()
                && reservation.getPaymentStatus() == PaymentStatus.PAID && reservation.getPaymentCollection() == PaymentCollection.PMS
                && payments.findByOrganizationIdAndSourceTypeAndSourceId(reservation.getOrganizationId(),
                    com.clenzy.service.ReservationRefundCoordination.SOURCE, reservation.getId()).isEmpty()
                && candidates.size() == 1 && "RESERVATION".equals(candidates.get(0).getSourceType())
                && candidates.get(0).getProviderType() == PaymentProviderType.STRIPE
                && candidates.get(0).getProviderTxId() != null && candidates.get(0).getProviderTxId().startsWith("cs_")
                && Objects.equals(reservation.getStripeSessionId(), candidates.get(0).getProviderTxId())
                && Objects.equals(reservation.getCurrency(), candidates.get(0).getCurrency())
                && "EUR".equals(reservation.getCurrency()) && cash.signum() > 0
                && candidates.get(0).getAmount().compareTo(cash) == 0 && requested.compareTo(cash) <= 0;
        if (requested.signum() == 0) {
            refund.setStatus(TransactionStatus.CANCELLED);
        } else if (eligible) {
            metadata.put("originalTransactionRef", candidates.get(0).getTransactionRef());
            metadata.put("originalAmount", cash.toPlainString());
            metadata.put("checkoutSessionId", reservation.getStripeSessionId());
        } else {
            refund.setStatus(TransactionStatus.FAILED);
            metadata.put("reviewRequired", true);
            refund.setErrorMessage("Encaissement unique Stripe EUR non rapproché : aucune émission automatique");
        }
        payments.save(refund);
    }

    @Transactional(readOnly = true)
    public CancellationResultDto result(Reservation reservation, String status) {
        var refund = find(reservation);
        if (refund == null) return new CancellationResultDto(status, BigDecimal.ZERO,
                reservation.getCurrency(), null, 0,
                "cancelled".equalsIgnoreCase(reservation.getStatus()) && reservation.getStripeSessionId() != null
                        && reservation.getPaymentStatus() != PaymentStatus.PENDING ? "UNKNOWN" : "NONE", BigDecimal.ZERO);
        var metadata = refund.getMetadata();
        boolean lateReceipt = refund.getStatus() == TransactionStatus.CANCELLED
                && "PENDING".equals(metadata.get("paymentStatusAtCancellation")) && reservation.getPaymentStatus() == PaymentStatus.PAID;
        String state = Boolean.TRUE.equals(metadata.get("reviewRequired")) || lateReceipt ? "RECONCILIATION_REQUIRED"
                : refund.getStatus() == TransactionStatus.CANCELLED ? "NONE" : refund.getStatus() == TransactionStatus.COMPLETED ? "CONFIRMED"
                : refund.getStatus() == TransactionStatus.FAILED ? "FAILED" : "PENDING";
        return new CancellationResultDto(status, refund.getAmount(), refund.getCurrency(),
                (String) metadata.get("policyType"), ((Number) metadata.getOrDefault("refundPercentage", 0)).intValue(),
                state, "CONFIRMED".equals(state) ? refund.getAmount() : BigDecimal.ZERO);
    }

    private PaymentTransaction find(Reservation r) {
        var found = payments.findByIdempotencyKey("BOOKING-CANCEL-" + r.getOrganizationId() + "-" + r.getId()).orElse(null);
        if (found != null && (!Objects.equals(found.getOrganizationId(), r.getOrganizationId())
                || !Objects.equals(found.getSourceId(), r.getId()) || !SOURCE.equals(found.getSourceType())))
            throw new IllegalStateException("Dossier d'annulation incohérent");
        return found;
    }

    public record Decision(RefundContext context, BigDecimal amount, boolean confirmed) {}

    @Transactional(readOnly = true)
    public Decision load(Long org, String ref) {
        var refund = require(org, ref);
        var metadata = refund.getMetadata();
        var original = payments.findByTransactionRef((String) metadata.get("originalTransactionRef")).orElseThrow();
        var reservation = reservations.findById(refund.getSourceId()).orElseThrow();
        requireIdentity(refund, original, reservation);
        if (refund.getStatus() != TransactionStatus.COMPLETED) ledger.validate(reservation, refund, original.getAmount());
        return new Decision(new RefundContext(org, original.getProviderTxId(), original.getTransactionRef(),
                original.getCurrency(), original.getAmount(), ref, refund.getProviderTxId(), refund.getCreatedAt()), refund.getAmount(),
                refund.getStatus() == TransactionStatus.COMPLETED);
    }

    private void requireIdentity(PaymentTransaction refund, PaymentTransaction original, Reservation reservation) {
        if (refund.getStatus() != TransactionStatus.COMPLETED
                    && !payoutClaims.findClaimedReservationIds(java.util.List.of(reservation.getId())).isEmpty()
                || (refund.getStatus() != TransactionStatus.COMPLETED && reservation.getPaymentStatus() != PaymentStatus.PAID)
                || payments.findReservationFunding(refund.getOrganizationId(), java.util.List.of(reservation.getId()),
                    com.clenzy.service.payout.ReservationPayoutFunding.SOURCES).stream()
                    .filter(t -> t.getPaymentType() == TransactionType.CHECKOUT && t.getStatus() == TransactionStatus.COMPLETED).count() != 1
                || !Objects.equals(refund.getOrganizationId(), original.getOrganizationId())
                || !Objects.equals(refund.getOrganizationId(), reservation.getOrganizationId())
                || !Objects.equals(refund.getSourceId(), original.getSourceId()) || !"RESERVATION".equals(original.getSourceType())
                || original.getPaymentType() != TransactionType.CHECKOUT || original.getStatus() != TransactionStatus.COMPLETED
                || original.getProviderType() != PaymentProviderType.STRIPE || !"cancelled".equalsIgnoreCase(reservation.getStatus())
                || !Objects.equals(original.getProviderTxId(), refund.getMetadata().get("checkoutSessionId"))
                || !Objects.equals(original.getProviderTxId(), reservation.getStripeSessionId())
                || !Objects.equals(original.getCurrency(), refund.getCurrency())
                || !Objects.equals(refund.getCurrency(), reservation.getCurrency()) || reservation.getPaymentCollection() != PaymentCollection.PMS
                || original.getAmount().compareTo(new BigDecimal((String) refund.getMetadata().get("originalAmount"))) != 0
                || original.getAmount().compareTo(cash(reservation)) != 0
                || refund.getAmount().signum() <= 0 || refund.getAmount().compareTo(original.getAmount()) > 0) {
            throw new IllegalStateException("Identité du remboursement de réservation à rapprocher");
        }
    }

    @Transactional
    public void apply(Long org, String ref, PaymentResult result) {
        // Même ordre de verrous pour annulation, confirmation et reprise : réservation, puis dossier.
        var found = require(org, ref);
        var reservation = reservations.findById(found.getSourceId()).orElseThrow();
        if (!Objects.equals(org, reservation.getOrganizationId())) throw new IllegalStateException("Organisation incohérente");
        entityManager.refresh(reservation, LockModeType.PESSIMISTIC_WRITE);
        var refund = payments.lockByReference(org, ref).orElseThrow();
        entityManager.refresh(refund);
        if (refund.getStatus() == TransactionStatus.COMPLETED) {
            if (!result.success() || !"REFUNDED".equals(result.status())
                    || !Objects.equals(refund.getProviderTxId(), result.providerTxId()))
                throw new IllegalStateException("Évolution tardive : rapprochement financier requis");
            refund.setMetadata(withoutReview(refund)); refund.setErrorMessage(null); payments.save(refund);
            return;
        }
        var original = payments.findByTransactionRef((String) refund.getMetadata().get("originalTransactionRef")).orElseThrow();
        requireIdentity(refund, original, reservation);
        if (result.providerTxId() == null || refund.getProviderTxId() != null && !refund.getProviderTxId().equals(result.providerTxId()))
            throw new IllegalStateException("Preuve de remboursement absente ou divergente");
        refund.setProviderTxId(result.providerTxId());
        if (result.success()) {
            if (!"REFUNDED".equals(result.status())) throw new IllegalStateException("Succès PSP non confirmé");
            ledger.reverse(reservation, refund, original.getAmount());
            credits.reverseRewards(org,reservation.getConfirmationCode(),original.getAmount(),BigDecimal.ZERO,refund.getAmount(),refund.getTransactionRef());
            transitions.markReservationRefunded(org, reservation.getId(), refund.getAmount().compareTo(original.getAmount()) == 0);
            refund.setStatus(TransactionStatus.COMPLETED); refund.setErrorMessage(null);
            refund.setMetadata(withoutReview(refund));
        } else if (refund.getStatus() != TransactionStatus.FAILED) {
            refund.setStatus("REFUND_REJECTED".equals(result.status()) ? TransactionStatus.FAILED : TransactionStatus.PROCESSING);
            refund.setErrorMessage(result.errorMessage());
        }
        // Le lot suivant doit aussi atteindre les dossiers derrière les attentes PSP inchangées.
        checkedNow(refund);
        payments.save(refund);
    }

    @Transactional
    public void recordFailure(Long org, String ref) {
        var refund = payments.lockByReference(org, ref).orElseThrow();
        if (refund.getStatus() == TransactionStatus.FAILED) return;
        var metadata = new HashMap<>(refund.getMetadata()); metadata.put("reviewRequired", true);
        refund.setMetadata(metadata); refund.setErrorMessage("Réponse ou rapprochement à vérifier ; même dossier conservé");
        checkedNow(refund);
        // PROCESSING reste repris par le worker, sans nouvelle clé d'émission.
        payments.save(refund);
    }

    private PaymentTransaction require(Long org, String ref) {
        var tx = payments.findByTransactionRef(ref).orElseThrow();
        if (!Objects.equals(org, tx.getOrganizationId()) || !SOURCE.equals(tx.getSourceType())
                || tx.getPaymentType() != TransactionType.REFUND || tx.getProviderType() != PaymentProviderType.STRIPE
                || tx.getMetadata() == null || !Boolean.TRUE.equals(tx.getMetadata().get("cancellationRefund")))
            throw new IllegalStateException("Dossier d'annulation introuvable");
        return tx;
    }

    private static HashMap<String, Object> withoutReview(PaymentTransaction tx) {
        var metadata = new HashMap<>(tx.getMetadata()); metadata.remove("reviewRequired"); return metadata;
    }

    private static void checkedNow(PaymentTransaction tx) {
        var metadata = new HashMap<>(tx.getMetadata());
        metadata.put("lastCheckedAt", java.time.LocalDateTime.now().toString());
        tx.setMetadata(metadata); // @PreUpdate renouvelle updatedAt même si Stripe reste pending.
    }

    static BigDecimal cash(Reservation r) {
        return (r.getTotalPrice() == null ? BigDecimal.ZERO : r.getTotalPrice())
                .subtract(r.getCreditApplied() == null ? BigDecimal.ZERO : r.getCreditApplied()).max(BigDecimal.ZERO);
    }
}
