package com.clenzy.payment.provider;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import com.clenzy.payment.RefundContext;
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
 * Provider Payzone Maroc (alternative moderne à CMI).
 *
 * <h2>Différenciation avec CMI</h2>
 * <ul>
 *   <li>REST API JSON (vs form POST SHA-512 chez CMI)</li>
 *   <li>Webhook HMAC-SHA256 standard (vs hash dans body chez CMI)</li>
 *   <li>Onboarding marchand plus simple (vs CMI qui exige NDA + délai)</li>
 *   <li>Frais souvent plus compétitifs sur petits volumes</li>
 * </ul>
 *
 * <h2>Quand utiliser Payzone vs CMI</h2>
 * <p>Pour les hosts marocains qui ne peuvent pas attendre l'onboarding CMI,
 * Payzone offre un démarrage rapide. CMI reste le standard "officiel" pour
 * les gros volumes et la confiance bancaire. Clenzy supporte les deux ; le
 * choix se fait au niveau organisation.</p>
 *
 * <h2>Note specs</h2>
 * <p>Les noms de champs exact dans le payload Payzone (id, checkout_url,
 * webhook signature header) sont basés sur le standard de marché et restent
 * à confirmer lors de l'onboarding. Le code suit le pattern PayTabs : un
 * Client HTTP séparé pour la testabilité et un Provider qui orchestre.</p>
 */
@Component
public class PayzonePaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(PayzonePaymentProvider.class);

    private final PayzoneClient client;
    private final PaymentMethodConfigService configService;

    @Value("${clenzy.base-url:https://app.clenzy.fr}")
    private String clenzyBaseUrl;

    public PayzonePaymentProvider(PayzoneClient client, PaymentMethodConfigService configService) {
        this.client = client;
        this.configService = configService;
    }

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.PAYZONE;
    }

    @Override
    public Set<PaymentCapability> getCapabilities() {
        // PAY + REFUND uniquement : pas de payout sortant ni de card-on-file,
        // capture = auto (pas de vraie pré-autorisation).
        return Set.of(PaymentCapability.PAY, PaymentCapability.REFUND);
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
    @CircuitBreaker(name = "payzone-api")
    public PaymentResult createPayment(PaymentRequest request) {
        try {
            Long orgId = readOrgId(request);
            PayzoneCredentials creds = loadCredentials(orgId);

            String successUrl = request.successUrl() != null && !request.successUrl().isBlank()
                ? request.successUrl()
                : creds.defaultSuccessUrl;
            String failureUrl = request.cancelUrl() != null && !request.cancelUrl().isBlank()
                ? request.cancelUrl()
                : creds.defaultFailureUrl;
            String webhookUrl = creds.webhookUrl != null
                ? creds.webhookUrl
                : clenzyBaseUrl + "/api/webhooks/payments/payzone";

            String merchantRef = request.idempotencyKey() != null
                ? request.idempotencyKey()
                : (request.metadata() != null ? request.metadata().get("transactionRef") : null);
            if (merchantRef == null) {
                return PaymentResult.failure("Payzone : transactionRef absent du metadata");
            }

            var params = new PayzoneClient.PayzoneCreatePaymentParams(
                creds.apiKey,
                creds.sandbox,
                merchantRef,
                request.currency(),
                request.amount(),
                request.description() != null ? request.description() : "Clenzy reservation",
                successUrl,
                failureUrl,
                webhookUrl,
                request.customerEmail(),
                request.customerName()
            );

            var response = client.createPayment(params);
            log.info("Payzone payment created — txId={} for org={}", response.transactionId(), orgId);
            return PaymentResult.success(response.transactionId(), response.redirectUrl());
        } catch (PayzoneClient.PayzoneApiException e) {
            log.error("Payzone createPayment failed: {}", e.getMessage());
            return PaymentResult.failure(e.getMessage());
        } catch (Exception e) {
            log.error("Payzone createPayment unexpected error", e);
            return PaymentResult.failure("Payzone error: " + e.getMessage());
        }
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        // Auto-capture en mode standard, idem PayTabs/CMI.
        return PaymentResult.success(providerTxId, null, "CAPTURED");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        // Sans contexte enrichi on ne peut pas resoudre les credentials marchand.
        return PaymentResult.failure(
            "Payzone refund : utilisez refundPayment(RefundContext, amount, reason)");
    }

    @Override
    @CircuitBreaker(name = "payzone-api")
    public PaymentResult refundPayment(RefundContext context, BigDecimal amount, String reason) {
        try {
            PayzoneCredentials creds = loadCredentials(context.orgId());
            BigDecimal refundAmount = amount != null ? amount : context.originalAmount();
            if (refundAmount == null) {
                return PaymentResult.failure("Payzone refund : amount obligatoire");
            }

            var params = new PayzoneClient.PayzoneRefundParams(
                creds.apiKey,
                creds.sandbox,
                context.providerTxId(),
                refundAmount,
                reason
            );
            var response = client.refundPayment(params);
            if (!response.approved()) {
                log.warn("Payzone refund refuse pour txId={} (org={}): status={}",
                    context.providerTxId(), context.orgId(), response.status());
                return PaymentResult.failure(
                    "Payzone refund refusé (status: " + response.status() + ")");
            }
            log.info("Payzone refund OK txId={} → refundId={} (org={})",
                context.providerTxId(), response.refundId(), context.orgId());
            return PaymentResult.success(response.refundId(), null, "REFUNDED");
        } catch (PayzoneClient.PayzoneApiException e) {
            log.error("Payzone refund failed: {}", e.getMessage());
            return PaymentResult.failure(e.getMessage());
        } catch (Exception e) {
            log.error("Payzone refund unexpected error", e);
            return PaymentResult.failure("Payzone refund error: " + e.getMessage());
        }
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        return null;
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        throw new UnsupportedOperationException("Payzone does not support outgoing payouts");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        if (signature == null || signature.isBlank() || secret == null || secret.isBlank()) {
            return false;
        }
        try {
            // HMAC-SHA256 standard : hash(payload) avec webhook_secret, comparé en hex
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computedHex = HexFormat.of().formatHex(computed);
            return constantTimeEquals(computedHex, signature.trim());
        } catch (Exception e) {
            log.error("Payzone webhook signature verification failed", e);
            return false;
        }
    }

    // ─── Helpers internes ──────────────────────────────────────────────────

    private Long readOrgId(PaymentRequest request) {
        if (request.metadata() == null || !request.metadata().containsKey("orgId")) {
            throw new IllegalStateException(
                "Payzone createPayment called without orgId metadata — orchestrator must inject it");
        }
        return Long.parseLong(request.metadata().get("orgId"));
    }

    private PayzoneCredentials loadCredentials(Long orgId) {
        PaymentMethodConfig config = configService.getOrCreateConfig(orgId, PaymentProviderType.PAYZONE);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new IllegalStateException("Payzone is not enabled for org " + orgId);
        }
        String apiKey = configService.decryptApiKey(config);
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Payzone api_key missing for org " + orgId);
        }
        Map<String, Object> json = config.getConfigJson();
        String webhookUrl = json != null && json.get("webhookUrl") instanceof String s ? s : null;
        String successUrl = json != null && json.get("defaultSuccessUrl") instanceof String s ? s : null;
        String failureUrl = json != null && json.get("defaultFailureUrl") instanceof String s ? s : null;
        boolean sandbox = Boolean.TRUE.equals(config.getSandboxMode());
        return new PayzoneCredentials(apiKey, sandbox, webhookUrl, successUrl, failureUrl);
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int diff = 0;
        String ac = a.toLowerCase();
        String bc = b.toLowerCase();
        for (int i = 0; i < ac.length(); i++) {
            diff |= ac.charAt(i) ^ bc.charAt(i);
        }
        return diff == 0;
    }

    private record PayzoneCredentials(
        String apiKey,
        boolean sandbox,
        String webhookUrl,
        String defaultSuccessUrl,
        String defaultFailureUrl
    ) {}
}
