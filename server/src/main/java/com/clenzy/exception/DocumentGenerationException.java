package com.clenzy.exception;

/**
 * Lancee quand la generation d'un document echoue (template filling, conversion PDF, stockage).
 */
public class DocumentGenerationException extends DocumentException {

    public DocumentGenerationException(String message) {
        super(message);
    }

    public DocumentGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
