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

/**
 * Provider <strong>Attijari Payment</strong> (etablissement de paiement
 * d'Attijariwafa Bank, Maroc) — POC.
 *
 * <h2>Pourquoi ce provider reutilise la machinerie CMI</h2>
 * <p>Depuis la libERALisation de l'acquisition carte au Maroc (fin du monopole
 * CMI, 2026), plusieurs banques operent leur propre acquisition via la meme
 * plateforme technique <em>Maroc Telecommerce</em> — le protocole
 * {@code est3Dgate} : construction d'un Map de parametres, hash SHA-512 ver3
 * ({@link CmiHashService}), formulaire HTML POST auto-submit
 * ({@link Est3DGateHtml}) vers la passerelle, puis callback S2S signe.</p>
 *
 * <p>Attijari partageant ce protocole, l'adaptateur <strong>reutilise</strong> :
 * </p>
 * <ul>
 *   <li>{@link CmiHashService} — hash/verification SHA-512 ver3 + mapping devise
 *       (generique Maroc Telecommerce, non specifique CMI) ;</li>
 *   <li>{@link Est3DGateHtml} — rendu de la page de redirection auto-submit ;</li>
 *   <li>{@link PaymentAdapterSupport#requireOrgId} — resolution fail-fast de l'org.</li>
 * </ul>
 * Seuls changent : le {@link PaymentProviderType}, l'URL de passerelle et les
 * URLs Clenzy de redirect/callback.
 *
 * <h2>Perimetre du POC</h2>
 * <p>Capacite {@link PaymentCapability#PAY} uniquement (comme CMI). Pas de
 * remboursement API (back-office), pas de payout sortant, pas de card-on-file.
 * Les URLs de passerelle sont a confirmer a l'onboarding marchand Attijari /
 * Maroc Telecommerce (voir {@link #resolveGatewayUrl}).</p>
 */
@Component
public class AttijariPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(AttijariPaymentProvider.class);

    private final CmiHashService hashService;
    private final PaymentMethodConfigService configService;

    @Value("${clenzy.base-url:https://app.clenzy.fr}")
    private String clenzyBaseUrl;

    public AttijariPaymentProvider(CmiHashService hashService, PaymentMethodConfigService configService) {
        this.hashService = hashService;
        this.configService = configService;
    }

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.ATTIJARI;
    }

    @Override
    public Set<PaymentCapability> getCapabilities() {
        // PAY uniquement (meme perimetre que CMI) : refund via back-office
        // marchand, pas de payout sortant, capture auto (pas de pre-autorisation).
        // Ne declarer que ce qui est reellement supporte (regle capacites).
        return Set.of(PaymentCapability.PAY);
    }

    @Override
    public Set<String> getSupportedCountries() {
        return Set.of("MA");
    }

    @Override
    public Set<String> getSupportedCurrencies() {
        return Set.of("MAD", "EUR", "USD");
    }

    @Override
    public PaymentResult createPayment(PaymentRequest request) {
        try {
            String transactionRef = request.idempotencyKey() != null
                ? request.idempotencyKey()
                : (request.metadata() != null ? request.metadata().get("transactionRef") : null);
            if (transactionRef == null) {
                return PaymentResult.failure("Attijari : transactionRef absent du metadata");
            }

            // Valide la presence des credentials (le hash est calcule au moment
            // du redirect endpoint, pas ici — voir AttijariRedirectController).
            Long orgId = PaymentAdapterSupport.requireOrgId(request, "Attijari");
            AttijariCredentials creds = loadCredentials(orgId);
            if (creds.storeKey == null || creds.storeKey.isBlank()) {
                return PaymentResult.failure("Attijari : store_key non configure pour l'org");
            }
            if (creds.clientId == null || creds.clientId.isBlank()) {
                return PaymentResult.failure("Attijari : client_id non configure pour l'org");
            }

            // Verifie que la devise est supportee par la passerelle.
            try {
                CmiHashService.toCmiCurrencyCode(request.currency());
            } catch (IllegalArgumentException e) {
                return PaymentResult.failure(e.getMessage());
            }

            String redirectUrl = clenzyBaseUrl + "/api/payments/attijari-redirect/" + transactionRef;
            log.info("Attijari payment initiated for org={} txRef={}", orgId, transactionRef);
            return PaymentResult.success(transactionRef, redirectUrl);
        } catch (Exception e) {
            log.error("Attijari createPayment failed", e);
            return PaymentResult.failure("Attijari error: " + e.getMessage());
        }
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        // Capture automatique en mode Auth (HPP standard est3Dgate).
        return PaymentResult.success(providerTxId, null, "CAPTURED");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        // Pas d'API REST de refund exposee : remboursements via back-office marchand.
        return PaymentResult.failure(
            "Attijari : les remboursements doivent etre effectues manuellement via le back-office.");
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        return null; // Pas de concept de customer persistant
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        throw new UnsupportedOperationException("Attijari does not support outgoing payouts");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        // Le hash de verification est dans le body form-urlencoded (pas un
        // header) : on parse en Map et on delegue au hash service partage.
        // Le webhook handler appelle de preference CmiHashService#verifyHash
        // directement avec le Map deja parse par Spring.
        try {
            Map<String, String> params = parseFormUrlEncoded(payload);
            return hashService.verifyHash(params, secret);
        } catch (Exception e) {
            log.error("Attijari verifyWebhook failed", e);
            return false;
        }
    }

    // ─── Helpers exposes pour AttijariRedirectController et le webhook handler ──

    /**
     * Charge les credentials Attijari de l'organisation depuis la BDD. Expose
     * en {@code public} pour reuse par
     * {@link com.clenzy.controller.AttijariRedirectController}.
     */
    public AttijariCredentials loadCredentials(Long orgId) {
        PaymentMethodConfig config = configService.getOrCreateConfig(orgId, PaymentProviderType.ATTIJARI);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new IllegalStateException("Attijari is not enabled for org " + orgId);
        }
        String clientId = configService.decryptApiKey(config);
        String storeKey = configService.decryptApiSecret(config);
        Map<String, Object> json = config.getConfigJson();
        String okUrl = json != null && json.get("okUrl") instanceof String s ? s : null;
        String failUrl = json != null && json.get("failUrl") instanceof String s ? s : null;
        String callbackUrl = json != null && json.get("callbackUrl") instanceof String s
            ? s
            : clenzyBaseUrl + "/api/webhooks/payments/attijari";
        boolean sandbox = Boolean.TRUE.equals(config.getSandboxMode());
        return new AttijariCredentials(clientId, storeKey, okUrl, failUrl, callbackUrl, sandbox);
    }

    /**
     * URL de la passerelle Attijari / Maroc Telecommerce (test ou prod).
     *
     * <p><strong>POC</strong> : ces URLs {@code est3Dgate} sont a confirmer a
     * l'onboarding marchand (le sous-domaine differe selon la banque acquereuse
     * sur la plateforme Maroc Telecommerce). Externalisables en config le jour
     * de la mise en service.</p>
     */
    public static String resolveGatewayUrl(boolean sandbox) {
        return sandbox
            ? "https://testpayment.maroctelecommerce.com/fim/est3Dgate"
            : "https://payment.maroctelecommerce.com/fim/est3Dgate";
    }

    /** Expose le hash service pour le redirect controller. */
    public CmiHashService hashService() {
        return hashService;
    }

    /** Parser minimal form-urlencoded → Map. Suffisant pour les callbacks est3Dgate. */
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

    /** Credentials Attijari hydrates depuis la BDD. */
    public record AttijariCredentials(
        String clientId,
        String storeKey,
        String okUrl,
        String failUrl,
        String callbackUrl,
        boolean sandbox
    ) {}
}
