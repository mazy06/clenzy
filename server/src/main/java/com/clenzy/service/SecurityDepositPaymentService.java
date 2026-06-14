package com.clenzy.service;

import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.SecurityDepositRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCaptureParams;
import com.stripe.param.PaymentIntentCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Effet Stripe RÉEL de la caution / damage protection (CLZ Domaine 2 — anti-fraude) : pré-autorisation
 * (hold) à capture manuelle, capture (totale/partielle) et libération. Comble le HP-19.
 *
 * <p>Audit #2 : l'appel Stripe est réalisé <b>hors transaction DB</b> (ce service n'est pas
 * {@code @Transactional}) ; la machine à états (CAS) de {@link SecurityDepositService} applique ensuite
 * la transition dans sa propre transaction courte. Idempotency keys déterministes par dépôt.</p>
 */
@Service
public class SecurityDepositPaymentService {

    private static final Logger log = LoggerFactory.getLogger(SecurityDepositPaymentService.class);

    private final SecurityDepositRepository repository;
    private final SecurityDepositService depositService;
    private final StripeGateway stripeGateway;

    public SecurityDepositPaymentService(SecurityDepositRepository repository,
                                         SecurityDepositService depositService,
                                         StripeGateway stripeGateway) {
        this.repository = repository;
        this.depositService = depositService;
        this.stripeGateway = stripeGateway;
    }

    /** Pré-autorise (hold) le montant de la caution sur la carte. PENDING -> HELD. */
    public void placeHold(Long orgId, Long depositId) {
        SecurityDeposit deposit = load(orgId, depositId);
        requireStatus(deposit, SecurityDepositStatus.PENDING);

        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
            .setAmount(StripeAmounts.toMinorUnits(deposit.getAmount()))
            .setCurrency(deposit.getCurrency().toLowerCase(Locale.ROOT))
            .setCaptureMethod(PaymentIntentCreateParams.CaptureMethod.MANUAL)
            .putMetadata("depositId", String.valueOf(depositId))
            .putMetadata("reservationId", String.valueOf(deposit.getReservationId()))
            .setDescription("Caution reservation #" + deposit.getReservationId())
            .build();
        try {
            PaymentIntent pi = stripeGateway.createPaymentIntent(params, "deposit-hold-" + depositId);
            depositService.markHeld(orgId, depositId, pi.getId());
        } catch (StripeException e) {
            // Audit #7 : on ne masque pas l'échec — statut explicite FAILED + propagation.
            depositService.markFailed(orgId, depositId);
            throw new IllegalStateException("Echec du hold Stripe pour la caution " + depositId, e);
        }
    }

    /** Libère le hold (aucun débit). HELD -> RELEASED. */
    public void releaseHold(Long orgId, Long depositId) {
        SecurityDeposit deposit = load(orgId, depositId);
        requireStatus(deposit, SecurityDepositStatus.HELD);
        try {
            if (deposit.getExternalRef() != null && !deposit.getExternalRef().isBlank()) {
                PaymentIntent pi = stripeGateway.retrievePaymentIntent(deposit.getExternalRef());
                stripeGateway.cancelPaymentIntent(pi, "deposit-release-" + depositId);
            }
            depositService.release(orgId, depositId);
        } catch (StripeException e) {
            throw new IllegalStateException("Echec de la liberation Stripe pour la caution " + depositId, e);
        }
    }

    /** Capture tout ou partie de la caution (dégâts constatés). HELD -> CAPTURED. */
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

    private void requireStatus(SecurityDeposit deposit, SecurityDepositStatus expected) {
        if (deposit.getStatus() != expected) {
            throw new IllegalStateException(
                "Caution " + deposit.getId() + " au statut " + deposit.getStatus() + " (attendu " + expected + ")");
        }
    }
}
