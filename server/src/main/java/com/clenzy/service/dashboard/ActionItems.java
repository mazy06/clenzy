package com.clenzy.service.dashboard;

import com.clenzy.model.Property;

/**
 * Les quelques gestes que toutes les sources refaisaient.
 *
 * <p>Lire le nom d'un logement qui peut être absent, couper un extrait sans
 * laisser de blanc, nommer une réservation qui n'a pas de voyageur : recopiés
 * dans quatorze méthodes, ces gestes finissaient par diverger — l'une rendait
 * une chaîne vide là où l'autre rendait {@code null}, et l'écran affichait
 * tantôt un tiret tantôt rien.</p>
 */
public final class ActionItems {

    /** Longueur d'un extrait affiché en seconde ligne. */
    public static final int EXCERPT_LENGTH = 140;

    private ActionItems() {
    }

    public static Long propertyId(Property property) {
        return property == null ? null : property.getId();
    }

    public static String propertyName(Property property) {
        return property == null ? null : property.getName();
    }

    /** Un extrait propre, ou {@code null} — jamais une chaîne vide. */
    public static String truncate(String value, int max) {
        if (value == null) return null;
        final String trimmed = value.strip();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max) + "…";
    }

    /** Le premier texte utilisable de la liste, {@code null} si aucun ne l'est. */
    public static String firstNonBlank(String... candidates) {
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) return candidate;
        }
        return null;
    }
}
