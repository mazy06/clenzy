package com.clenzy.config.ai;

/**
 * Exception levee par les providers AI en cas d'erreur de communication,
 * de parsing de reponse, ou de reponse vide.
 */
public class AiProviderException extends RuntimeException {

    private final String provider;

    public AiProviderException(String provider, String message) {
        super("[" + provider + "] " + message);
        this.provider = provider;
    }

    public AiProviderException(String provider, String message, Throwable cause) {
        super("[" + provider + "] " + message, cause);
        this.provider = provider;
    }

    public String getProvider() {
        return provider;
    }
}
