package com.clenzy.payment.provider;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import com.clenzy.service.PaymentMethodConfigService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;

/**
 * Provider YouCan Pay (PSP marocain self-serve).
 *
 * <h2>Positionnement vs CMI / Payzone / Attijari</h2>
 * <p>Seul PSP marocain avec un <b>onboarding 100 % en ligne</b> (clés API +
 * sandbox immédiates, sans conventionnement bancaire ni NDA) — le candidat
 * « démarrage rapide » pour les hosts marocains, en attendant un compte CMI
 * ou Payzone pour les gros volumes.</p>
 *
 * <h2>Flux</h2>
 * <p>{@code createPayment} → tokenize (clé privée, montant en centimes MAD)
 * → redirection du guest sur la page de paiement hébergée YouCan Pay →
 * webhook signé HMAC-SHA256 sur {@code /api/webhooks/payments/youcanpay}.</p>
 *
 * <h2>Capacités</h2>
 * <p>PAY uniquement : les remboursements YouCan Pay se font depuis le
 * dashboard marchand (pas d'API publique de refund) — l'échec est explicite,
 * jamais silencieux. Pas de payout sortant ni de card-on-file.</p>
 */
@Component
public class YouCanPayPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(YouCanPayPaymentProvider.class);

    private final YouCanPayClient client;
    private final PaymentMethodConfigService configService;

    @Value("${clenzy.base-url:https://app.clenzy.fr}")
    private String baseUrl;

    public YouCanPayPaymentProvider(YouCanPayClient client, PaymentMethodConfigService configService) {
        this.client = client;
        this.configService = configService;
    }

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.YOUCAN_PAY;
    }

    @Override
    public Set<PaymentCapability> getCapabilities() {
        // PAY uniquement : refund = dashboard marchand, pas d'API publique.
        return Set.of(PaymentCapability.PAY);
    }

    @Override
    public Set<String> getSupportedCountries() {
        return Set.of("MA");
    }

    @Override
    public Set<String> getSupportedCurrencies() {
        return Set.of("MAD");
    }

    @Override
    @CircuitBreaker(name = "youcanpay-api")
    public PaymentResult createPayment(PaymentRequest request) {
        try {
            Long orgId = PaymentAdapterSupport.requireOrgId(request, "YouCan Pay");
            YouCanPayCredentials creds = loadCredentials(orgId);

            String successUrl = request.successUrl() != null && !request.successUrl().isBlank()
                ? request.successUrl()
                : creds.defaultSuccessUrl;
            String errorUrl = request.cancelUrl() != null && !request.cancelUrl().isBlank()
                ? request.cancelUrl()
                : creds.defaultFailureUrl;

            String merchantRef = request.idempotencyKey() != null
                ? request.idempotencyKey()
                : (request.metadata() != null ? request.metadata().get("transactionRef") : null);
            if (merchantRef == null) {
                return PaymentResult.failure("YouCan Pay : transactionRef absent du metadata");
            }

            var params = new YouCanPayClient.YouCanPayTokenizeParams(
                creds.privateKey,
                creds.sandbox,
                merchantRef,
                request.currency(),
                StripeAmounts.toMinorUnits(request.amount()),
                successUrl,
                errorUrl,
                request.metadata() != null ? request.metadata().get("customerIp") : null
            );

            var response = client.tokenize(params);
            log.info("YouCan Pay token created — tokenId={} for org={}", response.tokenId(), orgId);
            return PaymentResult.success(response.tokenId(), response.paymentFormUrl());
        } catch (YouCanPayClient.YouCanPayApiException e) {
            log.error("YouCan Pay createPayment failed: {}", e.getMessage());
            return PaymentResult.failure(e.getMessage());
        } catch (Exception e) {
            log.error("YouCan Pay createPayment unexpected error", e);
            return PaymentResult.failure("YouCan Pay error: " + e.getMessage());
        }
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        // Auto-capture au paiement, idem CMI/Payzone.
        return PaymentResult.success(providerTxId, null, "CAPTURED");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        return PaymentResult.failure(
            "YouCan Pay : remboursement via le dashboard marchand (pas d'API publique de refund)");
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        return null;
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        throw new UnsupportedOperationException("YouCan Pay does not support outgoing payouts");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        if (signature == null || signature.isBlank() || secret == null || secret.isBlank()) {
            return false;
        }
        try {
            // HMAC-SHA256 du payload avec la clé privée, comparé en hex (constant-time).
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computedHex = HexFormat.of().formatHex(computed);
            return WebhookSignatures.constantTimeEqualsIgnoreCase(computedHex, signature.trim());
        } catch (Exception e) {
            log.error("YouCan Pay webhook signature verification failed", e);
            return false;
        }
    }

    // ─── Helpers internes ──────────────────────────────────────────────────

    private YouCanPayCredentials loadCredentials(Long orgId) {
        PaymentMethodConfig config = configService.getOrCreateConfig(orgId, PaymentProviderType.YOUCAN_PAY);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new IllegalStateException("YouCan Pay is not enabled for org " + orgId);
        }
        String privateKey = configService.decryptApiKey(config);
        if (privateKey == null || privateKey.isBlank()) {
            throw new IllegalStateException("YouCan Pay private key missing for org " + orgId);
        }
        Map<String, Object> json = config.getConfigJson();
        String successUrl = json != null && json.get("defaultSuccessUrl") instanceof String s ? s : baseUrl;
        String failureUrl = json != null && json.get("defaultFailureUrl") instanceof String s ? s : baseUrl;
        boolean sandbox = Boolean.TRUE.equals(config.getSandboxMode());
        return new YouCanPayCredentials(privateKey, sandbox, successUrl, failureUrl);
    }

    private record YouCanPayCredentials(
        String privateKey,
        boolean sandbox,
        String defaultSuccessUrl,
        String defaultFailureUrl
    ) {}
}
