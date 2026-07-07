package com.clenzy.booking.service;

import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeAmounts;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Orchestration de la caution côté booking engine en contexte SYSTÈME (webhook Stripe, hors tenant)
 * — par opposition à {@link com.clenzy.service.SecurityDepositService} qui valide l'ownership d'un
 * utilisateur authentifié. Ici l'org provient de la réservation (source serveur de confiance).
 *
 * <p><b>P0.3 — vraie caution séparée (carte enregistrée)</b> : après le paiement du séjour (carte
 * sauvegardée via {@code setup_future_usage=off_session}), on pose un hold off-session
 * (PaymentIntent {@code capture_method=manual}) sur cette carte. Le séjour n'est pas impacté ;
 * la capture (dégâts) / libération restent pilotées par le PMS ({@code /api/security-deposits}).</p>
 *
 * <p>Audit #2 : les appels Stripe sont hors transaction (méthodes d'orchestration non
 * {@code @Transactional}) ; les écritures DB passent par le proxy via {@link #self} (audit #6 :
 * éviter l'auto-invocation qui contourne {@code @Transactional}). Transitions par CAS (audit #8).</p>
 */
@Service
public class BookingEngineDepositService {

    private static final Logger log = LoggerFactory.getLogger(BookingEngineDepositService.class);

    /** Délai par défaut après le check-out avant libération automatique d'un hold non capturé. */
    public static final int RELEASE_DAYS_AFTER_CHECKOUT = 2;

    private final SecurityDepositRepository depositRepository;
    private final ReservationRepository reservationRepository;
    private final StripeGateway stripeGateway;
    private final ObjectProvider<BookingEngineDepositService> self;

    public BookingEngineDepositService(SecurityDepositRepository depositRepository,
                                       ReservationRepository reservationRepository,
                                       StripeGateway stripeGateway,
                                       ObjectProvider<BookingEngineDepositService> self) {
        this.depositRepository = depositRepository;
        this.reservationRepository = reservationRepository;
        this.stripeGateway = stripeGateway;
        this.self = self;
    }

    /**
     * Met en place la caution APRÈS le paiement du séjour (à invoquer après commit du webhook).
     * Idempotent : ne fait rien si une caution existe déjà pour la réservation.
     */
    public void setupCautionAfterPayment(Long reservationId, Long orgId, BigDecimal amount,
                                         String currency, String customerId, String stayPaymentIntentId) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        if (customerId == null || customerId.isBlank() || stayPaymentIntentId == null || stayPaymentIntentId.isBlank()) {
            log.warn("Caution résa {} non posée : carte non enregistrée (customer/paymentIntent absent)", reservationId);
            return;
        }

        // 1. Résout le payment_method (carte enregistrée) depuis le PaymentIntent du séjour.
        final String paymentMethodId;
        try {
            PaymentIntent stayPi = stripeGateway.retrievePaymentIntent(stayPaymentIntentId);
            paymentMethodId = stayPi.getPaymentMethod();
        } catch (StripeException e) {
            log.error("Caution résa {} : échec lecture PaymentIntent {} : {}", reservationId, stayPaymentIntentId, e.getMessage());
            return;
        }
        if (paymentMethodId == null || paymentMethodId.isBlank()) {
            log.warn("Caution résa {} : aucun payment_method enregistré sur le séjour", reservationId);
            return;
        }

        // 2. Crée (idempotent) le dépôt PENDING + enregistre la carte sur la résa (tx via proxy).
        final String effectiveCurrency = (currency != null && !currency.isBlank()) ? currency : "EUR";
        Long depositId = self.getObject().createPendingDeposit(orgId, reservationId, amount, effectiveCurrency, customerId, paymentMethodId);
        if (depositId == null) {
            log.info("Caution résa {} déjà présente — pas de nouveau hold", reservationId);
            return;
        }

        // 3. Hold off-session à capture manuelle (Stripe, hors transaction).
        try {
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(StripeAmounts.toMinorUnits(amount))
                .setCurrency(effectiveCurrency.toLowerCase(Locale.ROOT))
                .setCaptureMethod(PaymentIntentCreateParams.CaptureMethod.MANUAL)
                .setCustomer(customerId)
                .setPaymentMethod(paymentMethodId)
                .setOffSession(true)
                .setConfirm(true)
                .putMetadata("depositId", String.valueOf(depositId))
                .putMetadata("reservationId", String.valueOf(reservationId))
                .setDescription("Caution réservation #" + reservationId)
                .build();
            PaymentIntent hold = stripeGateway.createPaymentIntent(params, "deposit-hold-" + depositId);
            self.getObject().markHeld(orgId, depositId, hold.getId());
            log.info("Caution résa {} : hold posé ({}), montant {} {}", reservationId, hold.getId(), amount, effectiveCurrency);
        } catch (StripeException e) {
            // Audit #7 : échec explicite (FAILED), pas de masquage. Best-effort : le séjour est payé,
            // la caution pourra être reposée depuis le PMS (carte enregistrée sur la résa).
            self.getObject().markFailed(orgId, depositId);
            log.error("Caution résa {} : hold off-session échoué : {} — à reposer côté PMS", reservationId, e.getMessage());
        }
    }

    /**
     * Libère (annule le hold Stripe puis RELEASED) une caution HELD — utilisé par le scheduler.
     * Renvoie {@code true} si la libération a réussi, {@code false} si l'appel Stripe a échoué
     * (le scheduler s'appuie sur ce retour pour ne remonter dans la constellation qu'en cas de succès).
     */
    public boolean releaseHold(SecurityDeposit deposit) {
        try {
            if (deposit.getExternalRef() != null && !deposit.getExternalRef().isBlank()) {
                PaymentIntent pi = stripeGateway.retrievePaymentIntent(deposit.getExternalRef());
                stripeGateway.cancelPaymentIntent(pi, "deposit-release-" + deposit.getId());
            }
            self.getObject().release(deposit.getOrganizationId(), deposit.getId());
            log.info("Caution {} libérée automatiquement (séjour terminé)", deposit.getId());
            return true;
        } catch (StripeException e) {
            log.error("Caution {} : libération auto échouée : {}", deposit.getId(), e.getMessage());
            return false;
        }
    }

    @Transactional(readOnly = true)
    public List<SecurityDeposit> findHoldsToRelease(LocalDate checkoutBefore) {
        return depositRepository.findHeldWithCheckoutBefore(checkoutBefore);
    }

    /** Crée le dépôt PENDING + enregistre la carte sur la résa. Renvoie l'id, ou null si déjà présent. */
    @Transactional
    public Long createPendingDeposit(Long orgId, Long reservationId, BigDecimal amount,
                                     String currency, String customerId, String paymentMethodId) {
        if (depositRepository.findByOrganizationIdAndReservationId(orgId, reservationId).isPresent()) {
            return null;
        }
        SecurityDeposit deposit = new SecurityDeposit();
        deposit.setOrganizationId(orgId);
        deposit.setReservationId(reservationId);
        deposit.setAmount(amount);
        deposit.setCurrency(currency);
        deposit.setStatus(SecurityDepositStatus.PENDING);
        deposit = depositRepository.save(deposit);

        Reservation reservation = reservationRepository.findById(reservationId).orElse(null);
        if (reservation != null) {
            reservation.setStripeCustomerId(customerId);
            reservation.setStripePaymentMethodId(paymentMethodId);
            reservationRepository.save(reservation);
        }
        return deposit.getId();
    }

    @Transactional
    public void markHeld(Long orgId, Long depositId, String externalRef) {
        depositRepository.transitionStatus(depositId, orgId,
            SecurityDepositStatus.PENDING, SecurityDepositStatus.HELD, externalRef);
    }

    @Transactional
    public void markFailed(Long orgId, Long depositId) {
        depositRepository.transitionStatus(depositId, orgId,
            SecurityDepositStatus.PENDING, SecurityDepositStatus.FAILED, null);
    }

    @Transactional
    public void release(Long orgId, Long depositId) {
        depositRepository.transitionStatus(depositId, orgId,
            SecurityDepositStatus.HELD, SecurityDepositStatus.RELEASED, null);
    }
}
