package com.clenzy.payment;

import com.clenzy.model.PaymentProviderType;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Strategy interface for payment providers.
 * Follows the TaxCalculator pattern from the fiscal module.
 * Each provider implementation is a Spring bean auto-discovered by the registry.
 */
public interface PaymentProvider {

    /** Provider type identifier */
    PaymentProviderType getProviderType();

    /** Countries this provider supports */
    Set<String> getSupportedCountries();

    /** Currencies this provider supports */
    Set<String> getSupportedCurrencies();

    /** Create a payment session/checkout */
    PaymentResult createPayment(PaymentRequest request);

    /** Capture a previously authorized payment */
    PaymentResult capturePayment(String providerTxId, BigDecimal amount);

    /** Refund a payment (full or partial) */
    PaymentResult refundPayment(String providerTxId, BigDecimal amount, String reason);

    /** Create a customer profile on the provider */
    String createCustomer(CustomerRequest request);

    /** Initiate a payout to an external bank account */
    PaymentResult createPayout(PayoutRequest request);

    /** Verify a webhook signature */
    boolean verifyWebhook(String payload, String signature, String secret);
}
