package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.model.PricingConfig;
import com.clenzy.repository.PricingConfigRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
public class PricingConfigService {

    private static final Logger log = LoggerFactory.getLogger(PricingConfigService.class);

    private final PricingConfigRepository repository;
    private final ObjectMapper objectMapper;
    private final TenantContext tenantContext;

    // ─── Scalar defaults (kept for QuoteController helper methods) ────────────

    private static final Map<String, Double> DEFAULT_PROPERTY_TYPE_COEFFS = Map.of(
            "studio", 0.85, "appartement", 1.0, "maison", 1.15,
            "duplex", 1.20, "villa", 1.35, "autre", 1.0
    );

    private static final Map<String, Double> DEFAULT_PROPERTY_COUNT_COEFFS = Map.of(
            "1", 1.0, "2", 0.95, "3-5", 0.90, "6+", 0.85
    );

    private static final Map<String, Double> DEFAULT_GUEST_CAPACITY_COEFFS = Map.of(
            "1-2", 0.90, "3-4", 1.0, "5-6", 1.10, "7+", 1.25
    );

    private static final Map<String, Double> DEFAULT_FREQUENCY_COEFFS = Map.of(
            "tres-frequent", 0.85, "regulier", 0.92,
            "nouvelle-annonce", 1.0, "occasionnel", 1.10
    );

    private static final List<PricingConfigDto.SurfaceTier> DEFAULT_SURFACE_TIERS = List.of(
            new PricingConfigDto.SurfaceTier(40, 0.85, "< 40 m²"),
            new PricingConfigDto.SurfaceTier(60, 1.0, "40 - 60 m²"),
            new PricingConfigDto.SurfaceTier(80, 1.10, "61 - 80 m²"),
            new PricingConfigDto.SurfaceTier(120, 1.20, "81 - 120 m²"),
            new PricingConfigDto.SurfaceTier(null, 1.35, "> 120 m²")
    );

    private static final int DEFAULT_BASE_ESSENTIEL = 50;
    private static final int DEFAULT_BASE_CONFORT = 75;
    private static final int DEFAULT_BASE_PREMIUM = 100;
    private static final int DEFAULT_MIN_PRICE = 50;
    private static final int DEFAULT_PMS_MONTHLY_CENTS = 500;
    private static final int DEFAULT_PMS_SYNC_CENTS = 1000;

    // NOTE: DEFAULT_FORFAIT_CONFIGS, DEFAULT_TRAVAUX_CONFIG, DEFAULT_EXTERIEUR_CONFIG,
    // DEFAULT_BLANCHISSERIE_CONFIG, DEFAULT_COMMISSION_CONFIGS have been removed.
    // These are now seeded directly in the database via V36 migration.
    // JSON parse methods now fall back to empty lists when data is null.

    public PricingConfigService(PricingConfigRepository repository, ObjectMapper objectMapper,
                               TenantContext tenantContext) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.tenantContext = tenantContext;
    }

    // ─── Public API ────────────────────────────────────────────────

    @Cacheable(value = "pricingConfig", key = "'current'")
    @Transactional(readOnly = true)
    public PricingConfigDto getCurrentConfig() {
        return repository.findTopByOrderByIdDesc()
                .map(this::toDto)
                .orElseGet(this::buildDefaultDto);
    }

    @CacheEvict(value = "pricingConfig", allEntries = true)
    public PricingConfigDto updateConfig(PricingConfigDto dto) {
        validatePricingBounds(dto);
        PricingConfig config = repository.findTopByOrderByIdDesc()
                .orElse(new PricingConfig());
        applyFromDto(config, dto);
        config.setOrganizationId(tenantContext.getRequiredOrganizationId());
        config = repository.save(config);
        log.info("Configuration tarifaire mise a jour (id={})", config.getId());
        return toDto(config);
    }

    private void validatePricingBounds(PricingConfigDto dto) {
        if (dto.getBasePriceEssentiel() != null && (dto.getBasePriceEssentiel() < 0 || dto.getBasePriceEssentiel() > 100_000)) {
            throw new IllegalArgumentException("basePriceEssentiel hors limites (0-100000)");
        }
        if (dto.getBasePriceConfort() != null && (dto.getBasePriceConfort() < 0 || dto.getBasePriceConfort() > 100_000)) {
            throw new IllegalArgumentException("basePriceConfort hors limites (0-100000)");
        }
        if (dto.getBasePricePremium() != null && (dto.getBasePricePremium() < 0 || dto.getBasePricePremium() > 100_000)) {
            throw new IllegalArgumentException("basePricePremium hors limites (0-100000)");
        }
        if (dto.getMinPrice() != null && (dto.getMinPrice() < 0 || dto.getMinPrice() > 100_000)) {
            throw new IllegalArgumentException("minPrice hors limites (0-100000)");
        }
        if (dto.getPmsMonthlyPriceCents() != null && (dto.getPmsMonthlyPriceCents() < 0 || dto.getPmsMonthlyPriceCents() > 10_000_00)) {
            throw new IllegalArgumentException("pmsMonthlyPriceCents hors limites (0-1000000)");
        }
        if (dto.getPmsSyncPriceCents() != null && (dto.getPmsSyncPriceCents() < 0 || dto.getPmsSyncPriceCents() > 10_000_00)) {
            throw new IllegalArgumentException("pmsSyncPriceCents hors limites (0-1000000)");
        }
        // Validate coefficients are positive and reasonable (0.01 to 100.0)
        validateCoeffMap(dto.getPropertyTypeCoeffs(), "propertyTypeCoeffs");
        validateCoeffMap(dto.getPropertyCountCoeffs(), "propertyCountCoeffs");
        validateCoeffMap(dto.getGuestCapacityCoeffs(), "guestCapacityCoeffs");
        validateCoeffMap(dto.getFrequencyCoeffs(), "frequencyCoeffs");
    }

    private void validateCoeffMap(Map<String, Double> coeffs, String fieldName) {
        if (coeffs == null) return;
        for (Map.Entry<String, Double> entry : coeffs.entrySet()) {
            if (entry.getValue() == null || entry.getValue() < 0.01 || entry.getValue() > 100.0) {
                throw new IllegalArgumentException(fieldName + " : coefficient '" + entry.getKey() + "' hors limites (0.01-100.0)");
            }
        }
    }

    // ─── Helper methods for QuoteController ────────────────────────

    public Map<String, Integer> getBasePrices() {
        PricingConfigDto dto = getCurrentConfig();
        Map<String, Integer> map = new HashMap<>();
        map.put("essentiel", dto.getBasePriceEssentiel() != null ? dto.getBasePriceEssentiel() : DEFAULT_BASE_ESSENTIEL);
        map.put("confort", dto.getBasePriceConfort() != null ? dto.getBasePriceConfort() : DEFAULT_BASE_CONFORT);
        map.put("premium", dto.getBasePricePremium() != null ? dto.getBasePricePremium() : DEFAULT_BASE_PREMIUM);
        return map;
    }

    public Map<String, Double> getPropertyTypeCoeffs() {
        PricingConfigDto dto = getCurrentConfig();
        return dto.getPropertyTypeCoeffs() != null ? dto.getPropertyTypeCoeffs() : DEFAULT_PROPERTY_TYPE_COEFFS;
    }

    public Map<String, Double> getPropertyCountCoeffs() {
        PricingConfigDto dto = getCurrentConfig();
        return dto.getPropertyCountCoeffs() != null ? dto.getPropertyCountCoeffs() : DEFAULT_PROPERTY_COUNT_COEFFS;
    }

    public Map<String, Double> getGuestCapacityCoeffs() {
        PricingConfigDto dto = getCurrentConfig();
        return dto.getGuestCapacityCoeffs() != null ? dto.getGuestCapacityCoeffs() : DEFAULT_GUEST_CAPACITY_COEFFS;
    }

    public Map<String, Double> getFrequencyCoeffs() {
        PricingConfigDto dto = getCurrentConfig();
        return dto.getFrequencyCoeffs() != null ? dto.getFrequencyCoeffs() : DEFAULT_FREQUENCY_COEFFS;
    }

    public double getSurfaceCoeff(int surface) {
        PricingConfigDto dto = getCurrentConfig();
        List<PricingConfigDto.SurfaceTier> tiers = dto.getSurfaceTiers() != null
                ? dto.getSurfaceTiers() : DEFAULT_SURFACE_TIERS;

        for (PricingConfigDto.SurfaceTier tier : tiers) {
            if (tier.getMaxSurface() == null) {
                return tier.getCoeff() != null ? tier.getCoeff() : 1.0;
            }
            if (surface < tier.getMaxSurface()) {
                return tier.getCoeff() != null ? tier.getCoeff() : 1.0;
            }
        }
        return 1.0;
    }

    public int getMinPrice() {
        PricingConfigDto dto = getCurrentConfig();
        return dto.getMinPrice() != null ? dto.getMinPrice() : DEFAULT_MIN_PRICE;
    }

    public int getPmsMonthlyPriceCents() {
        PricingConfigDto dto = getCurrentConfig();
        return dto.getPmsMonthlyPriceCents() != null ? dto.getPmsMonthlyPriceCents() : DEFAULT_PMS_MONTHLY_CENTS;
    }

    // ─── Conversion: Entity -> DTO ─────────────────────────────────

    private PricingConfigDto toDto(PricingConfig entity) {
        PricingConfigDto dto = new PricingConfigDto();
        dto.setId(entity.getId());

        dto.setPropertyTypeCoeffs(parseMapJson(entity.getPropertyTypeCoeffs(), DEFAULT_PROPERTY_TYPE_COEFFS));
        dto.setPropertyCountCoeffs(parseMapJson(entity.getPropertyCountCoeffs(), DEFAULT_PROPERTY_COUNT_COEFFS));
        dto.setGuestCapacityCoeffs(parseMapJson(entity.getGuestCapacityCoeffs(), DEFAULT_GUEST_CAPACITY_COEFFS));
        dto.setFrequencyCoeffs(parseMapJson(entity.getFrequencyCoeffs(), DEFAULT_FREQUENCY_COEFFS));
        dto.setSurfaceTiers(parseTiersJson(entity.getSurfaceTiers(), DEFAULT_SURFACE_TIERS));

        dto.setBasePriceEssentiel(entity.getBasePriceEssentiel() != null ? entity.getBasePriceEssentiel() : DEFAULT_BASE_ESSENTIEL);
        dto.setBasePriceConfort(entity.getBasePriceConfort() != null ? entity.getBasePriceConfort() : DEFAULT_BASE_CONFORT);
        dto.setBasePricePremium(entity.getBasePricePremium() != null ? entity.getBasePricePremium() : DEFAULT_BASE_PREMIUM);
        dto.setMinPrice(entity.getMinPrice() != null ? entity.getMinPrice() : DEFAULT_MIN_PRICE);

        dto.setPmsMonthlyPriceCents(entity.getPmsMonthlyPriceCents() != null ? entity.getPmsMonthlyPriceCents() : DEFAULT_PMS_MONTHLY_CENTS);
        dto.setPmsSyncPriceCents(entity.getPmsSyncPriceCents() != null ? entity.getPmsSyncPriceCents() : DEFAULT_PMS_SYNC_CENTS);

        dto.setAutomationBasicSurcharge(entity.getAutomationBasicSurcharge() != null ? entity.getAutomationBasicSurcharge() : 0);
        dto.setAutomationFullSurcharge(entity.getAutomationFullSurcharge() != null ? entity.getAutomationFullSurcharge() : 0);

        // DB-driven lists — fallback to empty list (data is seeded via V36 migration)
        dto.setForfaitConfigs(parseListJson(entity.getForfaitConfigs(), new TypeReference<List<PricingConfigDto.ForfaitConfig>>() {}));
        dto.setTravauxConfig(parseListJson(entity.getTravauxConfig(), new TypeReference<List<PricingConfigDto.ServicePriceConfig>>() {}));
        dto.setExterieurConfig(parseListJson(entity.getExterieurConfig(), new TypeReference<List<PricingConfigDto.ServicePriceConfig>>() {}));
        dto.setBlanchisserieConfig(parseListJson(entity.getBlanchisserieConfig(), new TypeReference<List<PricingConfigDto.BlanchisserieItem>>() {}));
        dto.setCommissionConfigs(parseListJson(entity.getCommissionConfigs(), new TypeReference<List<PricingConfigDto.CommissionConfig>>() {}));
        dto.setAvailablePrestations(parseListJson(entity.getAvailablePrestations(), new TypeReference<List<PricingConfigDto.PrestationOption>>() {}));
        dto.setAvailableSurcharges(parseListJson(entity.getAvailableSurcharges(), new TypeReference<List<PricingConfigDto.SurchargeOption>>() {}));

        dto.setUpdatedAt(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null);

        return dto;
    }

    // ─── Conversion: DTO -> Entity ─────────────────────────────────

    private void applyFromDto(PricingConfig entity, PricingConfigDto dto) {
        if (dto.getPropertyTypeCoeffs() != null) {
            entity.setPropertyTypeCoeffs(toJson(dto.getPropertyTypeCoeffs()));
        }
        if (dto.getPropertyCountCoeffs() != null) {
            entity.setPropertyCountCoeffs(toJson(dto.getPropertyCountCoeffs()));
        }
        if (dto.getGuestCapacityCoeffs() != null) {
            entity.setGuestCapacityCoeffs(toJson(dto.getGuestCapacityCoeffs()));
        }
        if (dto.getFrequencyCoeffs() != null) {
            entity.setFrequencyCoeffs(toJson(dto.getFrequencyCoeffs()));
        }
        if (dto.getSurfaceTiers() != null) {
            entity.setSurfaceTiers(toJson(dto.getSurfaceTiers()));
        }

        if (dto.getBasePriceEssentiel() != null) entity.setBasePriceEssentiel(dto.getBasePriceEssentiel());
        if (dto.getBasePriceConfort() != null) entity.setBasePriceConfort(dto.getBasePriceConfort());
        if (dto.getBasePricePremium() != null) entity.setBasePricePremium(dto.getBasePricePremium());
        if (dto.getMinPrice() != null) entity.setMinPrice(dto.getMinPrice());

        if (dto.getPmsMonthlyPriceCents() != null) entity.setPmsMonthlyPriceCents(dto.getPmsMonthlyPriceCents());
        if (dto.getPmsSyncPriceCents() != null) entity.setPmsSyncPriceCents(dto.getPmsSyncPriceCents());

        if (dto.getAutomationBasicSurcharge() != null) entity.setAutomationBasicSurcharge(dto.getAutomationBasicSurcharge());
        if (dto.getAutomationFullSurcharge() != null) entity.setAutomationFullSurcharge(dto.getAutomationFullSurcharge());

        if (dto.getForfaitConfigs() != null) {
            entity.setForfaitConfigs(toJson(dto.getForfaitConfigs()));
        }
        if (dto.getTravauxConfig() != null) {
            entity.setTravauxConfig(toJson(dto.getTravauxConfig()));
        }
        if (dto.getExterieurConfig() != null) {
            entity.setExterieurConfig(toJson(dto.getExterieurConfig()));
        }
        if (dto.getBlanchisserieConfig() != null) {
            entity.setBlanchisserieConfig(toJson(dto.getBlanchisserieConfig()));
        }
        if (dto.getCommissionConfigs() != null) {
            entity.setCommissionConfigs(toJson(dto.getCommissionConfigs()));
        }
        if (dto.getAvailablePrestations() != null) {
            entity.setAvailablePrestations(toJson(dto.getAvailablePrestations()));
        }
        if (dto.getAvailableSurcharges() != null) {
            entity.setAvailableSurcharges(toJson(dto.getAvailableSurcharges()));
        }
    }

    // ─── Default DTO ───────────────────────────────────────────────

    private PricingConfigDto buildDefaultDto() {
        PricingConfigDto dto = new PricingConfigDto();
        dto.setPropertyTypeCoeffs(new LinkedHashMap<>(DEFAULT_PROPERTY_TYPE_COEFFS));
        dto.setPropertyCountCoeffs(new LinkedHashMap<>(DEFAULT_PROPERTY_COUNT_COEFFS));
        dto.setGuestCapacityCoeffs(new LinkedHashMap<>(DEFAULT_GUEST_CAPACITY_COEFFS));
        dto.setFrequencyCoeffs(new LinkedHashMap<>(DEFAULT_FREQUENCY_COEFFS));
        dto.setSurfaceTiers(new ArrayList<>(DEFAULT_SURFACE_TIERS));
        dto.setBasePriceEssentiel(DEFAULT_BASE_ESSENTIEL);
        dto.setBasePriceConfort(DEFAULT_BASE_CONFORT);
        dto.setBasePricePremium(DEFAULT_BASE_PREMIUM);
        dto.setMinPrice(DEFAULT_MIN_PRICE);
        dto.setPmsMonthlyPriceCents(DEFAULT_PMS_MONTHLY_CENTS);
        dto.setPmsSyncPriceCents(DEFAULT_PMS_SYNC_CENTS);
        dto.setAutomationBasicSurcharge(0);
        dto.setAutomationFullSurcharge(0);
        // DB-driven lists — return empty (data will be seeded on first save)
        dto.setForfaitConfigs(new ArrayList<>());
        dto.setTravauxConfig(new ArrayList<>());
        dto.setExterieurConfig(new ArrayList<>());
        dto.setBlanchisserieConfig(new ArrayList<>());
        dto.setCommissionConfigs(new ArrayList<>());
        dto.setAvailablePrestations(new ArrayList<>());
        dto.setAvailableSurcharges(new ArrayList<>());
        return dto;
    }

    // ─── JSON helpers ──────────────────────────────────────────────

    private Map<String, Double> parseMapJson(String json, Map<String, Double> fallback) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>(fallback);
        try {
            return objectMapper.readValue(json, new TypeReference<LinkedHashMap<String, Double>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Erreur parsing JSON coefficients, fallback aux defaults: {}", e.getMessage());
            return new LinkedHashMap<>(fallback);
        }
    }

    private List<PricingConfigDto.SurfaceTier> parseTiersJson(String json, List<PricingConfigDto.SurfaceTier> fallback) {
        if (json == null || json.isBlank()) return new ArrayList<>(fallback);
        try {
            return objectMapper.readValue(json, new TypeReference<List<PricingConfigDto.SurfaceTier>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Erreur parsing JSON surface tiers, fallback aux defaults: {}", e.getMessage());
            return new ArrayList<>(fallback);
        }
    }

    /**
     * Generic JSON list parser — returns empty list when json is null/blank.
     * Used for all DB-driven catalogs (forfaits, travaux, exterieur, blanchisserie,
     * commissions, available prestations, available surcharges).
     */
    private <T> List<T> parseListJson(String json, TypeReference<List<T>> typeRef) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (JsonProcessingException e) {
            log.warn("Erreur parsing JSON list, retour liste vide: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("Erreur serialisation JSON: {}", e.getMessage());
            return "{}";
        }
    }
}
