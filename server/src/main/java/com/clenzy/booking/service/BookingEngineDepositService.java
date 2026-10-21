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
    public void recoverMissingCaution(Long reservationId, Long orgId) {
        Reservation reservation = reservationRepository.findByIdWithGuestAndProperty(reservationId)
                .filter(r -> orgId.equals(r.getOrganizationId())).orElseThrow();
        try {
            var session = stripeGateway.retrieveSession(reservation.getStripeSessionId());
            if (!"paid".equals(session.getPaymentStatus()))
                throw new IllegalStateException("Paiement Stripe non confirmé pour la caution à reprendre.");
            self.getObject().setupCautionAfterPayment(reservationId, orgId, reservation.getSecurityDepositAmount(),
                    reservation.getCurrency(), session.getCustomer(), session.getPaymentIntent());
        } catch (StripeException failure) {
            throw new IllegalStateException("La carte de caution reste à rapprocher avec Stripe.", failure);
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void setupCautionAfterPayment(Long reservationId, Long orgId, BigDecimal amount,
                                         String currency, String customerId, String stayPaymentIntentId) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        if (customerId == null || customerId.isBlank() || stayPaymentIntentId == null || stayPaymentIntentId.isBlank()) {
            throw new IllegalStateException("Caution non posée : carte non enregistrée (customer/paymentIntent absent).");
        }

        // 1. Résout le payment_method (carte enregistrée) depuis le PaymentIntent du séjour.
        final String paymentMethodId;
        try {
            PaymentIntent stayPi = stripeGateway.retrievePaymentIntent(stayPaymentIntentId);
            if (!customerId.equals(stayPi.getCustomer()) || !"succeeded".equals(stayPi.getStatus()))
                throw new IllegalStateException("Le paiement confirmé et la carte enregistrée doivent appartenir au même voyageur.");
            paymentMethodId = stayPi.getPaymentMethod();
        } catch (StripeException e) {
            throw new IllegalStateException("Lecture du paiement de séjour impossible : caution à reprendre.", e);
        }
        if (paymentMethodId == null || paymentMethodId.isBlank()) {
            throw new IllegalStateException("Aucune carte enregistrée sur le séjour : caution à reprendre.");
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

    /** Crée le dépôt PENDING + enregistre la carte sur la résa. Renvoie le dépôt, ou null si déjà présent. */
    @Transactional
    public SecurityDeposit createPendingDeposit(Long orgId, Long reservationId, BigDecimal amount,
                                     String currency, String customerId, String paymentMethodId) {
        Reservation reservation = reservationRepository.lockDepositReservation(reservationId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Séjour introuvable dans cette organisation."));
        if (reservation.getSecurityDepositAmount() != null && amount.compareTo(reservation.getSecurityDepositAmount()) != 0)
            throw new IllegalStateException("Le montant de caution doit correspondre au montant annoncé à la réservation.");
        reservation.setStripeCustomerId(customerId);
        reservation.setStripePaymentMethodId(paymentMethodId);
        reservationRepository.save(reservation);
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

        return deposit;
    }

    public record PublicSummary(BigDecimal amount, String status) {}

    @Transactional(readOnly = true)
    public java.util.Optional<PublicSummary> publicSummary(Long orgId, Long reservationId) {
        return depositRepository.findByOrganizationIdAndReservationId(orgId, reservationId)
                .map(deposit -> new PublicSummary(deposit.getAmount(), deposit.getStatus().name()));
    }

}
