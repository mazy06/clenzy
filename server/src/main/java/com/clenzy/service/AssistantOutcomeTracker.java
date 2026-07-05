package com.clenzy.service;

import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Instrumentation « reprise humaine » per-outcome (mesure 30 jours, PAS de pricing) :
 * une conversation guest est « reprise par un humain » si un message MANUEL (envoyé
 * par un membre de l'org depuis la messagerie) part vers le même guest dans les
 * 24 h suivant une auto-réponse IA.
 *
 * <p>Mécanique : marqueur Redis TTL 24 h posé à l'auto-réponse
 * ({@code assistant:outcome:autoreply:{orgId}:{reservationId}}), consommé à l'envoi
 * manuel — le DEL Redis étant atomique, une reprise est comptée au plus UNE fois
 * par auto-réponse ({@code assistant.outcome.manual_takeover{org}}).</p>
 */
@Service
public class AssistantOutcomeTracker {

    private static final Logger log = LoggerFactory.getLogger(AssistantOutcomeTracker.class);

    private static final String KEY_PREFIX = "assistant:outcome:autoreply:";
    /** Fenêtre produit figée : une reprise humaine est comptée dans les 24 h après l'auto-réponse. */
    private static final Duration TAKEOVER_WINDOW = Duration.ofHours(24);

    private final StringRedisTemplate redisTemplate;
    private final MeterRegistry meterRegistry;

    public AssistantOutcomeTracker(StringRedisTemplate redisTemplate, MeterRegistry meterRegistry) {
        this.redisTemplate = redisTemplate;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Marque qu'une auto-réponse IA vient de partir vers le guest de cette réservation.
     * No-op si la réservation est inconnue (aucune clé de corrélation fiable avec un
     * futur message manuel).
     */
    public void recordAutoReply(Long orgId, Long reservationId) {
        if (orgId == null || reservationId == null) {
            return;
        }
        try {
            redisTemplate.opsForValue().set(markerKey(orgId, reservationId), "1", TAKEOVER_WINDOW);
        } catch (DataAccessException e) {
            // WHY: instrumentation non critique — une panne Redis ne doit jamais dégrader
            // la réponse au guest ; on perd juste un point de mesure (fail-open assumé).
            log.warn("Marqueur reprise humaine non posé (Redis indisponible, org={}, reservation={}): {}",
                orgId, reservationId, e.getMessage());
        }
    }

    /**
     * Signale un message MANUEL d'un membre de l'org vers le guest de cette réservation.
     * Si une auto-réponse IA a eu lieu dans la fenêtre de 24 h, incrémente
     * {@code assistant.outcome.manual_takeover{org}} et consomme le marqueur.
     */
    public void recordManualMessage(Long orgId, Long reservationId) {
        if (orgId == null || reservationId == null) {
            return;
        }
        try {
            Boolean consumed = redisTemplate.delete(markerKey(orgId, reservationId));
            if (Boolean.TRUE.equals(consumed)) {
                meterRegistry.counter("assistant.outcome.manual_takeover",
                    "org", String.valueOf(orgId)).increment();
            }
        } catch (DataAccessException e) {
            // WHY: instrumentation non critique — l'envoi du message manuel prime sur la
            // mesure ; en cas de panne Redis on renonce au point de mesure (fail-open assumé).
            log.warn("Détection reprise humaine ignorée (Redis indisponible, org={}, reservation={}): {}",
                orgId, reservationId, e.getMessage());
        }
    }

    private String markerKey(Long orgId, Long reservationId) {
        return KEY_PREFIX + orgId + ":" + reservationId;
    }
}
