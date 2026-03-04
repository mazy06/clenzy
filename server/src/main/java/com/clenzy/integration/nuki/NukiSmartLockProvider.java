package com.clenzy.integration.nuki;

import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.model.NukiConnection.NukiConnectionStatus;
import com.clenzy.integration.nuki.repository.NukiConnectionRepository;
import com.clenzy.integration.nuki.service.NukiApiService;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.service.smartlock.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Implementation SmartLockProvider pour les serrures Nuki.
 *
 * Chaque methode :
 * 1. Recupere la NukiConnection active pour l'organisation
 * 2. Dechiffre le token via TokenEncryptionService
 * 3. Delegue a NukiApiService (protege par CircuitBreaker)
 */
@Service
@ConditionalOnProperty(name = "clenzy.nuki.client-id")
public class NukiSmartLockProvider implements SmartLockProvider {

    private static final Logger log = LoggerFactory.getLogger(NukiSmartLockProvider.class);

    private final NukiApiService nukiApiService;
    private final NukiConnectionRepository connectionRepository;
    private final TokenEncryptionService encryptionService;

    public NukiSmartLockProvider(NukiApiService nukiApiService,
                                  NukiConnectionRepository connectionRepository,
                                  TokenEncryptionService encryptionService) {
        this.nukiApiService = nukiApiService;
        this.connectionRepository = connectionRepository;
        this.encryptionService = encryptionService;
    }

    @Override
    public SmartLockBrand getBrand() {
        return SmartLockBrand.NUKI;
    }

    @Override
    public SmartLockCommandResult unlock(String deviceId, Long orgId) {
        try {
            String token = resolveToken(orgId);
            nukiApiService.lockAction(deviceId, NukiApiService.ACTION_UNLOCK, token);
            return SmartLockCommandResult.success("Serrure Nuki deverrouillee");
        } catch (Exception e) {
            log.error("Erreur unlock Nuki deviceId={}, orgId={}: {}", deviceId, orgId, e.getMessage());
            return SmartLockCommandResult.failure("Erreur deverrouillage Nuki: " + e.getMessage());
        }
    }

    @Override
    public SmartLockCommandResult lock(String deviceId, Long orgId) {
        try {
            String token = resolveToken(orgId);
            nukiApiService.lockAction(deviceId, NukiApiService.ACTION_LOCK, token);
            return SmartLockCommandResult.success("Serrure Nuki verrouillee");
        } catch (Exception e) {
            log.error("Erreur lock Nuki deviceId={}, orgId={}: {}", deviceId, orgId, e.getMessage());
            return SmartLockCommandResult.failure("Erreur verrouillage Nuki: " + e.getMessage());
        }
    }

    @Override
    public SmartLockCommandResult generateAccessCode(String deviceId, AccessCodeParams params, Long orgId) {
        try {
            String token = resolveToken(orgId);
            Map<String, Object> result = nukiApiService.createWebApiCode(deviceId, params, token);

            String externalId = result != null && result.containsKey("id")
                    ? String.valueOf(result.get("id"))
                    : null;

            return SmartLockCommandResult.success("Code d'acces Nuki cree", externalId);
        } catch (Exception e) {
            log.error("Erreur generation code Nuki deviceId={}, orgId={}: {}", deviceId, orgId, e.getMessage());
            return SmartLockCommandResult.failure("Erreur creation code Nuki: " + e.getMessage());
        }
    }

    @Override
    public SmartLockCommandResult revokeAccessCode(String deviceId, String codeId, Long orgId) {
        try {
            String token = resolveToken(orgId);
            nukiApiService.deleteWebApiCode(deviceId, codeId, token);
            return SmartLockCommandResult.success("Code d'acces Nuki revoque");
        } catch (Exception e) {
            log.error("Erreur revocation code Nuki deviceId={}, codeId={}, orgId={}: {}",
                    deviceId, codeId, orgId, e.getMessage());
            return SmartLockCommandResult.failure("Erreur revocation code Nuki: " + e.getMessage());
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public SmartLockDeviceInfo getDeviceInfo(String deviceId, Long orgId) {
        String token = resolveToken(orgId);
        Map<String, Object> data = nukiApiService.getSmartlock(deviceId, token);

        if (data == null) {
            throw new RuntimeException("Aucune donnee retournee par Nuki pour le device " + deviceId);
        }

        String name = (String) data.getOrDefault("name", "Nuki Smart Lock");
        Integer batteryLevel = extractBatteryLevel(data);
        boolean online = extractOnlineState(data);
        String lockState = extractLockState(data);
        String firmware = (String) data.get("firmwareVersion");

        return new SmartLockDeviceInfo(deviceId, name, batteryLevel, online, lockState, firmware);
    }

    @Override
    public boolean isAvailable(Long orgId) {
        return connectionRepository.findByOrganizationIdAndStatus(orgId, NukiConnectionStatus.ACTIVE)
                .map(NukiConnection::isActive)
                .orElse(false);
    }

    // ─── Private helpers ────────────────────────────────────────

    private String resolveToken(Long orgId) {
        NukiConnection connection = connectionRepository
                .findByOrganizationIdAndStatus(orgId, NukiConnectionStatus.ACTIVE)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune connexion Nuki active pour l'organisation " + orgId));

        return encryptionService.decrypt(connection.getAccessTokenEncrypted());
    }

    @SuppressWarnings("unchecked")
    private Integer extractBatteryLevel(Map<String, Object> data) {
        Object state = data.get("state");
        if (state instanceof Map<?, ?> stateMap) {
            Object battery = stateMap.get("batteryCharge");
            if (battery instanceof Number num) {
                return num.intValue();
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private boolean extractOnlineState(Map<String, Object> data) {
        Object state = data.get("state");
        if (state instanceof Map<?, ?> stateMap) {
            // Nuki state 0 = paired, device reachable
            Object doorState = stateMap.get("state");
            return doorState != null;
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private String extractLockState(Map<String, Object> data) {
        Object state = data.get("state");
        if (state instanceof Map<?, ?> stateMap) {
            Object lockState = stateMap.get("state");
            if (lockState instanceof Number num) {
                return switch (num.intValue()) {
                    case 1 -> "LOCKED";
                    case 3 -> "UNLOCKED";
                    case 5 -> "UNLOCKED"; // unlatched
                    default -> "UNKNOWN";
                };
            }
        }
        return "UNKNOWN";
    }
}
