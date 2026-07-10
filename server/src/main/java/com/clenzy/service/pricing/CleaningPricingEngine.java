package com.clenzy.service.pricing;

import com.clenzy.model.HousekeeperRate;
import com.clenzy.model.Property;
import com.clenzy.repository.HousekeeperRateRepository;
import com.clenzy.service.PricingConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Moteur Ménage unifié (Phase 1A — PLAN-MOTEUR-MENAGE.md).
 *
 * <p>Un SEUL calcul produit la durée ET le prix :
 * <b>minutes normées par composant du logement × taux horaire org × multiplicateur
 * type de ménage → {durationMinutes, recommended, min, max}</b>.</p>
 *
 * <p>Il remplace les formules divergentes historiques (estimateCleaningCost forfait×coeffs,
 * estimateCleaningPrice front). Les minutes par composant portent l'algo front
 * {@code computeEstimatedDuration} (CleaningPriceEstimator), simplifié v1 : fenêtres/
 * portes/repassage/désinfection ignorés.</p>
 *
 * <p><b>Calibration</b> (défauts, réf. « Appartement Duplex Marrakech ≈ 95 € », propriété 3 dev,
 * profil : 2 chambres, 1 SDB, 50 m², duplex = 2 niveaux) :
 * minutes = base(2 ch)=120 + étage sup. 15 = 135 min ;
 * prix CLEANING = 135/60 h × 42 €/h × 1.0 = 94,50 € → arrondi au multiple de 5 → <b>95 €</b>.
 * D'où DEFAULT_HOURLY_RATE = 42.0.</p>
 *
 * <p>Point d'extension Phase 2 : l'étage tarif prestataire (housekeeper_rate, forfait
 * par propriété prioritaire) s'insérera dans {@link #resolveCleaningPrice} AVANT
 * l'override logement — voir l'ordre de résolution du plan.</p>
 */
@Service
public class CleaningPricingEngine {

    private static final Logger log = LoggerFactory.getLogger(CleaningPricingEngine.class);

    // ─── Défauts de config (utilisés si cleaning_engine_config est NULL/partiel) ──
    /** Taux horaire de référence — calibré Marrakech ≈ 95 € (voir Javadoc classe). */
    static final double DEFAULT_HOURLY_RATE = 42.0;
    static final Map<String, Integer> DEFAULT_BASE_BY_BEDROOMS = Map.of(
            "0", 90, "1", 90, "2", 120, "3", 150, "4", 180, "5plus", 210);
    static final int DEFAULT_PER_EXTRA_BATHROOM = 15;
    static final int DEFAULT_SURFACE_THRESHOLD_SQM = 80;
    static final int DEFAULT_PER_SURFACE_STEP_SQM = 5;
    static final int DEFAULT_SURFACE_STEP_MINUTES = 1;
    static final int DEFAULT_PER_EXTRA_FLOOR = 15;
    static final int DEFAULT_EXTERIOR_MINUTES = 20;
    static final int DEFAULT_LAUNDRY_MINUTES = 15;
    static final int DEFAULT_PER_GUEST_ABOVE_4 = 5;
    static final Map<String, Double> DEFAULT_TYPE_MULTIPLIERS = Map.of(
            "EXPRESS_CLEANING", 0.65, "CLEANING", 1.0, "DEEP_CLEANING", 1.6);
    static final int DEFAULT_RANGE_PERCENT = 15;
    static final int DEFAULT_ROUND_TO = 5;
    static final int DEFAULT_MIN_PRICE = 30;

    /** Type de ménage standard (multiplicateur 1.0) — celui des snapshots. */
    public static final String STANDARD_CLEANING = "CLEANING";

    // ─── Records du contrat public ────────────────────────────────────────────

    /** Composants du logement nécessaires au calcul (tolérant : null accepté partout). */
    public record CleaningInputs(
            Integer bedrooms,
            Integer bathrooms,
            Integer squareMeters,
            Integer floors,
            Boolean hasExterior,
            Boolean hasLaundry,
            Integer maxGuests) {

        public static CleaningInputs fromProperty(Property property) {
            return new CleaningInputs(
                    property.getBedroomCount(),
                    property.getBathroomCount(),
                    property.getSquareMeters(),
                    property.getNumberOfFloors(),
                    property.getHasExterior(),
                    property.getHasLaundry(),
                    property.getMaxGuests());
        }
    }

    /** Résultat du moteur : durée normée + prix conseillé + fourchette. */
    public record CleaningQuote(
            int durationMinutes,
            BigDecimal recommended,
            BigDecimal min,
            BigDecimal max) {
    }

    /** Provenance du prix résolu. (HOUSEKEEPER_RATE viendra en Phase 2.) */
    public enum CleaningPriceSource { HOUSEKEEPER_RATE, PROPERTY_OVERRIDE, ENGINE }

    /** Prix résolu d'une intervention ménage + provenance + quote (conseil) associée. */
    public record ResolvedCleaningPrice(
            BigDecimal amount,
            CleaningPriceSource source,
            CleaningQuote quote) {
    }

    // ─── Config effective (défauts + surcharge JSON org) ──────────────────────

    /** Config effective du moteur, après application des défauts champ à champ. */
    record EngineConfig(
            double hourlyRate,
            Map<String, Integer> baseByBedrooms,
            int perExtraBathroom,
            int surfaceThresholdSqm,
            int perSurfaceStepSqm,
            int surfaceStepMinutes,
            int perExtraFloor,
            int exteriorMinutes,
            int laundryMinutes,
            int perGuestAbove4,
            Map<String, Double> typeMultipliers,
            int rangePercent,
            int roundTo,
            int minPrice) {

        static EngineConfig defaults() {
            return new EngineConfig(
                    DEFAULT_HOURLY_RATE, DEFAULT_BASE_BY_BEDROOMS,
                    DEFAULT_PER_EXTRA_BATHROOM, DEFAULT_SURFACE_THRESHOLD_SQM,
                    DEFAULT_PER_SURFACE_STEP_SQM, DEFAULT_SURFACE_STEP_MINUTES,
                    DEFAULT_PER_EXTRA_FLOOR, DEFAULT_EXTERIOR_MINUTES,
                    DEFAULT_LAUNDRY_MINUTES, DEFAULT_PER_GUEST_ABOVE_4,
                    DEFAULT_TYPE_MULTIPLIERS, DEFAULT_RANGE_PERCENT,
                    DEFAULT_ROUND_TO, DEFAULT_MIN_PRICE);
        }
    }

    private final PricingConfigService pricingConfigService;
    private final ObjectMapper objectMapper;
    private final HousekeeperRateRepository housekeeperRateRepository;

    public CleaningPricingEngine(PricingConfigService pricingConfigService,
                                 ObjectMapper objectMapper,
                                 HousekeeperRateRepository housekeeperRateRepository) {
        this.pricingConfigService = pricingConfigService;
        this.objectMapper = objectMapper;
        this.housekeeperRateRepository = housekeeperRateRepository;
    }

    // ─── API publique ──────────────────────────────────────────────────────────

    /** Devis moteur pour un logement (inputs extraits de l'entité). */
    public CleaningQuote quote(Property property, String cleaningType) {
        return quote(CleaningInputs.fromProperty(property), cleaningType);
    }

    /** Devis moteur : minutes normées × taux horaire × multiplicateur type. */
    public CleaningQuote quote(CleaningInputs inputs, String cleaningType) {
        EngineConfig config = currentConfig();
        return quoteWith(config, inputs, cleaningType);
    }

    /**
     * Décomposition transparente des minutes par composant (preview / documents).
     * Clés stables : base, bathrooms, surface, floors, exterior, laundry, guests.
     */
    public Map<String, Integer> minutesBreakdown(CleaningInputs inputs) {
        return minutesBreakdownWith(currentConfig(), inputs);
    }

    /** Taux horaire de référence effectif de l'org (config ou défaut plateforme). */
    public double referenceHourlyRate() {
        return currentConfig().hourlyRate();
    }

    /**
     * Prix résolu d'une intervention ménage pour un logement (sans prestataire connu) :
     * 1) override du logement ({@code cleaningBasePrice} > 0) ;
     * 2) sinon prix conseillé du moteur (médiane, jamais null).
     * La quote (conseil) est toujours renvoyée pour le snapshot recommended_cost.
     */
    public ResolvedCleaningPrice resolveCleaningPrice(Property property, String cleaningType) {
        return resolveCleaningPrice(property, cleaningType, null);
    }

    /**
     * Prix résolu avec l'étage tarif PRESTATAIRE (Phase 2A, pattern Turno) :
     * 1) forfait (user, property) — exprimé pour le ménage STANDARD, dérivé par le
     *    ratio des multiplicateurs si {@code cleaningType} ≠ CLEANING ;
     * 2) taux horaire général du pro × durée normée du logement × multiplicateur type
     *    (arrondi/plancher moteur) ;
     * 3) sinon résolution existante : override logement → conseil moteur.
     */
    public ResolvedCleaningPrice resolveCleaningPrice(Property property, String cleaningType, Long housekeeperUserId) {
        CleaningQuote quote = quote(property, cleaningType);

        if (housekeeperUserId != null && property.getOrganizationId() != null) {
            EngineConfig config = currentConfig();

            // 1) Forfait par logement (prime sur le taux horaire).
            HousekeeperRate flat = housekeeperRateRepository
                    .findByOrganizationIdAndUserIdAndPropertyId(property.getOrganizationId(), housekeeperUserId, property.getId())
                    .filter(r -> r.getUnit() == HousekeeperRate.RateUnit.FLAT)
                    .orElse(null);
            if (flat != null && flat.getAmount() != null && flat.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal amount = flat.getAmount();
                double ratio = typeMultiplierRatio(config, cleaningType);
                if (ratio != 1.0) {
                    // Forfait standard × ratio (ex. express 0.65/1.0) puis arrondi moteur.
                    amount = roundAndFloor(amount.doubleValue() * ratio, config);
                }
                return new ResolvedCleaningPrice(amount, CleaningPriceSource.HOUSEKEEPER_RATE, quote);
            }

            // 2) Taux horaire général : durée normée × taux pro × multiplicateur type.
            HousekeeperRate hourly = housekeeperRateRepository
                    .findByOrganizationIdAndUserIdAndPropertyIdIsNull(property.getOrganizationId(), housekeeperUserId)
                    .filter(r -> r.getUnit() == HousekeeperRate.RateUnit.HOURLY)
                    .orElse(null);
            if (hourly != null && hourly.getAmount() != null && hourly.getAmount().compareTo(BigDecimal.ZERO) > 0) {
                double multiplier = config.typeMultipliers()
                        .getOrDefault(cleaningType != null ? cleaningType : STANDARD_CLEANING,
                                config.typeMultipliers().getOrDefault(STANDARD_CLEANING, 1.0));
                double raw = (quote.durationMinutes() / 60.0) * hourly.getAmount().doubleValue() * multiplier;
                return new ResolvedCleaningPrice(roundAndFloor(raw, config), CleaningPriceSource.HOUSEKEEPER_RATE, quote);
            }
        }

        // 3) Résolution existante : override logement → conseil moteur.
        BigDecimal basePrice = property.getCleaningBasePrice();
        if (basePrice != null && basePrice.compareTo(BigDecimal.ZERO) > 0) {
            return new ResolvedCleaningPrice(basePrice, CleaningPriceSource.PROPERTY_OVERRIDE, quote);
        }
        return new ResolvedCleaningPrice(quote.recommended(), CleaningPriceSource.ENGINE, quote);
    }

    /** Ratio multiplicateur(type) / multiplicateur(CLEANING) — dérive un forfait standard vers un autre type. */
    private double typeMultiplierRatio(EngineConfig config, String cleaningType) {
        double standard = config.typeMultipliers().getOrDefault(STANDARD_CLEANING, 1.0);
        double target = config.typeMultipliers()
                .getOrDefault(cleaningType != null ? cleaningType : STANDARD_CLEANING, standard);
        return standard != 0 ? target / standard : 1.0;
    }

    // ─── Calcul ────────────────────────────────────────────────────────────────

    CleaningQuote quoteWith(EngineConfig config, CleaningInputs inputs, String cleaningType) {
        int minutes = totalMinutes(config, inputs);
        double multiplier = config.typeMultipliers()
                .getOrDefault(cleaningType != null ? cleaningType : STANDARD_CLEANING,
                        config.typeMultipliers().getOrDefault(STANDARD_CLEANING, 1.0));

        double rawPrice = (minutes / 60.0) * config.hourlyRate() * multiplier;
        BigDecimal recommended = roundAndFloor(rawPrice, config);
        // Fourchette ancrée sur la MÉDIANE (recommended), pas le plancher.
        BigDecimal min = roundAndFloor(recommended.doubleValue() * (1 - config.rangePercent() / 100.0), config);
        BigDecimal max = roundAndFloor(recommended.doubleValue() * (1 + config.rangePercent() / 100.0), config);
        if (max.compareTo(recommended) < 0) max = recommended;
        if (min.compareTo(recommended) > 0) min = recommended;
        return new CleaningQuote(minutes, recommended, min, max);
    }

    Map<String, Integer> minutesBreakdownWith(EngineConfig config, CleaningInputs inputs) {
        Map<String, Integer> parts = new LinkedHashMap<>();
        int bedrooms = orZero(inputs.bedrooms());
        int bathrooms = orZero(inputs.bathrooms());
        int sqm = orZero(inputs.squareMeters());
        int floors = orZero(inputs.floors());
        int guests = orZero(inputs.maxGuests());

        parts.put("base", baseMinutes(config, bedrooms));
        parts.put("bathrooms", bathrooms > 1 ? (bathrooms - 1) * config.perExtraBathroom() : 0);
        parts.put("surface", sqm > config.surfaceThresholdSqm()
                ? ((sqm - config.surfaceThresholdSqm()) / config.perSurfaceStepSqm()) * config.surfaceStepMinutes()
                : 0);
        parts.put("floors", floors > 1 ? (floors - 1) * config.perExtraFloor() : 0);
        parts.put("exterior", Boolean.TRUE.equals(inputs.hasExterior()) ? config.exteriorMinutes() : 0);
        parts.put("laundry", Boolean.TRUE.equals(inputs.hasLaundry()) ? config.laundryMinutes() : 0);
        parts.put("guests", guests > 4 ? (guests - 4) * config.perGuestAbove4() : 0);
        return parts;
    }

    private int totalMinutes(EngineConfig config, CleaningInputs inputs) {
        return minutesBreakdownWith(config, inputs).values().stream().mapToInt(Integer::intValue).sum();
    }

    private int baseMinutes(EngineConfig config, int bedrooms) {
        Map<String, Integer> base = config.baseByBedrooms();
        String key = bedrooms >= 5 ? "5plus" : String.valueOf(bedrooms);
        Integer minutes = base.get(key);
        if (minutes == null) minutes = base.get("1");
        return minutes != null ? minutes : 90;
    }

    private BigDecimal roundAndFloor(double price, EngineConfig config) {
        double floored = Math.max(price, config.minPrice());
        long rounded = Math.round(floored / config.roundTo()) * config.roundTo();
        // L'arrondi ne doit pas re-passer sous le plancher (ex. minPrice 32, roundTo 5 → 30).
        if (rounded < config.minPrice()) rounded += config.roundTo();
        return BigDecimal.valueOf(rounded);
    }

    private static int orZero(Integer v) {
        return v != null ? v : 0;
    }

    // ─── Lecture de la config org (JSON partiel toléré, défauts champ à champ) ──

    EngineConfig currentConfig() {
        String json = pricingConfigService.getCleaningEngineConfigJson();
        if (json == null || json.isBlank()) return EngineConfig.defaults();
        try {
            return parseConfig(objectMapper.readTree(json));
        } catch (Exception e) {
            log.warn("cleaning_engine_config JSON invalide, fallback aux defauts: {}", e.getMessage());
            return EngineConfig.defaults();
        }
    }

    private EngineConfig parseConfig(JsonNode root) {
        JsonNode cm = root.path("componentMinutes");

        Map<String, Integer> baseByBedrooms = DEFAULT_BASE_BY_BEDROOMS;
        if (cm.hasNonNull("baseByBedrooms")) {
            Map<String, Integer> parsed = new LinkedHashMap<>();
            cm.get("baseByBedrooms").fields()
                    .forEachRemaining(e -> parsed.put(e.getKey(), e.getValue().asInt()));
            if (!parsed.isEmpty()) baseByBedrooms = parsed;
        }

        Map<String, Double> multipliers = DEFAULT_TYPE_MULTIPLIERS;
        if (root.hasNonNull("cleaningTypeMultipliers")) {
            Map<String, Double> parsed = new LinkedHashMap<>();
            root.get("cleaningTypeMultipliers").fields()
                    .forEachRemaining(e -> parsed.put(e.getKey(), e.getValue().asDouble()));
            if (!parsed.isEmpty()) multipliers = parsed;
        }

        return new EngineConfig(
                root.path("hourlyRate").asDouble(DEFAULT_HOURLY_RATE),
                baseByBedrooms,
                cm.path("perExtraBathroom").asInt(DEFAULT_PER_EXTRA_BATHROOM),
                cm.path("surfaceThresholdSqm").asInt(DEFAULT_SURFACE_THRESHOLD_SQM),
                cm.path("perSurfaceStepSqm").asInt(DEFAULT_PER_SURFACE_STEP_SQM),
                cm.path("surfaceStepMinutes").asInt(DEFAULT_SURFACE_STEP_MINUTES),
                cm.path("perExtraFloor").asInt(DEFAULT_PER_EXTRA_FLOOR),
                cm.path("exterior").asInt(DEFAULT_EXTERIOR_MINUTES),
                cm.path("laundry").asInt(DEFAULT_LAUNDRY_MINUTES),
                cm.path("perGuestAbove4").asInt(DEFAULT_PER_GUEST_ABOVE_4),
                multipliers,
                root.path("rangePercent").asInt(DEFAULT_RANGE_PERCENT),
                root.path("roundTo").asInt(DEFAULT_ROUND_TO),
                root.path("minPrice").asInt(DEFAULT_MIN_PRICE));
    }
}
