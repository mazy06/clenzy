package com.clenzy.controller;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.provider.PayPalPaymentProvider;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.service.PaymentTransactionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Endpoint de retour PayPal après approbation du paiement par le guest.
 *
 * <h2>Flow</h2>
 * <ol>
 *   <li>Guest clique "Pay with PayPal" sur le Booking Engine Clenzy.</li>
 *   <li>Clenzy crée un PayPal Order et retourne l'{@code approve_url}.</li>
 *   <li>Frontend redirige le browser sur {@code approve_url} (portail PayPal).</li>
 *   <li>Guest s'authentifie + approuve le paiement.</li>
 *   <li>PayPal redirige vers {@code return_url} = ce endpoint, avec
 *       {@code ?token=ORDER_ID&PayerID=...} en query string.</li>
 *   <li>Ce endpoint appelle la capture PayPal pour finaliser le paiement,
 *       met à jour la transaction et renvoie un statut au frontend.</li>
 * </ol>
 *
 * <h2>Sécurité</h2>
 * <p>Endpoint public (pas d'auth Spring Security car le guest n'est pas
 * forcément connecté côté PMS). La sécurité repose sur (Z3-SEC-04) :</p>
 * <ul>
 *   <li>L'order_id est un identifiant PayPal aléatoire non guessable, validé
 *       syntaxiquement avant tout accès BDD, et résolu via une requête indexée
 *       ({@code findByProviderTxId}) — plus aucun chargement de table en
 *       mémoire ni scan cross-tenant.</li>
 *   <li>Rate-limit strict par IP sur ce path (RateLimitInterceptor).</li>
 *   <li>La capture utilise les credentials PayPal de l'org (vérifiables).</li>
 *   <li>Idempotence : si l'order est déjà capturé, PayPal renvoie un statut
 *       cohérent sans double-débit.</li>
 *   <li>Le webhook PAYMENT.CAPTURE.COMPLETED confirme en parallèle (défense
 *       en profondeur).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/payments/paypal")
public class PayPalReturnController {

    private static final Logger log = LoggerFactory.getLogger(PayPalReturnController.class);

    /**
     * Format attendu d'un order_id PayPal (v2 Orders : alphanumerique, tirets
     * toleres). Toute valeur hors format est rejetee AVANT le moindre acces
     * BDD/PayPal — bloque le fuzzing de l'endpoint public (Z3-SEC-04).
     */
    private static final Pattern ORDER_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{4,64}$");

    /** Format d'un PayerID PayPal (informatif uniquement, jamais persiste). */
    private static final Pattern PAYER_ID_PATTERN = Pattern.compile("^[A-Za-z0-9]{1,32}$");

    private final PayPalPaymentProvider payPalProvider;
    private final PaymentTransactionService paymentTransactionService;
    private final PaymentOrchestrationService orchestrationService;

    public PayPalReturnController(PayPalPaymentProvider payPalProvider,
                                   PaymentTransactionService paymentTransactionService,
                                   PaymentOrchestrationService orchestrationService) {
        this.payPalProvider = payPalProvider;
        this.paymentTransactionService = paymentTransactionService;
        this.orchestrationService = orchestrationService;
    }

    /**
     * Endpoint de retour après approbation guest sur PayPal.
     * Capture l'order et met à jour la transaction Clenzy.
     */
    @GetMapping("/return")
    public ResponseEntity<?> handleReturn(@RequestParam("token") String orderId,
                                           @RequestParam(value = "PayerID", required = false) String payerId) {
        // 0. Validation syntaxique AVANT tout acces BDD/PayPal (Z3-SEC-04) :
        //    bloque le fuzzing de cet endpoint public non authentifie.
        if (orderId == null || !ORDER_ID_PATTERN.matcher(orderId).matches()) {
            log.warn("PayPal return : format d'order_id invalide, rejet");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Parametre token invalide"));
        }
        String safePayerId = (payerId != null && PAYER_ID_PATTERN.matcher(payerId).matches())
            ? payerId : null;

        // 1. Retrouver la transaction Clenzy via le providerTxId = orderId PayPal
        //    (requete indexee — plus de findAll() en memoire, Z3-SEC-04)
        PaymentTransaction tx = paymentTransactionService.findByProviderTxId(orderId).orElse(null);
        if (tx == null) {
            log.warn("PayPal return : transaction inconnue pour orderId={}", orderId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Transaction introuvable pour cet ordre PayPal"));
        }

        // 2. Capturer l'order côté PayPal
        PaymentResult result = payPalProvider.captureOrder(tx.getOrganizationId(), orderId);

        if (result.success()) {
            // 3. Mettre à jour la transaction avec le capture_id pour les futurs refunds.
            //    captureOrder retourne le captureId dans providerTxId.
            String captureId = result.providerTxId();
            if (captureId != null && !captureId.equals(orderId)) {
                paymentTransactionService.updateProviderTxId(tx, captureId);
                log.debug("PayPal return : providerTxId mis à jour {} → {}", orderId, captureId);
            }
            // 4. Marquer comme complétée (idempotent — le webhook peut déjà l'avoir fait)
            orchestrationService.completeTransaction(tx.getTransactionRef());
            log.info("PayPal return : capture OK pour orderId={} captureId={} txRef={}",
                orderId, captureId, tx.getTransactionRef());
            return ResponseEntity.ok(Map.of(
                "status", "completed",
                "transactionRef", tx.getTransactionRef(),
                "orderId", orderId,
                "captureId", captureId != null ? captureId : "",
                "payerId", safePayerId != null ? safePayerId : ""
            ));
        }

        log.warn("PayPal return : capture echouee orderId={} : {}", orderId, result.errorMessage());
        orchestrationService.failTransaction(tx.getTransactionRef(),
            "PayPal capture failed: " + result.errorMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
            "status", "failed",
            "transactionRef", tx.getTransactionRef(),
            "error", result.errorMessage()
        ));
    }
}
