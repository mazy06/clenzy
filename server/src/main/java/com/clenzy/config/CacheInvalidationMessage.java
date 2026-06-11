package com.clenzy.config;

/**
 * Message d'invalidation L1 cross-instance echange sur le canal Redis pub/sub.
 *
 * <p>Format wire volontairement minimal et texte : {@code originId|cacheName|key}.
 * {@code originId} est l'UUID du noeud emetteur — il permet a chaque noeud
 * d'ignorer ses propres messages (Redis pub/sub livre aussi a l'emetteur) et
 * d'eviter une boucle de re-publication. {@code key} absent (chaine vide) = clear
 * complet du cache.</p>
 *
 * <p>{@code cacheName} et {@code originId} ne contiennent jamais de {@code '|'}
 * (UUID + noms de caches alphanumeriques), donc un split limite a 3 segments
 * preserve une eventuelle cle contenant des {@code '|'}.</p>
 */
record CacheInvalidationMessage(String originId, String cacheName, String key) {

    private static final char SEP = '|';

    /** Marqueur de clear complet (cle absente). */
    static CacheInvalidationMessage clear(String originId, String cacheName) {
        return new CacheInvalidationMessage(originId, cacheName, null);
    }

    boolean isClear() {
        return key == null || key.isEmpty();
    }

    String serialize() {
        return originId + SEP + cacheName + SEP + (key == null ? "" : key);
    }

    /** Retourne null si le payload est malforme (defensif : ne jamais crasher le listener). */
    static CacheInvalidationMessage deserialize(String payload) {
        if (payload == null) {
            return null;
        }
        // limit=3 : seules les 2 premieres barres separent ; la cle peut contenir des '|'.
        String[] parts = payload.split("\\" + SEP, 3);
        if (parts.length < 3) {
            return null;
        }
        if (parts[0].isEmpty() || parts[1].isEmpty()) {
            return null;
        }
        String key = parts[2].isEmpty() ? null : parts[2];
        return new CacheInvalidationMessage(parts[0], parts[1], key);
    }
}
