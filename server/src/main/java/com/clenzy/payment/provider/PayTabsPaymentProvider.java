package com.clenzy.payment.provider;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

/**
 * PayTabs payment provider - Stub implementation.
 * Supports Saudi Arabia. To be implemented when API keys are available.
 */
@Component
public class PayTabsPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(PayTabsPaymentProvider.class);

    @Override
    public PaymentProviderType getProviderType() {
        return PaymentProviderType.PAYTABS;
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
    public PaymentResult createPayment(PaymentRequest request) {
        log.warn("PayTabs createPayment called but not yet implemented");
        throw new UnsupportedOperationException("PayTabs provider not yet implemented. Configure API keys first.");
    }

    @Override
    public PaymentResult capturePayment(String providerTxId, BigDecimal amount) {
        throw new UnsupportedOperationException("PayTabs provider not yet implemented");
    }

    @Override
    public PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason) {
        throw new UnsupportedOperationException("PayTabs provider not yet implemented");
    }

    @Override
    public String createCustomer(CustomerRequest request) {
        throw new UnsupportedOperationException("PayTabs provider not yet implemented");
    }

    @Override
    public PaymentResult createPayout(PayoutRequest request) {
        throw new UnsupportedOperationException("PayTabs provider not yet implemented");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature, String secret) {
        throw new UnsupportedOperationException("PayTabs provider not yet implemented");
    }
}
