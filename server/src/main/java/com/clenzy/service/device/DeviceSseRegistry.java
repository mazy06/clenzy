package com.clenzy.service.device;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registre LOCAL (par instance) des connexions SSE du hub des objets connectés,
 * indexées par ORGANISATION.
 *
 * <p>Le registre de supervision est keyé par logement, ce qui ne convient pas ici :
 * le hub affiche le parc entier d'une organisation, tous logements confondus. Un
 * écran ouvert doit recevoir le changement d'un appareil quel que soit son
 * logement — et ne jamais recevoir celui d'une autre organisation.</p>
 *
 * <p>Le fan-out inter-instances est assuré en amont par Redis pub/sub
 * ({@link DeviceRealtimePublisher} → {@link DeviceEventListener} → ici), comme
 * pour la supervision.</p>
 */
@Component
public class DeviceSseRegistry {

    private static final Logger log = LoggerFactory.getLogger(DeviceSseRegistry.class);

    /** organizationId → émetteurs SSE ouverts (thread-safe). */
    private final Map<Long, Set<SseEmitter>> byOrganization = new ConcurrentHashMap<>();

    /** Enregistre un émetteur pour une organisation et branche son auto-nettoyage. */
    public void register(Long organizationId, SseEmitter emitter) {
        final Set<SseEmitter> set =
                byOrganization.computeIfAbsent(organizationId, k -> ConcurrentHashMap.newKeySet());
        set.add(emitter);
        emitter.onCompletion(() -> remove(organizationId, emitter));
        emitter.onTimeout(() -> remove(organizationId, emitter));
        emitter.onError(e -> remove(organizationId, emitter));
    }

    private void remove(Long organizationId, SseEmitter emitter) {
        final Set<SseEmitter> set = byOrganization.get(organizationId);
        if (set != null) {
            set.remove(emitter);
            if (set.isEmpty()) {
                byOrganization.remove(organizationId, set);
            }
        }
    }

    /** Diffuse un événement (JSON déjà sérialisé) aux émetteurs locaux de l'organisation. */
    public void broadcast(Long organizationId, String eventJson) {
        final Set<SseEmitter> set = byOrganization.get(organizationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : set) {
            try {
                emitter.send(SseEmitter.event().name("device").data(eventJson));
            } catch (IOException | IllegalStateException e) {
                remove(organizationId, emitter);
            }
        }
        log.debug("SSE objets connectés : diffusé à {} émetteur(s) de l'organisation {}",
                set.size(), organizationId);
    }

    /** Nombre d'écrans ouverts pour une organisation (diagnostic, tests). */
    public int openStreams(Long organizationId) {
        final Set<SseEmitter> set = byOrganization.get(organizationId);
        return set == null ? 0 : set.size();
    }
}
