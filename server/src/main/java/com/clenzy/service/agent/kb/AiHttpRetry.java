package com.clenzy.service.agent.kb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

import java.util.function.Supplier;

/**
 * Retry avec backoff pour les appels HTTP aux APIs d'embeddings/rerank (Voyage, OpenAI).
 *
 * <p>Reessaie uniquement les erreurs transitoires : 429 (rate-limit, en respectant
 * {@code Retry-After} si present), 5xx et erreurs reseau. Les 4xx restants (cle invalide,
 * payload trop gros...) echouent immediatement — reessayer ne changerait rien.</p>
 *
 * <p>Le backoff reste court ({@value #MAX_ATTEMPTS} tentatives max) : ces appels sont sur
 * le chemin d'une reponse de chat, on prefere degrader proprement que bloquer le tour.</p>
 */
final class AiHttpRetry {

    private static final Logger log = LoggerFactory.getLogger(AiHttpRetry.class);
    /** Chemin ingestion/batch : on peut se permettre d'attendre. */
    static final int INGESTION_ATTEMPTS = 3;
    /**
     * Chemin requete (tour de chat) : 1 seul retry court — mieux vaut degrader
     * proprement (reponse sans contexte kb) que bloquer la conversation ~12s.
     */
    static final int QUERY_ATTEMPTS = 2;
    private static final long[] BACKOFF_MS = {500, 2000};
    private static final long MAX_WAIT_MS = 10_000;

    private AiHttpRetry() {}

    /** Politique par defaut (ingestion). */
    static <T> T execute(String label, Supplier<T> call) {
        return execute(label, INGESTION_ATTEMPTS, call);
    }

    static <T> T execute(String label, int maxAttempts, Supplier<T> call) {
        RuntimeException last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return call.get();
            } catch (RuntimeException e) {
                if (!isRetryable(e) || attempt == maxAttempts) {
                    throw e;
                }
                last = e;
                long waitMs = resolveWaitMs(e, attempt);
                log.warn("{} : erreur transitoire (tentative {}/{}), retry dans {}ms : {}",
                        label, attempt, maxAttempts, waitMs, e.getMessage());
                sleep(waitMs);
            }
        }
        throw last; // unreachable, garde le compilateur heureux
    }

    private static boolean isRetryable(RuntimeException e) {
        if (e instanceof ResourceAccessException) return true; // timeout / reseau
        if (e instanceof HttpStatusCodeException http) {
            int code = http.getStatusCode().value();
            return code == 429 || code >= 500;
        }
        return false;
    }

    /** {@code Retry-After} (secondes) si fourni par l'API, sinon backoff exponentiel. */
    private static long resolveWaitMs(RuntimeException e, int attempt) {
        if (e instanceof HttpStatusCodeException http && http.getResponseHeaders() != null) {
            String retryAfter = http.getResponseHeaders().getFirst("Retry-After");
            if (retryAfter != null) {
                try {
                    long ms = Long.parseLong(retryAfter.trim()) * 1000L;
                    return Math.min(Math.max(ms, 0), MAX_WAIT_MS);
                } catch (NumberFormatException ignored) {
                    // format date HTTP non gere : on retombe sur le backoff
                }
            }
        }
        return BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new EmbeddingProvider.EmbeddingException("Retry interrompu", ie);
        }
    }
}
