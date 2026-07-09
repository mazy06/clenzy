package com.clenzy.exception;

/**
 * Levée quand le SOLDE DE CRÉDITS IA (système T-07) est insuffisant pour lancer une opération IA
 * coûteuse (ex. génération de site). Distincte de {@link AiBudgetExceededException} (quota mensuel de
 * tokens, 429) : ici on ne bloque pas un quota gratuit mais un SOLDE PAYANT → le front propose un paywall
 * de rachat de packs de crédits.
 *
 * <p>Gérée par {@link GlobalExceptionHandler} → HTTP 402 (Payment Required), errorCode
 * {@code AI_CREDITS_INSUFFICIENT}. Montants en <b>millicredits</b> (1 crédit = 1 000 millicredits).</p>
 */
public class AiCreditsInsufficientException extends RuntimeException {

    private final String errorCode = "AI_CREDITS_INSUFFICIENT";
    private final String feature;
    private final long balanceMillicredits;
    private final long requiredMillicredits;

    public AiCreditsInsufficientException(String feature, long balanceMillicredits, long requiredMillicredits) {
        super("Crédits IA insuffisants pour " + feature + " : solde " + balanceMillicredits
                + " mc, requis ~" + requiredMillicredits + " mc.");
        this.feature = feature;
        this.balanceMillicredits = balanceMillicredits;
        this.requiredMillicredits = requiredMillicredits;
    }

    public String getErrorCode() { return errorCode; }
    public String getFeature() { return feature; }
    public long getBalanceMillicredits() { return balanceMillicredits; }
    public long getRequiredMillicredits() { return requiredMillicredits; }
}
