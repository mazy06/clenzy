package com.clenzy.service.payout;

/** Refus avant émission : aucun appel de transfert, donc une relance reste possible. */
public class PayoutFundsUnavailableException extends RuntimeException {
    public PayoutFundsUnavailableException(String message) { super(message); }
    public PayoutFundsUnavailableException(String message, Throwable cause) { super(message, cause); }
}
