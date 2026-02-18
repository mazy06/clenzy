package com.clenzy.service;

import com.clenzy.dto.PricingConfigDto;
import com.clenzy.model.PricingConfig;
import com.clenzy.repository.PricingConfigRepository;
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

    // ─── Default values (identical to current QuoteController hardcoded values) ──

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

    // ─── Default forfait configs (mirrors current hardcoded values in frontend) ──

    private static final List<PricingConfigDto.ForfaitConfig> DEFAULT_FORFAIT_CONFIGS;

    static {
        DEFAULT_FORFAIT_CONFIGS = new ArrayList<>();

        // Forfait Standard
        PricingConfigDto.ForfaitConfig standard = new PricingConfigDto.ForfaitConfig();
        standard.setKey("CLEANING");
        standard.setLabel("Standard");
        standard.setCoeffMin(1.0);
        standard.setCoeffMax(1.0);
        standard.setServiceTypes(List.of("CLEANING", "FLOOR_CLEANING", "BATHROOM_CLEANING", "KITCHEN_CLEANING"));
        standard.setIncludedPrestations(List.of("laundry", "exterior"));
        standard.setExtraPrestations(List.of("ironing", "deepKitchen", "disinfection", "windows", "frenchDoors", "slidingDoors"));
        standard.setEligibleTeamIds(List.of());
        standard.setSurcharges(new LinkedHashMap<>(Map.of(
                "perBedroom", 5.0, "perBathroom", 4.0, "perFloor", 8.0,
                "exterior", 12.0, "laundry", 8.0, "perGuestAbove4", 3.0
        )));
        standard.setSurfaceBasePrices(List.of(
                new PricingConfigDto.SurfaceBasePrice(30, 35),
                new PricingConfigDto.SurfaceBasePrice(50, 45),
                new PricingConfigDto.SurfaceBasePrice(70, 55),
                new PricingConfigDto.SurfaceBasePrice(100, 70),
                new PricingConfigDto.SurfaceBasePrice(150, 90),
                new PricingConfigDto.SurfaceBasePrice(null, 110)
        ));
        DEFAULT_FORFAIT_CONFIGS.add(standard);

        // Forfait Express
        PricingConfigDto.ForfaitConfig express = new PricingConfigDto.ForfaitConfig();
        express.setKey("EXPRESS_CLEANING");
        express.setLabel("Express");
        express.setCoeffMin(0.7);
        express.setCoeffMax(0.85);
        express.setServiceTypes(List.of("EXPRESS_CLEANING"));
        express.setIncludedPrestations(List.of());
        express.setExtraPrestations(List.of("laundry", "exterior", "ironing", "deepKitchen", "disinfection", "windows", "frenchDoors", "slidingDoors"));
        express.setEligibleTeamIds(List.of());
        express.setSurcharges(new LinkedHashMap<>(Map.of(
                "perBedroom", 5.0, "perBathroom", 4.0, "perFloor", 8.0,
                "exterior", 12.0, "laundry", 8.0, "perGuestAbove4", 3.0
        )));
        express.setSurfaceBasePrices(List.of(
                new PricingConfigDto.SurfaceBasePrice(30, 35),
                new PricingConfigDto.SurfaceBasePrice(50, 45),
                new PricingConfigDto.SurfaceBasePrice(70, 55),
                new PricingConfigDto.SurfaceBasePrice(100, 70),
                new PricingConfigDto.SurfaceBasePrice(150, 90),
                new PricingConfigDto.SurfaceBasePrice(null, 110)
        ));
        DEFAULT_FORFAIT_CONFIGS.add(express);

        // Forfait En profondeur
        PricingConfigDto.ForfaitConfig deep = new PricingConfigDto.ForfaitConfig();
        deep.setKey("DEEP_CLEANING");
        deep.setLabel("En profondeur");
        deep.setCoeffMin(1.4);
        deep.setCoeffMax(1.7);
        deep.setServiceTypes(List.of("DEEP_CLEANING", "WINDOW_CLEANING"));
        deep.setIncludedPrestations(List.of("laundry", "exterior", "ironing", "deepKitchen", "windows", "frenchDoors", "slidingDoors"));
        deep.setExtraPrestations(List.of("disinfection"));
        deep.setEligibleTeamIds(List.of());
        deep.setSurcharges(new LinkedHashMap<>(Map.of(
                "perBedroom", 5.0, "perBathroom", 4.0, "perFloor", 8.0,
                "exterior", 12.0, "laundry", 8.0, "perGuestAbove4", 3.0
        )));
        deep.setSurfaceBasePrices(List.of(
                new PricingConfigDto.SurfaceBasePrice(30, 35),
                new PricingConfigDto.SurfaceBasePrice(50, 45),
                new PricingConfigDto.SurfaceBasePrice(70, 55),
                new PricingConfigDto.SurfaceBasePrice(100, 70),
                new PricingConfigDto.SurfaceBasePrice(150, 90),
                new PricingConfigDto.SurfaceBasePrice(null, 110)
        ));
        DEFAULT_FORFAIT_CONFIGS.add(deep);
    }

    public PricingConfigService(PricingConfigRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
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
        PricingConfig config = repository.findTopByOrderByIdDesc()
                .orElse(new PricingConfig());
        applyFromDto(config, dto);
        config = repository.save(config);
        log.info("Configuration tarifaire mise a jour (id={})", config.getId());
        return toDto(config);
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

        // Tiers are sorted by maxSurface ascending, last tier has null maxSurface (">X")
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

        dto.setForfaitConfigs(parseForfaitJson(entity.getForfaitConfigs(), DEFAULT_FORFAIT_CONFIGS));

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
        dto.setForfaitConfigs(new ArrayList<>(DEFAULT_FORFAIT_CONFIGS));
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

    private List<PricingConfigDto.ForfaitConfig> parseForfaitJson(String json, List<PricingConfigDto.ForfaitConfig> fallback) {
        if (json == null || json.isBlank()) return new ArrayList<>(fallback);
        try {
            return objectMapper.readValue(json, new TypeReference<List<PricingConfigDto.ForfaitConfig>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Erreur parsing JSON forfait configs, fallback aux defaults: {}", e.getMessage());
            return new ArrayList<>(fallback);
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

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.error("Erreur serialisation JSON: {}", e.getMessage());
            return "{}";
        }
    }
}
