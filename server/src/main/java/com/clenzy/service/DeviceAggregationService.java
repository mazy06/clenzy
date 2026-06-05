package com.clenzy.service;

import com.clenzy.dto.camera.CameraDto;
import com.clenzy.dto.device.DeviceSummaryDto;
import com.clenzy.dto.device.ProviderStatusDto;
import com.clenzy.dto.keyexchange.KeyExchangePointDto;
import com.clenzy.dto.thermostat.ThermostatDto;
import com.clenzy.dto.noise.NoiseDeviceDto;
import com.clenzy.dto.smartlock.SmartLockDeviceDto;
import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.repository.MinutConnectionRepository;
import com.clenzy.integration.netatmo.model.NetatmoConnection;
import com.clenzy.integration.netatmo.repository.NetatmoConnectionRepository;
import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.repository.NukiConnectionRepository;
import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.repository.TuyaConnectionRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Agrege les objets connectes (serrures + capteurs sonores + points de remise)
 * en un read-model unifie, et calcule le statut de connexion des providers.
 *
 * Reutilise les services par type (meme scoping user/org que les endpoints
 * existants) → aucun changement de comportement vs l'agregation cote client
 * qu'il remplace.
 */
@Service
public class DeviceAggregationService {

    private final SmartLockService smartLockService;
    private final NoiseDeviceService noiseDeviceService;
    private final KeyExchangeService keyExchangeService;
    private final CameraService cameraService;
    private final ThermostatService thermostatService;
    private final MinutConnectionRepository minutConnectionRepository;
    private final TuyaConnectionRepository tuyaConnectionRepository;
    private final NukiConnectionRepository nukiConnectionRepository;
    private final NetatmoConnectionRepository netatmoConnectionRepository;
    private final TenantContext tenantContext;

    public DeviceAggregationService(SmartLockService smartLockService,
                                    NoiseDeviceService noiseDeviceService,
                                    KeyExchangeService keyExchangeService,
                                    CameraService cameraService,
                                    ThermostatService thermostatService,
                                    MinutConnectionRepository minutConnectionRepository,
                                    TuyaConnectionRepository tuyaConnectionRepository,
                                    NukiConnectionRepository nukiConnectionRepository,
                                    NetatmoConnectionRepository netatmoConnectionRepository,
                                    TenantContext tenantContext) {
        this.smartLockService = smartLockService;
        this.noiseDeviceService = noiseDeviceService;
        this.keyExchangeService = keyExchangeService;
        this.cameraService = cameraService;
        this.thermostatService = thermostatService;
        this.minutConnectionRepository = minutConnectionRepository;
        this.tuyaConnectionRepository = tuyaConnectionRepository;
        this.nukiConnectionRepository = nukiConnectionRepository;
        this.netatmoConnectionRepository = netatmoConnectionRepository;
        this.tenantContext = tenantContext;
    }

    /** Read-model unifie de tous les objets connectes de l'utilisateur courant. */
    public List<DeviceSummaryDto> getDevices(String userId) {
        List<DeviceSummaryDto> devices = new ArrayList<>();

        for (SmartLockDeviceDto d : smartLockService.getUserDevices(userId)) {
            // Serrure : online = vrai flag Tuya persiste (null si jamais synchronise — ni en ligne ni hors ligne).
            devices.add(new DeviceSummaryDto(
                    "lock", d.getId(), d.getName(), d.getPropertyId(), d.getPropertyName(), d.getRoomName(),
                    orUnknown(d.getBrand()), d.getStatus(), d.getOnline(), d.getLockState(), d.getBatteryLevel(), null, null, d.getCreatedAt()));
        }
        for (NoiseDeviceDto d : noiseDeviceService.getUserDevices(userId)) {
            // Capteur bruit : online = vrai flag Tuya/Minut persiste (null si jamais synchronise).
            devices.add(new DeviceSummaryDto(
                    "noise", d.getId(), d.getName(), d.getPropertyId(), d.getPropertyName(), d.getRoomName(),
                    orUnknown(d.getDeviceType()), d.getStatus(), d.getOnline(), null, null, null, null, d.getCreatedAt()));
        }
        for (KeyExchangePointDto d : keyExchangeService.getPoints(userId)) {
            devices.add(new DeviceSummaryDto(
                    "keybox", d.getId(), d.getStoreName(), d.getPropertyId(), d.getPropertyName(), null,
                    orUnknown(d.getProvider()), d.getStatus(), activeOnline(d.getStatus()), null, null, (int) d.getActiveCodesCount(), null, d.getCreatedAt()));
        }
        for (CameraDto c : cameraService.getUserCameras(userId)) {
            devices.add(new DeviceSummaryDto(
                    "camera", c.id(), c.name(), c.propertyId(), c.propertyName(), c.roomName(),
                    orUnknown(c.brand()), c.status(), activeOnline(c.status()), null, null, null, c.snapshotUrl(), c.createdAt()));
        }
        for (ThermostatDto th : thermostatService.getUserThermostats(userId)) {
            devices.add(new DeviceSummaryDto(
                    "thermostat", th.id(), th.name(), th.propertyId(), th.propertyName(), th.roomName(),
                    orUnknown(th.brand()), th.status(), activeOnline(th.status()), null, null, null, null, th.createdAt()));
        }
        return devices;
    }

    /** Statut de connexion par provider + nombre d'objets rattaches. */
    public List<ProviderStatusDto> getProviderStatuses(String userId) {
        Map<String, Long> counts = getDevices(userId).stream()
                .collect(Collectors.groupingBy(DeviceSummaryDto::provider, Collectors.counting()));

        boolean minut = minutConnectionRepository.findByUserId(userId)
                .map(MinutConnection::isActive).orElse(false);
        boolean tuya = tuyaConnectionRepository.findByUserId(userId)
                .map(TuyaConnection::isActive).orElse(false);
        Long orgId = tenantContext.getOrganizationId();
        boolean nuki = orgId != null && nukiConnectionRepository.findByOrganizationId(orgId)
                .map(NukiConnection::isActive).orElse(false);
        boolean netatmo = netatmoConnectionRepository.findByUserId(userId)
                .map(NetatmoConnection::isActive).orElse(false);

        List<ProviderStatusDto> statuses = new ArrayList<>();
        statuses.add(connectionStatus("MINUT", minut, counts));
        statuses.add(connectionStatus("TUYA", tuya, counts));
        statuses.add(connectionStatus("NUKI", nuki, counts));
        statuses.add(connectionStatus("NETATMO", netatmo, counts));

        // KeyNest / KeyVault : pas de connexion org-level → statut base sur la presence.
        addPresenceProvider(statuses, "KEYNEST", counts);
        addPresenceProvider(statuses, "CLENZY_KEYVAULT", counts);

        return statuses;
    }

    private ProviderStatusDto connectionStatus(String provider, boolean connected, Map<String, Long> counts) {
        return new ProviderStatusDto(provider, connected, counts.getOrDefault(provider, 0L),
                connected ? "ACTIVE" : "NOT_CONNECTED");
    }

    private void addPresenceProvider(List<ProviderStatusDto> statuses, String provider, Map<String, Long> counts) {
        long count = counts.getOrDefault(provider, 0L);
        if (count > 0) {
            statuses.add(new ProviderStatusDto(provider, true, count, null));
        }
    }

    private static String orUnknown(String value) {
        return (value == null || value.isBlank()) ? "UNKNOWN" : value;
    }

    /**
     * Connectivite des types sans signal "online" dedie (noise / keybox / camera / thermostat) :
     * derivee du cycle de vie (ACTIVE = en ligne). Les serrures utilisent le vrai flag Tuya.
     */
    private static Boolean activeOnline(String status) {
        return "ACTIVE".equals(status);
    }
}
