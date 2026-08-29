package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.dto.BatchPaymentSessionRequest;
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
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
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
    private final com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository;
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
                                      com.clenzy.service.access.OrganizationAccessGuard organizationAccessGuard,
            com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository) {
        this.interventionRepository = interventionRepository;
        this.serviceQuoteRepository = serviceQuoteRepository;
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
    /** Fenetre de deduplication : 5 minutes, assez pour un double-clic, pas pour bloquer. */
    private static long currentIdempotencyWindow() {
        return java.time.Instant.now().getEpochSecond() / 300;
    }

    /** Marque l'issue dans l'URL de retour, pour que l'ecran sache quoi dire. */
    private static String appendPaymentOutcome(String returnUrl, String outcome) {
        if (returnUrl == null || returnUrl.isBlank()) {
            return null;
        }
        String base = returnUrl.trim();
        return base + (base.contains("?") ? "&" : "?") + "payment=" + outcome;
    }

    /**
     * Reste a payer : le cout de l'intervention, moins l'acompte encaisse.
     *
     * <p>L'acompte n'est deduit que s'il est REELLEMENT regle
     * ({@code deposit_paid_at}) — un acompte exige mais impaye ne reduit rien.
     * Un solde nul ou negatif signifie que tout est deja verse ; l'appelant le
     * traite comme un montant indisponible, et refuse le paiement.</p>
     */
    private BigDecimal subtractPaidDeposit(Intervention intervention) {
        BigDecimal cost = intervention.getEstimatedCost();
        if (cost == null) return null;

        BigDecimal paidDeposit = serviceQuoteRepository
                .findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                        intervention.getId(), intervention.getOrganizationId())
                .stream()
                .filter(quote -> quote.getStatus() == com.clenzy.model.ServiceQuote.Status.APPROVED)
                .filter(quote -> quote.getDepositPaidAt() != null)
                .map(com.clenzy.model.ServiceQuote::getDepositAmount)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(BigDecimal.ZERO);

        BigDecimal balance = cost.subtract(paidDeposit);
        return balance.compareTo(BigDecimal.ZERO) > 0 ? balance : BigDecimal.ZERO;
    }

    /**
     * Acompte exigible : celui du devis APPROUVE de l'intervention.
     *
     * <p>Resolu cote serveur, jamais recu du client (regle audit n°1). Un devis
     * simplement recu ne donne rien : tant qu'il n'est pas retenu, il n'engage
     * personne.</p>
     */
    private BigDecimal resolveDepositAmount(Intervention intervention) {
        return serviceQuoteRepository
                .findByInterventionIdAndOrganizationIdOrderByAmountAsc(intervention.getId(), intervention.getOrganizationId())
                .stream()
                .filter(quote -> quote.getStatus() == com.clenzy.model.ServiceQuote.Status.APPROVED)
                // Un acompte deja regle ne se represente pas au paiement.
                .filter(quote -> quote.getDepositPaidAt() == null)
                .map(com.clenzy.model.ServiceQuote::getDepositAmount)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    /**
     * Regle plusieurs interventions en une session.
     *
     * <p>Le planning proposait deja de selectionner un lot et d'en payer le
     * total ; l'endpoint n'acceptait qu'UNE intervention, et le montant envoye
     * n'etait meme pas lu. Le total est ici recalcule intervention par
     * intervention, acomptes deduits (regle audit n°1) — le total de l'ecran
     * n'est qu'un cross-check.</p>
     */
    // Pas de @Transactional : cette methode appelle Stripe, et la classe
    // documente la regle — jamais d'appel HTTP externe dans une transaction DB
    // (regle audit n°2). Le `saveAll` final s'execute dans sa propre
    // transaction courte, APRES l'appel externe.
    public PaymentSessionResponse createBatchPaymentSession(
            BatchPaymentSessionRequest request, String customerEmail) {
        if (customerEmail == null || customerEmail.isEmpty()) {
            throw new PaymentValidationException("Email utilisateur non trouvé");
        }
        // Doublons ecartes et ordre stable : la cle d'idempotence depend du lot,
        // pas de l'ordre dans lequel l'ecran l'a envoye.
        List<Long> ids = request.interventionIds().stream()
                .filter(Objects::nonNull).distinct().sorted().toList();
        if (ids.isEmpty()) {
            throw new PaymentValidationException("Aucune intervention à régler");
        }

        var blockedStatuses = EnumSet.of(InterventionStatus.CANCELLED, InterventionStatus.COMPLETED);
        List<Intervention> interventions = new ArrayList<>();
        BigDecimal serverAmount = BigDecimal.ZERO;
        String currency = "EUR";

        for (Long id : ids) {
            Intervention intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new PaymentValidationException("Intervention non trouvée : " + id));
            // findById contourne le filtre Hibernate (regle audit n°3).
            requireSameOrganization(intervention);
            if (blockedStatuses.contains(intervention.getStatus())) {
                throw new PaymentValidationException("L'intervention #" + id
                        + " ne peut pas être payée. Statut actuel : " + intervention.getStatus());
            }
            if (intervention.getPaymentStatus() == PaymentStatus.PAID) {
                throw new PaymentValidationException("L'intervention #" + id + " est déjà payée");
            }
            BigDecimal balance = subtractPaidDeposit(intervention);
            if (balance == null || balance.compareTo(BigDecimal.ZERO) <= 0) {
                throw new PaymentValidationException(
                        "L'intervention #" + id + " n'a rien à régler");
            }
            // Un lot mele de devises ne peut pas tenir dans une seule session.
            String own = intervention.getCurrency() != null ? intervention.getCurrency() : "EUR";
            if (!interventions.isEmpty() && !own.equalsIgnoreCase(currency)) {
                throw new PaymentValidationException(
                        "Les interventions sélectionnées n'ont pas la même devise");
            }
            currency = own;
            serverAmount = serverAmount.add(balance);
            interventions.add(intervention);
        }

        if (request.totalAmount() != null && request.totalAmount().compareTo(serverAmount) != 0) {
            throw new PaymentValidationException("Le montant fourni ne correspond pas au montant attendu");
        }

        String idempotencyKey = "INT-BATCH-" + ids.stream().map(String::valueOf)
                .collect(java.util.stream.Collectors.joining("-"));

        PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
                serverAmount, currency, "INTERVENTION", ids.get(0),
                "Paiement de " + ids.size() + " intervention(s)", customerEmail,
                null,
                appendPaymentOutcome(request.returnUrl(), "success"),
                appendPaymentOutcome(request.returnUrl(), "cancelled"),
                Map.of("interventionIds", ids.stream().map(String::valueOf)
                                .collect(java.util.stream.Collectors.joining(",")),
                       "purpose", "FULL"),
                idempotencyKey);

        PaymentOrchestrationResult orchResult = orchestrationService.initiatePayment(orchRequest);
        if (!orchResult.isSuccess()) {
            String errMsg = orchResult.paymentResult() != null
                    ? orchResult.paymentResult().errorMessage() : "Erreur orchestration paiement";
            throw new PaymentProcessingException("Erreur orchestration: " + errMsg);
        }

        // Toutes les interventions du lot passent en cours de reglement : le
        // paiement est unique, leur sort l'est aussi.
        for (Intervention intervention : interventions) {
            if (orchResult.paymentResult().providerTxId() != null) {
                intervention.setStripeSessionId(orchResult.paymentResult().providerTxId());
            }
            intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        }
        interventionRepository.saveAll(interventions);

        PaymentSessionResponse response = new PaymentSessionResponse();
        response.setSessionId(orchResult.paymentResult().providerTxId());
        response.setUrl(orchResult.paymentResult().redirectUrl());
        // Une seule intervention peut etre citee : celle qui ouvre le lot.
        response.setInterventionId(ids.get(0));
        return response;
    }

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
        //
        // Un ACOMPTE ne vaut pas le cout de l'intervention : il vaut ce que le
        // devis approuve a fige. Sans cette distinction, la carte d'acompte
        // envoyait 40 EUR contre un cout de 200 et se faisait refuser.
        final boolean isDeposit = "DEPOSIT".equalsIgnoreCase(request.getPurpose());
        // Le SOLDE deduit l'acompte deja encaisse. Sans cela, le reglement
        // final refacturait la totalite : le proprietaire ayant verse 40 EUR
        // d'acompte sur un devis de 200 se voyait redemander 200.
        BigDecimal serverAmount = isDeposit
                ? resolveDepositAmount(intervention)
                : subtractPaidDeposit(intervention);
        if (serverAmount == null || serverAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new PaymentValidationException(isDeposit
                    ? "Aucun acompte exigible sur cette intervention"
                    : intervention.getEstimatedCost() != null
                        ? "Cette intervention est deja soldee par l'acompte"
                        : "Montant de l'intervention indisponible — paiement impossible");
        }
        if (request.getAmount() != null && request.getAmount().compareTo(serverAmount) != 0) {
            throw new PaymentValidationException("Le montant fourni ne correspond pas au montant attendu");
        }

        // Route all payments through the orchestrator (multi-provider)
        String currency = intervention.getCurrency() != null ? intervention.getCurrency() : "EUR";
        // L'idempotence protege du DOUBLE-CLIC, pas du second essai. Une cle
        // permanente rendait un acompte abandonne definitivement impayable :
        // l'orchestrateur rejouait la transaction PENDING, qui ne porte aucune
        // URL de paiement — l'ecran affichait « Le paiement n'a pas pu etre
        // ouvert ». La fenetre borne la deduplication a quelques minutes.
        String idempotencyKey = "INT-" + request.getInterventionId()
                + (isDeposit ? "-DEPOSIT-" + currentIdempotencyWindow() : "");

        PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
            serverAmount,
            currency,
            "INTERVENTION",
            request.getInterventionId(),
            (isDeposit ? "Acompte intervention #" : "Paiement intervention #")
                    + request.getInterventionId(),
            customerEmail,
            null, // no preferred provider — orchestrator resolves automatically
            // Retour a l'ecran d'origine plutot qu'a la facturation : un
            // abandon depuis une discussion doit y ramener. Le provider
            // verifie l'origine, un lien exterieur est ecarte.
            appendPaymentOutcome(request.getReturnUrl(), "success"),
            appendPaymentOutcome(request.getReturnUrl(), "cancelled"),
            Map.of("interventionId", String.valueOf(request.getInterventionId()),
                   "purpose", isDeposit ? "DEPOSIT" : "FULL"),
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
        if (!isDeposit) {
            intervention.setPaymentStatus(PaymentStatus.PROCESSING);
        }
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
