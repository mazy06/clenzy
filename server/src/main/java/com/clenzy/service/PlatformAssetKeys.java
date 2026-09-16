package com.clenzy.service;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Cles des binaires PLATEFORME, c'est-a-dire sans organisation proprietaire.
 *
 * <p>Forme : {@code platform/{namespace}/{uuid}}. Elle ne ressemble
 * volontairement pas a la cle org-scopee {@code org/{id}/photos/{uuid}} —
 * c'est ce qui permet a {@code assertReadableInCurrentOrg} de refuser un
 * binaire plateforme presente par un client.</p>
 */
public final class PlatformAssetKeys {

    /** Minuscules et tirets. Une cle se retrouve dans des chemins d'objets. */
    private static final Pattern NAMESPACE = Pattern.compile("^[a-z0-9-]{1,40}$");

    private PlatformAssetKeys() {}

    public static String build(String namespace) {
        if (namespace == null || !NAMESPACE.matcher(namespace).matches()) {
            // Un espace de noms libre laisserait ecrire « ../ » ou « org/1 » dans
            // la cle, donc deposer un binaire la ou il serait relu comme celui
            // d'une organisation.
            throw new IllegalArgumentException("Espace de noms de stockage invalide : " + namespace);
        }
        return "platform/" + namespace + "/" + UUID.randomUUID();
    }
}
