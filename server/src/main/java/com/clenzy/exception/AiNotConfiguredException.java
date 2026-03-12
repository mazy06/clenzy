package com.clenzy.exception;

/**
 * Exception levee quand une fonctionnalite IA n'est pas configuree.
 *
 * Cas d'usage :
 * - Aucune cle API disponible (ni plateforme, ni org) → errorCode = "AI_NOT_CONFIGURED"
 * - Feature flag desactive → errorCode = "AI_FEATURE_DISABLED"
 *
 * Geree par {@link com.clenzy.exception.GlobalExceptionHandler} → HTTP 422.
 */
public class AiNotConfiguredException extends RuntimeException {

    private final String errorCode;
    private final String feature;

    public AiNotConfiguredException(String errorCode, String feature, String message) {
        super(message);
        this.errorCode = errorCode;
        this.feature = feature;
    }

    public String getErrorCode() { return errorCode; }
    public String getFeature() { return feature; }
}
