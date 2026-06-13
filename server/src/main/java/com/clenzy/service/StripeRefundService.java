package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.NotificationKey;
import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.RefundCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Remboursements Stripe + contre-passation ledger — extrait de
 * {@link StripeService} (G1).
 *
 * <p>ATTENTION transactions : {@link #refundPayment} est concu pour s'executer
 * SANS transaction DB englobante (pattern Z3-BUGS-06 : preparation en
 * transaction courte via {@code PaymentStatusTransitionService}, appel Stripe
 * hors transaction avec idempotency key, persistance dans une nouvelle
 * transaction). C'est {@code StripeService.refundPayment}
 * ({@code @Transactional(NOT_SUPPORTED)}) qui garantit ce contexte — ne pas
 * appeler cette methode depuis un contexte transactionnel.</p>
 */
@Service
public class StripeRefundService {

    private static final Logger log = LoggerFactory.getLogger(StripeRefundService.class);

    private final StripeGateway stripeGateway;
    private final PaymentStatusTransitionService paymentStatusTransitionService;
    private final PaymentLedgerReversalService paymentLedgerReversalService;
    private final NotificationService notificationService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public StripeRefundService(StripeGateway stripeGateway,
                               PaymentStatusTransitionService paymentStatusTransitionService,
                               PaymentLedgerReversalService paymentLedgerReversalService,
                               NotificationService notificationService,
                               KafkaTemplate<String, Object> kafkaTemplate) {
        this.stripeGateway = stripeGateway;
        this.paymentStatusTransitionService = paymentStatusTransitionService;
        this.paymentLedgerReversalService = paymentLedgerReversalService;
        this.notificationService = notificationService;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Rembourse un paiement via Stripe et met a jour le statut de l'intervention.
     *
     * <p>Pattern anti double-remboursement (Z3-BUGS-06) : les donnees sont
     * preparees dans une transaction courte, l'appel Stripe (effet externe
     * irreversible) est emis HORS transaction avec une idempotency key derivee
     * de l'intervention, puis le resultat est persiste dans une nouvelle
     * transaction. Un re-essai apres echec de persistance rejoue la meme
     * idempotency key : Stripe renvoie le meme remboursement, aucun double debit.</p>
     */
    public void refundPayment(Long interventionId) throws StripeException {
        PaymentStatusTransitionService.InterventionRefundContext ctx =
            paymentStatusTransitionService.loadRefundableIntervention(interventionId);

        String paymentIntentId = resolvePaymentIntentId(ctx.stripeSessionId());

        // Remboursement total — hors transaction DB, idempotent cote Stripe
        RefundCreateParams refundParams = RefundCreateParams.builder()
            .setPaymentIntent(paymentIntentId)
            .build();
        stripeGateway.createRefund(refundParams, "refund-intervention-" + interventionId);

        persistRefundResult(interventionId);
        recordRefundLedgerReversal(interventionId);
        notifyRefundCompleted(ctx);
        publishRefundDocumentEvent(ctx);
    }

    /**
     * Rembourse integralement le paiement d'une session Checkout (Z4A-BUGS-03 :
     * paiement recu alors que les dates ne sont plus disponibles, ou montant
     * divergent du devis serveur). Idempotent cote Stripe via une idempotency key
     * derivee de la session : un re-essai ne produit pas de second remboursement.
     */
    public void refundCheckoutSessionPayment(String sessionId, String reason) throws StripeException {
        Session session = stripeGateway.retrieveSession(sessionId);
        String paymentIntentId = session != null ? session.getPaymentIntent() : null;
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new IllegalStateException("Aucun PaymentIntent trouve pour la session: " + sessionId);
        }
        RefundCreateParams params = RefundCreateParams.builder()
            .setPaymentIntent(paymentIntentId)
            .build();
        stripeGateway.createRefund(params, "refund-checkout-session-" + sessionId);
        log.warn("Remboursement automatique emis pour la session {} : {}", sessionId, reason);
    }

    /**
     * Contre-passe les ecritures ledger du paiement rembourse (Z3-BUGS-06) :
     * sans cela, les credits ESCROW→PLATFORM et le split restaient en place
     * apres remboursement (soldes wallets surevalues). Best-effort assume : le
     * remboursement Stripe est deja parti et le statut REFUNDED persiste — un
     * echec ici declenche une alerte de reconciliation au lieu de faire echouer
     * l'operation (qui ne pourrait plus etre annulee cote Stripe).
     */
    private void recordRefundLedgerReversal(Long interventionId) {
        try {
            paymentLedgerReversalService.reverseInterventionPaymentEntries(interventionId);
        } catch (Exception e) {
            log.error("Remboursement intervention {} : contre-passation ledger en echec — "
                + "reconciliation requise", interventionId, e);
            notifyLedgerReconciliationRequired("intervention", String.valueOf(interventionId),
                "contre-passation ledger du remboursement non enregistree");
        }
    }

    private String resolvePaymentIntentId(String sessionId) throws StripeException {
        Session session = stripeGateway.retrieveSession(sessionId);
        String paymentIntentId = (session != null) ? session.getPaymentIntent() : null;
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            throw new IllegalStateException("Aucun PaymentIntent trouve pour la session: " + sessionId);
        }
        return paymentIntentId;
    }

    private void persistRefundResult(Long interventionId) {
        try {
            paymentStatusTransitionService.markInterventionRefunded(interventionId);
        } catch (Exception e) {
            log.error("Remboursement Stripe emis pour l'intervention {} mais la persistance du statut a echoue — "
                + "reconciliation requise. Relancer l'operation est sans risque (idempotency key refund-intervention-{}).",
                interventionId, interventionId, e);
            throw new IllegalStateException(
                "Remboursement emis cote Stripe mais la mise a jour du statut a echoue — relancer l'operation.", e);
        }
    }

    private void notifyRefundCompleted(PaymentStatusTransitionService.InterventionRefundContext ctx) {
        try {
            if (ctx.ownerKeycloakId() != null) {
                notificationService.notify(
                    ctx.ownerKeycloakId(),
                    NotificationKey.PAYMENT_REFUND_COMPLETED,
                    "Remboursement effectue",
                    "Le paiement pour l'intervention \"" + ctx.title() + "\" a ete rembourse",
                    "/interventions/" + ctx.interventionId()
                );
            }
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PAYMENT_REFUND_COMPLETED,
                "Remboursement effectue",
                "Le paiement pour l'intervention \"" + ctx.title() + "\" a ete rembourse",
                "/interventions/" + ctx.interventionId()
            );
        } catch (Exception e) {
            log.warn("Erreur notification PAYMENT_REFUND_COMPLETED: {}", e.getMessage());
        }
    }

    private void publishRefundDocumentEvent(PaymentStatusTransitionService.InterventionRefundContext ctx) {
        try {
            String emailTo = ctx.ownerEmail() != null ? ctx.ownerEmail() : "";
            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "justif-remboursement-int-" + ctx.interventionId(),
                Map.of(
                    "documentType", "JUSTIFICATIF_REMBOURSEMENT",
                    "referenceId", ctx.interventionId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo
                )
            );
            log.debug("Evenement JUSTIFICATIF_REMBOURSEMENT publie sur Kafka pour l'intervention: {}", ctx.interventionId());
        } catch (Exception e) {
            log.error("Erreur publication Kafka JUSTIFICATIF_REMBOURSEMENT: {}", e.getMessage());
        }
    }

    /**
     * Alerte les admins/managers qu'une ecriture comptable attendue manque
     * (T-BP-07). Best-effort : un echec de notification est logge sans bloquer
     * le flux (meme contrat que cote confirmations).
     */
    private void notifyLedgerReconciliationRequired(String refType, String refId, String detail) {
        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.RECONCILIATION_FAILED,
                "Reconciliation ledger requise",
                "Paiement confirme mais " + detail + " pour " + refType + " #" + refId
                    + ". Verifier les soldes wallets/ledger.",
                "/billing?tab=wallets"
            );
        } catch (Exception notifyEx) {
            log.error("Impossible de notifier la reconciliation ledger requise pour {} #{}: {}",
                refType, refId, notifyEx.getMessage());
        }
    }
}
