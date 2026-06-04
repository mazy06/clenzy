package com.clenzy.integration.nuki.service;

import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.SmartLockDevice.LockState;
import com.clenzy.repository.SmartLockDeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Applique les evenements du Nuki Bridge a la serrure correspondante.
 *
 * Le webhook est public (pas de JWT) : le filtre tenant Hibernate n'est PAS
 * actif sur cette requete, donc le lookup par {@code externalDeviceId} se fait
 * cross-org (le nukiId est unique). Meme pattern que le consumer Minut.
 */
@Service
@ConditionalOnProperty(name = "clenzy.nuki.client-id")
public class NukiWebhookService {

    private static final Logger log = LoggerFactory.getLogger(NukiWebhookService.class);

    private final SmartLockDeviceRepository deviceRepository;

    public NukiWebhookService(SmartLockDeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }

    /**
     * Met a jour l'etat de verrou et le niveau de batterie de la serrure ciblee
     * par le payload du Bridge. Idempotent : ne persiste que si quelque chose change.
     *
     * @return true si la serrure a ete trouvee et mise a jour, false sinon.
     */
    @Transactional
    public boolean applyBridgeEvent(Map<String, Object> payload) {
        final String nukiId = asString(payload.get("nukiId"));
        if (nukiId == null || nukiId.isBlank()) {
            log.warn("Webhook Nuki : nukiId absent du payload");
            return false;
        }

        final SmartLockDevice device = deviceRepository.findByExternalDeviceId(nukiId).orElse(null);
        if (device == null) {
            log.debug("Webhook Nuki : serrure inconnue externalDeviceId={}", nukiId);
            return false;
        }

        boolean changed = false;

        final LockState newState = mapLockState(asInt(payload.get("state")));
        if (newState != null && newState != device.getLockState()) {
            device.setLockState(newState);
            changed = true;
        }

        final Integer battery = asInt(payload.get("batteryCharge"));
        if (battery != null && !battery.equals(device.getBatteryLevel())) {
            device.setBatteryLevel(battery);
            changed = true;
        }

        if (changed) {
            deviceRepository.save(device);
            log.info("Webhook Nuki : serrure {} mise a jour (lockState={}, battery={}%)",
                    device.getId(), device.getLockState(), device.getBatteryLevel());
        }
        return true;
    }

    /**
     * Mappe le code d'etat Nuki vers {@link LockState}.
     * Retourne {@code null} pour les etats transitoires/indefinis (ne pas modifier).
     *
     * Codes Nuki : 1=locked, 3=unlocked, 5=unlatched, 6=unlocked (lock'n'go),
     * 0/2/4/7/254/255 = transitoire ou indefini.
     */
    private LockState mapLockState(Integer state) {
        if (state == null) {
            return null;
        }
        return switch (state) {
            case 1 -> LockState.LOCKED;
            case 3, 5, 6 -> LockState.UNLOCKED;
            default -> null;
        };
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Integer asInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
