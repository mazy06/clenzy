package com.clenzy.payment.provider;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import com.clenzy.service.PaymentMethodConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Provider CMI Maroc (Centre Monetique Interbancaire).
 *
 * <h2>Specificite : protocole legacy form POST</h2>
 * <p>CMI n'a pas d'API REST moderne. Le merchant construit un Map de
 * parametres, calcule un hash SHA-512 ver3 (voir {@link CmiHashService}),
 * et soumet un formulaire HTML POST vers {@code payment.cmi.co.ma/fim/est3Dgate}.
 * Le navigateur du guest est redirige sur le portail CMI 3D Secure.</p>
 *
 * <h2>Architecture Clenzy</h2>
 * <p>Pour preserver le contrat {@link PaymentProvider} (un seul
 * {@code redirectUrl} en retour), {@code createPayment} retourne une
 * <strong>URL Clenzy intermediaire</strong> ({@code /api/payments/cmi-redirect/&lt;txRef&gt;})
 * qui sera servie par {@link com.clenzy.controller.CmiRedirectController} sous
 * forme d'un mini-HTML auto-submit contenant les parametres CMI + le hash.
 * Cette indirection evite d'etendre {@link PaymentResult} avec un champ
 * {@code formParams} qui briserait le contract des autres providers.</p>
 *
 * <h2>Webhook (S2S callback)</h2>
 * <p>CMI envoie un POST {@code application/x-www-form-urlencoded} avec
 * {@code ProcReturnCode=00} pour succes. Le hash de verification est dans
 * le body, pas un header — d'ou le binding {@code @RequestParam Map<String, String>}
 * dans {@link com.clenzy.controller.PaymentWebhookRouter#handleCmiWebhook}.</p>
 */
@Component
public class CmiPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(CmiPaymentProvider.class);

    private final CmiHashService hashService;
    private final PaymentMethodConfigService configService;

    @Value("${clenzy.base-url:https://app.clenzy.fr}")
    private String clenzyBaseUrl;

    public CmiPaymentProvider(CmiHashService hashService, PaymentMethodConfigService configService) {
        this.hashService = hashService;
        this.configService = configService;
    }

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.CMI;
    }

    @Override
    public Set<String> getSupportedCountries() {
        return Set.of("MA");
    }

    @Override
    public Set<String> getSupportedCurrencies() {
        return Set.of("MAD", "EUR", "USD", "GBP");
    }

    @Override
    public PaymentResult createPayment(PaymentRequest request) {
        try {
            String transactionRef = request.idempotencyKey() != null
                ? request.idempotencyKey()
                : (request.metadata() != null ? request.metadata().get("transactionRef") : null);
            if (transactionRef == null) {
                return PaymentResult.failure("CMI : transactionRef absent du metadata");
            }

            // Valide que les credentials sont presents (le hash sera calcule
            // au moment du redirect endpoint, pas ici — voir CmiRedirectController).
            Long orgId = readOrgId(request);
            CmiCredentials creds = loadCredentials(orgId);
            if (creds.storeKey == null || creds.storeKey.isBlank()) {
                return PaymentResult.failure("CMI : store_key non configure pour l'org");
            }
            if (creds.clientId == null || creds.clientId.isBlank()) {
                return PaymentResult.failure("CMI : client_id non configure pour l'org");
            }

            // Verifie que la devise est supportee par CMI.
            try {
                CmiHashService.toCmiCurrencyCode(request.currency());
            } catch (IllegalArgumentException e) {
                return PaymentResult.failure(e.getMessage());
            }

            // providerTxId = transactionRef car CMI n'a pas d'ID transaction
            // propre cote merchant avant le callback (oid = notre transactionRef).
            String redirectUrl = clenzyBaseUrl + "/api/payments/cmi-redirect/" + transactionRef;
            log.info("CMI payment initiated for org={} txRef={}", orgId, transactionRef);
            return PaymentResult.success(transactionRef, redirectUrl);
        } catch (Exception e) {
            log.error("CMI createPayment failed", e);
            return PaymentResult.failure("CMI error: " + e.getMessage());
        }
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        // CMI capture automatiquement en mode Auth (HPP standard).
        return PaymentResult.success(providerTxId, null, "CAPTURED");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        // CMI ne propose pas d'API REST de refund — les remboursements se font
        // via le back-office marchand CMI manuellement.
        return PaymentResult.failure(
            "CMI : les remboursements doivent etre effectues manuellement via le back-office CMI.");
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        return null; // CMI n'a pas de concept de customer persistant
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        throw new UnsupportedOperationException("CMI does not support outgoing payouts");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        // L'interface generique passe payload (raw body) + signature header,
        // mais pour CMI le hash est dans le body form-urlencoded. On parse
        // le body en Map et on delegue a CmiHashService.
        // Le webhook handler appelle de preference {@link CmiHashService#verifyHash}
        // directement avec le Map deja parse par Spring.
        try {
            Map<String, String> params = parseFormUrlEncoded(payload);
            return hashService.verifyHash(params, secret);
        } catch (Exception e) {
            log.error("CMI verifyWebhook failed", e);
            return false;
        }
    }

    // ─── Helpers exposes pour CmiRedirectController et le webhook handler ──

    /**
     * Charge les credentials CMI de l'organisation depuis la BDD. Expose
     * en {@code public} pour reuse par {@link com.clenzy.controller.CmiRedirectController}.
     */
    public CmiCredentials loadCredentials(Long orgId) {
        PaymentMethodConfig config = configService.getOrCreateConfig(orgId, PaymentProviderType.CMI);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new IllegalStateException("CMI is not enabled for org " + orgId);
        }
        String clientId = configService.decryptApiKey(config);
        String storeKey = configService.decryptApiSecret(config);
        Map<String, Object> json = config.getConfigJson();
        String okUrl = json != null && json.get("okUrl") instanceof String s ? s : null;
        String failUrl = json != null && json.get("failUrl") instanceof String s ? s : null;
        String callbackUrl = json != null && json.get("callbackUrl") instanceof String s
            ? s
            : clenzyBaseUrl + "/api/webhooks/payments/cmi";
        boolean sandbox = Boolean.TRUE.equals(config.getSandboxMode());
        return new CmiCredentials(clientId, storeKey, okUrl, failUrl, callbackUrl, sandbox);
    }

    /** URL du portail CMI (test ou prod). */
    public static String resolveGatewayUrl(boolean sandbox) {
        return sandbox
            ? "https://testpayment.cmi.co.ma/fim/est3Dgate"
            : "https://payment.cmi.co.ma/fim/est3Dgate";
    }

    /** Expose le hash service pour le redirect controller. */
    public CmiHashService hashService() {
        return hashService;
    }

    private Long readOrgId(PaymentRequest request) {
        if (request.metadata() == null || !request.metadata().containsKey("orgId")) {
            throw new IllegalStateException(
                "CMI createPayment called without orgId metadata — orchestrator must inject it");
        }
        return Long.parseLong(request.metadata().get("orgId"));
    }

    /** Parser minimal form-urlencoded → Map. Suffisant pour les callbacks CMI. */
    private static Map<String, String> parseFormUrlEncoded(String body) {
        java.util.HashMap<String, String> out = new java.util.HashMap<>();
        if (body == null || body.isBlank()) return out;
        for (String pair : body.split("&")) {
            int eq = pair.indexOf('=');
            if (eq < 0) continue;
            String key = java.net.URLDecoder.decode(pair.substring(0, eq), java.nio.charset.StandardCharsets.UTF_8);
            String value = java.net.URLDecoder.decode(pair.substring(eq + 1), java.nio.charset.StandardCharsets.UTF_8);
            out.put(key, value);
        }
        return out;
    }

    /** Generateur de valeur random pour le champ {@code rnd} obligatoire CMI. */
    public static String generateRnd() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    /** Credentials CMI hydrates depuis la BDD. */
    public record CmiCredentials(
        String clientId,
        String storeKey,
        String okUrl,
        String failUrl,
        String callbackUrl,
        boolean sandbox
    ) {}
}
