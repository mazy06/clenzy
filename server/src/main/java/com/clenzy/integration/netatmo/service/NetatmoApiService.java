package com.clenzy.integration.netatmo.service;

import com.clenzy.dto.netatmo.NetatmoModuleDto;
import com.clenzy.integration.netatmo.config.NetatmoConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Appels REST vers l'API Netatmo Connect (station meteo). Authentifie via le token OAuth
 * de l'utilisateur ({@link NetatmoOAuthService#getValidAccessToken}). Calque sur MinutApiService.
 *
 * getstationsdata renvoie body.devices[] (stations NAMain : Temperature/Humidity/CO2/Noise)
 * + device.modules[] (NAModule1 exterieur, NAModule4 interieur add. : Temperature/Humidity...).
 */
@Service
public class NetatmoApiService {

    private static final Logger log = LoggerFactory.getLogger(NetatmoApiService.class);

    private final NetatmoConfig config;
    private final NetatmoOAuthService oAuthService;
    private final RestTemplate restTemplate;

    public NetatmoApiService(NetatmoConfig config, NetatmoOAuthService oAuthService, RestTemplate restTemplate) {
        this.config = config;
        this.oAuthService = oAuthService;
        this.restTemplate = restTemplate;
    }

    /** Donnees brutes des stations meteo de l'utilisateur. GET /api/getstationsdata */
    public Map<String, Object> getStationsData(String userId) {
        return doGet(userId, "/api/getstationsdata", new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    /** Modules decouverts (stations + modules rattaches), pour le picker du wizard. */
    @SuppressWarnings("unchecked")
    public List<NetatmoModuleDto> listWeatherModules(String userId) {
        List<NetatmoModuleDto> modules = new ArrayList<>();
        Map<String, Object> data = getStationsData(userId);
        List<Map<String, Object>> devices = devices(data);
        for (Map<String, Object> device : devices) {
            String stationName = str(device.get("station_name"));
            modules.add(toModuleDto(device, stationName));
            Object subs = device.get("modules");
            if (subs instanceof List) {
                for (Object m : (List<?>) subs) {
                    if (m instanceof Map) modules.add(toModuleDto((Map<String, Object>) m, stationName));
                }
            }
        }
        return modules;
    }

    /**
     * Releves d'un module (par son _id) : dashboard_data (Temperature/Humidity/CO2/Noise) +
     * flag {@code reachable}. Netatmo n'expose pas d'endpoint par module → on filtre la reponse globale.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchModuleReadings(String userId, String moduleId) {
        Map<String, Object> data = getStationsData(userId);
        for (Map<String, Object> device : devices(data)) {
            if (moduleId.equals(str(device.get("_id")))) return readings(device);
            Object subs = device.get("modules");
            if (subs instanceof List) {
                for (Object m : (List<?>) subs) {
                    if (m instanceof Map && moduleId.equals(str(((Map<String, Object>) m).get("_id")))) {
                        return readings((Map<String, Object>) m);
                    }
                }
            }
        }
        return null;
    }

    // ─── Thermostat / Energy (homesdata + homestatus + setroomthermpoint) ───

    public Map<String, Object> getHomesData(String userId) {
        return doGet(userId, "/api/homesdata", new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    public Map<String, Object> getHomeStatus(String userId, String homeId) {
        return doGet(userId, "/api/homestatus?home_id=" + homeId,
                new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    /** Thermostats / vannes découverts (id = {@code homeId|roomId}), pour le picker. */
    @SuppressWarnings("unchecked")
    public List<NetatmoModuleDto> listThermostats(String userId) {
        List<NetatmoModuleDto> out = new ArrayList<>();
        for (Map<String, Object> home : homes(getHomesData(userId))) {
            String homeId = str(home.get("id"));
            String homeName = str(home.get("name"));
            Map<String, String> roomNames = new java.util.HashMap<>();
            Object rooms = home.get("rooms");
            if (rooms instanceof List) {
                for (Object r : (List<?>) rooms) {
                    if (r instanceof Map) {
                        Map<String, Object> room = (Map<String, Object>) r;
                        roomNames.put(str(room.get("id")), str(room.get("name")));
                    }
                }
            }
            Object modules = home.get("modules");
            if (modules instanceof List) {
                for (Object m : (List<?>) modules) {
                    if (!(m instanceof Map)) continue;
                    Map<String, Object> module = (Map<String, Object>) m;
                    String type = str(module.get("type"));
                    if ("NATherm1".equals(type) || "NRV".equals(type) || "OTM".equals(type)) {
                        String roomId = str(module.get("room_id"));
                        String roomName = roomNames.getOrDefault(roomId, str(module.get("name")));
                        out.add(new NetatmoModuleDto(homeId + "|" + roomId, roomName, "thermostat", homeName, true));
                    }
                }
            }
        }
        return out;
    }

    /** Etat d'une pièce chauffée (therm_measured_temperature / therm_setpoint_temperature / mode). */
    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchThermostatReadings(String userId, String homeId, String roomId) {
        Map<String, Object> data = getHomeStatus(userId, homeId);
        if (data == null) return null;
        Object body = data.get("body");
        Object home = body instanceof Map ? ((Map<String, Object>) body).get("home") : null;
        Object rooms = home instanceof Map ? ((Map<String, Object>) home).get("rooms") : null;
        if (rooms instanceof List) {
            for (Object r : (List<?>) rooms) {
                if (r instanceof Map && roomId.equals(str(((Map<String, Object>) r).get("id")))) {
                    return (Map<String, Object>) r;
                }
            }
        }
        return null;
    }

    /** Définit la consigne (mode manuel) d'une pièce. POST /api/setroomthermpoint */
    public void setThermpoint(String userId, String homeId, String roomId, double temp) {
        String path = "/api/setroomthermpoint?home_id=" + homeId + "&room_id=" + roomId
                + "&mode=manual&temp=" + temp;
        doPost(userId, path, new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    // ─── Sécurité (détecteur fumée NSD + door tag NACamDoorTag) ───

    /** Modules sécurité découverts (id = {@code homeId|moduleId}), pour le picker. */
    @SuppressWarnings("unchecked")
    public List<NetatmoModuleDto> listSecurityModules(String userId) {
        List<NetatmoModuleDto> out = new ArrayList<>();
        for (Map<String, Object> home : homes(getHomesData(userId))) {
            String homeId = str(home.get("id"));
            String homeName = str(home.get("name"));
            Object modules = home.get("modules");
            if (!(modules instanceof List)) continue;
            for (Object m : (List<?>) modules) {
                if (!(m instanceof Map)) continue;
                Map<String, Object> module = (Map<String, Object>) m;
                String kind = securityKind(str(module.get("type")));
                if (kind != null) {
                    out.add(new NetatmoModuleDto(homeId + "|" + str(module.get("id")),
                            str(module.get("name")), kind, homeName, true));
                }
            }
        }
        return out;
    }

    /** Etat d'un module sécurité (status / battery_percent / reachable) via homestatus. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchSecurityModuleStatus(String userId, String homeId, String moduleId) {
        Map<String, Object> data = getHomeStatus(userId, homeId);
        if (data == null) return null;
        Object body = data.get("body");
        Object home = body instanceof Map ? ((Map<String, Object>) body).get("home") : null;
        Object modules = home instanceof Map ? ((Map<String, Object>) home).get("modules") : null;
        if (modules instanceof List) {
            for (Object m : (List<?>) modules) {
                if (m instanceof Map && moduleId.equals(str(((Map<String, Object>) m).get("id")))) {
                    return (Map<String, Object>) m;
                }
            }
        }
        return null;
    }

    /** Mappe un type de module sécurité Netatmo vers un kind Clenzy (null si non géré). */
    private static String securityKind(String type) {
        if ("NSD".equals(type)) return "smoke";
        if ("NACamDoorTag".equals(type)) return "contact";
        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> homes(Map<String, Object> data) {
        if (data == null) return Collections.emptyList();
        Object body = data.get("body");
        Object homes = body instanceof Map ? ((Map<String, Object>) body).get("homes") : data.get("homes");
        if (homes instanceof List) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object h : (List<?>) homes) {
                if (h instanceof Map) result.add((Map<String, Object>) h);
            }
            return result;
        }
        return Collections.emptyList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> devices(Map<String, Object> data) {
        if (data == null) return Collections.emptyList();
        Object body = data.get("body");
        Object devices = body instanceof Map ? ((Map<String, Object>) body).get("devices") : data.get("devices");
        if (devices instanceof List) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object d : (List<?>) devices) {
                if (d instanceof Map) result.add((Map<String, Object>) d);
            }
            return result;
        }
        return Collections.emptyList();
    }

    private NetatmoModuleDto toModuleDto(Map<String, Object> m, String stationName) {
        String name = str(m.get("module_name"));
        if (name == null) name = str(m.get("station_name"));
        if (name == null) name = stationName;
        Object reachable = m.get("reachable");
        return new NetatmoModuleDto(str(m.get("_id")), name, str(m.get("type")), stationName,
                Boolean.TRUE.equals(reachable));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readings(Map<String, Object> m) {
        Object dash = m.get("dashboard_data");
        Map<String, Object> out = (dash instanceof Map) ? (Map<String, Object>) dash
                : new java.util.HashMap<>();
        out = new java.util.HashMap<>(out);
        out.put("reachable", m.get("reachable"));
        return out;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private <T> T doGet(String userId, String path, ParameterizedTypeReference<T> responseType) {
        String token = oAuthService.getValidAccessToken(userId);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        try {
            ResponseEntity<T> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path, HttpMethod.GET, new HttpEntity<>(headers), responseType);
            return response.getBody();
        } catch (Exception e) {
            log.error("Erreur API Netatmo GET {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Netatmo: " + e.getMessage(), e);
        }
    }

    private <T> T doPost(String userId, String path, ParameterizedTypeReference<T> responseType) {
        String token = oAuthService.getValidAccessToken(userId);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        try {
            ResponseEntity<T> response = restTemplate.exchange(
                    config.getApiBaseUrl() + path, HttpMethod.POST, new HttpEntity<>(headers), responseType);
            return response.getBody();
        } catch (Exception e) {
            log.error("Erreur API Netatmo POST {}: {}", path, e.getMessage());
            throw new RuntimeException("Erreur appel API Netatmo: " + e.getMessage(), e);
        }
    }
}
