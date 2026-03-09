package com.clenzy.payment.provider;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

/**
 * PayPal - Global fallback. Stub implementation.
 */
@Component
public class PayPalPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(PayPalPaymentProvider.class);

    @Override
    public PaymentProviderType getProviderType() { return PaymentProviderType.PAYPAL; }

    @Override
    public Set<String> getSupportedCountries() { return Set.of("*"); }

    @Override
    public Set<String> getSupportedCurrencies() { return Set.of("EUR", "USD", "GBP", "MAD", "SAR"); }

    @Override
    public PaymentResult createPayment(PaymentRequest request) {
        throw new UnsupportedOperationException("PayPal provider not yet implemented");
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        throw new UnsupportedOperationException("PayPal provider not yet implemented");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        throw new UnsupportedOperationException("PayPal provider not yet implemented");
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        throw new UnsupportedOperationException("PayPal provider not yet implemented");
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        throw new UnsupportedOperationException("PayPal provider not yet implemented");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        throw new UnsupportedOperationException("PayPal provider not yet implemented");
    }
}
