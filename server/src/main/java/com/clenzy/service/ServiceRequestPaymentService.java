package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.ServiceRequestRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
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
 * Le marquage PROCESSING s'exécute dans une transaction courte dédiée.</p>
 */
@Service
public class ServiceRequestPaymentService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestPaymentService.class);

    /** {@code sourceType} de la {@code PaymentTransaction} d'un paiement de demande de service. */
    public static final String SOURCE_TYPE = "SERVICE_REQUEST";

    private final ServiceRequestRepository serviceRequestRepository;
    private final StripeService stripeService;
    private final StripeGateway stripeGateway;
    private final PaymentOrchestrationService orchestrationService;
    private final com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;
    /** Marquage PROCESSING atomique HORS de l'appel provider. */
    private final TransactionTemplate transactionTemplate;

    @Value("${stripe.currency}")
    private String currency;

    public ServiceRequestPaymentService(ServiceRequestRepository serviceRequestRepository,
                                        StripeService stripeService,
                                        StripeGateway stripeGateway,
                                        PaymentOrchestrationService orchestrationService,
                                        com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard,
                                        PlatformTransactionManager transactionManager) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.stripeService = stripeService;
        this.stripeGateway = stripeGateway;
        this.orchestrationService = orchestrationService;
        this.organizationAccessGuard = organizationAccessGuard;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
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
        ServiceRequest sr = loadPayableServiceRequest(serviceRequestId);
        // Z3-SEC-01 : montant TOUJOURS serveur (estimatedCost de l'entité).
        BigDecimal amount = sr.getEstimatedCost();

        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "service_request");
        metadata.put("service_request_id", serviceRequestId.toString());

        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
            amount,
            currency,
            SOURCE_TYPE,
            serviceRequestId,
            "Demande de service: " + sr.getTitle(),
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
            sr.getOrganizationId(), null, request);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            throw new IllegalStateException("Echec de creation du paiement de la demande de service: " + err);
        }

        // Marquage PROCESSING + réf de session provider (transaction courte dédiée, hors appel provider).
        final String providerTxId = result.paymentResult().providerTxId();
        transactionTemplate.executeWithoutResult(status -> {
            ServiceRequest fresh = serviceRequestRepository.findById(serviceRequestId).orElse(null);
            if (fresh != null) {
                fresh.setStripeSessionId(providerTxId);
                fresh.setPaymentStatus(PaymentStatus.PROCESSING);
                serviceRequestRepository.save(fresh);
            }
        });
        log.info("Session de paiement {} (demande de service {}) créée via orchestrateur: tx={}, provider={}",
            embedded ? "embarquée" : "hébergée", serviceRequestId,
            result.transaction() != null ? result.transaction().getTransactionRef() : "?", result.providerUsed());
        return result;
    }

    private ServiceRequest loadPayableServiceRequest(Long serviceRequestId) {
        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
            .orElseThrow(() -> new NotFoundException("Demande de service non trouvee: " + serviceRequestId));
        // findById contourne le filtre org (audit 2026-07 F1-08) : garde d'ownership fail-closed.
        organizationAccessGuard.requireSameOrganization(
            sr.getOrganizationId(), "Demande hors de votre organisation");
        if (sr.getStatus() != RequestStatus.AWAITING_PAYMENT) {
            throw new IllegalStateException(
                "La demande de service doit etre en statut AWAITING_PAYMENT pour proceder au paiement. "
                + "Statut actuel: " + sr.getStatus());
        }
        BigDecimal amount = sr.getEstimatedCost();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Montant invalide pour la demande de service: " + amount);
        }
        return sr;
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
        ServiceRequest sr = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Demande de service non trouvee: " + id));
        // findById contourne le filtre org (audit 2026-07 F1-08) : garde d'ownership fail-closed.
        organizationAccessGuard.requireSameOrganization(
                sr.getOrganizationId(), "Demande hors de votre organisation");

        // Already paid?
        if (sr.getPaymentStatus() == PaymentStatus.PAID) {
            return Map.of(
                    "paymentStatus", "PAID",
                    "message", "Paiement deja confirme"
            );
        }

        String sessionId = sr.getStripeSessionId();
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
