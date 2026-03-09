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

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.STRIPE;
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
        try {
            log.info("Creating Stripe payment: {} {}", request.amount(), request.currency());

            // Use request URLs, fallback to config defaults
            String successUrl = (request.successUrl() != null && !request.successUrl().isBlank())
                ? request.successUrl() : defaultSuccessUrl;
            String cancelUrl = (request.cancelUrl() != null && !request.cancelUrl().isBlank())
                ? request.cancelUrl() : defaultCancelUrl;

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
                                    .setUnitAmount(request.amount().multiply(BigDecimal.valueOf(100)).longValue())
                                    .setProductData(
                                        com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName(request.description() != null ? request.description() : "Payment")
                                            .build())
                                    .build())
                            .build());

            if (request.customerEmail() != null) {
                builder.setCustomerEmail(request.customerEmail());
            }

            if (request.metadata() != null) {
                builder.putAllMetadata(request.metadata());
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
                builder.setAmount(amount.multiply(BigDecimal.valueOf(100)).longValue());
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
                    .setAmount(request.amount().multiply(BigDecimal.valueOf(100)).longValue())
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
