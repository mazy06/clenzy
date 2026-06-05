package com.clenzy.service;

import com.clenzy.dto.smartlock.CreateSmartLockDeviceDto;
import com.clenzy.dto.smartlock.SmartLockDeviceDto;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaDeviceClaimService;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.model.SmartLockDevice.DeviceStatus;
import com.clenzy.model.SmartLockDevice.LockState;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service business pour les serrures connectees (Tuya Smart Lock).
 * Reutilise TuyaApiService pour les appels device.
 */
@Service
public class SmartLockService {

    private static final Logger log = LoggerFactory.getLogger(SmartLockService.class);

    private final SmartLockDeviceRepository smartLockRepository;
    private final PropertyRepository propertyRepository;
    private final TuyaApiService tuyaApiService;
    private final TenantContext tenantContext;
    private final TuyaDeviceClaimService claimService;

    public SmartLockService(SmartLockDeviceRepository smartLockRepository,
                            PropertyRepository propertyRepository,
                            TuyaApiService tuyaApiService,
                            TenantContext tenantContext,
                            TuyaDeviceClaimService claimService) {
        this.smartLockRepository = smartLockRepository;
        this.propertyRepository = propertyRepository;
        this.tuyaApiService = tuyaApiService;
        this.tenantContext = tenantContext;
        this.claimService = claimService;
    }

    // ─── CRUD ───────────────────────────────────────────────────

    /**
     * Liste les serrures de l'organisation (le filtre Hibernate assure l'isolation).
     */
    public List<SmartLockDeviceDto> getUserDevices(String userId) {
        return smartLockRepository.findByStatus(DeviceStatus.ACTIVE).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Cree une nouvelle serrure.
     */
    public SmartLockDeviceDto createDevice(String userId, CreateSmartLockDeviceDto dto) {
        Property property = propertyRepository.findById(dto.getPropertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + dto.getPropertyId()));

        SmartLockDevice device = new SmartLockDevice();
        device.setUserId(userId);
        device.setName(dto.getName());
        device.setPropertyId(dto.getPropertyId());
        device.setRoomName(dto.getRoomName());
        device.setExternalDeviceId(dto.getExternalDeviceId());
        device.setStatus(DeviceStatus.ACTIVE);
        device.setLockState(LockState.UNKNOWN);
        device.setOrganizationId(tenantContext.getRequiredOrganizationId());

        // Garde-fou multi-tenant : reclame le device Tuya (rejet si deja rattache a une autre org).
        claimService.claim(dto.getExternalDeviceId(), "lock");

        SmartLockDevice saved = smartLockRepository.save(device);
        log.info("Serrure creee: {} (property={}) pour user={}",
                saved.getName(), saved.getPropertyId(), userId);

        return toDto(saved);
    }

    /**
     * Supprime une serrure.
     * Utilise findById (et non findByIdAndUserId) car getUserDevices() retourne
     * toutes les serrures ACTIVE de l'organisation sans filtrer par userId.
     * L'isolation multi-tenant est assuree par le filtre Hibernate organizationFilter.
     */
    @Transactional
    public void deleteDevice(String userId, Long deviceId) {
        SmartLockDevice device = smartLockRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Serrure introuvable: " + deviceId));

        claimService.release(device.getExternalDeviceId());
        smartLockRepository.delete(device);
        log.info("Serrure supprimee: {} (id={}) pour user={}", device.getName(), deviceId, userId);
    }

    // ─── Lock operations ─────────────────────────────────────────

    /**
     * Recupere le statut live d'une serrure via Tuya API.
     * Parse les DPs standard Tuya pour serrures :
     * - "locked" ou "switch_lock" : boolean verrou
     * - "battery_state" ou "residual_electricity" : niveau batterie
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getLockStatus(String userId, Long deviceId) {
        SmartLockDevice device = smartLockRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Serrure introuvable: " + deviceId));

        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isEmpty()) {
            return Map.of(
                    "locked", false,
                    "batteryLevel", -1,
                    "online", false
            );
        }

        try {
            Map<String, Object> status = tuyaApiService.getDeviceStatus(device.getExternalDeviceId());

            boolean locked = false;
            int batteryLevel = -1;

            // Parse Tuya status DPs (returned as list of {code, value})
            if (status instanceof Map) {
                Object statusList = status.get("result");
                if (statusList == null) statusList = status;

                if (statusList instanceof List) {
                    for (Object dp : (List<?>) statusList) {
                        if (dp instanceof Map) {
                            Map<String, Object> dpMap = (Map<String, Object>) dp;
                            String code = String.valueOf(dpMap.get("code"));
                            Object value = dpMap.get("value");

                            if ("locked".equals(code) || "switch_lock".equals(code)
                                    || "lock".equals(code) || "reverse_lock".equals(code)) {
                                locked = Boolean.TRUE.equals(value);
                            }
                            if ("battery_state".equals(code) || "residual_electricity".equals(code)
                                    || "battery_percentage".equals(code)) {
                                if (value instanceof Number) {
                                    batteryLevel = ((Number) value).intValue();
                                }
                            }
                        }
                    }
                }
            }

            // Connectivite reelle : flag Tuya "online" via getDeviceInfo, isole pour ne pas
            // perdre lock/batterie si l'appel echoue (vs l'ancien online=true en dur).
            boolean online = fetchOnline(device.getExternalDeviceId());

            // Update cached state (persiste pour le read-model GET /api/devices)
            device.setLockState(locked ? LockState.LOCKED : LockState.UNLOCKED);
            device.setBatteryLevel(batteryLevel >= 0 ? batteryLevel : null);
            device.setOnline(online);
            device.setLastSeenAt(LocalDateTime.now());
            smartLockRepository.save(device);

            return Map.of(
                    "locked", locked,
                    "batteryLevel", batteryLevel,
                    "online", online
            );

        } catch (Exception e) {
            log.error("Erreur recuperation statut serrure {} (device Tuya {}): {}",
                    deviceId, device.getExternalDeviceId(), e.getMessage());
            return Map.of(
                    "locked", device.getLockState() == LockState.LOCKED,
                    "batteryLevel", device.getBatteryLevel() != null ? device.getBatteryLevel() : -1,
                    "online", false
            );
        }
    }

    /**
     * Envoie une commande verrouillage/deverrouillage via Tuya.
     */
    public void sendLockCommand(String userId, Long deviceId, boolean lock) {
        SmartLockDevice device = smartLockRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Serrure introuvable: " + deviceId));

        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isEmpty()) {
            throw new IllegalStateException("Pas d'ID device Tuya configure pour cette serrure");
        }

        List<Map<String, Object>> commands = List.of(
                Map.of("code", "lock", "value", lock)
        );

        tuyaApiService.sendCommand(device.getExternalDeviceId(), commands);

        // Update local state
        device.setLockState(lock ? LockState.LOCKED : LockState.UNLOCKED);
        smartLockRepository.save(device);

        log.info("Commande {} envoyee a la serrure {} (device Tuya {})",
                lock ? "LOCK" : "UNLOCK", deviceId, device.getExternalDeviceId());
    }

    // ─── Private helpers ────────────────────────────────────────

    /**
     * Connectivite reelle d'une serrure (flag Tuya "online" via GET /v1.0/devices/{id}).
     * Isole dans son propre try/catch : une indisponibilite degrade vers false sans
     * faire perdre l'etat verrou / la batterie deja parses.
     */
    private boolean fetchOnline(String externalDeviceId) {
        try {
            Map<String, Object> info = tuyaApiService.getDeviceInfo(externalDeviceId);
            return info != null && Boolean.TRUE.equals(info.get("online"));
        } catch (Exception e) {
            log.warn("Statut online Tuya indisponible pour device {}: {}", externalDeviceId, e.getMessage());
            return false;
        }
    }

    private SmartLockDeviceDto toDto(SmartLockDevice device) {
        SmartLockDeviceDto dto = new SmartLockDeviceDto();
        dto.setId(device.getId());
        dto.setName(device.getName());
        dto.setPropertyId(device.getPropertyId());
        dto.setRoomName(device.getRoomName());
        dto.setExternalDeviceId(device.getExternalDeviceId());
        dto.setBrand(device.getBrand() != null ? device.getBrand().name() : null);
        dto.setStatus(device.getStatus().name());
        dto.setLockState(device.getLockState().name());
        dto.setBatteryLevel(device.getBatteryLevel());
        dto.setOnline(device.getOnline());
        dto.setCreatedAt(device.getCreatedAt());

        // Resolve property name
        propertyRepository.findById(device.getPropertyId())
                .ifPresent(p -> dto.setPropertyName(p.getName()));

        return dto;
    }
}
