package com.clenzy.integration.nuki.service;

import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.model.NukiConnection.NukiConnectionStatus;
import com.clenzy.integration.nuki.repository.NukiConnectionRepository;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.SmartLockDevice.LockState;
import com.clenzy.repository.SmartLockDeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Applique les evenements du Nuki Bridge a la serrure correspondante.
 *
 * Le webhook est public (pas de JWT). I2-IOT-01 : l'origine de l'evenement est
 * authentifiee par un secret partage par connexion porte dans l'URL du callback
 * ({@code /api/webhooks/nuki/bridge-callback/{token}}). Ce token est compare en
 * temps constant au secret stocke (chiffre au repos) et resout l'organisation
 * cible. Le lookup de la serrure par {@code externalDeviceId} est ensuite borne
 * a cette organisation (pas de modification cross-org).
 */
@Service
@ConditionalOnProperty(name = "clenzy.nuki.client-id")
public class NukiWebhookService {

    private static final Logger log = LoggerFactory.getLogger(NukiWebhookService.class);

    private final SmartLockDeviceRepository deviceRepository;
    private final NukiConnectionRepository connectionRepository;

    public NukiWebhookService(SmartLockDeviceRepository deviceRepository,
                              NukiConnectionRepository connectionRepository) {
        this.deviceRepository = deviceRepository;
        this.connectionRepository = connectionRepository;
    }

    /**
     * Resout la connexion Nuki dont le secret de webhook correspond au token
     * fourni dans l'URL de callback. Comparaison en temps constant sur toutes les
     * connexions ACTIVE (I2-IOT-01). Rejette si le token est absent/vide.
     *
     * @return la connexion correspondante, ou {@code null} si aucune ne matche.
     */
    @Transactional(readOnly = true)
    public NukiConnection resolveConnectionByToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        final byte[] tokenBytes = token.getBytes(StandardCharsets.UTF_8);
        NukiConnection match = null;
        // Parcours complet (pas de short-circuit) pour limiter la fuite de timing :
        // on compare toutes les connexions ACTIVE meme apres avoir trouve un match.
        for (NukiConnection conn : connectionRepository.findAllByStatus(NukiConnectionStatus.ACTIVE)) {
            String secret = conn.getWebhookSecret();
            if (secret == null || secret.isBlank()) {
                continue;
            }
            if (MessageDigest.isEqual(secret.getBytes(StandardCharsets.UTF_8), tokenBytes)) {
                match = conn;
            }
        }
        return match;
    }

    /**
     * Met a jour l'etat de verrou et le niveau de batterie de la serrure ciblee
     * par le payload du Bridge, dans le perimetre de l'organisation {@code orgId}
     * resolue depuis le secret du webhook. Idempotent : ne persiste que si quelque
     * chose change.
     *
     * @return true si la serrure a ete trouvee (dans l'org) et mise a jour, false sinon.
     */
    @Transactional
    public boolean applyBridgeEvent(Map<String, Object> payload, Long orgId) {
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

        // Ownership : la serrure DOIT appartenir a l'org resolue depuis le secret du
        // webhook. Sans cette garde, un secret valide d'une org permettrait de piloter
        // l'etat d'une serrure d'une autre org (findByExternalDeviceId est cross-org).
        if (orgId == null || !orgId.equals(device.getOrganizationId())) {
            log.warn("Webhook Nuki : serrure {} (org={}) hors du perimetre du secret (org={}) — rejete",
                    nukiId, device.getOrganizationId(), orgId);
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
