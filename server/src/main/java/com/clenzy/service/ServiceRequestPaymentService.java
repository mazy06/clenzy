package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Paiement d'une demande de service : création de session (orchestrée
 * multi-provider, hébergée ou embarquée) et vérification de paiement.
 *
 * <p>ADR paiement multi-provider (Vague 5) : la création passe par
 * {@link PaymentOrchestrationService} ; la réconciliation (PROCESSING → PAID +
 * création de l'intervention) est provider-agnostique via l'event outbox
 * {@code PAYMENT_COMPLETED} (sourceType {@code SERVICE_REQUEST}) →
 * {@code confirmServiceRequestPayment}, et non plus via le dispatch Stripe-direct.</p>
 *
 * <p>PAS de {@code @Transactional} au niveau classe : appel HTTP externe (provider).
 * Tous les accès base passent par {@link ServiceRequestPaymentPersistence}, dont les
 * méthodes ouvrent des transactions courtes <b>et scopées tenant</b> — un
 * {@code TransactionTemplate} ou un repository appelé directement échapperait à
 * l'aspect qui pose les GUC de Row-Level Security (audit RLS, plan REM-T-01).</p>
 */
@Service
public class ServiceRequestPaymentService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestPaymentService.class);

    /** {@code sourceType} de la {@code PaymentTransaction} d'un paiement de demande de service. */
    public static final String SOURCE_TYPE = "SERVICE_REQUEST";

    private final ServiceRequestPaymentPersistence persistence;
    private final StripeService stripeService;
    private final StripeGateway stripeGateway;
    private final PaymentOrchestrationService orchestrationService;

    @Value("${stripe.currency}")
    private String currency;

    public ServiceRequestPaymentService(ServiceRequestPaymentPersistence persistence,
                                        StripeService stripeService,
                                        StripeGateway stripeGateway,
                                        PaymentOrchestrationService orchestrationService) {
        this.persistence = persistence;
        this.stripeService = stripeService;
        this.stripeGateway = stripeGateway;
        this.orchestrationService = orchestrationService;
    }

    /**
     * Crée une session de paiement HÉBERGÉE (redirection) pour une demande de service.
     * @return {@code {checkoutUrl}}
     */
    public Map<String, String> createPaymentSession(Long serviceRequestId, String customerEmail) {
        PaymentOrchestrationResult result = initiate(serviceRequestId, customerEmail, false);
        return Map.of("checkoutUrl", result.paymentResult().redirectUrl());
    }

    /**
     * Crée une session de paiement EMBARQUÉE (clientSecret) pour une demande de service.
     * @return {@code {sessionId, clientSecret}}
     */
    public Map<String, String> createEmbeddedPaymentSession(Long serviceRequestId, String customerEmail) {
        PaymentOrchestrationResult result = initiate(serviceRequestId, customerEmail, true);
        return Map.of(
            "sessionId", result.paymentResult().providerTxId(),
            "clientSecret", result.paymentResult().clientSecret());
    }

    private PaymentOrchestrationResult initiate(Long serviceRequestId, String customerEmail, boolean embedded) {
        // Chargement + validations (statut, montant serveur) en transaction courte scopée.
        ServiceRequestPaymentPersistence.PayableServiceRequest payable =
            persistence.loadPayable(serviceRequestId);

        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "service_request");
        metadata.put("service_request_id", serviceRequestId.toString());

        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
            payable.amount(),
            currency,
            SOURCE_TYPE,
            serviceRequestId,
            "Demande de service: " + payable.title(),
            customerEmail,
            null,                                 // preferredProvider
            null,                                 // successUrl : défauts provider (hosted)
            null,                                 // cancelUrl : défauts provider (hosted)
            metadata,
            "SERVICE-REQUEST-" + serviceRequestId,
            embedded,
            null,
            false);

        PaymentOrchestrationResult result = orchestrationService.initiatePayment(
            payable.organizationId(), null, request);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            throw new IllegalStateException("Echec de creation du paiement de la demande de service: " + err);
        }

        // Marquage PROCESSING + réf de session provider (transaction courte dédiée, hors appel provider).
        persistence.markProcessing(serviceRequestId, result.paymentResult().providerTxId());
        log.info("Session de paiement {} (demande de service {}) créée via orchestrateur: tx={}, provider={}",
            embedded ? "embarquée" : "hébergée", serviceRequestId,
            result.transaction() != null ? result.transaction().getTransactionRef() : "?", result.providerUsed());
        return result;
    }

    /**
     * Verifie directement aupres de Stripe si le paiement a ete effectue.
     * Confirme automatiquement (+ cree l'intervention) si Stripe indique paid.
     * Filet de secours Stripe-only (webhook manqué) ; le chemin nominal est le
     * consumer PAYMENT_COMPLETED.
     *
     * @return corps de reponse (paymentStatus / message)
     * @throws NotFoundException si la demande de service n'existe pas
     */
    public Map<String, String> checkPaymentStatus(Long id) throws StripeException {
        ServiceRequestPaymentPersistence.ServiceRequestPaymentState state =
                persistence.loadPaymentState(id);

        // Already paid?
        if (state.paymentStatus() == PaymentStatus.PAID) {
            return Map.of(
                    "paymentStatus", "PAID",
                    "message", "Paiement deja confirme"
            );
        }

        String sessionId = state.stripeSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return Map.of(
                    "paymentStatus", "NO_SESSION",
                    "message", "Aucune session de paiement Stripe associee"
            );
        }

        Session stripeSession = stripeGateway.retrieveSession(sessionId);
        String stripePaymentStatus = stripeSession.getPaymentStatus();

        log.info("Check payment SR {}: Stripe session {} paymentStatus={}",
                id, sessionId, stripePaymentStatus);

        if ("paid".equals(stripePaymentStatus)) {
            // Webhook missed — confirm manually (creates intervention too)
            stripeService.confirmServiceRequestPayment(sessionId);
            return Map.of(
                    "paymentStatus", "PAID",
                    "message", "Paiement confirme (webhook rattrape)"
            );
        }

        return Map.of(
                "paymentStatus", stripePaymentStatus != null ? stripePaymentStatus.toUpperCase() : "UNKNOWN",
                "message", "Paiement non encore confirme sur Stripe"
        );
    }
}
