package com.clenzy.booking.service;

import com.clenzy.model.Reservation;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.SecurityDepositHoldPolicy;
import com.clenzy.service.SecurityDepositHoldService;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Orchestration de la caution côté booking engine en contexte SYSTÈME (webhook Stripe, hors tenant)
 * — par opposition à {@link com.clenzy.service.SecurityDepositService} qui valide l'ownership d'un
 * utilisateur authentifié. Ici l'org provient de la réservation (source serveur de confiance).
 *
 * <p><b>P0.3 — vraie caution séparée (carte enregistrée)</b> : après le paiement du séjour (carte
 * sauvegardée via {@code setup_future_usage=off_session}), on crée la caution PENDING et on
 * enregistre la carte sur la réservation. La pré-autorisation elle-même (hold off-session,
 * {@code capture_method=manual}) n'est posée que le jour de l'arrivée : une autorisation carte ne
 * vit que 4 j 18 h à 7 j ({@link SecurityDepositHoldPolicy}). Posée à la réservation, elle était
 * annulée par Stripe avant le séjour. La capture (dégâts) / libération restent pilotées par le PMS
 * ({@code /api/security-deposits}).</p>
 *
 * <p>Audit #2 : les appels Stripe sont hors transaction (méthodes d'orchestration sans transaction,
 * ou {@code NOT_SUPPORTED}) ; les écritures DB passent par le proxy via {@link #self} (audit #6 :
 * éviter l'auto-invocation qui contourne {@code @Transactional}). Transitions par CAS (audit #8).</p>
 */
@Service
public class BookingEngineDepositService {

    private static final Logger log = LoggerFactory.getLogger(BookingEngineDepositService.class);

    /** Délai après le check-out avant libération automatique d'un hold non capturé (fin de la fenêtre de réclamation). */
    public static final int RELEASE_DAYS_AFTER_CHECKOUT = SecurityDepositHoldPolicy.CLAIM_DAYS_AFTER_CHECKOUT;

    private final SecurityDepositRepository depositRepository;
    private final ReservationRepository reservationRepository;
    private final StripeGateway stripeGateway;
    private final SecurityDepositHoldService holdService;
    private final ObjectProvider<BookingEngineDepositService> self;

    public BookingEngineDepositService(SecurityDepositRepository depositRepository,
                                       ReservationRepository reservationRepository,
                                       StripeGateway stripeGateway,
                                       SecurityDepositHoldService holdService,
                                       ObjectProvider<BookingEngineDepositService> self) {
        this.depositRepository = depositRepository;
        this.reservationRepository = reservationRepository;
        this.stripeGateway = stripeGateway;
        this.holdService = holdService;
        this.self = self;
    }

    /**
     * Met en place la caution APRÈS le paiement du séjour (à invoquer après commit du webhook) :
     * caution PENDING + carte enregistrée sur la réservation. Le hold n'est posé tout de suite que
     * si l'arrivée est aujourd'hui (réservation de dernière minute) ; sinon le scheduler le posera
     * le jour J. Idempotent : ne fait rien si une caution existe déjà pour la réservation.
     *
     * <p>{@code NOT_SUPPORTED} : l'appelant ({@code PublicBookingService}) déclenche cette méthode en
     * {@code afterCommit} de la transaction du webhook. Spring y garde la transaction commitée liée
     * au thread : sans suspension, chaque écriture « participerait » à cette transaction terminée —
     * la caution n'était jamais commitée et l'UPDATE du hold levait {@code TransactionRequiredException},
     * laissant chez Stripe un hold que la base ignorait (prouvé par {@code BookingCautionAfterCommitIT}).
     * Suspendue, chaque écriture ouvre sa propre transaction courte et Stripe reste hors transaction.</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
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
        SecurityDeposit deposit = self.getObject().createPendingDeposit(orgId, reservationId, amount, effectiveCurrency, customerId, paymentMethodId);
        if (deposit == null) {
            log.info("Caution résa {} déjà présente — pas de nouveau hold", reservationId);
            return;
        }

        // 3. Hold off-session seulement si l'arrivée est aujourd'hui (Stripe, hors transaction).
        Reservation reservation = reservationRepository.findByIdWithGuestAndProperty(reservationId).orElse(null);
        if (reservation == null) {
            log.error("Caution résa {} : réservation introuvable après enregistrement de la carte", reservationId);
            return;
        }
        SecurityDepositHoldService.HoldOutcome outcome = holdService.placeHoldIfDue(deposit, reservation);
        log.info("Caution résa {} : carte enregistrée, pré-autorisation {}", reservationId,
            outcome == SecurityDepositHoldService.HoldOutcome.NOT_DUE
                ? "prévue le jour de l'arrivée (" + reservation.getCheckIn() + ")" : outcome);
    }

    /**
     * Libère (annule le hold Stripe puis RELEASED) une caution HELD — utilisé par le scheduler.
     * Renvoie {@code true} si la libération a réussi, {@code false} si l'appel Stripe a échoué
     * (le scheduler s'appuie sur ce retour pour ne remonter dans la constellation qu'en cas de succès).
     */
    public boolean releaseHold(SecurityDeposit deposit) {
        try {
            if (deposit.getExternalRef() != null && !deposit.getExternalRef().isBlank()) {
                holdService.cancelAuthorization(deposit.getExternalRef(), "deposit-release-" + deposit.getId());
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

    /** Crée le dépôt PENDING + enregistre la carte sur la résa. Renvoie le dépôt, ou null si déjà présent. */
    @Transactional
    public SecurityDeposit createPendingDeposit(Long orgId, Long reservationId, BigDecimal amount,
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
        return deposit;
    }

    @Transactional
    public void release(Long orgId, Long depositId) {
        depositRepository.transitionStatus(depositId, orgId,
            SecurityDepositStatus.HELD, SecurityDepositStatus.RELEASED, null);
    }
}
