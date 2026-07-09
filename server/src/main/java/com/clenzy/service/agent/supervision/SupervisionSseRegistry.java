package com.clenzy.service.agent.supervision;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registre LOCAL (par instance) des connexions SSE de supervision, indexées par logement.
 * Diffuse un événement (feed / résolution) à tous les opérateurs qui observent CE logement
 * sur CETTE instance. Le fan-out inter-instances est assuré en amont par Redis pub/sub
 * ({@link SupervisionRealtimePublisher} → {@link SupervisionEventListener} → ici).
 */
@Component
public class SupervisionSseRegistry {

    private static final Logger log = LoggerFactory.getLogger(SupervisionSseRegistry.class);

    /** propertyId → émetteurs SSE ouverts (thread-safe). */
    private final Map<Long, Set<SseEmitter>> byProperty = new ConcurrentHashMap<>();

    /** Enregistre un émetteur pour un logement et branche son auto-nettoyage. */
    public void register(Long propertyId, SseEmitter emitter) {
        final Set<SseEmitter> set = byProperty.computeIfAbsent(propertyId, k -> ConcurrentHashMap.newKeySet());
        set.add(emitter);
        emitter.onCompletion(() -> remove(propertyId, emitter));
        emitter.onTimeout(() -> remove(propertyId, emitter));
        emitter.onError(e -> remove(propertyId, emitter));
    }

    private void remove(Long propertyId, SseEmitter emitter) {
        final Set<SseEmitter> set = byProperty.get(propertyId);
        if (set != null) {
            set.remove(emitter);
            if (set.isEmpty()) {
                byProperty.remove(propertyId, set);
            }
        }
    }

    /** Diffuse un événement (JSON déjà sérialisé) à tous les émetteurs locaux du logement. */
    public void broadcast(Long propertyId, String eventJson) {
        final Set<SseEmitter> set = byProperty.get(propertyId);
        if (set == null || set.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : set) {
            try {
                emitter.send(SseEmitter.event().name("supervision").data(eventJson));
            } catch (IOException | IllegalStateException e) {
                // Connexion fermée entre-temps → on retire (le callback onError/onCompletion
                // peut ne pas avoir encore tiré). Best-effort, jamais bloquant.
                remove(propertyId, emitter);
            }
        }
        log.debug("SSE supervision: diffusé à {} émetteur(s) du logement {}", set.size(), propertyId);
    }
}
