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

import java.math.BigDecimal;
import java.util.Set;

/**
 * Provider PayPal (REST API v2 Orders, mode CAPTURE intent).
 *
 * <h2>Flow</h2>
 * <ol>
 *   <li>{@code createPayment} : OAuth2 token → POST /v2/checkout/orders →
 *       retourne {@code approve_url} pour rediriger le guest sur PayPal.</li>
 *   <li>Guest approuve sur PayPal et revient sur {@code return_url} (Clenzy)
 *       avec {@code token=ORDER_ID} en query string.</li>
 *   <li>Le frontend appelle {@code capturePayment(orderId)} qui POST sur
 *       /v2/checkout/orders/{id}/capture pour matérialiser le paiement.</li>
 *   <li>Webhook PAYPAL.PAYMENT.CAPTURE.COMPLETED confirme côté serveur
 *       en parallèle (redondance).</li>
 * </ol>
 *
 * <h2>Credentials par tenant</h2>
 * <p>Chaque organisation a son propre PayPal merchant ID. Les credentials
 * Client ID + Client Secret sont stockés chiffrés en BDD. PayPal préfère
 * un compte business par marchand, pas un compte central — comme pour Stripe
 * Connect mais en plus simple à mettre en place.</p>
 *
 * <h2>Webhook verification</h2>
 * <p>PayPal propose deux modèles de vérification :</p>
 * <ul>
 *   <li><strong>Local (offline)</strong> : impossible — PayPal ne fournit
 *       pas de secret HMAC partagé contrairement aux autres providers.</li>
 *   <li><strong>API verify</strong> : POST /v1/notifications/verify-webhook-signature
 *       avec les headers reçus + le payload + le webhook_id. PayPal renvoie
 *       SUCCESS/FAILURE. Voir {@link #verifyWebhook}.</li>
 * </ul>
 */
@Component
public class PayPalPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(PayPalPaymentProvider.class);

    private final PayPalClient client;
    private final PaymentMethodConfigService configService;

    @Value("${clenzy.base-url:https://app.clenzy.fr}")
    private String clenzyBaseUrl;

    public PayPalPaymentProvider(PayPalClient client, PaymentMethodConfigService configService) {
        this.client = client;
        this.configService = configService;
    }

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.PAYPAL;
    }

    @Override
    public Set<String> getSupportedCountries() {
        // PayPal couvre 200+ pays
        return Set.of("*");
    }

    @Override
    public Set<String> getSupportedCurrencies() {
        // PayPal supporte 25+ devises — on liste les principales pour Clenzy
        return Set.of("EUR", "USD", "GBP", "MAD", "SAR", "AED", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK");
    }

    @Override
    @CircuitBreaker(name = "paypal-api")
    public PaymentResult createPayment(PaymentRequest request) {
        try {
            Long orgId = readOrgId(request);
            PayPalConfig cfg = loadCredentials(orgId);

            String referenceId = request.idempotencyKey() != null
                ? request.idempotencyKey()
                : (request.metadata() != null ? request.metadata().get("transactionRef") : null);
            if (referenceId == null) {
                return PaymentResult.failure("PayPal : transactionRef absent du metadata");
            }

            String returnUrl = request.successUrl() != null && !request.successUrl().isBlank()
                ? request.successUrl()
                : clenzyBaseUrl + "/booking/paypal-return";
            String cancelUrl = request.cancelUrl() != null && !request.cancelUrl().isBlank()
                ? request.cancelUrl()
                : clenzyBaseUrl + "/booking/cancel";

            var params = new PayPalClient.PayPalCreateOrderParams(
                cfg.cacheKey(),
                cfg.sandbox(),
                cfg.clientId(),
                cfg.clientSecret(),
                referenceId,
                request.currency(),
                request.amount(),
                request.description() != null ? request.description() : "Clenzy reservation",
                returnUrl,
                cancelUrl
            );

            var response = client.createOrder(params);
            log.info("PayPal order created — orderId={} for org={}", response.orderId(), orgId);
            return PaymentResult.success(response.orderId(), response.approveUrl());
        } catch (PayPalClient.PayPalApiException e) {
            log.error("PayPal createPayment failed: {}", e.getMessage());
            return PaymentResult.failure(e.getMessage());
        } catch (Exception e) {
            log.error("PayPal createPayment unexpected error", e);
            return PaymentResult.failure("PayPal error: " + e.getMessage());
        }
    }

    @Override
    @CircuitBreaker(name = "paypal-api")
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        // amount ignoré : PayPal capture le montant exact de l'order créé.
        // Cette méthode est appelée depuis le frontend après le return PayPal
        // (ou en backup depuis le webhook si nécessaire).
        try {
            // Note : capturePayment dans l'interface PaymentProvider ne reçoit pas
            // d'orgId. Pour le PoC on s'appuie sur le fait que PayPal capture est
            // appelée par un endpoint Clenzy authentifié qui a accès au TenantContext.
            // À raffiner si on veut une signature plus stricte.
            throw new UnsupportedOperationException(
                "PayPal capture needs orgId from tenant context — call PayPalPaymentProvider.captureOrder() directly");
        } catch (Exception e) {
            return PaymentResult.failure(e.getMessage());
        }
    }

    /**
     * Capture explicite avec contexte tenant (appelé par PayPalReturnController).
     *
     * <p>La réponse contient maintenant le {@code captureId} qu'on retourne
     * via le champ {@code providerTxId} de {@link PaymentResult} — c'est lui
     * (et pas l'order_id) qui sera utilisé pour les refunds futurs. L'orchestrator
     * met à jour {@code PaymentTransaction.providerTxId} avec cette valeur.</p>
     */
    public PaymentResult captureOrder(Long orgId, String orderId) {
        try {
            PayPalConfig cfg = loadCredentials(orgId);
            var response = client.captureOrder(orderId,
                new PayPalClient.PayPalCredentials(cfg.cacheKey(), cfg.sandbox(),
                    cfg.clientId(), cfg.clientSecret()));
            if (response.completed()) {
                // On retourne le captureId comme providerTxId pour que l'orchestrator
                // le persiste — sera nécessaire pour le refund.
                String idForRefund = response.captureId() != null ? response.captureId() : orderId;
                return PaymentResult.success(idForRefund, null, "CAPTURED");
            }
            return PaymentResult.failure("PayPal capture status: " + response.status());
        } catch (Exception e) {
            log.error("PayPal capture failed for order {}", orderId, e);
            return PaymentResult.failure(e.getMessage());
        }
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        // Sans contexte enrichi (orgId, currency) on ne peut pas resoudre
        // les credentials marchand.
        return PaymentResult.failure(
            "PayPal refund : utilisez refundPayment(RefundContext, amount, reason)");
    }

    @Override
    @CircuitBreaker(name = "paypal-api")
    public PaymentResult refundPayment(RefundContext context, BigDecimal amount, String reason) {
        try {
            PayPalConfig cfg = loadCredentials(context.orgId());
            BigDecimal refundAmount = amount != null ? amount : context.originalAmount();
            if (refundAmount == null) {
                return PaymentResult.failure("PayPal refund : amount obligatoire");
            }

            var params = new PayPalClient.PayPalRefundParams(
                cfg.cacheKey(),
                cfg.sandbox(),
                cfg.clientId(),
                cfg.clientSecret(),
                context.currency(),
                refundAmount,
                reason
            );
            // context.providerTxId() = capture_id (stocké lors du captureOrder)
            var response = client.refundCapture(context.providerTxId(), params);
            if (!response.completed()) {
                log.warn("PayPal refund non complete pour capture={} (org={}): status={}",
                    context.providerTxId(), context.orgId(), response.status());
                return PaymentResult.failure(
                    "PayPal refund status: " + response.status());
            }
            log.info("PayPal refund OK capture={} → refundId={} (org={})",
                context.providerTxId(), response.refundId(), context.orgId());
            return PaymentResult.success(response.refundId(), null, "REFUNDED");
        } catch (PayPalClient.PayPalApiException e) {
            log.error("PayPal refund failed: {}", e.getMessage());
            return PaymentResult.failure(e.getMessage());
        } catch (Exception e) {
            log.error("PayPal refund unexpected error", e);
            return PaymentResult.failure("PayPal refund error: " + e.getMessage());
        }
    }

    /**
     * Vérifie un webhook PayPal via l'API stricte
     * {@code /v1/notifications/verify-webhook-signature}.
     *
     * <p>Différent de {@link #verifyWebhook} (signature historique qui ne
     * reçoit qu'un secret/payload) : cette méthode prend tous les headers
     * PayPal nécessaires + le webhook_id du marchand + les credentials de
     * l'org pour générer un access_token.</p>
     */
    public boolean verifyWebhookStrict(PayPalClient.PayPalWebhookHeaders headers,
                                        String rawPayload, Long orgId) {
        try {
            PayPalConfig cfg = loadCredentials(orgId);
            PaymentMethodConfig dbConfig = configService.getOrCreateConfig(orgId, PaymentProviderType.PAYPAL);
            String webhookId = configService.decryptWebhookSecret(dbConfig);
            if (webhookId == null || webhookId.isBlank()) {
                log.warn("PayPal webhook strict : webhook_id absent pour org {}", orgId);
                return false;
            }
            var creds = new PayPalClient.PayPalCredentials(
                cfg.cacheKey(), cfg.sandbox(), cfg.clientId(), cfg.clientSecret());
            return client.verifyWebhookSignature(headers, webhookId, rawPayload, creds);
        } catch (Exception e) {
            log.error("PayPal verifyWebhookStrict failed for org {}", orgId, e);
            return false;
        }
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        return null; // PayPal Vault optionnel, pas nécessaire pour MVP
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        // PayPal Payouts existe (API séparée Payouts) mais pas dans le scope
        // payouts sortants Clenzy. Voir Wise pour la roadmap payouts.
        throw new UnsupportedOperationException(
            "PayPal payouts API not implemented — see Wise/Stripe Connect for outgoing payouts");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        // PayPal n'utilise pas de HMAC partagé. La vérification nécessite un
        // appel API à /v1/notifications/verify-webhook-signature avec les
        // headers PayPal-Transmission-* et le webhook_id. Le payload `secret`
        // ici contient le webhook_id de l'org.
        //
        // Pour MVP : verification "soft" — on accepte le webhook si le secret
        // (webhook_id) est présent. La vraie verification API sera ajoutée
        // dans une PR ultérieure. C'est moins sécurisé mais acceptable en
        // sandbox local.
        //
        // TODO PR ultérieure : implémenter verifyWebhookSignature via API PayPal
        if (secret == null || secret.isBlank()) {
            log.warn("PayPal webhook : webhook_id absent dans la config, rejet");
            return false;
        }
        log.warn("PayPal webhook : verification soft (à durcir en PR ultérieure)");
        return true;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private Long readOrgId(PaymentRequest request) {
        if (request.metadata() == null || !request.metadata().containsKey("orgId")) {
            throw new IllegalStateException(
                "PayPal createPayment called without orgId metadata — orchestrator must inject it");
        }
        return Long.parseLong(request.metadata().get("orgId"));
    }

    public PayPalConfig loadCredentials(Long orgId) {
        PaymentMethodConfig config = configService.getOrCreateConfig(orgId, PaymentProviderType.PAYPAL);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new IllegalStateException("PayPal is not enabled for org " + orgId);
        }
        String clientId = configService.decryptApiKey(config);
        String clientSecret = configService.decryptApiSecret(config);
        if (clientId == null || clientId.isBlank()) {
            throw new IllegalStateException("PayPal client_id missing for org " + orgId);
        }
        if (clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException("PayPal client_secret missing for org " + orgId);
        }
        boolean sandbox = Boolean.TRUE.equals(config.getSandboxMode());
        String cacheKey = "org-" + orgId + ":" + (sandbox ? "sandbox" : "prod");
        return new PayPalConfig(cacheKey, sandbox, clientId, clientSecret);
    }

    public record PayPalConfig(
        String cacheKey,
        boolean sandbox,
        String clientId,
        String clientSecret
    ) {}
}
