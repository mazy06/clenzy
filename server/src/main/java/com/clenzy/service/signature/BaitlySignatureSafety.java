package com.clenzy.service.signature;

import com.clenzy.util.BaitlyExternalIds;
import java.net.URI;

/** Bornes locales Baitly : aucune réponse invalide n'est une preuve de signature. */
public final class BaitlySignatureSafety {
    private BaitlySignatureSafety() {}
    public static final String CREATION_UNCONFIRMED = "Demande de signature non confirmée ; vérifier avant de relancer";
    public static IllegalStateException unavailable() { return new IllegalStateException("Service de signature temporairement indisponible"); }
    public static IllegalStateException unknownStatus() { return new IllegalStateException("Statut de signature non confirmé"); }
    public static IllegalStateException invalidResponse() { return new IllegalStateException("Réponse de signature invalide"); }

    public static String remoteId(Object value) {
        try {return BaitlyExternalIds.require(value, 128);}
        catch (IllegalArgumentException ignored) {throw invalidResponse();}
    }

    public static String signingUrl(Object value) {
        if (!(value instanceof String text) || text.length() > 8192) throw invalidResponse();
        try {
            var uri = URI.create(text);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null) throw invalidResponse();
            return text;
        } catch (IllegalArgumentException ignored) { throw invalidResponse(); }
    }
}
