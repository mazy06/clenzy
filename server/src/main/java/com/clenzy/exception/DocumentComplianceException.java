package com.clenzy.exception;

/**
 * Lancee lors d'un probleme de conformite NF (integrite compromise, verrouillage impossible).
 */
public class DocumentComplianceException extends DocumentException {

    public DocumentComplianceException(String message) {
        super(message);
    }

    public DocumentComplianceException(String message, Throwable cause) {
        super(message, cause);
    }
}
