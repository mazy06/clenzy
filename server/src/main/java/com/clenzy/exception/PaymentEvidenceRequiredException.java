package com.clenzy.exception;

/** Une déclaration manuelle ne constitue pas une preuve de paiement Baitly. */
public class PaymentEvidenceRequiredException extends IllegalStateException {
    public PaymentEvidenceRequiredException(String message) {
        super(message);
    }
}
