package com.clenzy.exception;

/**
 * Lancee lors d'un probleme de stockage fichier (lecture/ecriture/suppression).
 */
public class DocumentStorageException extends DocumentException {

    public DocumentStorageException(String message) {
        super(message);
    }

    public DocumentStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
