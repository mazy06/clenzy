package com.clenzy.integration.regulatory.ntmp;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cache des jetons d'acces a la NTMP.
 *
 * <p>La passerelle facture ses quotas par etablissement ET par integrateur :
 * redemander un jeton a chaque appel les consommerait pour rien. On le garde
 * donc jusqu'a son echeance, moins une marge — attendre le {@code 401} coute un
 * appel perdu a chaque cycle, ce que la documentation du ministere signale
 * explicitement.</p>
 *
 * <p>La cle est le couple connexion + licence : un identifiant d'agence couvre
 * toute l'organisation, mais le jeton qu'il obtient vaut pour UNE licence.</p>
 *
 * <p>L'echange lui-meme est injecte plutot qu'appele : cette classe ne connait
 * pas HTTP, et se teste sans reseau.</p>
 */
@Component
public class NtmpTokenProvider {

    /**
     * Marge avant echeance. Couvre le vol du dernier appel emis avec ce jeton :
     * un jeton encore valide a l'emission mais expire a l'arrivee est un 401
     * qu'aucun retry ne rattrape proprement.
     */
    static final Duration SAFETY_MARGIN = Duration.ofSeconds(60);

    /** Obtention d'un jeton neuf aupres de la passerelle. */
    @FunctionalInterface
    public interface Exchange {
        NtmpAccessToken exchange(Long connectionId, String externalLicenseId);
    }

    private record Key(Long connectionId, String externalLicenseId) {
    }

    private final Map<Key, NtmpAccessToken> cache = new ConcurrentHashMap<>();
    private final Map<Key, Object> locks = new ConcurrentHashMap<>();
    private final Clock clock;

    public NtmpTokenProvider(Clock clock) {
        this.clock = clock;
    }

    /**
     * Jeton utilisable pour cette licence, depuis le cache ou fraichement obtenu.
     *
     * <p>Un echange qui echoue ne met RIEN en cache : l'appel suivant reessaiera
     * plutot que de servir un jeton fantome.</p>
     */
    public NtmpAccessToken get(Long connectionId, String externalLicenseId, Exchange exchange) {
        Objects.requireNonNull(connectionId, "connectionId");
        Key key = new Key(connectionId, externalLicenseId);

        NtmpAccessToken cached = cache.get(key);
        if (isUsable(cached)) {
            return cached;
        }

        // Verrou par cle : sans lui, dix appels concurrents sur la meme licence
        // declenchent dix echanges, et c'est le quota qui paie.
        Object lock = locks.computeIfAbsent(key, ignored -> new Object());
        synchronized (lock) {
            NtmpAccessToken afterWait = cache.get(key);
            if (isUsable(afterWait)) {
                return afterWait;
            }
            NtmpAccessToken fresh = exchange.exchange(connectionId, externalLicenseId);
            cache.put(key, fresh);
            return fresh;
        }
    }

    /** Oublie les jetons d'une connexion — secret change, raccordement revoque. */
    public void evict(Long connectionId) {
        cache.keySet().removeIf(key -> key.connectionId().equals(connectionId));
        locks.keySet().removeIf(key -> key.connectionId().equals(connectionId));
    }

    private boolean isUsable(NtmpAccessToken token) {
        return token != null
                && token.expiresAt() != null
                && clock.instant().isBefore(token.expiresAt().minus(SAFETY_MARGIN));
    }
}
