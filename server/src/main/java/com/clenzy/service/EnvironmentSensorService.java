package com.clenzy.service;

import com.clenzy.dto.environment.CreateEnvironmentSensorDto;
import com.clenzy.dto.environment.EnvironmentSensorDto;
import com.clenzy.integration.netatmo.service.NetatmoApiService;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaDeviceClaimService;
import com.clenzy.model.EnvironmentSensor;
import com.clenzy.model.EnvironmentSensor.SensorStatus;
import com.clenzy.model.EnvironmentSensor.SensorType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.repository.EnvironmentSensorRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service business des capteurs d'environnement (temp/humidite, contact, mouvement,
 * fumee). Modele generique unique ({@link EnvironmentSensor}) pour les 4 types ;
 * reutilise l'integration Tuya (lecture d'etat) et le filtre Hibernate pour
 * l'isolation multi-tenant (meme pattern que {@link ThermostatService}).
 *
 * Alertes : sur transition vers "detecte" (fumee / mouvement), une notification
 * est envoyee aux admins/managers de l'org, avec un cooldown anti-spam
 * ({@code lastAlertAt}). Les DP Tuya varient selon le modele → parsing defensif.
 */
@Service
public class EnvironmentSensorService {

    private static final Logger log = LoggerFactory.getLogger(EnvironmentSensorService.class);

    /** Cooldown entre deux notifications pour un meme capteur (minutes). */
    private static final long SMOKE_COOLDOWN_MIN = 10;
    private static final long MOTION_COOLDOWN_MIN = 15;

    private final EnvironmentSensorRepository sensorRepository;
    private final PropertyRepository propertyRepository;
    private final TuyaApiService tuyaApiService;
    private final TenantContext tenantContext;
    private final TuyaDeviceClaimService claimService;
    private final NotificationService notificationService;
    private final NetatmoApiService netatmoApiService;
    private final SupervisionActivityService supervisionActivityService;

    public EnvironmentSensorService(EnvironmentSensorRepository sensorRepository,
                                    PropertyRepository propertyRepository,
                                    TuyaApiService tuyaApiService,
                                    TenantContext tenantContext,
                                    TuyaDeviceClaimService claimService,
                                    NotificationService notificationService,
                                    NetatmoApiService netatmoApiService,
                                    SupervisionActivityService supervisionActivityService) {
        this.sensorRepository = sensorRepository;
        this.propertyRepository = propertyRepository;
        this.tuyaApiService = tuyaApiService;
        this.tenantContext = tenantContext;
        this.claimService = claimService;
        this.notificationService = notificationService;
        this.netatmoApiService = netatmoApiService;
        this.supervisionActivityService = supervisionActivityService;
    }

    // ─── CRUD ───────────────────────────────────────────────────

    public List<EnvironmentSensorDto> getUserSensors(String userId) {
        return sensorRepository.findByStatus(SensorStatus.ACTIVE).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public EnvironmentSensorDto createSensor(String userId, CreateEnvironmentSensorDto dto) {
        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + dto.propertyId()));

        SensorType type = parseType(dto.sensorType());

        EnvironmentSensor sensor = new EnvironmentSensor();
        sensor.setUserId(userId);
        sensor.setName(dto.name());
        sensor.setPropertyId(property.getId());
        sensor.setRoomName(dto.roomName());
        sensor.setSensorType(type);
        sensor.setBrand(dto.brand() != null ? dto.brand() : "TUYA");
        sensor.setExternalDeviceId(dto.externalDeviceId());
        sensor.setStatus(SensorStatus.ACTIVE);
        sensor.setOrganizationId(tenantContext.getRequiredOrganizationId());

        // Garde-fou multi-tenant : reclame le device Tuya (rejet si deja rattache ailleurs).
        if ("TUYA".equalsIgnoreCase(sensor.getBrand()) && sensor.getExternalDeviceId() != null
                && !sensor.getExternalDeviceId().isBlank()) {
            claimService.claim(sensor.getExternalDeviceId(), "environment_sensor");
        }

        EnvironmentSensor saved = sensorRepository.save(sensor);
        log.info("Capteur {} cree: {} (property={}) pour user={}",
                type, saved.getName(), saved.getPropertyId(), userId);
        return toDto(saved);
    }

    @Transactional
    public void deleteSensor(String userId, Long sensorId) {
        EnvironmentSensor sensor = sensorRepository.findById(sensorId)
                .orElseThrow(() -> new IllegalArgumentException("Capteur introuvable: " + sensorId));
        if ("TUYA".equalsIgnoreCase(sensor.getBrand()) && sensor.getExternalDeviceId() != null
                && !sensor.getExternalDeviceId().isBlank()) {
            claimService.release(sensor.getExternalDeviceId());
        }
        sensorRepository.delete(sensor);
        log.info("Capteur supprime: {} (id={}) pour user={}", sensor.getName(), sensorId, userId);
    }

    // ─── Lecture Tuya + alertes ──────────────────────────────────

    /** Rafraichit l'etat d'un capteur depuis Tuya (lecture a la demande). */
    @Transactional
    public EnvironmentSensorDto refreshStatus(String userId, Long sensorId) {
        EnvironmentSensor sensor = sensorRepository.findById(sensorId)
                .orElseThrow(() -> new IllegalArgumentException("Capteur introuvable: " + sensorId));
        return refresh(sensor);
    }

    /**
     * Scheduler : poll les capteurs SMOKE/MOTION de toutes les orgs (filtre Hibernate
     * inactif hors requete) et declenche les alertes. @return nombre de capteurs traites.
     */
    @Transactional
    public int pollAndAlert() {
        List<EnvironmentSensor> sensors = sensorRepository.findByStatusAndSensorTypeIn(
                SensorStatus.ACTIVE, List.of(SensorType.SMOKE, SensorType.MOTION));
        int processed = 0;
        for (EnvironmentSensor sensor : sensors) {
            if (sensor.getExternalDeviceId() == null || sensor.getExternalDeviceId().isBlank()) continue;
            try {
                refresh(sensor);
                processed++;
            } catch (Exception e) {
                log.warn("Erreur poll capteur {} (device Tuya {}): {}",
                        sensor.getId(), sensor.getExternalDeviceId(), e.getMessage());
            }
        }
        return processed;
    }

    @SuppressWarnings("unchecked")
    private EnvironmentSensorDto refresh(EnvironmentSensor sensor) {
        if (sensor.getExternalDeviceId() == null || sensor.getExternalDeviceId().isBlank()) {
            return toDto(sensor);
        }

        // Marque Netatmo : lecture via l'API Connect (station meteo), pas Tuya.
        if ("NETATMO".equalsIgnoreCase(sensor.getBrand())) {
            return refreshFromNetatmo(sensor);
        }

        try {
            // Etat precedent (pour detecter une transition → alerte).
            boolean prevSmoke = Boolean.TRUE.equals(sensor.getSmokeDetected());
            boolean prevMotion = Boolean.TRUE.equals(sensor.getMotionDetected());
            Boolean prevContact = sensor.getContactOpen();

            Map<String, Object> status = tuyaApiService.getDeviceStatus(sensor.getExternalDeviceId());
            Object statusList = status.getOrDefault("result", status);
            if (statusList instanceof List) {
                for (Object dp : (List<?>) statusList) {
                    if (!(dp instanceof Map)) continue;
                    Map<String, Object> dpMap = (Map<String, Object>) dp;
                    applyDp(sensor, String.valueOf(dpMap.get("code")), dpMap.get("value"));
                }
            }

            sensor.setOnline(fetchOnline(sensor.getExternalDeviceId()));
            sensor.setLastSeenAt(LocalDateTime.now());

            // Detection de transition + alertes.
            boolean nowSmoke = Boolean.TRUE.equals(sensor.getSmokeDetected());
            boolean nowMotion = Boolean.TRUE.equals(sensor.getMotionDetected());
            boolean contactChanged = prevContact != null
                    && !prevContact.equals(sensor.getContactOpen());

            if ((nowSmoke && !prevSmoke) || (nowMotion && !prevMotion) || contactChanged) {
                sensor.setLastEventAt(LocalDateTime.now());
            }
            if (sensor.getSensorType() == SensorType.SMOKE && nowSmoke && !prevSmoke) {
                maybeAlert(sensor, SensorType.SMOKE);
            }
            if (sensor.getSensorType() == SensorType.MOTION && nowMotion && !prevMotion) {
                maybeAlert(sensor, SensorType.MOTION);
            }

            sensorRepository.save(sensor);
        } catch (Exception e) {
            log.error("Erreur recuperation statut capteur {} (device Tuya {}): {}",
                    sensor.getId(), sensor.getExternalDeviceId(), e.getMessage());
        }
        return toDto(sensor);
    }

    /**
     * Lecture d'un capteur Netatmo (station meteo) : temperature/humidite + CO2 + bruit (dB)
     * via getstationsdata. Pas d'alertes (la station meteo n'a ni fumee ni mouvement).
     */
    private EnvironmentSensorDto refreshFromNetatmo(EnvironmentSensor sensor) {
        try {
            if (sensor.getSensorType() == SensorType.SMOKE || sensor.getSensorType() == SensorType.CONTACT) {
                refreshNetatmoSecurity(sensor);
            } else {
                refreshNetatmoWeather(sensor);
            }
            sensorRepository.save(sensor);
        } catch (Exception e) {
            log.error("Erreur lecture Netatmo capteur {} (module {}): {}",
                    sensor.getId(), sensor.getExternalDeviceId(), e.getMessage());
        }
        return toDto(sensor);
    }

    /** Station météo Netatmo : temp/humidité + CO2 + bruit via getstationsdata. */
    private void refreshNetatmoWeather(EnvironmentSensor sensor) {
        Map<String, Object> r = netatmoApiService.fetchModuleReadings(
                sensor.getUserId(), sensor.getExternalDeviceId());
        if (r != null) {
            if (r.get("Temperature") instanceof Number n) {
                sensor.setTemperatureC(BigDecimal.valueOf(n.doubleValue()).setScale(1, RoundingMode.HALF_UP));
            }
            if (r.get("Humidity") instanceof Number n) sensor.setHumidity(n.intValue());
            if (r.get("CO2") instanceof Number n) sensor.setCo2(n.intValue());
            if (r.get("Noise") instanceof Number n) sensor.setNoiseDb(n.intValue());
            sensor.setOnline(Boolean.TRUE.equals(r.get("reachable")));
            sensor.setLastSeenAt(LocalDateTime.now());
        } else {
            sensor.setOnline(false);
        }
    }

    /**
     * Module sécurité Netatmo (clé {@code homeId|moduleId}) via homestatus : online + batterie ;
     * pour un door tag (CONTACT), l'état ouvert/fermé. La détection fumée (NSD) est
     * événementielle (webhook) → non lue ici (online + batterie seulement).
     */
    private void refreshNetatmoSecurity(EnvironmentSensor sensor) {
        String[] parts = sensor.getExternalDeviceId().split("\\|", 2);
        if (parts.length != 2) { sensor.setOnline(false); return; }
        Map<String, Object> m = netatmoApiService.fetchSecurityModuleStatus(
                sensor.getUserId(), parts[0], parts[1]);
        if (m == null) { sensor.setOnline(false); return; }
        sensor.setOnline(Boolean.TRUE.equals(m.get("reachable")));
        if (m.get("battery_percent") instanceof Number n) sensor.setBatteryLevel(n.intValue());
        if (sensor.getSensorType() == SensorType.CONTACT && m.get("status") != null) {
            sensor.setContactOpen("open".equalsIgnoreCase(String.valueOf(m.get("status"))));
        }
        sensor.setLastSeenAt(LocalDateTime.now());
    }

    /**
     * Envoie une notification aux admins/managers de l'org sur detection, avec
     * cooldown (best-effort : une erreur de notif ne casse pas le refresh).
     */
    private void maybeAlert(EnvironmentSensor sensor, SensorType type) {
        Long orgId = sensor.getOrganizationId();
        if (orgId == null) return;

        long cooldown = type == SensorType.SMOKE ? SMOKE_COOLDOWN_MIN : MOTION_COOLDOWN_MIN;
        LocalDateTime now = LocalDateTime.now();
        if (sensor.getLastAlertAt() != null && sensor.getLastAlertAt().isAfter(now.minusMinutes(cooldown))) {
            return; // cooldown actif
        }
        sensor.setLastAlertAt(now);

        String property = propertyRepository.findById(sensor.getPropertyId())
                .map(Property::getName).orElse("un logement");
        // Deep-link vers la vue objets connectes de la propriete concernee, avec
        // highlight du capteur ayant declenche l'alerte.
        String actionUrl = "/connected-objects/property/" + sensor.getPropertyId()
                + "?highlight=" + sensor.getId();
        try {
            if (type == SensorType.SMOKE) {
                notificationService.notifyAdminsAndManagersByOrgId(orgId, NotificationKey.IOT_SMOKE_DETECTED,
                        "Fumee detectee",
                        sensor.getName() + " — " + property + " a detecte de la fumee ou de la vapeur.",
                        actionUrl);
                log.warn("Alerte FUMEE : capteur={} property={} org={}", sensor.getId(), sensor.getPropertyId(), orgId);
            } else {
                notificationService.notifyAdminsAndManagersByOrgId(orgId, NotificationKey.IOT_MOTION_DETECTED,
                        "Mouvement detecte",
                        sensor.getName() + " — " + property + " a detecte un mouvement.",
                        actionUrl);
                log.info("Alerte MOUVEMENT : capteur={} property={} org={}", sensor.getId(), sensor.getPropertyId(), orgId);
            }
        } catch (Exception e) {
            log.error("Erreur envoi notification alerte capteur {}: {}", sensor.getId(), e.getMessage());
        }

        // Feed « En direct » de la constellation (best-effort : ne casse jamais le flux d'alerte).
        try {
            String label = type == SensorType.SMOKE ? "Fumee detectee" : "Mouvement detecte";
            String summary = label + " — " + sensor.getName() + " · " + property;
            supervisionActivityService.recordModuleAct(
                    orgId, sensor.getPropertyId(), "ops", "sensor_anomaly", summary);
        } catch (Exception e) {
            log.debug("Alerte capteur {} : activite constellation non enregistree: {}",
                    sensor.getId(), e.getMessage());
        }
    }

    // ─── Parsing Tuya (DP varient selon le modele → defensif) ────

    private void applyDp(EnvironmentSensor s, String code, Object value) {
        switch (code) {
            // Temperature (souvent x10 : 215 => 21.5°C)
            case "va_temperature", "temp_current", "temperature", "temp_value" -> {
                BigDecimal t = parseScaled(value);
                if (t != null) s.setTemperatureC(t);
            }
            // Humidite (%) — direct, parfois x10
            case "va_humidity", "humidity_value", "humidity", "humidity_current" -> {
                if (value instanceof Number n) {
                    int h = n.intValue();
                    if (h > 100) h = Math.round(h / 10f);
                    s.setHumidity(h);
                }
            }
            // Contact porte/fenetre (true = ouvert)
            case "doorcontact_state", "contact_state" -> s.setContactOpen(asBool(value));
            // Mouvement / presence
            case "pir", "presence_state", "motion_state", "occupancy" ->
                    s.setMotionDetected(asDetected(value, "pir", "presence", "motion", "1", "true"));
            // Fumee / vape
            case "smoke_sensor_status", "smoke_sensor_state", "smoke_state" ->
                    s.setSmokeDetected(asDetected(value, "alarm", "1", "true", "abnormal"));
            case "smoke_value", "smoke_sensor_value" -> {
                if (value instanceof Number n && n.intValue() > 0) s.setSmokeDetected(true);
            }
            // Batterie (% direct, ou enum low/middle/high)
            case "battery_percentage", "battery_value", "residual_electricity", "battery" -> {
                if (value instanceof Number n) s.setBatteryLevel(n.intValue());
            }
            case "battery_state" -> s.setBatteryLevel(mapBatteryState(value));
            default -> { /* DP ignore */ }
        }
    }

    /** Tuya renvoie souvent les valeurs x10. Heuristique : |valeur| > 100 => /10. */
    private BigDecimal parseScaled(Object value) {
        if (!(value instanceof Number n)) return null;
        double d = n.doubleValue();
        if (Math.abs(d) > 100) d = d / 10.0;
        return BigDecimal.valueOf(d).setScale(1, RoundingMode.HALF_UP);
    }

    private Boolean asBool(Object value) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.intValue() != 0;
        if (value instanceof String str) {
            return "true".equalsIgnoreCase(str) || "1".equals(str) || "open".equalsIgnoreCase(str);
        }
        return null;
    }

    /** True si la valeur (bool/num/enum string) correspond a un etat "detecte". */
    private boolean asDetected(Object value, String... detectedTokens) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.intValue() != 0;
        if (value instanceof String str) {
            for (String token : detectedTokens) {
                if (token.equalsIgnoreCase(str)) return true;
            }
        }
        return false;
    }

    private Integer mapBatteryState(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String str) {
            return switch (str.toLowerCase()) {
                case "high" -> 90;
                case "middle", "medium" -> 50;
                case "low" -> 15;
                default -> null;
            };
        }
        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────

    private SensorType parseType(String raw) {
        try {
            return SensorType.valueOf(raw.trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Type de capteur invalide: " + raw
                    + " (attendu: TEMP_HUMIDITY, CONTACT, MOTION, SMOKE)");
        }
    }

    private boolean fetchOnline(String externalDeviceId) {
        try {
            Map<String, Object> info = tuyaApiService.getDeviceInfo(externalDeviceId);
            return info != null && Boolean.TRUE.equals(info.get("online"));
        } catch (Exception e) {
            log.warn("Statut online Tuya indisponible pour device {}: {}", externalDeviceId, e.getMessage());
            return false;
        }
    }

    private EnvironmentSensorDto toDto(EnvironmentSensor s) {
        String propertyName = propertyRepository.findById(s.getPropertyId())
                .map(Property::getName)
                .orElse(null);
        return new EnvironmentSensorDto(
                s.getId(), s.getName(), s.getPropertyId(), propertyName, s.getRoomName(),
                s.getSensorType().name(), s.getBrand(), s.getStatus().name(), s.getOnline(),
                s.getBatteryLevel(),
                s.getTemperatureC() != null ? s.getTemperatureC().doubleValue() : null,
                s.getHumidity(), s.getContactOpen(), s.getMotionDetected(), s.getSmokeDetected(),
                s.getCo2(), s.getNoiseDb(),
                s.getLastSeenAt(), s.getLastEventAt(), s.getCreatedAt());
    }
}
