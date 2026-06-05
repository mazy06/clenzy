package com.clenzy.service;

import com.clenzy.dto.thermostat.CreateThermostatDto;
import com.clenzy.dto.thermostat.ThermostatDto;
import com.clenzy.integration.netatmo.service.NetatmoApiService;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaDeviceClaimService;
import com.clenzy.model.Property;
import com.clenzy.model.Thermostat;
import com.clenzy.model.Thermostat.ThermostatStatus;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ThermostatRepository;
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
 * Service business des thermostats. Reutilise l'integration Tuya existante
 * (TuyaApiService) pour la lecture/le pilotage, et le filtre Hibernate pour
 * l'isolation multi-tenant (meme pattern que SmartLockService).
 *
 * NB : les codes de DP Tuya et l'echelle des temperatures varient selon le
 * modele. Le parsing est defensif (plusieurs codes connus) avec une heuristique
 * d'echelle (valeur > 60 => /10). A affiner par modele si necessaire.
 */
@Service
public class ThermostatService {

    private static final Logger log = LoggerFactory.getLogger(ThermostatService.class);

    private final ThermostatRepository thermostatRepository;
    private final PropertyRepository propertyRepository;
    private final TuyaApiService tuyaApiService;
    private final TenantContext tenantContext;
    private final TuyaDeviceClaimService claimService;
    private final NetatmoApiService netatmoApiService;

    public ThermostatService(ThermostatRepository thermostatRepository,
                             PropertyRepository propertyRepository,
                             TuyaApiService tuyaApiService,
                             TenantContext tenantContext,
                             TuyaDeviceClaimService claimService,
                             NetatmoApiService netatmoApiService) {
        this.thermostatRepository = thermostatRepository;
        this.propertyRepository = propertyRepository;
        this.tuyaApiService = tuyaApiService;
        this.tenantContext = tenantContext;
        this.claimService = claimService;
        this.netatmoApiService = netatmoApiService;
    }

    // ─── CRUD ───────────────────────────────────────────────────

    public List<ThermostatDto> getUserThermostats(String userId) {
        return thermostatRepository.findByStatus(ThermostatStatus.ACTIVE).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ThermostatDto createThermostat(String userId, CreateThermostatDto dto) {
        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + dto.propertyId()));

        Thermostat thermostat = new Thermostat();
        thermostat.setUserId(userId);
        thermostat.setName(dto.name());
        thermostat.setPropertyId(property.getId());
        thermostat.setRoomName(dto.roomName());
        thermostat.setBrand(dto.brand() != null ? dto.brand() : "TUYA");
        thermostat.setExternalDeviceId(dto.externalDeviceId());
        thermostat.setStatus(ThermostatStatus.ACTIVE);
        thermostat.setOrganizationId(tenantContext.getRequiredOrganizationId());

        // Garde-fou multi-tenant : reclame le device Tuya (rejet si deja rattache a une autre org).
        if ("TUYA".equalsIgnoreCase(thermostat.getBrand())) {
            claimService.claim(thermostat.getExternalDeviceId(), "thermostat");
        }

        Thermostat saved = thermostatRepository.save(thermostat);
        log.info("Thermostat cree: {} (property={}) pour user={}", saved.getName(), saved.getPropertyId(), userId);
        return toDto(saved);
    }

    @Transactional
    public void deleteThermostat(String userId, Long thermostatId) {
        Thermostat thermostat = thermostatRepository.findById(thermostatId)
                .orElseThrow(() -> new IllegalArgumentException("Thermostat introuvable: " + thermostatId));
        if ("TUYA".equalsIgnoreCase(thermostat.getBrand())) {
            claimService.release(thermostat.getExternalDeviceId());
        }
        thermostatRepository.delete(thermostat);
        log.info("Thermostat supprime: {} (id={}) pour user={}", thermostat.getName(), thermostatId, userId);
    }

    // ─── Lecture / pilotage Tuya ─────────────────────────────────

    /** Rafraichit l'etat (temp/humidite/mode) depuis Tuya et met en cache. */
    @Transactional
    @SuppressWarnings("unchecked")
    public ThermostatDto refreshStatus(String userId, Long thermostatId) {
        Thermostat t = thermostatRepository.findById(thermostatId)
                .orElseThrow(() -> new IllegalArgumentException("Thermostat introuvable: " + thermostatId));

        if (t.getExternalDeviceId() == null || t.getExternalDeviceId().isEmpty()) {
            return toDto(t);
        }

        // Marque Netatmo : lecture via l'API Energy (homestatus), pas Tuya.
        if ("NETATMO".equalsIgnoreCase(t.getBrand())) {
            return refreshFromNetatmo(t);
        }

        try {
            Map<String, Object> status = tuyaApiService.getDeviceStatus(t.getExternalDeviceId());
            Object statusList = status.getOrDefault("result", status);
            if (statusList instanceof List) {
                for (Object dp : (List<?>) statusList) {
                    if (!(dp instanceof Map)) continue;
                    Map<String, Object> dpMap = (Map<String, Object>) dp;
                    String code = String.valueOf(dpMap.get("code"));
                    Object value = dpMap.get("value");
                    applyDp(t, code, value);
                }
            }
            t.setLastSeenAt(LocalDateTime.now());
            thermostatRepository.save(t);
        } catch (Exception e) {
            log.error("Erreur recuperation statut thermostat {} (device Tuya {}): {}",
                    thermostatId, t.getExternalDeviceId(), e.getMessage());
        }
        return toDto(t);
    }

    /**
     * Lecture d'un thermostat Netatmo (clé {@code homeId|roomId}) : température mesurée +
     * consigne + mode, via homestatus.
     */
    private ThermostatDto refreshFromNetatmo(Thermostat t) {
        try {
            String[] parts = t.getExternalDeviceId().split("\\|", 2);
            if (parts.length == 2) {
                Map<String, Object> room = netatmoApiService.fetchThermostatReadings(
                        t.getUserId(), parts[0], parts[1]);
                if (room != null) {
                    if (room.get("therm_measured_temperature") instanceof Number n) {
                        t.setCurrentTempC(BigDecimal.valueOf(n.doubleValue()).setScale(1, RoundingMode.HALF_UP));
                    }
                    if (room.get("therm_setpoint_temperature") instanceof Number n) {
                        t.setTargetTempC(BigDecimal.valueOf(n.doubleValue()).setScale(1, RoundingMode.HALF_UP));
                    }
                    if (room.get("therm_setpoint_mode") instanceof String s) {
                        t.setMode(mapMode(s));
                    }
                }
            }
            t.setLastSeenAt(LocalDateTime.now());
            thermostatRepository.save(t);
        } catch (Exception e) {
            log.error("Erreur lecture Netatmo thermostat {} ({}): {}",
                    t.getId(), t.getExternalDeviceId(), e.getMessage());
        }
        return toDto(t);
    }

    /** Definit la consigne (°C) via Tuya et met en cache. */
    @Transactional
    public ThermostatDto setTargetTemp(String userId, Long thermostatId, double targetTempC) {
        Thermostat t = thermostatRepository.findById(thermostatId)
                .orElseThrow(() -> new IllegalArgumentException("Thermostat introuvable: " + thermostatId));

        if (t.getExternalDeviceId() == null || t.getExternalDeviceId().isEmpty()) {
            throw new IllegalStateException("Pas d'ID device configure pour ce thermostat");
        }

        // Marque Netatmo : pilotage via setroomthermpoint (clé homeId|roomId).
        if ("NETATMO".equalsIgnoreCase(t.getBrand())) {
            String[] parts = t.getExternalDeviceId().split("\\|", 2);
            if (parts.length == 2) {
                netatmoApiService.setThermpoint(t.getUserId(), parts[0], parts[1], targetTempC);
            }
            t.setTargetTempC(BigDecimal.valueOf(targetTempC).setScale(1, RoundingMode.HALF_UP));
            thermostatRepository.save(t);
            log.info("Consigne thermostat Netatmo {} = {}°C", thermostatId, targetTempC);
            return toDto(t);
        }

        // Beaucoup de thermostats Tuya utilisent l'echelle 1 (valeur entiere = °C x10).
        int tuyaValue = (int) Math.round(targetTempC * 10);
        List<Map<String, Object>> commands = List.of(Map.of("code", "temp_set", "value", tuyaValue));
        tuyaApiService.sendCommand(t.getExternalDeviceId(), commands);

        t.setTargetTempC(BigDecimal.valueOf(targetTempC).setScale(1, RoundingMode.HALF_UP));
        thermostatRepository.save(t);
        log.info("Consigne thermostat {} = {}°C (device Tuya {})", thermostatId, targetTempC, t.getExternalDeviceId());
        return toDto(t);
    }

    // ─── Helpers ─────────────────────────────────────────────────

    private void applyDp(Thermostat t, String code, Object value) {
        switch (code) {
            case "temp_current", "temp_indoor", "upper_temp", "va_temperature" -> {
                BigDecimal temp = parseTemp(value);
                if (temp != null) t.setCurrentTempC(temp);
            }
            case "temp_set", "temp_set_f", "set_temp" -> {
                BigDecimal temp = parseTemp(value);
                if (temp != null) t.setTargetTempC(temp);
            }
            case "humidity_current", "humidity_indoor", "humidity", "va_humidity" -> {
                if (value instanceof Number n) t.setHumidity(n.intValue());
            }
            case "mode", "work_mode", "system_mode" -> t.setMode(mapMode(String.valueOf(value)));
            case "switch", "power", "switch_compressor" -> {
                if (Boolean.FALSE.equals(value)) t.setMode("off");
            }
            default -> { /* DP ignore */ }
        }
    }

    /** Tuya renvoie souvent la temperature x10 (echelle 1). Heuristique : > 60 => /10. */
    private BigDecimal parseTemp(Object value) {
        if (!(value instanceof Number n)) return null;
        double d = n.doubleValue();
        if (Math.abs(d) > 60) d = d / 10.0;
        return BigDecimal.valueOf(d).setScale(1, RoundingMode.HALF_UP);
    }

    /** Normalise le mode Tuya vers : heat | cool | eco | off. */
    private String mapMode(String raw) {
        if (raw == null) return null;
        String m = raw.toLowerCase();
        if (m.contains("hot") || m.contains("heat")) return "heat";
        if (m.contains("cold") || m.contains("cool")) return "cool";
        if (m.contains("eco") || m.contains("auto")) return "eco";
        if (m.contains("off")) return "off";
        return m;
    }

    private ThermostatDto toDto(Thermostat t) {
        String propertyName = propertyRepository.findById(t.getPropertyId())
                .map(Property::getName)
                .orElse(null);
        boolean online = t.getStatus() == ThermostatStatus.ACTIVE;
        return new ThermostatDto(
                t.getId(), t.getName(), t.getPropertyId(), propertyName, t.getRoomName(),
                t.getBrand(), t.getStatus().name(), online,
                t.getCurrentTempC() != null ? t.getCurrentTempC().doubleValue() : null,
                t.getTargetTempC() != null ? t.getTargetTempC().doubleValue() : null,
                t.getHumidity(), t.getMode(), t.getPreset(), t.getCreatedAt());
    }
}
