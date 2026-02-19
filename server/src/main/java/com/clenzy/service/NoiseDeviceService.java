package com.clenzy.service;

import com.clenzy.dto.noise.CreateNoiseDeviceDto;
import com.clenzy.dto.noise.NoiseChartDataDto;
import com.clenzy.dto.noise.NoiseDataPointDto;
import com.clenzy.dto.noise.NoiseDeviceDto;
import com.clenzy.integration.minut.service.MinutApiService;
import com.clenzy.integration.tuya.service.TuyaApiService;
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

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service business unifie pour les capteurs de bruit.
 * Orchestre les appels vers Minut ou Tuya selon le type de device.
 */
@Service
public class NoiseDeviceService {

    private static final Logger log = LoggerFactory.getLogger(NoiseDeviceService.class);

    private final NoiseDeviceRepository noiseDeviceRepository;
    private final PropertyRepository propertyRepository;
    private final MinutApiService minutApiService;
    private final TuyaApiService tuyaApiService;
    private final TenantContext tenantContext;

    public NoiseDeviceService(NoiseDeviceRepository noiseDeviceRepository,
                              PropertyRepository propertyRepository,
                              MinutApiService minutApiService,
                              TuyaApiService tuyaApiService,
                              TenantContext tenantContext) {
        this.noiseDeviceRepository = noiseDeviceRepository;
        this.propertyRepository = propertyRepository;
        this.minutApiService = minutApiService;
        this.tuyaApiService = tuyaApiService;
        this.tenantContext = tenantContext;
    }

    // ─── CRUD ───────────────────────────────────────────────────

    /**
     * Liste les capteurs de l'utilisateur.
     */
    public List<NoiseDeviceDto> getUserDevices(String userId) {
        return noiseDeviceRepository.findByUserId(userId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Cree un nouveau capteur.
     */
    public NoiseDeviceDto createDevice(String userId, CreateNoiseDeviceDto dto) {
        // Verifier que la propriete existe
        Property property = propertyRepository.findById(dto.getPropertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + dto.getPropertyId()));

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

        NoiseDevice saved = noiseDeviceRepository.save(device);
        log.info("Capteur cree: {} (type={}, property={}) pour user={}",
                saved.getName(), saved.getDeviceType(), saved.getPropertyId(), userId);

        return toDto(saved);
    }

    /**
     * Supprime un capteur.
     */
    public void deleteDevice(String userId, Long deviceId) {
        NoiseDevice device = noiseDeviceRepository.findByIdAndUserId(deviceId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Capteur introuvable: " + deviceId));

        noiseDeviceRepository.delete(device);
        log.info("Capteur supprime: {} (id={}) pour user={}", device.getName(), deviceId, userId);
    }

    // ─── Noise Data ─────────────────────────────────────────────

    /**
     * Recupere les donnees bruit d'un capteur specifique.
     */
    public List<NoiseDataPointDto> getNoiseData(String userId, Long deviceId,
                                                  String startAt, String endAt) {
        NoiseDevice device = noiseDeviceRepository.findByIdAndUserId(deviceId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Capteur introuvable: " + deviceId));

        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isEmpty()) {
            log.warn("Pas d'external device ID pour le capteur {}, retour donnees vides", deviceId);
            return Collections.emptyList();
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
            log.error("Erreur recuperation donnees bruit pour device {}: {}", deviceId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Recupere les donnees bruit agregees de tous les capteurs de l'utilisateur.
     */
    public NoiseChartDataDto getAllNoiseData(String userId, String startAt, String endAt) {
        List<NoiseDevice> devices = noiseDeviceRepository.findByUserIdAndStatus(userId, DeviceStatus.ACTIVE);

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
        dto.setCreatedAt(device.getCreatedAt());

        // Resolve property name
        propertyRepository.findById(device.getPropertyId())
                .ifPresent(p -> dto.setPropertyName(p.getName()));

        return dto;
    }
}
