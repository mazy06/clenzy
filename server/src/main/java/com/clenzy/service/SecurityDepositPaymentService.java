package com.clenzy.service;

import com.clenzy.dto.SecurityDepositDto;
import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCaptureParams;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Effet Stripe RÉEL de la caution / damage protection (CLZ Domaine 2 — anti-fraude) : pré-autorisation
 * (hold) à capture manuelle, capture (totale/partielle) et libération. Comble le HP-19.
 *
 * <p>Le hold se pose hors session sur la carte enregistrée à la réservation, et seulement à partir du
 * jour de l'arrivée ({@link SecurityDepositHoldPolicy}) : une autorisation carte ne vit que 4 j 18 h
 * à 7 j. La pose elle-même est portée par {@link SecurityDepositHoldService}, partagée avec le
 * scheduler et le booking engine.</p>
 *
 * <p>Audit #2 : l'appel Stripe est réalisé <b>hors transaction DB</b> (ce service n'est pas
 * {@code @Transactional}) ; la machine à états (CAS) applique ensuite la transition dans sa propre
 * transaction courte. Idempotency keys déterministes par dépôt.</p>
 */
@Service
public class SecurityDepositPaymentService {

    private final SecurityDepositRepository repository;
    private final ReservationRepository reservationRepository;
    private final SecurityDepositService depositService;
    private final SecurityDepositHoldService holdService;
    private final StripeGateway stripeGateway;

    public SecurityDepositPaymentService(SecurityDepositRepository repository,
                                         ReservationRepository reservationRepository,
                                         SecurityDepositService depositService,
                                         SecurityDepositHoldService holdService,
                                         StripeGateway stripeGateway) {
        this.repository = repository;
        this.reservationRepository = reservationRepository;
        this.depositService = depositService;
        this.holdService = holdService;
        this.stripeGateway = stripeGateway;
    }

    /**
     * Demande la pré-autorisation (hold) de la caution sur la carte enregistrée à la réservation.
     * Avant le jour de l'arrivée, la caution reste PENDING : le scheduler posera le hold ce jour-là.
     * Depuis FAILED, relance une tentative (nouvelle clé d'idempotence).
     *
     * @return l'état de la caution après la demande (HELD, PENDING planifiée, ou FAILED + motif)
     * @throws IllegalStateException sans carte enregistrée, hors de la fenêtre de pose après un refus,
     *                               ou si Stripe est indisponible
     */
    public SecurityDepositDto placeHold(Long orgId, Long depositId) {
        SecurityDeposit deposit = load(orgId, depositId);
        if (deposit.getStatus() != SecurityDepositStatus.PENDING && deposit.getStatus() != SecurityDepositStatus.FAILED) {
            throw new IllegalStateException(
                "Caution " + depositId + " au statut " + deposit.getStatus() + " (attendu PENDING ou FAILED)");
        }
        Reservation reservation = reservationOf(orgId, deposit);
        if (!SecurityDepositHoldService.hasSavedCard(reservation)) {
            throw new IllegalStateException("Aucune carte enregistrée sur la réservation " + reservation.getId()
                + " : la caution ne peut pas être pré-autorisée hors session");
        }
        SecurityDepositHoldService.HoldOutcome outcome = holdService.placeHoldIfDue(deposit, reservation);
        if (outcome == SecurityDepositHoldService.HoldOutcome.NOT_DUE && deposit.getStatus() == SecurityDepositStatus.FAILED) {
            throw new IllegalStateException("Caution " + depositId + " : la pré-autorisation ne peut être relancée "
                + "que du jour de l'arrivée au jour du départ");
        }
        if (outcome == SecurityDepositHoldService.HoldOutcome.UNAVAILABLE) {
            throw new IllegalStateException("Stripe indisponible : pré-autorisation de la caution " + depositId + " non posée");
        }
        return SecurityDepositDto.from(load(orgId, depositId));
    }

    /** Libère le hold (aucun débit). HELD -> RELEASED — y compris un hold déjà échu chez Stripe. */
    public void releaseHold(Long orgId, Long depositId) {
        SecurityDeposit deposit = load(orgId, depositId);
        requireStatus(deposit, SecurityDepositStatus.HELD);
        try {
            if (deposit.getExternalRef() != null && !deposit.getExternalRef().isBlank()) {
                holdService.cancelAuthorization(deposit.getExternalRef(), "deposit-release-" + depositId);
            }
            depositService.release(orgId, depositId);
        } catch (StripeException e) {
            throw new IllegalStateException("Echec de la liberation Stripe pour la caution " + depositId, e);
        }
    }

    /**
     * Capture tout ou partie de la caution (dégâts constatés). HELD -> CAPTURED. Un hold échu chez
     * Stripe n'a plus de fonds : la caution quitte HELD (EXPIRED) et la capture est refusée.
     */
    public void captureHold(Long orgId, Long depositId, BigDecimal amount, String reason) {
        SecurityDeposit deposit = load(orgId, depositId);
        requireStatus(deposit, SecurityDepositStatus.HELD);
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Le montant capture doit etre > 0");
        }
        if (amount.compareTo(deposit.getAmount()) > 0) {
            throw new IllegalArgumentException("Le montant capture depasse la caution");
        }
        try {
            PaymentIntent pi = stripeGateway.retrievePaymentIntent(deposit.getExternalRef());
            if (SecurityDepositHoldService.PI_CANCELED.equals(pi.getStatus())) {
                holdService.recordLapse(deposit, reservationOf(orgId, deposit));
                throw new IllegalStateException("La pré-autorisation de la caution " + depositId
                    + " a expiré chez la banque du voyageur : plus aucun fonds à capturer");
            }
            PaymentIntentCaptureParams captureParams = PaymentIntentCaptureParams.builder()
                .setAmountToCapture(StripeAmounts.toMinorUnits(amount))
                .build();
            stripeGateway.capturePaymentIntent(pi, captureParams, "deposit-capture-" + depositId);
            depositService.capture(orgId, depositId, amount, reason);
        } catch (StripeException e) {
            throw new IllegalStateException("Echec de la capture Stripe pour la caution " + depositId, e);
        }
    }

    private SecurityDeposit load(Long orgId, Long depositId) {
        return repository.findByIdAndOrganizationId(depositId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Caution introuvable: " + depositId));
    }

    /** Réservation de la caution, logement chargé (fuseau), bornée à l'org (audit #3). */
    private Reservation reservationOf(Long orgId, SecurityDeposit deposit) {
        return reservationRepository.findByIdWithGuestAndProperty(deposit.getReservationId())
            .filter(r -> orgId.equals(r.getOrganizationId()))
            .orElseThrow(() -> new IllegalArgumentException(
                "Reservation introuvable pour la caution " + deposit.getId()));
    }

    private void requireStatus(SecurityDeposit deposit, SecurityDepositStatus expected) {
        if (deposit.getStatus() != expected) {
            throw new IllegalStateException(
                "Caution " + deposit.getId() + " au statut " + deposit.getStatus() + " (attendu " + expected + ")");
        }
    }
}
