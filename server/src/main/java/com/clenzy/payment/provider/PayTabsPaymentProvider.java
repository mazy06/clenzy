package com.clenzy.payment.provider;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import com.clenzy.payment.RefundContext;
import com.clenzy.service.PaymentMethodConfigService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;

/**
 * Provider PayTabs (Hosted Payment Page).
 *
 * <h2>Flow</h2>
 * <ol>
 *   <li>{@code createPayment} : lit la config marchand (profile_id + server_key)
 *       de l'organisation courante, appelle {@link PayTabsClient#createPayment},
 *       retourne le {@code redirect_url} pour rediriger le guest.</li>
 *   <li>Guest paie sur le portail PayTabs (3D Secure automatique sur KSA).</li>
 *   <li>PayTabs poste un IPN sur {@code /api/webhooks/payments/paytabs} —
 *       valide par {@link #verifyWebhook} via HMAC-SHA256, puis transmis a
 *       l'orchestrateur pour completer la transaction.</li>
 * </ol>
 *
 * <h2>Credentials par tenant</h2>
 * <p>Chaque organisation a son propre compte marchand PayTabs (server_key
 * different). Le provider lit la config via {@link PaymentMethodConfigService}
 * en utilisant l'orgId transmis dans {@link PaymentRequest#metadata()} par
 * l'orchestrateur (clef {@code orgId}). Le {@code profile_id} est stocke
 * dans {@code config_json}, non secret.</p>
 *
 * <h2>Signature webhook</h2>
 * <p>PayTabs signe les IPN avec un HMAC-SHA256 du payload brut en utilisant
 * le Server Key. Voir
 * <a href="https://support.paytabs.com/en/support/solutions/articles/60000710069">doc IPN</a>.</p>
 */
@Component
public class PayTabsPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(PayTabsPaymentProvider.class);
    private static final String DEFAULT_REGION = "SA";

    private final PayTabsClient client;
    private final PaymentMethodConfigService configService;

    public PayTabsPaymentProvider(PayTabsClient client, PaymentMethodConfigService configService) {
        this.client = client;
        this.configService = configService;
    }

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.PAYTABS;
    }

    @Override
    public Set<PaymentCapability> getCapabilities() {
        // PAY + REFUND uniquement : pas de payout sortant ni de card-on-file,
        // capture = auto (pas de vraie pré-autorisation).
        return Set.of(PaymentCapability.PAY, PaymentCapability.REFUND);
    }

    @Override
    public Set<String> getSupportedCountries() {
        return Set.of("SA", "AE", "BH", "KW", "OM", "QA", "EG", "JO");
    }

    @Override
    public Set<String> getSupportedCurrencies() {
        return Set.of("SAR", "AED", "BHD", "KWD", "OMR", "QAR", "EGP", "USD");
    }

    @Override
    @CircuitBreaker(name = "paytabs-api")
    public PaymentResult createPayment(PaymentRequest request) {
        try {
            Long orgId = PaymentAdapterSupport.requireOrgId(request, "PayTabs");
            PayTabsCredentials creds = loadCredentials(orgId);

            String callbackUrl = creds.callbackUrl != null
                ? creds.callbackUrl
                : "https://api.clenzy.fr/api/webhooks/payments/paytabs";
            String returnUrl = request.successUrl() != null && !request.successUrl().isBlank()
                ? request.successUrl()
                : creds.defaultReturnUrl;

            var params = new PayTabsClient.PayTabsCreatePaymentParams(
                creds.serverKey,
                creds.profileId,
                creds.region,
                // PayTabs utilise cart_id comme reference marchande — on y met
                // notre transactionRef pour reconcilier au callback.
                request.idempotencyKey() != null ? request.idempotencyKey() : request.metadata().get("transactionRef"),
                request.currency(),
                request.amount(),
                request.description() != null ? request.description() : "Clenzy reservation",
                callbackUrl,
                returnUrl,
                request.customerName(),
                request.customerEmail()
            );

            var response = client.createPayment(params);
            log.info("PayTabs payment created — tranRef={} for org={}", response.tranRef(), orgId);
            return PaymentResult.success(response.tranRef(), response.redirectUrl());
        } catch (PayTabsClient.PayTabsApiException e) {
            log.error("PayTabs createPayment failed: {}", e.getMessage());
            return PaymentResult.failure(e.getMessage());
        } catch (Exception e) {
            log.error("PayTabs createPayment unexpected error", e);
            return PaymentResult.failure("PayTabs error: " + e.getMessage());
        }
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        // PayTabs auto-capture en mode {@code tran_type=sale}. La capture
        // manuelle existe seulement pour {@code tran_type=auth}, que Clenzy
        // n'utilise pas. Renvoyer succes idempotent.
        log.debug("PayTabs capture no-op (auto-captured at sale)");
        return PaymentResult.success(providerTxId, null, "CAPTURED");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        // Sans contexte enrichi (orgId, currency, cart_id), on ne peut pas
        // resoudre les credentials marchand ni construire le refund body
        // PayTabs valide. L'orchestrateur doit appeler la surcharge
        // refundPayment(RefundContext, ...) ci-dessous.
        return PaymentResult.failure(
            "PayTabs refund : utilisez refundPayment(RefundContext, amount, reason) "
          + "qui receive orgId + currency + transactionRef.");
    }

    @Override
    @CircuitBreaker(name = "paytabs-api")
    public PaymentResult refundPayment(RefundContext context, BigDecimal amount, String reason) {
        try {
            PayTabsCredentials creds = loadCredentials(context.orgId());
            BigDecimal refundAmount = amount != null ? amount : context.originalAmount();
            if (refundAmount == null) {
                return PaymentResult.failure("PayTabs refund : amount obligatoire");
            }

            var params = new PayTabsClient.PayTabsRefundParams(
                creds.serverKey,
                creds.profileId,
                creds.region,
                // PayTabs identifie la transaction par cart_id (= notre
                // transactionRef) + tran_ref (= providerTxId).
                context.originalTransactionRef() != null
                    ? context.originalTransactionRef()
                    : context.providerTxId(),
                context.currency(),
                refundAmount,
                reason,
                context.providerTxId()
            );

            var response = client.refundPayment(params);
            if (!response.approved()) {
                log.warn("PayTabs refund refuse pour tran_ref={} (org={})",
                    context.providerTxId(), context.orgId());
                return PaymentResult.failure("PayTabs refund refusé par la passerelle");
            }
            log.info("PayTabs refund OK tran_ref={} → refund_ref={} (org={})",
                context.providerTxId(), response.tranRef(), context.orgId());
            return PaymentResult.success(response.tranRef(), null, "REFUNDED");
        } catch (PayTabsClient.PayTabsApiException e) {
            log.error("PayTabs refund failed: {}", e.getMessage());
            return PaymentResult.failure(e.getMessage());
        } catch (Exception e) {
            log.error("PayTabs refund unexpected error", e);
            return PaymentResult.failure("PayTabs refund error: " + e.getMessage());
        }
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        // PayTabs HPP n'a pas de concept de "customer" persistant cote
        // marchand. Les coordonnees du payeur sont passees a chaque request.
        return null;
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        // PayTabs ne fait pas de payouts sortants (uniquement paiements
        // entrants). Voir Wise pour les payouts vers proprietaires KSA.
        throw new UnsupportedOperationException("PayTabs does not support outgoing payouts");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        if (signature == null || signature.isBlank() || secret == null || secret.isBlank()) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computedHex = HexFormat.of().formatHex(computed);
            // PayTabs envoie la signature en hex lowercase ; on compare en
            // ignorant la casse pour tolerer les variantes.
            return WebhookSignatures.constantTimeEqualsIgnoreCase(computedHex, signature.trim());
        } catch (Exception e) {
            log.error("PayTabs webhook signature verification failed", e);
            return false;
        }
    }

    /** Charge la config PayTabs de l'organisation depuis la BDD. */
    private PayTabsCredentials loadCredentials(Long orgId) {
        PaymentMethodConfig config = configService.getOrCreateConfig(orgId, PaymentProviderType.PAYTABS);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new IllegalStateException("PayTabs is not enabled for org " + orgId);
        }
        String serverKey = configService.decryptApiKey(config);
        if (serverKey == null || serverKey.isBlank()) {
            throw new IllegalStateException("PayTabs server_key missing for org " + orgId);
        }
        Long profileId = readProfileId(config);
        String region = readRegion(config);
        Map<String, Object> json = config.getConfigJson();
        String callbackUrl = json != null && json.get("callbackUrl") instanceof String s ? s : null;
        String defaultReturnUrl = json != null && json.get("defaultReturnUrl") instanceof String s ? s : null;
        return new PayTabsCredentials(serverKey, profileId, region, callbackUrl, defaultReturnUrl);
    }

    private static Long readProfileId(PaymentMethodConfig config) {
        Map<String, Object> json = config.getConfigJson();
        if (json == null || !(json.get("profileId") instanceof Number n)) {
            throw new IllegalStateException(
                "PayTabs profile_id missing in config_json for org " + config.getOrganizationId());
        }
        return n.longValue();
    }

    private static String readRegion(PaymentMethodConfig config) {
        Map<String, Object> json = config.getConfigJson();
        if (json != null && json.get("region") instanceof String s && !s.isBlank()) {
            return s.toUpperCase();
        }
        return DEFAULT_REGION;
    }

    /** Credentials hydrates depuis la BDD pour un appel. */
    private record PayTabsCredentials(
        String serverKey,
        Long profileId,
        String region,
        String callbackUrl,
        String defaultReturnUrl
    ) {}
}
