package com.clenzy.payment;

import com.clenzy.model.PaymentProviderType;

public class UnsupportedPaymentProviderException extends RuntimeException {

    private final PaymentProviderType providerType;

    public UnsupportedPaymentProviderException(PaymentProviderType providerType) {
        super("Payment provider not supported: " + providerType);
        this.providerType = providerType;
    }

    public PaymentProviderType getProviderType() {
        return providerType;
    }
}
