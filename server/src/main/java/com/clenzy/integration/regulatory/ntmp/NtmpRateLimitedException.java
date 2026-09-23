package com.clenzy.integration.regulatory.ntmp;

import java.time.Duration;

/**
 * La passerelle a repondu {@code 429}.
 *
 * <p>Porte le delai qu'elle demande ({@code Retry-After}) quand elle le donne.
 * L'appelant recule de ce delai AU MOINS — les quotas sont comptes par
 * etablissement et par integrateur, un rattrapage massif peut donc faire
 * dépasser tous les clients a la fois.</p>
 */
public class NtmpRateLimitedException extends RuntimeException {

    private final Duration retryAfter;

    public NtmpRateLimitedException(String message, Duration retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
    }

    /** Delai demande par la passerelle, ou {@code null} si elle n'en donne pas. */
    public Duration getRetryAfter() {
        return retryAfter;
    }
}
