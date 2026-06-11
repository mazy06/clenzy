package com.clenzy.service.ical;

import java.net.URI;

/**
 * Masquage des URLs de feeds pour les logs.
 *
 * <p>Les URLs iCal des OTA embarquent un token secret dans la query string
 * (ex. Airbnb {@code ?s=<secret>}) qui donne acces au calendrier complet du
 * logement. Ne JAMAIS logger une URL de feed brute : utiliser
 * {@link #mask(String)} qui conserve scheme/host/path (diagnostic) et
 * remplace query string et userinfo par un marqueur.</p>
 */
public final class FeedUrlMasker {

    private static final String MASKED_QUERY = "?<masque>";

    private FeedUrlMasker() {
    }

    /**
     * Retourne une version de l'URL sans secret, exploitable en logs :
     * {@code scheme://host[:port]/path[?<masque>]}.
     * Ne leve jamais d'exception (retourne un placeholder si l'URL est invalide).
     */
    public static String mask(String url) {
        if (url == null || url.isBlank()) {
            return "<url vide>";
        }
        try {
            URI uri = URI.create(url.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) {
                return "<url invalide>";
            }
            String port = uri.getPort() != -1 ? ":" + uri.getPort() : "";
            String path = uri.getRawPath() != null ? uri.getRawPath() : "";
            String masked = scheme + "://" + host + port + path;
            return uri.getRawQuery() != null ? masked + MASKED_QUERY : masked;
        } catch (IllegalArgumentException e) {
            return "<url invalide>";
        }
    }
}
