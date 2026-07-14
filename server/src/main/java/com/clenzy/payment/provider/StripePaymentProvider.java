package com.clenzy.payment.provider;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Stripe payment provider implementation.
 * Adapts the existing StripeService logic to the PaymentProvider interface.
 */
@Component
public class StripePaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(StripePaymentProvider.class);

    @Value("${stripe.secret-key:}")
    private String secretKey;

    @Value("${stripe.webhook-secret:}")
    private String webhookSecret;

    @Value("${stripe.success-url:}")
    private String defaultSuccessUrl;

    @Value("${stripe.cancel-url:}")
    private String defaultCancelUrl;

    // Audit 2026-07 F9-01 : allow-list des origines de redirection paiement (anti open-redirect).
    // Une URL de retour hors allow-list retombe sur le défaut (fail-safe, ne casse pas le flux).
    @Value("${cors.allowed-origins:https://app.clenzy.fr,https://clenzy.fr,https://www.clenzy.fr}")
    private String allowedRedirectOriginsCsv;

    /** Retourne {@code provided} si son origine (scheme://host[:port]) est allow-listée, sinon {@code fallback}. */
    private String sanitizeReturnUrl(String provided, String fallback) {
        if (provided == null || provided.isBlank()) {
            return fallback;
        }
        try {
            java.net.URI uri = java.net.URI.create(provided.trim());
            String origin = uri.getScheme() + "://" + uri.getAuthority();
            for (String allowed : allowedRedirectOriginsCsv.split(",")) {
                if (origin.equalsIgnoreCase(allowed.trim())) {
                    return provided;
                }
            }
        } catch (RuntimeException malformed) {
            // URL invalide (ex. javascript:) -> repli sur le défaut.
        }
        log.warn("URL de retour paiement hors allow-list, repli sur le défaut");
        return fallback;
    }

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.STRIPE;
    }

    @Override
    public Set<PaymentCapability> getCapabilities() {
        // Stripe couvre toute la palette : paiement, pré-autorisation (caution),
        // remboursement, payout (Connect), card-on-file, checkout embarqué et
        // collecte d'adresse de livraison.
        return Set.of(PaymentCapability.PAY, PaymentCapability.PREAUTH,
                PaymentCapability.REFUND, PaymentCapability.PAYOUT, PaymentCapability.CUSTOMER,
                PaymentCapability.EMBEDDED_CHECKOUT, PaymentCapability.SHIPPING_ADDRESS);
    }

    @Override
    public Set<String> getSupportedCountries() {
        return Set.of("FR", "MA", "SA", "*");
    }

    @Override
    public Set<String> getSupportedCurrencies() {
        return Set.of("EUR", "MAD", "SAR", "USD", "GBP");
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult createPayment(PaymentRequest request) {
        if (request.embedded()) {
            return createEmbeddedPayment(request);
        }
        try {
            log.info("Creating Stripe payment: {} {}", request.amount(), request.currency());

            // Use request URLs (validées contre l'allow-list, audit F9-01), fallback to config defaults
            String successUrl = sanitizeReturnUrl(request.successUrl(), defaultSuccessUrl);
            String cancelUrl = sanitizeReturnUrl(request.cancelUrl(), defaultCancelUrl);

            com.stripe.param.checkout.SessionCreateParams.Builder builder =
                com.stripe.param.checkout.SessionCreateParams.builder()
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .addLineItem(
                        com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(
                                com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency(request.currency().toLowerCase())
                                    // Arrondi HALF_UP + longValueExact, jamais de troncature (Z3-BUGS-09)
                                    .setUnitAmount(StripeAmounts.toMinorUnits(request.amount()))
                                    .setProductData(
                                        com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName(request.description() != null ? request.description() : "Payment")
                                            .build())
                                    .build())
                            .build());

            if (request.customerEmail() != null) {
                builder.setCustomerEmail(request.customerEmail());
            }

            // Collecte d'adresse de livraison (biens physiques : shop hardware).
            if (request.shippingAddressCountries() != null && !request.shippingAddressCountries().isEmpty()) {
                com.stripe.param.checkout.SessionCreateParams.ShippingAddressCollection.Builder shipping =
                    com.stripe.param.checkout.SessionCreateParams.ShippingAddressCollection.builder();
                for (String country : request.shippingAddressCountries()) {
                    shipping.addAllowedCountry(
                        com.stripe.param.checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry.valueOf(
                            country.toUpperCase()));
                }
                builder.setShippingAddressCollection(shipping.build());
            }

            if (request.metadata() != null && !request.metadata().isEmpty()) {
                builder.putAllMetadata(request.metadata());
                // Miroir sur le PaymentIntent : les métadonnées de session ne se propagent
                // PAS automatiquement à la charge/PI. On les recopie pour (a) Stripe Radar
                // (règles lues sur le PaymentIntent, ex. scoring de fraude du booking engine)
                // et (b) la traçabilité sur la charge.
                builder.setPaymentIntentData(
                    com.stripe.param.checkout.SessionCreateParams.PaymentIntentData.builder()
                        .putAllMetadata(request.metadata())
                        .build());
            }

            // Expiration de la session (ex. ~35 min pour le checkout booking engine) —
            // null = défaut Stripe (24h).
            if (request.expiresAtEpochSeconds() != null) {
                builder.setExpiresAt(request.expiresAtEpochSeconds());
            }

            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.create(
                builder.build(),
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());

            return PaymentResult.success(session.getId(), session.getUrl());
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe createPayment failed: {}", e.getMessage());
            return PaymentResult.failure("Stripe error: " + e.getMessage());
        }
    }

    /**
     * Crée une session Stripe Checkout en mode <strong>embarqué</strong> (inline) et
     * renvoie son {@code clientSecret} (pas de redirection). Honore l'expiration
     * demandée et, si {@code saveCardForFutureUse}, enregistre la carte off-session
     * (customer + setup_future_usage) pour une mise en place de caution ultérieure.
     */
    private PaymentResult createEmbeddedPayment(PaymentRequest request) {
        try {
            log.info("Creating Stripe embedded payment: {} {} (saveCard={})",
                request.amount(), request.currency(), request.saveCardForFutureUse());

            com.stripe.param.checkout.SessionCreateParams.Builder builder =
                com.stripe.param.checkout.SessionCreateParams.builder()
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.PAYMENT)
                    .setUiMode(com.stripe.param.checkout.SessionCreateParams.UiMode.EMBEDDED)
                    .setRedirectOnCompletion(
                        com.stripe.param.checkout.SessionCreateParams.RedirectOnCompletion.NEVER)
                    .addPaymentMethodType(com.stripe.param.checkout.SessionCreateParams.PaymentMethodType.CARD)
                    .addLineItem(
                        com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(
                                com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency(request.currency().toLowerCase())
                                    .setUnitAmount(StripeAmounts.toMinorUnits(request.amount()))
                                    .setProductData(
                                        com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName(request.description() != null ? request.description() : "Payment")
                                            .build())
                                    .build())
                            .build());

            if (request.expiresAtEpochSeconds() != null) {
                builder.setExpiresAt(request.expiresAtEpochSeconds());
            }
            if (request.customerEmail() != null) {
                builder.setCustomerEmail(request.customerEmail());
            }
            // Caution : enregistre la carte (customer + off-session) pour un hold manuel ultérieur.
            if (request.saveCardForFutureUse()) {
                builder
                    .setCustomerCreation(com.stripe.param.checkout.SessionCreateParams.CustomerCreation.ALWAYS)
                    .setPaymentIntentData(
                        com.stripe.param.checkout.SessionCreateParams.PaymentIntentData.builder()
                            .setSetupFutureUsage(
                                com.stripe.param.checkout.SessionCreateParams.PaymentIntentData.SetupFutureUsage.OFF_SESSION)
                            .build());
            }
            if (request.metadata() != null) {
                builder.putAllMetadata(request.metadata());
            }

            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.create(
                builder.build(),
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());

            return PaymentResult.embedded(session.getId(), session.getClientSecret());
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe embedded createPayment failed: {}", e.getMessage());
            return PaymentResult.failure("Stripe error: " + e.getMessage());
        }
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        try {
            com.stripe.model.PaymentIntent intent = com.stripe.model.PaymentIntent.retrieve(
                providerTxId,
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());
            intent.capture(
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());
            return PaymentResult.success(providerTxId, null, "CAPTURED");
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe capturePayment failed: {}", e.getMessage());
            return PaymentResult.failure("Stripe capture error: " + e.getMessage());
        }
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        try {
            com.stripe.param.RefundCreateParams.Builder builder =
                com.stripe.param.RefundCreateParams.builder()
                    .setPaymentIntent(providerTxId);

            if (amount != null) {
                builder.setAmount(StripeAmounts.toMinorUnits(amount));
            }
            if (reason != null) {
                builder.setReason(com.stripe.param.RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER);
            }

            com.stripe.model.Refund refund = com.stripe.model.Refund.create(
                builder.build(),
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());

            return PaymentResult.success(refund.getId(), null, "REFUNDED");
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe refundPayment failed: {}", e.getMessage());
            return PaymentResult.failure("Stripe refund error: " + e.getMessage());
        }
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public String createCustomer(CustomerRequest request) {
        try {
            com.stripe.param.CustomerCreateParams params =
                com.stripe.param.CustomerCreateParams.builder()
                    .setEmail(request.email())
                    .setName(request.name())
                    .build();

            com.stripe.model.Customer customer = com.stripe.model.Customer.create(
                params,
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());

            return customer.getId();
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe createCustomer failed: {}", e.getMessage());
            throw new RuntimeException("Stripe customer creation failed: " + e.getMessage(), e);
        }
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult createPayout(PayoutRequest request) {
        try {
            com.stripe.param.PayoutCreateParams params =
                com.stripe.param.PayoutCreateParams.builder()
                    .setAmount(StripeAmounts.toMinorUnits(request.amount()))
                    .setCurrency(request.currency().toLowerCase())
                    .setDescription(request.description())
                    .build();

            com.stripe.model.Payout payout = com.stripe.model.Payout.create(
                params,
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());

            return PaymentResult.success(payout.getId(), null, "PAYOUT_CREATED");
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe createPayout failed: {}", e.getMessage());
            return PaymentResult.failure("Stripe payout error: " + e.getMessage());
        }
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        try {
            com.stripe.net.Webhook.constructEvent(payload, signature,
                secret != null ? secret : webhookSecret);
            return true;
        } catch (Exception e) {
            log.warn("Stripe webhook verification failed: {}", e.getMessage());
            return false;
        }
    }
}
