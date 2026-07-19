package com.clenzy.service.agent.kb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Throttle adaptatif pour l'API Voyage : sans moyen de paiement, le compte est
 * limite a <b>3 requetes/minute et 10K tokens/minute</b>. Plutot que d'echouer en
 * rafale, on s'adapte : des qu'un 429 est observe, les chemins d'ARRIERE-PLAN
 * (ingestion, re-embedding, evaluation) espacent leurs appels de
 * {@value #SLOT_INTERVAL_MS} ms (~3 RPM) pendant {@value #THROTTLE_WINDOW_MS} ms.
 *
 * <p>Le chemin conversation (embeddings QUERY d'un tour de chat) ne DOIT PAS
 * attendre un creneau — il degrade proprement (reponse sans contexte kb) plutot
 * que de bloquer l'utilisateur 20 secondes. Seuls les appels de fond consultent
 * {@link #awaitSlot()}.</p>
 *
 * <p>Hors periode de throttle (compte avec paiement, pas de 429 recent),
 * {@link #awaitSlot()} est un no-op : aucun cout en fonctionnement nominal.</p>
 */
@Component
public class VoyageRateThrottle {

    private static final Logger log = LoggerFactory.getLogger(VoyageRateThrottle.class);
    /** Duree du mode ralenti apres le dernier 429 observe. */
    private static final long THROTTLE_WINDOW_MS = 10 * 60_000L;
    /** Espacement des appels en mode ralenti : ~3 requetes/minute (marge incluse). */
    private static final long SLOT_INTERVAL_MS = 21_000L;

    private final long throttleWindowMs;
    private final long slotIntervalMs;

    private volatile long throttledUntil = 0L;
    /** Prochain creneau reservable — protege par {@code this}. */
    private long nextSlotAt = 0L;

    public VoyageRateThrottle() {
        this(THROTTLE_WINDOW_MS, SLOT_INTERVAL_MS);
    }

    /** Visible pour les tests (fenetres courtes). */
    VoyageRateThrottle(long throttleWindowMs, long slotIntervalMs) {
        this.throttleWindowMs = throttleWindowMs;
        this.slotIntervalMs = slotIntervalMs;
    }

    /** A appeler sur chaque 429 Voyage : (re)arme le mode ralenti. */
    public void onRateLimited() {
        boolean wasThrottled = isThrottled();
        throttledUntil = System.currentTimeMillis() + throttleWindowMs;
        if (!wasThrottled) {
            log.warn("VoyageRateThrottle : 429 recu — passage en mode ralenti ~3 req/min pour {} min "
                    + "(cle Voyage sans moyen de paiement ? voir dashboard.voyageai.com)",
                    throttleWindowMs / 60_000);
        }
    }

    /** True si le mode ralenti est actif (429 recent). */
    public boolean isThrottled() {
        return System.currentTimeMillis() < throttledUntil;
    }

    /**
     * Reserve un creneau d'appel pour un chemin d'arriere-plan : attend si
     * necessaire pour respecter ~3 req/min quand le mode ralenti est actif.
     * No-op hors throttle. Ne JAMAIS appeler depuis un tour de conversation.
     */
    public void awaitSlot() {
        if (!isThrottled()) return;
        long waitMs;
        synchronized (this) {
            long now = System.currentTimeMillis();
            long slotStart = Math.max(now, nextSlotAt);
            waitMs = slotStart - now;
            nextSlotAt = slotStart + slotIntervalMs;
        }
        if (waitMs <= 0) return;
        try {
            Thread.sleep(waitMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
