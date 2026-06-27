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
 * aux signatures historiques, qui delegue a trois collaborateurs (G1) :
 * <ul>
 *   <li>{@link StripeCheckoutSessionFactory} — creation des sessions Checkout
 *       (interventions, reservations, upsells, demandes de service) ;</li>
 *   <li>{@link StripePaymentConfirmationService} — confirmations idempotentes
 *       et marquage des echecs (webhooks + fallbacks) ;</li>
 *   <li>{@link StripeRefundService} — remboursements + contre-passation ledger.</li>
 * </ul>
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
    private final StripeCheckoutSessionFactory checkoutSessionFactory;
    private final StripePaymentConfirmationService paymentConfirmationService;
    private final StripeRefundService refundService;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.embedded-return-url:#{null}}")
    private String embeddedReturnUrl;

    public StripeService(StripeGateway stripeGateway,
                         StripeCheckoutSessionFactory checkoutSessionFactory,
                         StripePaymentConfirmationService paymentConfirmationService,
                         StripeRefundService refundService) {
        this.stripeGateway = stripeGateway;
        this.checkoutSessionFactory = checkoutSessionFactory;
        this.paymentConfirmationService = paymentConfirmationService;
        this.refundService = refundService;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Creation de sessions Checkout → StripeCheckoutSessionFactory
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Crée une session de paiement Stripe pour une intervention.
     *
     * <p>Le montant facturé est TOUJOURS résolu côté serveur depuis
     * {@code intervention.getEstimatedCost()} (Z3-SEC-01 / Z3-BUGS-02). Le
     * paramètre {@code amount} fourni par l'appelant n'est qu'un cross-check :
     * s'il diffère du montant serveur, l'appel est rejeté.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createCheckoutSession(Long interventionId, BigDecimal amount, String customerEmail) throws StripeException {
        return checkoutSessionFactory.createInterventionCheckoutSession(interventionId, amount, customerEmail, false);
    }

    /**
     * Cree une session de paiement Stripe en mode EMBEDDED (inline dans l'interface).
     * Retourne une session avec un clientSecret utilisable cote frontend
     * via EmbeddedCheckoutProvider de @stripe/react-stripe-js.
     *
     * <p>Comme {@link #createCheckoutSession}, le montant facturé est résolu
     * côté serveur ; {@code amount} n'est qu'un cross-check.</p>
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createEmbeddedCheckoutSession(Long interventionId, BigDecimal amount, String customerEmail) throws StripeException {
        return checkoutSessionFactory.createInterventionCheckoutSession(interventionId, amount, customerEmail, true);
    }

    /**
     * Crée une session de paiement Stripe pour une réservation (envoi par email au guest).
     * Ne modifie pas la réservation (c'est le controller qui le fait).
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                     String customerEmail, String guestName,
                                                     String propertyName) throws StripeException {
        return createReservationCheckoutSession(reservationId, amount, customerEmail,
            guestName, propertyName, null);
    }

    /**
     * Variante avec duree de vie explicite de la session ({@code expires_at}).
     * Utilisee par le flux booking engine {@code /reserve} + {@code /checkout} :
     * le hold pending expire a 30 min, la session Stripe doit devenir
     * inutilisable dans la foulee (~35 min, minimum Stripe : 30 min) — sinon un
     * guest pouvait encore payer 24h apres la liberation des dates (reliquat
     * revue A3). {@code expiresIn} null = comportement historique (lien de
     * paiement email, payable 24h).
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                     String customerEmail, String guestName,
                                                     String propertyName,
                                                     java.time.Duration expiresIn) throws StripeException {
        return checkoutSessionFactory.createReservationCheckoutSession(reservationId, amount,
            customerEmail, guestName, propertyName, expiresIn);
    }

    /**
     * Variante avec {@code successUrl} explicite (B3, parcours booking engine template-driven).
     * {@code successUrl} null = {@code stripe.success-url} par defaut. L'appelant DOIT avoir valide
     * cette URL (HTTPS + host autorise de l'org) — la factory l'utilise telle quelle.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                     String customerEmail, String guestName,
                                                     String propertyName,
                                                     java.time.Duration expiresIn,
                                                     String successUrl) throws StripeException {
        return checkoutSessionFactory.createReservationCheckoutSession(reservationId, amount,
            customerEmail, guestName, propertyName, expiresIn, successUrl);
    }

    /**
     * Variante alimentant Stripe Radar (P2 — scoring de fraude advisory) : {@code riskMetadata}
     * (null/vide = aucun effet) est propagé dans {@code payment_intent_data.metadata} (lu par Radar)
     * + la metadata de session. Ne modifie jamais le montant ni les paramètres de paiement.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createReservationCheckoutSession(Long reservationId, BigDecimal amount,
                                                     String customerEmail, String guestName,
                                                     String propertyName,
                                                     java.time.Duration expiresIn,
                                                     String successUrl,
                                                     java.util.Map<String, String> riskMetadata) throws StripeException {
        return checkoutSessionFactory.createReservationCheckoutSession(reservationId, amount,
            customerEmail, guestName, propertyName, expiresIn, successUrl, riskMetadata);
    }

    /**
     * Cree une session Stripe EMBEDDED pour un upsell guest (clientSecret cote livret).
     * Chargee sur le compte plateforme comme les reservations ; la repartition part
     * hote / part plateforme est creditee au ledger a la confirmation du paiement
     * (cf. UpsellService.markPaidBySession via le webhook checkout.session.completed).
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createUpsellCheckoutSession(Long upsellOrderId, BigDecimal amount, String currencyCode,
                                               String title, String customerEmail) throws StripeException {
        return checkoutSessionFactory.createUpsellCheckoutSession(upsellOrderId, amount, currencyCode,
            title, customerEmail);
    }

    /** Upsell HOSTED (redirection) — booking engine (cf. factory). */
    @CircuitBreaker(name = "stripe-api")
    public Session createUpsellHostedCheckoutSession(Long upsellOrderId, BigDecimal amount, String currencyCode,
                                                     String title, String customerEmail, String successUrl) throws StripeException {
        return checkoutSessionFactory.createUpsellHostedCheckoutSession(upsellOrderId, amount, currencyCode,
            title, customerEmail, successUrl);
    }

    /**
     * Cree une session de paiement Stripe pour une demande de service assignee.
     * Le demandeur paie le montant estimatedCost de la SR.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createServiceRequestCheckoutSession(Long serviceRequestId, String customerEmail) throws StripeException {
        return checkoutSessionFactory.createServiceRequestSession(serviceRequestId, customerEmail, false);
    }

    /**
     * Cree une session de paiement Stripe en mode EMBEDDED pour une demande de service.
     * Identique a createEmbeddedCheckoutSession mais pour les ServiceRequest.
     * Retourne une session avec clientSecret pour EmbeddedCheckout cote frontend.
     */
    @CircuitBreaker(name = "stripe-api")
    public Session createServiceRequestEmbeddedCheckoutSession(Long serviceRequestId, String customerEmail) throws StripeException {
        return checkoutSessionFactory.createServiceRequestSession(serviceRequestId, customerEmail, true);
    }

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
