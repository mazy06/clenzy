package com.clenzy.integration.holidays;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.Serializable;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Client pour l'API publique date.nager.at — jours feries officiels par pays.
 *
 * <p>API gratuite, sans cle (https://date.nager.at/api/v3/PublicHolidays/{year}/{country}).
 * Pays code ISO-3166 alpha-2 (FR, MA, ES, ...). Une annee = ~10 jours feries.</p>
 *
 * <p>Cache Redis 7 jours par {(country, year)} — les jours feries ne bougent pas.
 * Echec reseau : on log warn et on retourne liste vide. Le service consommateur
 * fait la fusion sans cracher.</p>
 *
 * <p>Activation via {@code clenzy.assistant.events.public-holidays-enabled}
 * (defaut {@code true}). En cas de coupure ciblee, l'admin peut desactiver la
 * feature sans toucher au code.</p>
 */
@Component
public class PublicHolidaysClient {

    private static final Logger log = LoggerFactory.getLogger(PublicHolidaysClient.class);
    private static final Duration CACHE_TTL = Duration.ofDays(7);
    private static final String CACHE_PREFIX = "events:holidays:";

    private final RestTemplate restTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final String baseUrl;
    private final boolean enabled;

    public PublicHolidaysClient(RestTemplate restTemplate,
                                  RedisTemplate<String, Object> redisTemplate,
                                  @Value("${clenzy.assistant.events.public-holidays-base-url:https://date.nager.at}") String baseUrl,
                                  @Value("${clenzy.assistant.events.public-holidays-enabled:true}") boolean enabled) {
        this.restTemplate = restTemplate;
        this.redisTemplate = redisTemplate;
        this.baseUrl = baseUrl;
        this.enabled = enabled;
    }

    /**
     * Retourne les jours feries officiels pour {@code countryCode} sur une plage
     * de dates inclusive. La methode appelle l'API par annee complete (le
     * provider ne supporte pas le filtrage par range) puis filtre cote Java.
     *
     * @param countryCode ISO 3166 alpha-2 ("FR", "MA", "ES", ...). Insensible casse.
     * @param from        date de debut inclusive
     * @param to          date de fin inclusive
     * @return liste de jours feries dans la plage, ou liste vide si feature off
     *         OU country invalide OU appel echoue (fail-soft).
     */
    public List<PublicHoliday> findInRange(String countryCode, LocalDate from, LocalDate to) {
        if (!enabled || countryCode == null || countryCode.isBlank() || from == null || to == null) {
            return List.of();
        }
        if (from.isAfter(to)) return List.of();

        String normalizedCountry = countryCode.trim().toUpperCase(Locale.ROOT);
        if (normalizedCountry.length() != 2) {
            log.debug("PublicHolidays: countryCode '{}' invalide (attendu ISO-2)", countryCode);
            return List.of();
        }

        // Une plage peut chevaucher 2-3 annees max — on collecte chaque annee
        List<PublicHoliday> all = new ArrayList<>();
        for (int year = from.getYear(); year <= to.getYear(); year++) {
            all.addAll(fetchYear(normalizedCountry, year));
        }

        List<PublicHoliday> filtered = new ArrayList<>();
        for (PublicHoliday h : all) {
            if (h.date == null) continue;
            if (h.date.isBefore(from) || h.date.isAfter(to)) continue;
            filtered.add(h);
        }
        return filtered;
    }

    /** Fetch + cache d'une annee complete pour un pays. */
    private List<PublicHoliday> fetchYear(String countryCode, int year) {
        String cacheKey = CACHE_PREFIX + countryCode + ":" + year;
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof CachedHolidayList list) {
                return list.holidays != null ? list.holidays : List.of();
            }
        } catch (Exception e) {
            log.debug("Redis read failed for {}: {}", cacheKey, e.getMessage());
        }

        String url = baseUrl + "/api/v3/PublicHolidays/" + year + "/" + countryCode;
        try {
            NagerHoliday[] response = restTemplate.getForObject(url, NagerHoliday[].class);
            if (response == null) {
                return List.of();
            }
            List<PublicHoliday> mapped = new ArrayList<>(response.length);
            for (NagerHoliday nh : response) {
                if (nh == null || nh.date == null) continue;
                LocalDate parsed = parseDateSafe(nh.date);
                if (parsed == null) continue;
                mapped.add(new PublicHoliday(parsed,
                        nh.localName != null ? nh.localName : nh.name,
                        nh.name,
                        countryCode));
            }
            try {
                redisTemplate.opsForValue().set(cacheKey, new CachedHolidayList(mapped), CACHE_TTL);
            } catch (Exception e) {
                log.debug("Redis write failed for {}: {}", cacheKey, e.getMessage());
            }
            return mapped;
        } catch (Exception e) {
            log.warn("date.nager.at fetch failed for {}/{}: {}", countryCode, year, e.getMessage());
            return List.of();
        }
    }

    private static LocalDate parseDateSafe(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return LocalDate.parse(raw); } catch (Exception e) { return null; }
    }

    /** Indique si la feature est activee globalement (testable via getter). */
    public boolean isEnabled() {
        return enabled;
    }

    // ─── DTOs publics ───────────────────────────────────────────────────────

    /**
     * Jour ferie public expose au caller. Implements Serializable pour la
     * serialization Redis du {@link CachedHolidayList}.
     */
    public record PublicHoliday(LocalDate date, String localName, String englishName,
                                  String countryCode) implements Serializable {}

    // ─── DTOs internes ──────────────────────────────────────────────────────

    /** Wrapper serialisable pour la liste cachee Redis. */
    static final class CachedHolidayList implements Serializable {
        private static final long serialVersionUID = 1L;
        public List<PublicHoliday> holidays;

        public CachedHolidayList() {}

        public CachedHolidayList(List<PublicHoliday> holidays) {
            this.holidays = holidays;
        }
    }

    /** Mapping du JSON date.nager.at. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class NagerHoliday {
        public String date;
        public String localName;
        public String name;
        public String countryCode;
    }
}
