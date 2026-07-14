package com.clenzy.controller;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.provider.AttijariPaymentProvider;
import com.clenzy.payment.provider.AttijariPaymentProvider.AttijariCredentials;
import com.clenzy.payment.provider.CmiHashService;
import com.clenzy.payment.provider.CmiPaymentProvider;
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
import java.util.Map;

/**
 * Endpoint intermediaire de redirection vers la passerelle Attijari Payment
 * (Maroc Telecommerce {@code est3Dgate}).
 *
 * <p>Miroir de {@link CmiRedirectController} : meme protocole {@code est3Dgate},
 * mutualisant le rendu HTML via {@link Est3DGateHtml} et le hash via
 * {@link CmiHashService}. Seuls changent le path
 * ({@code /api/payments/attijari-redirect/&lt;txRef&gt;}), le libelle affiche et
 * l'URL de passerelle.</p>
 *
 * <h2>Securite</h2>
 * <p>Endpoint public (le guest est redirige ici depuis le Booking Engine). La
 * protection repose sur : {@code transactionRef} non guessable (UUID), une
 * transaction payable une seule fois (statut PENDING), et le {@code clientid}
 * secret marchand inclus dans le hash. Note POC : comme pour le CMI, le path
 * {@code /api/payments/attijari-redirect/**} devra etre whiteliste dans
 * {@code SecurityConfigProd} au moment de la mise en service prod (les PSP
 * regionaux ne sont pas encore actifs en prod).</p>
 */
@RestController
@RequestMapping("/api/payments")
public class AttijariRedirectController {

    private static final Logger log = LoggerFactory.getLogger(AttijariRedirectController.class);

    private final PaymentTransactionService paymentTransactionService;
    private final AttijariPaymentProvider attijariProvider;

    public AttijariRedirectController(PaymentTransactionService paymentTransactionService,
                                       AttijariPaymentProvider attijariProvider) {
        this.paymentTransactionService = paymentTransactionService;
        this.attijariProvider = attijariProvider;
    }

    @GetMapping(value = "/attijari-redirect/{transactionRef}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> renderAttijariRedirect(@PathVariable String transactionRef) {
        PaymentTransaction tx = paymentTransactionService.findByTransactionRef(transactionRef).orElse(null);
        if (tx == null) {
            log.warn("Attijari redirect : transaction inconnue txRef={}", transactionRef);
            return errorPage(HttpStatus.NOT_FOUND, "Transaction introuvable");
        }
        if (!"ATTIJARI".equals(tx.getProviderType().name())) {
            log.warn("Attijari redirect : provider invalide pour txRef={} ({})",
                transactionRef, tx.getProviderType());
            return errorPage(HttpStatus.BAD_REQUEST, "Provider invalide");
        }

        AttijariCredentials creds;
        try {
            creds = attijariProvider.loadCredentials(tx.getOrganizationId());
        } catch (Exception e) {
            log.error("Attijari redirect : credentials missing for txRef={}", transactionRef, e);
            return errorPage(HttpStatus.INTERNAL_SERVER_ERROR,
                "Configuration Attijari incomplète pour cette organisation");
        }

        // Params est3Dgate (ordre indifferent : CmiHashService trie
        // alphabetiquement avant de hasher — l'ordre ne sert qu'au debug visuel).
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

        // Hash SHA-512 ver3 via le service partage (identique CMI/Attijari).
        String hash = attijariProvider.hashService().computeHash(params, creds.storeKey());
        params.put("HASH", hash);

        String gatewayUrl = AttijariPaymentProvider.resolveGatewayUrl(creds.sandbox());
        String html = Est3DGateHtml.autoSubmitForm("Attijari Payment", gatewayUrl, params);

        log.info("Attijari redirect rendu pour txRef={} → {}", transactionRef, gatewayUrl);
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
