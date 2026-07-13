package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.ai.AiCreditGrantService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Réconciliation provider-agnostique des flux de <strong>périphérie</strong>
 * (Vague 5 de l'ADR paiement multi-provider) : crédits IA, shop, upsells,
 * demandes de service.
 *
 * <p>Déclenché par l'event outbox {@code PAYMENT_COMPLETED} consommé par
 * {@link PaymentEventConsumer}, quel que soit le provider. Chaque méthode charge
 * la {@link PaymentTransaction} (sourceId + providerTxId + metadata) et délègue à
 * la logique de complétion existante (idempotente), en passant le
 * {@code providerTxId} là où l'ancien webhook passait le {@code stripeSessionId}.</p>
 */
@Service
public class PeripheralPaymentReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(PeripheralPaymentReconciliationService.class);

    private final PaymentTransactionRepository transactionRepository;
    private final AiCreditGrantService aiCreditGrantService;
    private final StripePaymentConfirmationService paymentConfirmationService;
    private final UpsellService upsellService;

    public PeripheralPaymentReconciliationService(PaymentTransactionRepository transactionRepository,
                                                  AiCreditGrantService aiCreditGrantService,
                                                  StripePaymentConfirmationService paymentConfirmationService,
                                                  UpsellService upsellService) {
        this.transactionRepository = transactionRepository;
        this.aiCreditGrantService = aiCreditGrantService;
        this.paymentConfirmationService = paymentConfirmationService;
        this.upsellService = upsellService;
    }

    /**
     * Crédite le pack de crédits IA acheté (idempotent : {@code checkoutSessionId} =
     * {@code providerTxId}). orgId = {@code sourceId} ; millicredits = metadata.
     */
    @Transactional
    public void reconcileAiCreditTopUp(String transactionRef) {
        PaymentTransaction tx = requireTx(transactionRef, "crédits IA");
        if (tx == null) {
            return;
        }
        Long orgId = tx.getSourceId();
        String providerTxId = tx.getProviderTxId();
        Map<String, Object> metadata = tx.getMetadata();
        Object rawMillis = metadata != null ? metadata.get("millicredits") : null;
        if (orgId == null || providerTxId == null || providerTxId.isBlank() || rawMillis == null) {
            log.error("Reconciliation crédits IA : sourceId/providerTxId/millicredits absent sur tx {} — "
                    + "reconciliation impossible, verification manuelle requise", transactionRef);
            return;
        }
        long millicredits;
        try {
            millicredits = Long.parseLong(rawMillis.toString());
        } catch (NumberFormatException e) {
            log.error("Reconciliation crédits IA : millicredits invalide '{}' sur tx {}", rawMillis, transactionRef);
            return;
        }
        aiCreditGrantService.grantTopUp(orgId, millicredits, providerTxId);
        log.info("Reconciliation crédits IA OK : tx={} org={} millicredits={}", transactionRef, orgId, millicredits);
    }

    /**
     * Confirme le paiement d'une demande de service (PROCESSING → PAID + création de
     * l'intervention + ledger). Idempotent. La SR est retrouvée par la réf de session
     * provider stockée à la création ({@code stripeSessionId} = {@code providerTxId}).
     */
    @Transactional
    public void reconcileServiceRequest(String transactionRef) {
        PaymentTransaction tx = requireTx(transactionRef, "demande de service");
        if (tx == null) {
            return;
        }
        String providerTxId = tx.getProviderTxId();
        if (providerTxId == null || providerTxId.isBlank()) {
            log.error("Reconciliation demande de service : providerTxId absent sur tx {} — "
                    + "reconciliation impossible, verification manuelle requise", transactionRef);
            return;
        }
        paymentConfirmationService.confirmServiceRequestPayment(providerTxId);
        log.info("Reconciliation demande de service OK : tx={} providerSession={}", transactionRef, providerTxId);
    }

    /**
     * Confirme une commande d'upsell (PENDING → PAID + split hôte/plateforme/conciergerie).
     * Idempotent. La commande est retrouvée par la réf de session provider ({@code stripeSessionId}
     * = {@code providerTxId}).
     */
    @Transactional
    public void reconcileUpsell(String transactionRef) {
        PaymentTransaction tx = requireTx(transactionRef, "upsell");
        if (tx == null) {
            return;
        }
        String providerTxId = tx.getProviderTxId();
        if (providerTxId == null || providerTxId.isBlank()) {
            log.error("Reconciliation upsell : providerTxId absent sur tx {} — "
                    + "reconciliation impossible, verification manuelle requise", transactionRef);
            return;
        }
        upsellService.markPaidBySession(providerTxId);
        log.info("Reconciliation upsell OK : tx={} providerSession={}", transactionRef, providerTxId);
    }

    private PaymentTransaction requireTx(String transactionRef, String flux) {
        PaymentTransaction tx = transactionRepository.findByTransactionRef(transactionRef).orElse(null);
        if (tx == null) {
            log.error("Reconciliation {} : PaymentTransaction introuvable pour tx={} — ignoree", flux, transactionRef);
        }
        return tx;
    }
}
