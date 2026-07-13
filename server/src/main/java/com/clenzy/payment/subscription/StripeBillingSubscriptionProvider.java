package com.clenzy.payment.subscription;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.PaymentCapability;
import com.clenzy.payment.PaymentResult;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Adaptateur Stripe Billing du port {@link SubscriptionProvider} : crée une
 * session Stripe Checkout en mode {@code SUBSCRIPTION} (embarquée ou hébergée).
 *
 * <p>Seul provider récurrent aujourd'hui. Les creds sont fournies par appel
 * ({@link com.stripe.net.RequestOptions}), jamais via {@code Stripe.apiKey} global.</p>
 */
@Component
public class StripeBillingSubscriptionProvider implements SubscriptionProvider {

    private static final Logger log = LoggerFactory.getLogger(StripeBillingSubscriptionProvider.class);

    @Value("${stripe.secret-key:}")
    private String secretKey;

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.STRIPE;
    }

    @Override
    public Set<PaymentCapability> getCapabilities() {
        return Set.of(PaymentCapability.RECURRING, PaymentCapability.CUSTOMER);
    }

    @Override
    @CircuitBreaker(name = "stripe-api")
    public PaymentResult createSubscriptionCheckout(SubscriptionCheckoutRequest request) {
        try {
            com.stripe.param.checkout.SessionCreateParams.Builder builder =
                com.stripe.param.checkout.SessionCreateParams.builder()
                    .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION);

            if (request.embedded()) {
                builder.setUiMode(com.stripe.param.checkout.SessionCreateParams.UiMode.EMBEDDED)
                    .setReturnUrl(request.successOrReturnUrl());
            } else {
                builder.setSuccessUrl(request.successOrReturnUrl())
                    .setCancelUrl(request.cancelUrl());
            }

            builder.addLineItem(
                com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(
                        com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(request.currency().toLowerCase())
                            .setUnitAmount(request.unitAmountMinor())
                            .setRecurring(
                                com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.Recurring.builder()
                                    .setInterval(mapInterval(request.interval()))
                                    .setIntervalCount(request.intervalCount())
                                    .build())
                            .setProductData(
                                com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(request.productName())
                                    .setDescription(request.productDescription())
                                    .build())
                            .build())
                    .build());

            if (request.customerId() != null && !request.customerId().isBlank()) {
                builder.setCustomer(request.customerId());
            } else if (request.customerEmail() != null) {
                builder.setCustomerEmail(request.customerEmail());
            }

            // Metadata posées sur la session ET sur l'abonnement (événements futurs).
            com.stripe.param.checkout.SessionCreateParams.SubscriptionData.Builder subData =
                com.stripe.param.checkout.SessionCreateParams.SubscriptionData.builder();
            if (request.metadata() != null) {
                request.metadata().forEach((k, v) -> {
                    builder.putMetadata(k, v);
                    subData.putMetadata(k, v);
                });
            }
            builder.setSubscriptionData(subData.build());

            if (request.couponId() != null && !request.couponId().isBlank()) {
                builder.addDiscount(
                    com.stripe.param.checkout.SessionCreateParams.Discount.builder()
                        .setCoupon(request.couponId())
                        .build());
            }

            com.stripe.model.checkout.Session session = com.stripe.model.checkout.Session.create(
                builder.build(),
                com.stripe.net.RequestOptions.builder().setApiKey(secretKey).build());

            return request.embedded()
                ? PaymentResult.embedded(session.getId(), session.getClientSecret())
                : PaymentResult.success(session.getId(), session.getUrl());
        } catch (com.stripe.exception.StripeException e) {
            log.error("Stripe subscription checkout failed: {}", e.getMessage());
            return PaymentResult.failure("Stripe subscription error: " + e.getMessage());
        }
    }

    private com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval mapInterval(
            SubscriptionInterval interval) {
        return switch (interval) {
            case DAY -> com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval.DAY;
            case WEEK -> com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval.WEEK;
            case MONTH -> com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH;
            case YEAR -> com.stripe.param.checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval.YEAR;
        };
    }
}
