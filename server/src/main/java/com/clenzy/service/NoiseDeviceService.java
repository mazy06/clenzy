package com.clenzy.service;

import com.clenzy.dto.noise.CreateNoiseDeviceDto;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.dto.noise.NoiseChartDataDto;
import com.clenzy.dto.noise.NoiseDataPointDto;
import com.clenzy.dto.noise.NoiseDeviceDto;
import com.clenzy.integration.minut.service.MinutApiService;
import com.clenzy.integration.baitlyiot.BaitlyIotClient;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaDeviceClaimService;
import com.clenzy.model.NoiseDevice;
import com.clenzy.tenant.TenantContext;
import com.clenzy.model.NoiseDevice.DeviceStatus;
import com.clenzy.model.NoiseDevice.DeviceType;
import com.clenzy.model.Property;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service business unifie pour les capteurs de bruit.
 * Orchestre les appels vers Minut, Tuya ou Baitly IoT selon le type de device.
 */
@Service
public class NoiseDeviceService {

    private static final Logger log = LoggerFactory.getLogger(NoiseDeviceService.class);

    private final NoiseDeviceRepository noiseDeviceRepository;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final PropertyRepository propertyRepository;
    private final MinutApiService minutApiService;
    private final TuyaApiService tuyaApiService;
    private final TenantContext tenantContext;
    private final TuyaDeviceClaimService claimService;
    private final BaitlyIotClient baitlyIotClient;

    public NoiseDeviceService(NoiseDeviceRepository noiseDeviceRepository,
                              PropertyRepository propertyRepository,
                              MinutApiService minutApiService,
                              TuyaApiService tuyaApiService,
                              TenantContext tenantContext,
                              TuyaDeviceClaimService claimService,
                                    OrganizationAccessGuard organizationAccessGuard,
                                    BaitlyIotClient baitlyIotClient) {
        this.noiseDeviceRepository = noiseDeviceRepository;
        this.propertyRepository = propertyRepository;
        this.minutApiService = minutApiService;
        this.tuyaApiService = tuyaApiService;
        this.tenantContext = tenantContext;
        this.claimService = claimService;
        this.organizationAccessGuard = organizationAccessGuard;
        this.baitlyIotClient = baitlyIotClient;
    }

    // ─── CRUD ───────────────────────────────────────────────────

    /**
     * Liste les capteurs de l'organisation courante. Le filtre explicite est requis : le filtre
     * Hibernate est inactif en HTTP, et findByStatus exposait les appareils de toutes les organisations.
     */
    public List<NoiseDeviceDto> getUserDevices(String userId) {
        return noiseDeviceRepository.findByOrganizationIdAndStatus(tenantContext.getRequiredOrganizationId(), DeviceStatus.ACTIVE).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Cree un nouveau capteur.
     */
    public NoiseDeviceDto createDevice(String userId, CreateNoiseDeviceDto dto) {
        if (DeviceType.BAITLY.name().equalsIgnoreCase(dto.getDeviceType())) {
            throw new IllegalArgumentException("Utilisez le parcours de rattachement Wi-Fi direct pour cet appareil");
        }
        // Verifier que la propriete existe
        Property property = propertyRepository.findById(dto.getPropertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + dto.getPropertyId()));
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Logement hors de votre organisation");

        NoiseDevice device = new NoiseDevice();
        device.setUserId(userId);
        device.setDeviceType(DeviceType.valueOf(dto.getDeviceType().toUpperCase()));
        device.setName(dto.getName());
        device.setPropertyId(dto.getPropertyId());
        device.setRoomName(dto.getRoomName());
        device.setExternalDeviceId(dto.getExternalDeviceId());
        device.setExternalHomeId(dto.getExternalHomeId());
        device.setStatus(DeviceStatus.ACTIVE);
        device.setOrganizationId(tenantContext.getRequiredOrganizationId());

        // Garde-fou multi-tenant : reclame le device Tuya (rejet si deja rattache a une autre org).
        if (DeviceType.TUYA.equals(device.getDeviceType())) {
            claimService.claim(device.getExternalDeviceId(), "noise");
        }

        NoiseDevice saved = noiseDeviceRepository.save(device);
        log.info("Baitly bruit : capteur {} cree, type {}", saved.getId(), saved.getDeviceType());

        return toDto(saved);
    }

    /**
     * Supprime un capteur.
     * Utilise findById (et non findByIdAndUserId) car getUserDevices() retourne
     * tous les capteurs ACTIVE de l'organisation sans filtrer par userId.
     * L'isolation multi-tenant est assuree par le filtre Hibernate organizationFilter.
     */
    @Transactional
    public void deleteDevice(String userId, Long deviceId) {
        NoiseDevice device = noiseDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Capteur introuvable: " + deviceId));
        organizationAccessGuard.requireSameOrganization(
                device.getOrganizationId(), "Capteur de bruit hors de votre organisation");

        if (DeviceType.BAITLY.equals(device.getDeviceType())) {
            throw new IllegalArgumentException("Utilisez la gestion Baitly IoT pour revoquer puis supprimer ce capteur");
        }

        if (DeviceType.TUYA.equals(device.getDeviceType())) {
            claimService.release(device.getExternalDeviceId());
        }
        noiseDeviceRepository.delete(device);
        log.info("Baitly bruit : capteur {} supprime", deviceId);
    }

    // ─── Noise Data ─────────────────────────────────────────────

    /**
     * Recupere les donnees bruit d'un capteur specifique.
     * Le filtre Hibernate organizationFilter assure l'isolation multi-tenant.
     */
    public List<NoiseDataPointDto> getNoiseData(String userId, Long deviceId,
                                                  String startAt, String endAt) {
        NoiseDevice device = noiseDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Capteur introuvable: " + deviceId));
        organizationAccessGuard.requireSameOrganization(
                device.getOrganizationId(), "Capteur de bruit hors de votre organisation");

        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isEmpty()) {
            log.warn("Pas d'external device ID pour le capteur {}, retour donnees vides", deviceId);
            return Collections.emptyList();
        }

        // A transport failure must remain distinguishable from an empty measurement history.
        if (DeviceType.BAITLY.equals(device.getDeviceType())) {
            return baitlyIotClient.noise(device.getExternalDeviceId(), device.getOrganizationId(),
                    device.getPropertyId(), startAt, endAt, getDeviceLabel(device));
        }

        try {
            switch (device.getDeviceType()) {
                case MINUT:
                    return fetchMinutNoiseData(userId, device, startAt, endAt);
                case TUYA:
                    return fetchTuyaNoiseData(device, startAt, endAt);
                default:
                    return Collections.emptyList();
            }
        } catch (Exception e) {
            log.error("Baitly bruit : lecture non confirmee pour capteur {}", deviceId);
            return Collections.emptyList();
        }
    }

    /**
     * Statut live d'un capteur : connectivite reelle (flag Tuya/Minut), persistee
     * pour le read-model GET /api/devices. Mirror de SmartLockService.getLockStatus.
     */
    public Map<String, Object> getDeviceStatus(String userId, Long deviceId) {
        NoiseDevice device = noiseDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Capteur introuvable: " + deviceId));
        organizationAccessGuard.requireSameOrganization(
                device.getOrganizationId(), "Capteur de bruit hors de votre organisation");

        if (DeviceType.BAITLY.equals(device.getDeviceType())) {
            var status = baitlyIotClient.getDevice(device.getExternalDeviceId(), device.getOrganizationId());
            if (status == null || status.organizationId() != device.getOrganizationId()
                    || status.propertyId() != device.getPropertyId()) {
                throw new IllegalStateException("Rattachement Baitly IoT incoherent");
            }
            device.setOnline(status.online());
            // Same convention as the other providers: last_seen_at is a UTC technical timestamp.
            device.setLastSeenAt(status.lastReceivedAt() == null ? null
                    : LocalDateTime.ofInstant(status.lastReceivedAt(), java.time.ZoneOffset.UTC));
            noiseDeviceRepository.save(device);
            return Map.of("online", status.online(), "revoked", status.revoked());
        }

        boolean online = fetchOnline(userId, device);
        device.setOnline(online);
        device.setLastSeenAt(LocalDateTime.now(java.time.ZoneOffset.UTC));
        noiseDeviceRepository.save(device);

        return Map.of("online", online);
    }

    /** Une panne fournisseur n'est pas une preuve que le capteur est hors ligne. */
    private boolean fetchOnline(String userId, NoiseDevice device) {
        String externalId = device.getExternalDeviceId();
        if (externalId == null || externalId.isBlank()) throw statusUnavailable();
        try {
            return switch (device.getDeviceType()) {
                case TUYA -> {
                    Map<String, Object> info = tuyaApiService.getDeviceInfo(externalId);
                    if (info == null || !(info.get("online") instanceof Boolean online)) throw statusUnavailable();
                    yield online;
                }
                case MINUT -> parseMinutOnline(minutApiService.getDevice(userId, externalId));
                default -> throw statusUnavailable();
            };
        } catch (Exception unavailable) {
            log.warn("Baitly bruit : statut non confirme pour capteur {}", device.getId());
            throw statusUnavailable();
        }
    }

    private boolean parseMinutOnline(Map<String, Object> info) {
        if (info == null) throw statusUnavailable();
        Object nested = info.get("device");
        if (info.containsKey("device") && !(nested instanceof Map)) throw statusUnavailable();
        Map<?, ?> values = nested instanceof Map<?, ?> map ? map : info;
        Object offline = values.get("offline");
        Object online = values.get("online");
        if (values.containsKey("offline") && !(offline instanceof Boolean)
                || values.containsKey("online") && !(online instanceof Boolean)) throw statusUnavailable();
        if (offline instanceof Boolean off && online instanceof Boolean on) {
            if (off.booleanValue() == on.booleanValue()) throw statusUnavailable();
            return on;
        }
        if (offline instanceof Boolean off) return !off;
        if (online instanceof Boolean on) return on;
        // last_heard_from_at est historique : ce n'est pas une preuve de statut courant.
        throw statusUnavailable();
    }

    private static IllegalStateException statusUnavailable() {
        return new IllegalStateException("Statut du capteur non confirme");
    }

    /**
     * Recupere les donnees bruit agregees de tous les capteurs de l'organisation.
     * Les capteurs sans donnees sont inclus avec currentLevel/averageLevel/maxLevel = -1
     * pour indiquer l'absence de donnees (et non pas une fausse valeur 0).
     */
    public NoiseChartDataDto getAllNoiseData(String userId, String startAt, String endAt) {
        List<NoiseDevice> devices = noiseDeviceRepository.findByOrganizationIdAndStatus(
                tenantContext.getRequiredOrganizationId(), DeviceStatus.ACTIVE);

        List<NoiseChartDataDto.DeviceSummary> summaries = new ArrayList<>();
        Map<String, Map<String, Double>> timeSeriesMap = new LinkedHashMap<>();

        for (NoiseDevice device : devices) {
            String label = getDeviceLabel(device);
            List<NoiseDataPointDto> data = getNoiseData(userId, device.getId(), startAt, endAt);

            if (!data.isEmpty()) {
                double[] levels = data.stream().mapToDouble(NoiseDataPointDto::getDecibels).toArray();
                double current = levels[levels.length - 1];
                double average = Arrays.stream(levels).average().orElse(0);
                double max = Arrays.stream(levels).max().orElse(0);

                summaries.add(new NoiseChartDataDto.DeviceSummary(label, current, average, max));

                for (NoiseDataPointDto point : data) {
                    timeSeriesMap.computeIfAbsent(point.getTime(), k -> new LinkedHashMap<>())
                            .put(label, point.getDecibels());
                }
            } else {
                // Capteur sans donnees : -1 signale "pas de lecture disponible"
                summaries.add(new NoiseChartDataDto.DeviceSummary(label, -1, -1, -1));
            }
        }

        // Convertir en format chart
        List<Map<String, Object>> chartData = timeSeriesMap.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("time", entry.getKey());
                    row.putAll(entry.getValue());
                    return row;
                })
                .collect(Collectors.toList());

        return new NoiseChartDataDto(summaries, chartData);
    }

    // ─── Private helpers ────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<NoiseDataPointDto> fetchMinutNoiseData(String userId, NoiseDevice device,
                                                         String startAt, String endAt) {
        // Resolution: 30 min = 1800s
        Map<String, Object> response = minutApiService.getSoundLevels(
                userId, device.getExternalDeviceId(), startAt, endAt, 1800);

        if (response == null) return Collections.emptyList();

        String label = getDeviceLabel(device);
        List<NoiseDataPointDto> points = new ArrayList<>();

        // Parse Minut response (values array)
        Object values = response.get("values");
        if (values instanceof List) {
            for (Object entry : (List<?>) values) {
                if (entry instanceof Map) {
                    Map<String, Object> point = (Map<String, Object>) entry;
                    String time = String.valueOf(point.get("datetime"));
                    double db = point.get("value") != null
                            ? ((Number) point.get("value")).doubleValue() : 0;
                    // Format time to HH:mm
                    if (time.length() >= 16) {
                        time = time.substring(11, 16);
                    }
                    points.add(new NoiseDataPointDto(time, db, label));
                }
            }
        }

        return points;
    }

    @SuppressWarnings("unchecked")
    private List<NoiseDataPointDto> fetchTuyaNoiseData(NoiseDevice device,
                                                        String startAt, String endAt) {
        // Convertir dates en timestamps
        long startTime = System.currentTimeMillis() - 24 * 60 * 60 * 1000; // 24h par defaut
        long endTime = System.currentTimeMillis();

        Map<String, Object> response = tuyaApiService.getDeviceLogs(
                device.getExternalDeviceId(), startTime, endTime);

        if (response == null) return Collections.emptyList();

        String label = getDeviceLabel(device);
        List<NoiseDataPointDto> points = new ArrayList<>();

        Object logs = response.get("logs");
        if (logs instanceof List) {
            for (Object entry : (List<?>) logs) {
                if (entry instanceof Map) {
                    Map<String, Object> logEntry = (Map<String, Object>) entry;
                    String code = String.valueOf(logEntry.get("code"));
                    if ("noise_value".equals(code)) {
                        long eventTime = logEntry.get("event_time") != null
                                ? ((Number) logEntry.get("event_time")).longValue() : 0;
                        double value = logEntry.get("value") != null
                                ? ((Number) logEntry.get("value")).doubleValue() / 1000.0 : 0; // scale 3
                        // Format timestamp to HH:mm
                        Calendar cal = Calendar.getInstance();
                        cal.setTimeInMillis(eventTime);
                        String time = String.format("%02d:%02d", cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE));
                        points.add(new NoiseDataPointDto(time, value, label));
                    }
                }
            }
        }

        return points;
    }

    private String getDeviceLabel(NoiseDevice device) {
        Property property = propertyRepository.findById(device.getPropertyId()).orElse(null);
        String base = property != null ? property.getName() : "Propriete #" + device.getPropertyId();
        return device.getRoomName() != null && !device.getRoomName().isEmpty()
                ? base + " - " + device.getRoomName()
                : base;
    }

    private NoiseDeviceDto toDto(NoiseDevice device) {
        NoiseDeviceDto dto = new NoiseDeviceDto();
        dto.setId(device.getId());
        dto.setDeviceType(device.getDeviceType().name());
        dto.setName(device.getName());
        dto.setPropertyId(device.getPropertyId());
        dto.setRoomName(device.getRoomName());
        dto.setExternalDeviceId(device.getExternalDeviceId());
        dto.setStatus(device.getStatus().name());
        dto.setOnline(device.getOnline());
        dto.setCreatedAt(device.getCreatedAt());

        // Resolve property name
        propertyRepository.findById(device.getPropertyId())
                .ifPresent(p -> dto.setPropertyName(p.getName()));

        return dto;
    }
}
