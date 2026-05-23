package com.clenzy.integration.channex.exception;

/**
 * Exception generique pour les operations Channex.
 *
 * <p>Distingue 3 categories d'erreurs via {@link Kind} pour permettre aux
 * appelants de differencier les erreurs "retry-ables" des erreurs "terminales".</p>
 */
public class ChannexException extends RuntimeException {

    public enum Kind {
        /** 4xx HTTP — la requete est invalide, NE PAS retry (corriger l'input). */
        BAD_REQUEST,
        /** 401/403 — credentials invalides, NE PAS retry sans nouvelle config. */
        UNAUTHORIZED,
        /** 404 — ressource introuvable (property/channel inconnu cote Channex). */
        NOT_FOUND,
        /** 429 — rate limit, retry avec backoff. */
        RATE_LIMITED,
        /** 5xx ou timeout — erreur serveur cote Channex, retry. */
        SERVER_ERROR,
        /** Erreur reseau / parsing / signature invalide. */
        TRANSPORT,
    }

    private final Kind kind;
    private final Integer httpStatus;

    public ChannexException(Kind kind, String message) {
        super(message);
        this.kind = kind;
        this.httpStatus = null;
    }

    public ChannexException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
        this.httpStatus = null;
    }

    public ChannexException(Kind kind, Integer httpStatus, String message) {
        super(message);
        this.kind = kind;
        this.httpStatus = httpStatus;
    }

    public Kind getKind() { return kind; }
    public Integer getHttpStatus() { return httpStatus; }

    /** True si l'operation merite un retry (rate limit, 5xx, transport). */
    public boolean isRetryable() {
        return kind == Kind.RATE_LIMITED || kind == Kind.SERVER_ERROR || kind == Kind.TRANSPORT;
    }
}
