package com.clenzy.exception;

/**
 * Exception levee quand le budget mensuel de tokens IA est depasse.
 *
 * Geree par {@link GlobalExceptionHandler} → HTTP 429.
 */
public class AiBudgetExceededException extends RuntimeException {

    private final String errorCode = "AI_BUDGET_EXCEEDED";
    private final String feature;
    private final long used;
    private final long limit;

    public AiBudgetExceededException(String feature, long used, long limit) {
        super("Budget mensuel de tokens IA depasse pour la fonctionnalite " + feature
                + " (" + used + "/" + limit + " tokens utilises).");
        this.feature = feature;
        this.used = used;
        this.limit = limit;
    }

    public String getErrorCode() { return errorCode; }
    public String getFeature() { return feature; }
    public long getUsed() { return used; }
    public long getLimit() { return limit; }
}
