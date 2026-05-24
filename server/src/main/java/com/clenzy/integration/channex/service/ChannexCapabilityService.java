package com.clenzy.integration.channex.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Circuit breaker runtime pour les endpoints Channex whitelabel-only.
 *
 * <p><b>Strategie</b> : on assume par defaut que toutes les capabilities
 * sont disponibles. Les callers (ChannexClient WL methods) detectent les
 * echecs 401/403 et marquent la capability comme indisponible, avec un TTL.
 * Apres expiration du TTL, on retente automatiquement (utile si l'acces
 * whitelabel est accorde sans redeploiement).</p>
 *
 * <ul>
 *   <li>Compte public actuel → 1er appel echoue → cached "indispo 1h" →
 *       fallback scrape pendant 1h → re-tente, re-echoue, etc.</li>
 *   <li>Compte whitelabel accorde → 1er appel reussit → cached "dispo 24h"
 *       → tous les calls suivants utilisent l'API WL.</li>
 * </ul>
 *
 * <p>Aucune config YAML requise. Auto-discovery 100% runtime.</p>
 */
@Service
public class ChannexCapabilityService {

    private static final Logger log = LoggerFactory.getLogger(ChannexCapabilityService.class);

    /**
     * Capabilities Channex protegees. Chaque entree = un groupe d'endpoints
     * whitelabel-only qu'on peut tenter automatiquement.
     */
    public enum Capability {
        /**
         * Detail d'un channel : {@code GET /channels/{id}/listings}.
         * Donne le NOM textuel humain des listings OTA (Airbnb : "Prestige
         * Duplex..."), sans scraping.
         */
        CHANNEL_DETAILS,

        /**
         * Operations sur les listings : {@code POST /channels/{id}/listings/{lid}/map}.
         * Mapping programmatique sans wizard manuel.
         */
        LISTING_OPERATIONS,

        /**
         * Webhooks push : {@code POST /webhooks} + reception sur notre URL.
         * Events listing_updated, content_updated, sync_error.
         */
        WEBHOOKS,

        /**
         * Relation facilities populated : {@code /properties/{id}?include=facilities}.
         * Permet de lire les facilities Channex sans scraping OTA.
         */
        PROPERTY_FACILITIES,
    }

    /** TTL apres un echec : 1h. Court pour detecter rapidement un upgrade whitelabel. */
    private static final Duration UNAVAILABLE_TTL = Duration.ofHours(1);

    /** TTL apres un succes : 24h. Long car les acces WL sont stables. */
    private static final Duration AVAILABLE_TTL = Duration.ofHours(24);

    private final Map<Capability, CacheEntry> cache = new ConcurrentHashMap<>();

    /**
     * True si la capability doit etre tentee :
     *   - jamais probe → true (try)
     *   - cache "dispo" non expire → true
     *   - cache "indispo" non expire → false
     *   - cache expire → true (retry)
     */
    public boolean isAvailable(Capability cap) {
        CacheEntry entry = cache.get(cap);
        if (entry == null) return true; // jamais teste : on tente
        if (entry.expiresAt.isBefore(Instant.now())) {
            cache.remove(cap); // expire, on retente
            return true;
        }
        return entry.available;
    }

    /**
     * Marque une capability comme disponible (apres succes d'un call WL).
     * Cache 24h.
     */
    public void markAvailable(Capability cap) {
        CacheEntry entry = cache.get(cap);
        boolean wasUnavailable = entry != null && !entry.available;
        cache.put(cap, new CacheEntry(true, Instant.now().plus(AVAILABLE_TTL)));
        if (wasUnavailable) {
            log.info("Channex capability NOW AVAILABLE : {} (probably whitelabel access granted)", cap);
        }
    }

    /**
     * Marque une capability comme indisponible (apres 401/403 sur un call WL).
     * Cache 1h pour eviter de spammer Channex avec des calls qui vont echouer.
     */
    public void markUnavailable(Capability cap) {
        CacheEntry entry = cache.get(cap);
        boolean wasAvailable = entry != null && entry.available;
        cache.put(cap, new CacheEntry(false, Instant.now().plus(UNAVAILABLE_TTL)));
        if (wasAvailable) {
            log.warn("Channex capability LOST : {} (whitelabel access revoked ?)", cap);
        } else if (entry == null) {
            log.info("Channex capability detected as unavailable : {} (public account)", cap);
        }
    }

    /** Snapshot pour endpoint admin / debug. */
    public Map<Capability, CacheEntry> snapshot() {
        Map<Capability, CacheEntry> snap = new EnumMap<>(Capability.class);
        for (Capability c : Capability.values()) {
            CacheEntry entry = cache.get(c);
            snap.put(c, entry != null ? entry : new CacheEntry(true, null)); // unknown = assume available
        }
        return snap;
    }

    /** Vide le cache (forcera un retry au prochain call). */
    public void clearCache() {
        cache.clear();
        log.info("Channex capability cache cleared (will retry all WL endpoints on next use)");
    }

    /**
     * Entree du cache : etat + date d'expiration. Public pour serialization
     * dans le DTO de snapshot.
     */
    public record CacheEntry(boolean available, Instant expiresAt) {}
}
