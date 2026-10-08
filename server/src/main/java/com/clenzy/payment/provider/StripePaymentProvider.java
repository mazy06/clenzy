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
    private final StripeGateway stripeGateway;
    private final ManagedStripeRefund managedRefund;

    public StripePaymentProvider(StripeGateway stripeGateway, ManagedStripeRefund managedRefund) {
        this.stripeGateway = stripeGateway;
        this.managedRefund = managedRefund;
    }

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
                    .setIntegrationIdentifier(com.clenzy.payment.StripeGateway.CHECKOUT_INTEGRATION_ID)
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .addLineItem(lineItem(request));
            configureInvoice(builder,request);

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

            com.stripe.model.checkout.Session session = stripeGateway.createSession(builder.build(), request.idempotencyKey());

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
                    .setIntegrationIdentifier(com.clenzy.payment.StripeGateway.CHECKOUT_INTEGRATION_ID)
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.PAYMENT)
                    .setUiMode(com.stripe.param.checkout.SessionCreateParams.UiMode.EMBEDDED_PAGE)
                    .setRedirectOnCompletion(
                        com.stripe.param.checkout.SessionCreateParams.RedirectOnCompletion.NEVER)
                    .addLineItem(lineItem(request));
            configureInvoice(builder,request);

            if (request.expiresAtEpochSeconds() != null) {
                builder.setExpiresAt(request.expiresAtEpochSeconds());
            }
            if (request.customerEmail() != null) {
                builder.setCustomerEmail(request.customerEmail());
            }
            var intentData = com.stripe.param.checkout.SessionCreateParams.PaymentIntentData.builder();
            // Caution : enregistre la carte (customer + off-session) pour un hold manuel ultérieur.
            if (request.saveCardForFutureUse()) {
                builder.setCustomerCreation(com.stripe.param.checkout.SessionCreateParams.CustomerCreation.ALWAYS);
                intentData.setSetupFutureUsage(com.stripe.param.checkout.SessionCreateParams.PaymentIntentData.SetupFutureUsage.OFF_SESSION);
            }
            if (request.metadata() != null) {
                builder.putAllMetadata(request.metadata());
                intentData.putAllMetadata(request.metadata());
            }
            builder.setPaymentIntentData(intentData.build());

            com.stripe.model.checkout.Session session = stripeGateway.createSession(builder.build(), request.idempotencyKey());

            return PaymentResult.embedded(session.getId(), session.getClientSecret());
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe embedded createPayment failed: {}", e.getMessage());
            return PaymentResult.failure("Stripe error: " + e.getMessage());
        }
    }

    private static com.stripe.param.checkout.SessionCreateParams.LineItem lineItem(PaymentRequest request) {
        var product=com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.ProductData.builder()
            .setName(request.description()!=null?request.description():"Paiement Baitly");
        var price=com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.builder().setCurrency(request.currency().toLowerCase(java.util.Locale.ROOT))
            .setUnitAmount(StripeAmounts.toMinorUnits(request.amount()));
        if(invoiceRequested(request)) {
            String code=request.metadata().get("baitly_tax_code");
            if(code==null || !code.matches("txcd_[0-9]{8}"))throw new IllegalArgumentException("Catégorie fiscale absente");
            product.setTaxCode(code);price.setTaxBehavior(com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.TaxBehavior.INCLUSIVE);
        }
        return com.stripe.param.checkout.SessionCreateParams.LineItem.builder().setQuantity(1L).setPriceData(price.setProductData(product.build()).build()).build();
    }
    private static boolean invoiceRequested(PaymentRequest request) {
        return request.metadata()!=null && "true".equals(request.metadata().get("baitly_commerce_invoice"));
    }
    private static void configureInvoice(com.stripe.param.checkout.SessionCreateParams.Builder builder,PaymentRequest request) {
        if(!invoiceRequested(request))return;
        builder.setAutomaticTax(com.stripe.param.checkout.SessionCreateParams.AutomaticTax.builder().setEnabled(true).build())
            .setCustomerCreation(com.stripe.param.checkout.SessionCreateParams.CustomerCreation.ALWAYS)
            .setBillingAddressCollection(com.stripe.param.checkout.SessionCreateParams.BillingAddressCollection.REQUIRED)
            .setTaxIdCollection(com.stripe.param.checkout.SessionCreateParams.TaxIdCollection.builder().setEnabled(true).build())
            .setInvoiceCreation(com.stripe.param.checkout.SessionCreateParams.InvoiceCreation.builder().setEnabled(true)
                .setInvoiceData(com.stripe.param.checkout.SessionCreateParams.InvoiceCreation.InvoiceData.builder().putAllMetadata(request.metadata()).build()).build());
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult resumeEmbeddedPayment(String providerTxId, BigDecimal amount, String currency) {
        return resumeCheckout(providerTxId, amount, currency, true);
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult resumeHostedPayment(String providerTxId, BigDecimal amount, String currency) {
        return resumeCheckout(providerTxId, amount, currency, false);
    }

    private PaymentResult resumeCheckout(String providerTxId, BigDecimal amount, String currency, boolean embedded) {
        if (providerTxId == null || !providerTxId.startsWith("cs_") || amount == null || currency == null) {
            return PaymentResult.failure("Le paiement existant nécessite une vérification.");
        }
        try {
            var session = stripeGateway.retrieveSession(providerTxId);
            if (!"open".equals(session.getStatus()) || !"unpaid".equals(session.getPaymentStatus())) {
                return PaymentResult.failure("Ce paiement est terminé ou expiré. Actualisez son statut avant de réessayer.");
            }
            if (!currency.equalsIgnoreCase(session.getCurrency())
                    || !java.util.Objects.equals(session.getAmountTotal(), StripeAmounts.toMinorUnits(amount))) {
                return PaymentResult.failure("La session existante ne correspond pas au montant à régler.");
            }
            if (embedded) {
                // Dahlia nomme désormais ce mode embedded_page ; conserver les sessions antérieures.
                boolean embeddedMode = com.stripe.param.checkout.SessionCreateParams.UiMode.EMBEDDED_PAGE
                    .getValue().equals(session.getUiMode()) || "embedded".equals(session.getUiMode());
                if (!embeddedMode || session.getClientSecret() == null || session.getClientSecret().isBlank()) {
                    return PaymentResult.failure("Cette session ne peut pas être ouverte dans le formulaire de paiement.");
                }
                return PaymentResult.embedded(session.getId(), session.getClientSecret());
            }
            boolean hostedMode = com.stripe.param.checkout.SessionCreateParams.UiMode.HOSTED_PAGE
                .getValue().equals(session.getUiMode()) || "hosted".equals(session.getUiMode());
            if (!hostedMode || session.getUrl() == null || session.getUrl().isBlank()) {
                return PaymentResult.failure("Cette session ne dispose pas de lien de paiement hébergé.");
            }
            return PaymentResult.success(session.getId(), session.getUrl());
        } catch (com.stripe.exception.StripeException e) {
            log.warn("Reprise du checkout Stripe impossible : {}", e.getClass().getSimpleName());
            return PaymentResult.failure("Impossible de reprendre le paiement pour le moment. Réessayez sans créer un nouvel ordre.");
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
        return refundPayment(providerTxId, amount, reason, null);
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult refundPayment(RefundContext context, BigDecimal amount, String reason) {
        if (context.refundTransactionRef() != null) {
            try { return managedRefund.execute(context, amount); }
            catch (Exception failure) { return PaymentResult.failure(failure.getMessage()); }
        }
        // Un remboursement total rejoue la même opération après une panne de persistance.
        String key = (amount == null || amount.compareTo(context.originalAmount()) == 0)
            ? "baitly-refund-full-" + context.originalTransactionRef() : null;
        return refundPayment(context.providerTxId(), amount, reason, key);
    }

    private PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason, String key) {
        try {
            var options = com.stripe.net.RequestOptions.builder().setApiKey(secretKey);
            String paymentIntentId = providerTxId;
            // createPayment renvoie une session Checkout, pas un PaymentIntent.
            if (providerTxId.startsWith("cs_")) {
                var session = com.stripe.model.checkout.Session.retrieve(providerTxId, options.build());
                if (!"paid".equals(session.getPaymentStatus()) || session.getPaymentIntent() == null) {
                    return PaymentResult.failure("Le paiement Stripe de cette session n'est pas confirmé");
                }
                paymentIntentId = session.getPaymentIntent();
            }
            com.stripe.param.RefundCreateParams.Builder builder =
                com.stripe.param.RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId);

            if (amount != null) {
                builder.setAmount(StripeAmounts.toMinorUnits(amount));
            }
            if (reason != null) {
                builder.setReason(com.stripe.param.RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER);
            }

            com.stripe.model.Refund refund = com.stripe.model.Refund.create(
                builder.build(),
                options.setIdempotencyKey(key).build());

            if (refund.getId() != null && !"succeeded".equals(refund.getStatus())) {
                refund = com.stripe.model.Refund.retrieve(refund.getId(),
                    com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());
            }
            if (!"succeeded".equals(refund.getStatus())) {
                return PaymentResult.failure("Remboursement non confirmé par Stripe : " + refund.getStatus());
            }

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
