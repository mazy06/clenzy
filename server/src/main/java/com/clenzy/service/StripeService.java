package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import java.math.BigDecimal;

/**
 * Facade des paiements Stripe : point d'entree transactionnel + circuit breaker
 * aux signatures historiques, qui delegue a deux collaborateurs (G1) :
 * <ul>
 *   <li>{@link StripePaymentConfirmationService} — confirmations idempotentes
 *       et marquage des echecs (webhooks + fallbacks) ;</li>
 *   <li>{@link StripeRefundService} — remboursements + contre-passation ledger.</li>
 * </ul>
 *
 * <p>La création des sessions Checkout a été retirée : tous les flux d'encaissement
 * passent par {@code PaymentOrchestrationService} (multi-provider).</p>
 *
 * <p>Les annotations {@code @Transactional} / {@code @CircuitBreaker} restent
 * sur cette facade : les collaborateurs s'executent dans le contexte qu'elle
 * etablit (notamment {@code NOT_SUPPORTED} sur {@link #refundPayment}).
 * L'expiration / interrogation de sessions Checkout reste ici (l'enum
 * {@link CheckoutSessionExpiryResult} fait partie de l'API publique).</p>
 */
@Service
@Transactional
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    private final StripeGateway stripeGateway;
    private final StripePaymentConfirmationService paymentConfirmationService;
    private final StripeRefundService refundService;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.embedded-return-url:#{null}}")
    private String embeddedReturnUrl;

    public StripeService(StripeGateway stripeGateway,
                         StripePaymentConfirmationService paymentConfirmationService,
                         StripeRefundService refundService) {
        this.stripeGateway = stripeGateway;
        this.paymentConfirmationService = paymentConfirmationService;
        this.refundService = refundService;
    }

    // La création des sessions Checkout (interventions, réservations, upsells, demandes
    // de service) a été retirée : tous ces flux passent désormais par
    // PaymentOrchestrationService (multi-provider). La factory Stripe dédiée a été
    // supprimée avec eux (Vague 2/5 + reste d'audit). StripeService ne conserve que
    // l'interrogation de session, la confirmation et le remboursement.

    // Les wrappers createUpsell* / createServiceRequest* ont été supprimés (Vague 5) :
    // ces flux passent par PaymentOrchestrationService (UpsellService,
    // ServiceRequestPaymentService). Preuve par grep : plus aucun appelant.

    // ════════════════════════════════════════════════════════════════════════
    // Interrogation / expiration de sessions Checkout (Z4A-BUGS-02)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Re-verifie cote serveur si une session Checkout est payee (filet de secours
     * quand le webhook tarde/echoue). Interroge directement l'API Stripe.
     *
     * <p>Contrat best-effort assume (T-SOLID-7) : une erreur de l'API Stripe est
     * loggee et traduite en {@code false} (paiement non confirme, le webhook ou
     * un re-essai ulterieur tranchera) ; seuls les {@link StripeException} sont
     * absorbees, un bug applicatif remonte normalement.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public boolean isCheckoutSessionPaid(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return false;
        }
        try {
            Session session = stripeGateway.retrieveSession(sessionId);
            return session != null && "paid".equals(session.getPaymentStatus());
        } catch (StripeException e) {
            log.warn("Stripe session retrieve failed for {}: {}", sessionId, e.getMessage());
            return false;
        }
    }

    /** Resultat de la tentative d'expiration d'une session Checkout. */
    public enum CheckoutSessionExpiryResult {
        /** Session expiree (ou deja expiree / absente) : le calendrier peut etre libere. */
        EXPIRED,
        /** Session deja payee (paiement tardif / race) : NE PAS liberer, reconcilier. */
        PAID,
        /** Session complete mais paiement asynchrone non confirme : NE PAS liberer. */
        COMPLETED_UNPAID,
        /** Appel Stripe en echec, statut inconnu : NE PAS liberer (re-essai ulterieur). */
        FAILED
    }

    /**
     * Expire une session Stripe Checkout encore ouverte afin qu'un guest ne puisse
     * plus payer une reservation sur le point d'etre annulee (Z4A-BUGS-02).
     *
     * <p>A appeler AVANT toute liberation de calendrier : seul un resultat
     * {@link CheckoutSessionExpiryResult#EXPIRED} autorise la liberation des dates.
     * Si la session est deja payee (race expiration / paiement), l'appelant doit
     * reconcilier (confirmer la reservation) au lieu de liberer.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public CheckoutSessionExpiryResult expireCheckoutSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return CheckoutSessionExpiryResult.EXPIRED;
        }
        try {
            Session session = stripeGateway.retrieveSession(sessionId);
            CheckoutSessionExpiryResult state = classifySessionForExpiry(session);
            if (state != null) {
                return state;
            }
            session.expire(com.stripe.net.RequestOptions.builder().setApiKey(stripeSecretKey).build());
            log.info("Session Checkout {} expiree (annulation reservation)", sessionId);
            return CheckoutSessionExpiryResult.EXPIRED;
        } catch (StripeException e) {
            return resolveExpiryAfterStripeError(sessionId, e);
        }
    }

    /** @return l'etat final si la session n'est pas expirable, {@code null} si elle est encore ouverte. */
    private CheckoutSessionExpiryResult classifySessionForExpiry(Session session) {
        if (session == null || "expired".equals(session.getStatus())) {
            return CheckoutSessionExpiryResult.EXPIRED;
        }
        if ("paid".equals(session.getPaymentStatus())) {
            return CheckoutSessionExpiryResult.PAID;
        }
        if ("complete".equals(session.getStatus())) {
            return CheckoutSessionExpiryResult.COMPLETED_UNPAID;
        }
        return null;
    }

    /**
     * Apres un echec d'expiration, re-lit la session : la cause la plus probable
     * est une completion concurrente (le guest vient de payer). Dans le doute,
     * retourne FAILED pour interdire la liberation du calendrier.
     */
    private CheckoutSessionExpiryResult resolveExpiryAfterStripeError(String sessionId, StripeException original) {
        try {
            Session session = stripeGateway.retrieveSession(sessionId);
            CheckoutSessionExpiryResult state = classifySessionForExpiry(session);
            if (state != null) {
                return state;
            }
        } catch (StripeException retryEx) {
            log.warn("Expiration session Checkout {} : relecture impossible ({})", sessionId, retryEx.getMessage());
        }
        log.warn("Expiration session Checkout {} en echec : {}", sessionId, original.getMessage());
        return CheckoutSessionExpiryResult.FAILED;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Confirmations / echecs de paiement → StripePaymentConfirmationService
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Confirme le paiement d'une intervention après réception du webhook.
     *
     * <p>Idempotent (Z3-BUGS-01) : si l'intervention est déjà PAID, ou si une
     * confirmation concurrente a gagné la transition gardée, le traitement est
     * abandonné sans nouvelle écriture ledger/split.</p>
     */
    public void confirmPayment(String sessionId) {
        paymentConfirmationService.confirmPayment(sessionId);
    }

    /**
     * Marque un paiement comme échoué
     */
    public void markPaymentAsFailed(String sessionId) {
        paymentConfirmationService.markPaymentAsFailed(sessionId);
    }

    /**
     * Confirme le paiement d'une reservation apres reception du webhook Stripe.
     * Appele depuis le webhook (pas de tenant context — recherche par stripeSessionId sans orgId).
     *
     * <p>Idempotent (Z3-SEC-02) : early-return si deja PAID + transition gardee
     * contre la course webhook / fallback authentifie.</p>
     */
    public void confirmReservationPayment(String sessionId) {
        paymentConfirmationService.confirmReservationPayment(sessionId);
    }

    /**
     * Marque le paiement d'une reservation comme echoue.
     */
    public void markReservationPaymentFailed(String sessionId) {
        paymentConfirmationService.markReservationPaymentFailed(sessionId);
    }

    /**
     * Confirme le paiement groupe de plusieurs interventions (paiement differe).
     * Chaque intervention incluse passe en PAID. Les interventions deja payees
     * sont ignorees (idempotence).
     */
    public void confirmGroupedPayment(String sessionId, String interventionIds) {
        paymentConfirmationService.confirmGroupedPayment(sessionId, interventionIds);
    }

    /**
     * Marque le paiement groupe comme echoue pour toutes les interventions incluses.
     */
    public void markGroupedPaymentAsFailed(String interventionIds) {
        paymentConfirmationService.markGroupedPaymentAsFailed(interventionIds);
    }

    /**
     * Confirme le paiement d'une demande de service apres reception du webhook Stripe.
     * Met a jour la SR en PAID/IN_PROGRESS et cree automatiquement l'intervention.
     *
     * <p>Idempotent : early-return si deja PAID + transition gardee.</p>
     */
    public void confirmServiceRequestPayment(String sessionId) {
        paymentConfirmationService.confirmServiceRequestPayment(sessionId);
    }

    /**
     * Marque le paiement d'une demande de service comme echoue.
     */
    public void markServiceRequestPaymentFailed(String sessionId) {
        paymentConfirmationService.markServiceRequestPaymentFailed(sessionId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Remboursements → StripeRefundService
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Rembourse un paiement via Stripe et met a jour le statut de l'intervention.
     *
     * <p>Pattern anti double-remboursement (Z3-BUGS-06) : les donnees sont
     * preparees dans une transaction courte, l'appel Stripe (effet externe
     * irreversible) est emis HORS transaction avec une idempotency key derivee
     * de l'intervention, puis le resultat est persiste dans une nouvelle
     * transaction. Un re-essai apres echec de persistance rejoue la meme
     * idempotency key : Stripe renvoie le meme remboursement, aucun double debit.
     * Le {@code NOT_SUPPORTED} ci-dessous garantit ce contexte hors transaction.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void refundPayment(Long interventionId) throws StripeException {
        refundService.refundPayment(interventionId);
    }

    /**
     * Rembourse integralement le paiement d'une session Checkout (Z4A-BUGS-03 :
     * paiement recu alors que les dates ne sont plus disponibles, ou montant
     * divergent du devis serveur). Idempotent cote Stripe via une idempotency key
     * derivee de la session : un re-essai ne produit pas de second remboursement.
     */
    @CircuitBreaker(name = "stripe-api")
    public void refundCheckoutSessionPayment(String sessionId, String reason) throws StripeException {
        refundService.refundCheckoutSessionPayment(sessionId, reason);
    }

    /** Remboursement PARTIEL (annulation self-service selon politique). Idempotent via la cle fournie. */
    @CircuitBreaker(name = "stripe-api")
    public void refundCheckoutSessionPartial(String sessionId, long amountMinorUnits,
                                             String idempotencyKey, String reason) throws StripeException {
        refundService.refundCheckoutSessionPartial(sessionId, amountMinorUnits, idempotencyKey, reason);
    }
}
