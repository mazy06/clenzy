package com.clenzy.exception;

/**
 * Levee quand un token de verification de cle (page publique commercant) a
 * accumule trop de tentatives de code echouees et se retrouve verrouille
 * temporairement. Protection anti brute-force des codes a 6 chiffres.
 *
 * Mappee en HTTP 429 par {@code KeyExchangePublicController}.
 */
public class TooManyVerificationAttemptsException extends RuntimeException {

    private final long retryAfterSeconds;

    public TooManyVerificationAttemptsException(long retryAfterSeconds) {
        super("Trop de tentatives de verification. Reessayez dans " + retryAfterSeconds + " secondes.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
