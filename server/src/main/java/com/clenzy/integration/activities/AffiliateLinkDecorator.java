package com.clenzy.integration.activities;

import com.clenzy.model.ActivityProvider;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Décore le lien de réservation d'une activité curatée avec l'identifiant d'affiliation
 * de l'org, pour que l'hôte touche sa commission. Une implémentation par provider
 * ({@link ActivityProvider}) — calquée sur {@link ActivityCatalogClient} (collectées en
 * {@code List} par Spring et mappées par {@link #provider()}).
 *
 * <p>Règle commune (algorithme partagé dans {@link #wrap}) : on ajoute le paramètre
 * d'affiliation UNIQUEMENT à une URL dont l'hôte appartient au provider ET qui n'est pas
 * déjà trackée (paramètre déjà présent). Les liens déjà trackés (deep-link généré par le
 * portail), pointant ailleurs (redirection d'un réseau d'affiliation) ou en lien court
 * (ex. {@code gyg.me}) sont laissés <b>intacts</b> : on n'écrase jamais un tracking existant.</p>
 */
public interface AffiliateLinkDecorator {

    ActivityProvider provider();

    /** Nom du paramètre d'affiliation dans l'URL (ex. {@code aid} Klook, {@code partner_id} GetYourGuide). */
    String affiliateParam();

    /** Vrai si l'hôte (déjà en minuscules) appartient au domaine du provider. */
    boolean matchesHost(String host);

    /**
     * Ajoute {@code <param>=<affiliateId>} si l'URL pointe vers le domaine du provider et
     * n'est pas déjà trackée ; sinon retourne l'URL inchangée. Null-safe, valeur encodée.
     */
    default String wrap(String url, String affiliateId) {
        if (url == null || url.isBlank() || affiliateId == null || affiliateId.isBlank()) {
            return url;
        }
        String host = host(url);
        if (host == null || !matchesHost(host) || containsParam(url, affiliateParam())) {
            return url;
        }
        String value = URLEncoder.encode(affiliateId.trim(), StandardCharsets.UTF_8);
        String sep = url.contains("?") ? "&" : "?";
        return url + sep + affiliateParam() + "=" + value;
    }

    private static String host(String url) {
        try {
            String h = URI.create(url.trim()).getHost();
            return h == null ? null : h.toLowerCase();
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean containsParam(String url, String param) {
        int q = url.indexOf('?');
        if (q < 0) {
            return false;
        }
        for (String pair : url.substring(q + 1).split("&")) {
            int eq = pair.indexOf('=');
            String key = eq >= 0 ? pair.substring(0, eq) : pair;
            if (key.equalsIgnoreCase(param)) {
                return true;
            }
        }
        return false;
    }
}
