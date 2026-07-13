package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Réconciliation provider-agnostique du paiement d'une réservation (ADR
 * paiement multi-provider, Vague 2).
 *
 * <p>Déclenché par l'event outbox {@code PAYMENT_COMPLETED} (Kafka
 * {@code TOPIC_PAYMENT_EVENTS}) consommé par {@link PaymentEventConsumer}, quel
 * que soit le provider (Stripe via le webhook legacy → {@code completeTransaction},
 * ou PayZone/CMI via {@code PaymentWebhookRouter} → {@code completeTransaction}).</p>
 *
 * <p>La réservation est retrouvée via la référence de session provider stockée
 * dans {@code Reservation.stripeSessionId} à la création (= {@code providerTxId}
 * de la {@code PaymentTransaction}). On délègue le passage PROCESSING → PAID
 * (+ wallet/ledger/split/email/facture) à
 * {@link StripePaymentConfirmationService#confirmReservationPayment} — idempotent
 * (early-return PAID + transition gardée CAS), donc sûr sur re-livraison webhook
 * et retry Kafka.</p>
 */
@Service
public class ReservationPaymentReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(ReservationPaymentReconciliationService.class);

    private final PaymentTransactionRepository transactionRepository;
    private final StripePaymentConfirmationService paymentConfirmationService;

    public ReservationPaymentReconciliationService(PaymentTransactionRepository transactionRepository,
                                                   StripePaymentConfirmationService paymentConfirmationService) {
        this.transactionRepository = transactionRepository;
        this.paymentConfirmationService = paymentConfirmationService;
    }

    /**
     * Réconcilie la réservation rattachée à une {@link PaymentTransaction}
     * complétée. Idempotent.
     *
     * @param transactionRef référence du ledger (portée par l'event PAYMENT_COMPLETED)
     */
    @Transactional
    public void reconcile(String transactionRef) {
        PaymentTransaction tx = transactionRepository.findByTransactionRef(transactionRef).orElse(null);
        if (tx == null) {
            // Incohérence : la transaction que nous avons nous-mêmes publiée est introuvable.
            // Un retry ne la fera pas apparaître → on trace sans boucler.
            log.error("Reconciliation reservation : PaymentTransaction introuvable pour tx={} — ignoree", transactionRef);
            return;
        }

        String providerSessionId = tx.getProviderTxId();
        if (providerSessionId == null || providerSessionId.isBlank()) {
            log.error("Reconciliation reservation : providerTxId absent sur la tx {} — "
                    + "reconciliation impossible, verification manuelle requise", transactionRef);
            return;
        }

        paymentConfirmationService.confirmReservationPayment(providerSessionId);
        log.info("Reconciliation reservation OK : tx={} providerSession={}", transactionRef, providerSessionId);
    }
}
