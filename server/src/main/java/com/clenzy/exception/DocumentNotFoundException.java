package com.clenzy.exception;

/**
 * Lancee quand un document, template ou generation est introuvable.
 */
public class DocumentNotFoundException extends DocumentException {

    public DocumentNotFoundException(String message) {
        super(message);
    }
}
