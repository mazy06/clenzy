package com.clenzy.payment.provider;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Payzone - Morocco. Stub implementation.
 */
@Component
public class PayzonePaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(PayzonePaymentProvider.class);

    @Override
    public PaymentProviderType getProviderType() { return PaymentProviderType.PAYZONE; }

    @Override
    public Set<String> getSupportedCountries() { return Set.of("MA"); }

    @Override
    public Set<String> getSupportedCurrencies() { return Set.of("MAD", "EUR"); }

    @Override
    public PaymentResult createPayment(PaymentRequest request) {
        throw new UnsupportedOperationException("Payzone provider not yet implemented");
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        throw new UnsupportedOperationException("Payzone provider not yet implemented");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        throw new UnsupportedOperationException("Payzone provider not yet implemented");
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        throw new UnsupportedOperationException("Payzone provider not yet implemented");
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        throw new UnsupportedOperationException("Payzone provider not yet implemented");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        throw new UnsupportedOperationException("Payzone provider not yet implemented");
    }
}
