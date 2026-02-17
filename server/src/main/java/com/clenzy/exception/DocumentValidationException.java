package com.clenzy.exception;

/**
 * Lancee quand les donnees d'entree sont invalides (type inconnu, reference manquante, etc.).
 */
public class DocumentValidationException extends DocumentException {

    public DocumentValidationException(String message) {
        super(message);
    }
}
