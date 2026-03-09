package com.clenzy.dto;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.PaymentResult;

public record PaymentOrchestrationResult(
    PaymentTransaction transaction,
    PaymentResult paymentResult,
    PaymentProviderType providerUsed
) {
    public boolean isSuccess() {
        return paymentResult != null && paymentResult.success();
    }
}
