package com.clenzy.service.device;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Annonce qu'un objet connecté a CHANGÉ, à destination des hubs ouverts.
 *
 * <p>Le hub interrogeait auparavant chaque appareil au montage de sa carte pour
 * découvrir son état. Sur un parc réel, cela revenait à demander à quatre-vingt-dix
 * fabricants, à chaque affichage, de confirmer que rien n'avait bougé. La fraîcheur
 * est ici une responsabilité du SERVEUR : il l'apprend par webhook quand le
 * fabricant en émet (Nuki, Minut), par son propre scheduler sinon (Tuya), et
 * l'annonce aux écrans ouverts.</p>
 *
 * <p><b>Règle qui fait tout tenir : on émet sur CHANGEMENT, jamais sur cadence.</b>
 * Publier à chaque relevé reconstruirait la même tempête, en SSE. Les appelants
 * détectent déjà les transitions ; c'est à eux d'appeler ici, et seulement alors.</p>
 *
 * <h2>Pourquoi l'événement ne transporte pas l'état</h2>
 * <p>Il porte l'IDENTITÉ de l'appareil, à charge pour le client de recharger. Le
 * hub conserve bien le DTO d'origine de chaque carte, mais sa forme dépend du
 * chemin qui l'a produit — read-model unifié ou agrégation par type, aux champs
 * différents. Fusionner un état partiel dans un DTO de forme incertaine serait
 * ambigu, et dupliquerait côté serveur le calcul d'affichage.</p>
 *
 * <p>Le coût est d'un rechargement de liste par changement réel. C'est acceptable
 * parce que les événements sont rares par construction : une serrure qu'on ouvre,
 * un capteur qui tombe. Le problème d'origine n'était pas le rechargement, c'était
 * d'en déclencher quatre-vingt-treize à chaque affichage.</p>
 *
 * <p>Best-effort : un échec de diffusion ne casse jamais l'action métier — un
 * écran non prévenu se resynchronise à sa prochaine ouverture.</p>
 */
@Component
public class DeviceRealtimePublisher {

    public static final String CHANNEL = "clenzy:devices:events";

    private static final Logger log = LoggerFactory.getLogger(DeviceRealtimePublisher.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public DeviceRealtimePublisher(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Un appareil a changé d'état.
     *
     * @param organizationId organisation propriétaire — borne la diffusion, un écran
     *                       ne doit jamais voir le parc d'une autre organisation
     * @param kind           type tel que le hub le nomme : {@code lock}, {@code noise},
     *                       {@code sensor}, {@code keybox}, {@code camera},
     *                       {@code thermostat}
     * @param deviceId       identifiant de l'appareil dans sa table
     * @param reason         ce qui a changé, en clair, pour le journal et le débogage
     *                       (« batterie », « verrou », « hors ligne »…)
     */
    public void publishDeviceChanged(Long organizationId, String kind, Long deviceId, String reason) {
        if (organizationId == null || kind == null || deviceId == null) {
            return;
        }
        final Map<String, Object> event = new HashMap<>();
        event.put("type", "device.changed");
        event.put("kind", kind);
        event.put("id", deviceId);
        if (reason != null) {
            event.put("reason", reason);
        }
        publish(organizationId, event);
    }

    private void publish(Long organizationId, Map<String, Object> event) {
        try {
            final Map<String, Object> message = new HashMap<>();
            message.put("organizationId", organizationId);
            message.put("event", event);
            redisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.debug("SSE objets connectés : publication échouée (org={}) : {}",
                    organizationId, e.getMessage());
        }
    }
}
