package com.clenzy.exception;

/**
 * Exception de base pour le module Documents.
 */
public class DocumentException extends RuntimeException {

    public DocumentException(String message) {
        super(message);
    }

    public DocumentException(String message, Throwable cause) {
        super(message, cause);
    }
}
