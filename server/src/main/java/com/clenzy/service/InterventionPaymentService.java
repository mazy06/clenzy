package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.dto.PaymentSessionRequest;
import com.clenzy.dto.PaymentSessionResponse;
import com.clenzy.exception.PaymentProcessingException;
import com.clenzy.exception.PaymentValidationException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Map;

/**
 * Paiement des interventions : creation de session (orchestree multi-provider
 * ou Stripe embedded) et remboursement. Logique deplacee depuis
 * {@code PaymentController} (refactor T-ARCH-01 — controller mince).
 *
 * <p>PAS de {@code @Transactional} sur les methodes de ce service : elles
 * font des appels HTTP externes (orchestrateur provider, Stripe) — regle
 * d'audit « jamais d'appel HTTP externe dans une transaction DB ». Les
 * ecritures ponctuelles ({@code interventionRepository.save}) s'executent
 * dans leur propre transaction courte.</p>
 *
 * <h2>Securite</h2>
 * <p>{@code findById} contourne le filtre Hibernate organizationFilter :
 * chaque chargement est suivi de {@link #requireSameOrganization} (pattern
 * SmartLockService, bypass platform staff inclus). Le montant facture est
 * TOUJOURS resolu cote serveur (Z3-SEC-01) ; le montant fourni par le client
 * n'est qu'un cross-check.</p>
 */
@Service
public class InterventionPaymentService {

    private static final Logger logger = LoggerFactory.getLogger(InterventionPaymentService.class);

    private final InterventionRepository interventionRepository;
    private final PaymentOrchestrationService orchestrationService;
    private final StripeService stripeService;
    private final PaymentTransactionService paymentTransactionService;
    private final TenantContext tenantContext;
    private final com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard;

    public InterventionPaymentService(InterventionRepository interventionRepository,
                                      PaymentOrchestrationService orchestrationService,
                                      StripeService stripeService,
                                      PaymentTransactionService paymentTransactionService,
                                      TenantContext tenantContext,
                                      com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard) {
        this.interventionRepository = interventionRepository;
        this.orchestrationService = orchestrationService;
        this.stripeService = stripeService;
        this.paymentTransactionService = paymentTransactionService;
        this.tenantContext = tenantContext;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Cree une session de paiement pour une intervention via l'orchestrateur
     * multi-provider, puis marque l'intervention PROCESSING.
     *
     * @throws PaymentValidationException statut bloquant, deja payee, email
     *         absent, montant indisponible ou incoherent (→ 400)
     * @throws PaymentProcessingException echec orchestrateur (→ 500)
     * @throws AccessDeniedException intervention d'une autre organisation (→ 403)
     */
    public PaymentSessionResponse createPaymentSession(PaymentSessionRequest request, String customerEmail) {
        // findById ne passe PAS par le filtre Hibernate organizationFilter → check explicite
        Intervention intervention = interventionRepository.findById(request.getInterventionId())
            .orElseThrow(() -> new RuntimeException("Intervention non trouvée"));
        requireSameOrganization(intervention);

        // Vérifier que l'intervention n'est pas annulée ou déjà terminée sans paiement
        var blockedStatuses = EnumSet.of(InterventionStatus.CANCELLED, InterventionStatus.COMPLETED);
        if (blockedStatuses.contains(intervention.getStatus())) {
            throw new PaymentValidationException(
                "Cette intervention ne peut pas être payée. Statut actuel: " + intervention.getStatus());
        }

        if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
            throw new PaymentValidationException("Cette intervention est déjà payée");
        }

        if (customerEmail == null || customerEmail.isEmpty()) {
            throw new PaymentValidationException("Email utilisateur non trouvé");
        }

        // Z3-SEC-01 : le montant facture est TOUJOURS resolu cote serveur ;
        // le montant fourni par le client n'est qu'un cross-check (400 si ecart).
        BigDecimal serverAmount = intervention.getEstimatedCost();
        if (serverAmount == null || serverAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new PaymentValidationException("Montant de l'intervention indisponible — paiement impossible");
        }
        if (request.getAmount() != null && request.getAmount().compareTo(serverAmount) != 0) {
            throw new PaymentValidationException("Le montant fourni ne correspond pas au montant de l'intervention");
        }

        // Route all payments through the orchestrator (multi-provider)
        String currency = intervention.getCurrency() != null ? intervention.getCurrency() : "EUR";
        String idempotencyKey = "INT-" + request.getInterventionId();

        PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
            serverAmount,
            currency,
            "INTERVENTION",
            request.getInterventionId(),
            "Paiement intervention #" + request.getInterventionId(),
            customerEmail,
            null, // no preferred provider — orchestrator resolves automatically
            null, // successUrl — provider uses its config defaults
            null, // cancelUrl — provider uses its config defaults
            Map.of("interventionId", String.valueOf(request.getInterventionId())),
            idempotencyKey
        );

        PaymentOrchestrationResult orchResult = orchestrationService.initiatePayment(orchRequest);

        if (!orchResult.isSuccess()) {
            String errMsg = orchResult.paymentResult() != null
                ? orchResult.paymentResult().errorMessage() : "Erreur orchestration paiement";
            throw new PaymentProcessingException("Erreur orchestration: " + errMsg);
        }

        // Update intervention with provider session info
        if (orchResult.paymentResult().providerTxId() != null) {
            intervention.setStripeSessionId(orchResult.paymentResult().providerTxId());
        }
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        interventionRepository.save(intervention);

        PaymentSessionResponse response = new PaymentSessionResponse();
        response.setSessionId(orchResult.paymentResult().providerTxId());
        response.setUrl(orchResult.paymentResult().redirectUrl());
        response.setInterventionId(intervention.getId());
        return response;
    }

    /**
     * Cree une session de paiement EMBEDDED (inline) via l'orchestrateur et
     * retourne le clientSecret pour le composant EmbeddedCheckout cote frontend.
     *
     * @throws PaymentValidationException statut bloquant, deja payee, email
     *         absent, montant indisponible ou incoherent (→ 400)
     * @throws PaymentProcessingException echec de l'orchestration (→ 500 cote controller)
     * @throws AccessDeniedException intervention d'une autre organisation (→ 403)
     */
    public PaymentSessionResponse createEmbeddedPaymentSession(PaymentSessionRequest request, String customerEmail) {
        // findById ne passe PAS par le filtre Hibernate organizationFilter → check explicite
        Intervention intervention = interventionRepository.findById(request.getInterventionId())
            .orElseThrow(() -> new RuntimeException("Intervention non trouvee"));
        requireSameOrganization(intervention);

        // Vérifier que l'intervention n'est pas annulée ou déjà terminée
        var embeddedBlockedStatuses = EnumSet.of(InterventionStatus.CANCELLED, InterventionStatus.COMPLETED);
        if (embeddedBlockedStatuses.contains(intervention.getStatus())) {
            throw new PaymentValidationException(
                "Cette intervention ne peut pas etre payee. Statut actuel: " + intervention.getStatus());
        }

        if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
            throw new PaymentValidationException("Cette intervention est deja payee");
        }

        if (customerEmail == null || customerEmail.isEmpty()) {
            throw new PaymentValidationException("Email utilisateur non trouve");
        }

        // Z3-SEC-01 : montant resolu cote serveur, montant client = cross-check
        BigDecimal serverAmount = intervention.getEstimatedCost();
        if (serverAmount == null || serverAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new PaymentValidationException("Montant de l'intervention indisponible — paiement impossible");
        }
        if (request.getAmount() != null && request.getAmount().compareTo(serverAmount) != 0) {
            throw new PaymentValidationException("Le montant fourni ne correspond pas au montant de l'intervention");
        }

        // Route via l'orchestrateur en mode EMBEDDED (miroir de createPaymentSession) :
        // l'embedded reste intrinsèquement Stripe (capacité EMBEDDED_CHECKOUT), mais le
        // flux passe par le port et une entrée ledger PaymentTransaction est créée.
        // Complétion INCHANGÉE : sourceType INTERVENTION n'est pas dans la garde webhook →
        // le webhook legacy retrouve l'intervention par stripeSessionId (confirmPayment).
        String currency = intervention.getCurrency() != null ? intervention.getCurrency() : "EUR";
        PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
            serverAmount, currency, "INTERVENTION", request.getInterventionId(),
            "Paiement intervention #" + request.getInterventionId(), customerEmail,
            null, null, null,
            Map.of("interventionId", String.valueOf(request.getInterventionId())),
            "INT-" + request.getInterventionId(),
            true,   // embedded
            null,   // expiresAtEpochSeconds — défaut provider
            false); // saveCardForFutureUse

        PaymentOrchestrationResult orchResult = orchestrationService.initiatePayment(orchRequest);

        if (!orchResult.isSuccess()) {
            String errMsg = orchResult.paymentResult() != null
                ? orchResult.paymentResult().errorMessage() : "Erreur orchestration paiement";
            throw new PaymentProcessingException("Erreur orchestration: " + errMsg);
        }

        String providerTxId = orchResult.paymentResult().providerTxId();
        if (providerTxId != null) {
            intervention.setStripeSessionId(providerTxId);
        }
        intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        interventionRepository.save(intervention);

        PaymentSessionResponse response = new PaymentSessionResponse();
        response.setSessionId(providerTxId);
        response.setClientSecret(orchResult.paymentResult().clientSecret());
        response.setInterventionId(intervention.getId());
        return response;
    }

    /**
     * Rembourse un paiement d'intervention.
     *
     * <h2>Provider-agnostique</h2>
     * <p>Cherche d'abord une {@code PaymentTransaction} liee a l'intervention
     * via {@code sourceType=INTERVENTION + sourceId}. Si trouvee, route via
     * {@code orchestrationService.processRefund()} qui delegue au bon
     * provider (Stripe, PayTabs, CMI, etc.).</p>
     *
     * <h2>Fallback legacy</h2>
     * <p>Pour les interventions creees avant l'introduction de l'orchestrateur
     * (champ {@code stripeSessionId} mais pas de {@code PaymentTransaction}),
     * fallback sur {@link StripeService#refundPayment(Long)} pour preserver la
     * compatibilite. A retirer une fois la migration des anciennes donnees
     * effectuee.</p>
     *
     * @return le corps de reponse succes (message + provider eventuel)
     * @throws PaymentValidationException paiement non confirme (→ 400)
     * @throws PaymentProcessingException echec du remboursement orchestre (→ 500)
     * @throws StripeException echec du remboursement legacy Stripe (→ 500 cote controller)
     * @throws AccessDeniedException intervention d'une autre organisation (→ 403)
     */
    public Map<String, Object> refundIntervention(Long interventionId) throws StripeException {
        // findById ne passe PAS par le filtre Hibernate organizationFilter → check explicite
        Intervention intervention = interventionRepository.findById(interventionId)
            .orElseThrow(() -> new RuntimeException("Intervention non trouvée"));
        requireSameOrganization(intervention);

        if (intervention.getPaymentStatus() != PaymentStatus.PAID) {
            throw new PaymentValidationException(
                "Seuls les paiements confirmés peuvent être remboursés. Statut actuel: " + intervention.getPaymentStatus());
        }

        Long orgId = tenantContext.getRequiredOrganizationId();

        // Nouvelle voie : provider-agnostique via PaymentTransaction.
        // Les paiements normaux sont stockes en CHECKOUT/COMPLETED ; on prend la
        // transaction completee la plus recente comme "original" a rembourser.
        var originalTx = paymentTransactionService.findCompletedCheckout(orgId, "INTERVENTION", interventionId);

        if (originalTx.isPresent()) {
            var result = orchestrationService.processRefund(
                originalTx.get().getTransactionRef(), null, "Refund requested by admin");
            if (!result.isSuccess()) {
                logger.error("Refund failed for intervention {} via {}: {}",
                    interventionId, result.providerUsed(), result.paymentResult().errorMessage());
                throw new PaymentProcessingException(
                    "Échec du remboursement: " + result.paymentResult().errorMessage());
            }
            return Map.of(
                "message", "Remboursement effectué avec succès",
                "provider", result.providerUsed() != null ? result.providerUsed().name() : "UNKNOWN");
        }

        // Fallback legacy : interventions payees avant l'orchestrateur.
        stripeService.refundPayment(interventionId);
        return Map.of("message", "Remboursement effectué avec succès (legacy Stripe)");
    }

    /**
     * Refuse l'accès si l'intervention appartient à une autre organisation.
     * Delegue a {@link com.clenzy.service.access.OrganizationAccessGuard}
     * (fail-closed, bypass platform staff + org SYSTEM), que findById ne traverse pas.
     */
    private void requireSameOrganization(Intervention intervention) {
        organizationAccessGuard.requireSameOrganization(
                intervention.getOrganizationId(), "Intervention hors de votre organisation");
    }
}
