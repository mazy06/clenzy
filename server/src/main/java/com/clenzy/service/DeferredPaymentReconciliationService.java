package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Réconciliation provider-agnostique des paiements différés groupés (ADR
 * paiement multi-provider, Vague 2).
 *
 * <p>Point d'entrée de la <em>completion</em> : déclenché par l'event outbox
 * {@code PAYMENT_COMPLETED} (Kafka {@code TOPIC_PAYMENT_EVENTS}) consommé par
 * {@link PaymentEventConsumer}, quel que soit le provider (Stripe via le webhook
 * legacy → {@code completeTransaction}, ou PayZone/CMI via
 * {@code PaymentWebhookRouter} → {@code completeTransaction}). Un seul chemin de
 * réconciliation pour tous les providers.</p>
 *
 * <p>La {@link PaymentTransaction} porte le lot : {@code sourceType} +
 * {@code intervention_ids} (metadata). On délègue le passage PROCESSING → PAID
 * (+ wallet/ledger/split/facture) à la logique idempotente existante
 * {@link StripePaymentConfirmationService#confirmGroupedPayment} — idempotente
 * (early-return PAID + transition gardée CAS), donc sûre sur re-livraison
 * webhook et sur retry Kafka.</p>
 */
@Service
public class DeferredPaymentReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(DeferredPaymentReconciliationService.class);

    private final PaymentTransactionRepository transactionRepository;
    private final StripePaymentConfirmationService paymentConfirmationService;

    public DeferredPaymentReconciliationService(PaymentTransactionRepository transactionRepository,
                                                StripePaymentConfirmationService paymentConfirmationService) {
        this.transactionRepository = transactionRepository;
        this.paymentConfirmationService = paymentConfirmationService;
    }

    /**
     * Réconcilie le lot d'interventions rattaché à une {@link PaymentTransaction}
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
            log.error("Reconciliation differee : PaymentTransaction introuvable pour tx={} — ignoree", transactionRef);
            return;
        }

        Map<String, Object> metadata = tx.getMetadata();
        Object rawIds = metadata != null ? metadata.get("intervention_ids") : null;
        String interventionIds = rawIds != null ? rawIds.toString() : null;
        if (interventionIds == null || interventionIds.isBlank()) {
            log.error("Reconciliation differee : intervention_ids absent des metadata de la tx {} — "
                    + "reconciliation impossible, verification manuelle requise", transactionRef);
            return;
        }

        // providerTxId = référence de session provider stockée à la création (traçabilité).
        paymentConfirmationService.confirmGroupedPayment(tx.getProviderTxId(), interventionIds);
        log.info("Reconciliation differee OK : tx={} sourceType={} interventions={}",
                transactionRef, tx.getSourceType(), interventionIds);
    }
}
