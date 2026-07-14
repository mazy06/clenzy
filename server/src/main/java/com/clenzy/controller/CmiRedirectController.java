package com.clenzy.controller;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.provider.CmiHashService;
import com.clenzy.payment.provider.CmiPaymentProvider;
import com.clenzy.payment.provider.CmiPaymentProvider.CmiCredentials;
import com.clenzy.payment.provider.Est3DGateHtml;
import com.clenzy.service.PaymentTransactionService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Endpoint intermediaire pour la redirection vers le portail CMI Maroc.
 *
 * <h2>Pourquoi cet endpoint</h2>
 * <p>CMI exige un <strong>formulaire HTML POST signe</strong>, pas une URL
 * GET avec query params. Le contrat {@link com.clenzy.payment.PaymentResult}
 * ne retourne qu'une {@code redirectUrl} unique — pour preserver le pattern
 * Strategy commun a tous les providers, le {@link CmiPaymentProvider} renvoie
 * une URL vers ce controller, qui :</p>
 * <ol>
 *   <li>Resout la {@code PaymentTransaction} depuis le {@code txRef} du path</li>
 *   <li>Charge les credentials CMI de l'organisation</li>
 *   <li>Construit le Map de parametres CMI (clientid, amount, currency, oid, etc.)</li>
 *   <li>Calcule le hash SHA-512 ver3</li>
 *   <li>Rend un HTML minimaliste qui auto-submit le formulaire vers CMI</li>
 * </ol>
 *
 * <h2>Securite</h2>
 * <p>Endpoint public (pas d'auth) car le guest est redirige ici depuis le
 * Booking Engine apres avoir cliquer sur "Payer". La protection se fait par :
 * </p>
 * <ul>
 *   <li>L'URL contient le {@code transactionRef} (UUID, non guessable)</li>
 *   <li>Une transaction donnee ne peut etre payee qu'une fois (statut PENDING)</li>
 *   <li>Le hash CMI inclut le {@code clientid} secret marchand</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/payments")
public class CmiRedirectController {

    private static final Logger log = LoggerFactory.getLogger(CmiRedirectController.class);

    private final PaymentTransactionService paymentTransactionService;
    private final CmiPaymentProvider cmiProvider;

    public CmiRedirectController(PaymentTransactionService paymentTransactionService,
                                  CmiPaymentProvider cmiProvider) {
        this.paymentTransactionService = paymentTransactionService;
        this.cmiProvider = cmiProvider;
    }

    @GetMapping(value = "/cmi-redirect/{transactionRef}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> renderCmiRedirect(@PathVariable String transactionRef) {
        PaymentTransaction tx = paymentTransactionService.findByTransactionRef(transactionRef).orElse(null);
        if (tx == null) {
            log.warn("CMI redirect : transaction inconnue txRef={}", transactionRef);
            return errorPage(HttpStatus.NOT_FOUND, "Transaction introuvable");
        }
        if (!"CMI".equals(tx.getProviderType().name())) {
            log.warn("CMI redirect : provider invalide pour txRef={} ({})",
                transactionRef, tx.getProviderType());
            return errorPage(HttpStatus.BAD_REQUEST, "Provider invalide");
        }

        CmiCredentials creds;
        try {
            creds = cmiProvider.loadCredentials(tx.getOrganizationId());
        } catch (Exception e) {
            log.error("CMI redirect : credentials missing for txRef={}", transactionRef, e);
            return errorPage(HttpStatus.INTERNAL_SERVER_ERROR,
                "Configuration CMI incomplète pour cette organisation");
        }

        // Construit les params CMI dans l'ordre habituel (ordre n'impacte pas
        // le hash car CmiHashService trie alphabetiquement, mais facilite le
        // debug visuel dans la page rendue).
        Map<String, String> params = new LinkedHashMap<>();
        params.put("clientid", creds.clientId());
        params.put("amount", tx.getAmount().toPlainString());
        params.put("currency", CmiHashService.toCmiCurrencyCode(tx.getCurrency()));
        params.put("oid", tx.getTransactionRef());
        params.put("okUrl", creds.okUrl());
        params.put("failUrl", creds.failUrl());
        params.put("callbackUrl", creds.callbackUrl());
        params.put("TranType", "Auth");
        params.put("storetype", "3D_PAY_HOSTING");
        params.put("hashAlgorithm", "ver3");
        params.put("encoding", "utf-8");
        params.put("rnd", CmiPaymentProvider.generateRnd());
        params.put("lang", "fr");
        params.put("shopurl", "https://app.clenzy.fr");

        // Calcul du hash via le service dedie (SHA-512 ver3, Base64)
        String hash = cmiProvider.hashService().computeHash(params, creds.storeKey());
        params.put("HASH", hash);

        String gatewayUrl = CmiPaymentProvider.resolveGatewayUrl(creds.sandbox());
        String html = Est3DGateHtml.autoSubmitForm("CMI", gatewayUrl, params);

        log.info("CMI redirect rendu pour txRef={} → {}", transactionRef, gatewayUrl);
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .body(html);
    }

    private ResponseEntity<String> errorPage(HttpStatus status, String message) {
        String html = """
            <!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
            <title>Erreur</title></head>
            <body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">
            <h1 style="color:#C97A7A">Erreur</h1>
            <p>%s</p>
            </body></html>
            """.formatted(StringUtils.escapeHtml(message));
        return ResponseEntity.status(status)
            .contentType(MediaType.TEXT_HTML)
            .body(html);
    }
}
