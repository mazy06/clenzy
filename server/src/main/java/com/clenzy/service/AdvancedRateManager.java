package com.clenzy.service;

import com.clenzy.dto.rate.RateCalendarDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service d'orchestration avancee des tarifs.
 *
 * Etend la logique du PriceEngine avec :
 * - Tarifs derives par channel (ChannelRateModifier)
 * - Remises duree de sejour (LengthOfStayDiscount)
 * - Tarification par occupation (OccupancyPricing)
 * - Yield management dynamique (YieldRule)
 * - Audit de toutes les modifications (RateAuditLog)
 *
 * Le PriceEngine reste la source de verite pour le prix de base.
 * Ce service applique des couches supplementaires par-dessus.
 */
@Service
@Transactional(readOnly = true)
public class AdvancedRateManager {

    private static final Logger log = LoggerFactory.getLogger(AdvancedRateManager.class);

    /** Source des overrides ecrits par le yield management. */
    static final String YIELD_RULE_SOURCE = "YIELD_RULE";

    /**
     * Garde-fou par defaut quand minPrice/maxPrice ne sont pas configures sur la
     * regle (champs nullables, audit Z5-BUGS-02) : le prix ajuste est borne a
     * ±50% du prix de base pour eviter tout effondrement/explosion du tarif.
     */
    static final BigDecimal DEFAULT_YIELD_CLAMP_RATIO = new BigDecimal("0.50");

    /**
     * Fallback documente (audit Z5-BUGS-08) quand la propriete n'a pas de
     * timezone exploitable : aligne sur le defaut du champ {@code Property.timezone}.
     */
    static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");

    /**
     * Defauts des fenetres de ciblage quand la triggerCondition est incomplete.
     * Partages entre l'evaluation ({@code evaluateDaysBeforeArrival} /
     * {@code evaluateLastMinuteFill}) et l'affichage calendrier (Z5-BUGS-09)
     * pour garantir que les deux restent alignes.
     */
    static final int DEFAULT_DAYS_AHEAD = 30;
    static final int DEFAULT_WITHIN_DAYS = 3;

    private final PriceEngine priceEngine;
    private final ChannelRateModifierRepository channelRateModifierRepository;
    private final LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    private final OccupancyPricingRepository occupancyPricingRepository;
    private final YieldRuleRepository yieldRuleRepository;
    private final RateAuditLogRepository rateAuditLogRepository;
    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final ObjectMapper objectMapper;

    public AdvancedRateManager(PriceEngine priceEngine,
                               ChannelRateModifierRepository channelRateModifierRepository,
                               LengthOfStayDiscountRepository lengthOfStayDiscountRepository,
                               OccupancyPricingRepository occupancyPricingRepository,
                               YieldRuleRepository yieldRuleRepository,
                               RateAuditLogRepository rateAuditLogRepository,
                               RateOverrideRepository rateOverrideRepository,
                               PropertyRepository propertyRepository,
                               ObjectMapper objectMapper) {
        this.priceEngine = priceEngine;
        this.channelRateModifierRepository = channelRateModifierRepository;
        this.lengthOfStayDiscountRepository = lengthOfStayDiscountRepository;
        this.occupancyPricingRepository = occupancyPricingRepository;
        this.yieldRuleRepository = yieldRuleRepository;
        this.rateAuditLogRepository = rateAuditLogRepository;
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Resout le prix channel pour une date donnee.
     * Prix de base (PriceEngine) + modifiers channel.
     */
    public BigDecimal resolveChannelPrice(Long propertyId, LocalDate date,
                                          ChannelName channel, Long orgId) {
        BigDecimal basePrice = priceEngine.resolvePrice(propertyId, date, orgId);
        if (basePrice == null) return null;

        return applyChannelModifiers(basePrice, propertyId, date, channel, orgId);
    }

    /**
     * Resolution complete avec duree de sejour et nombre de voyageurs.
     * Applique dans l'ordre :
     * 1. Prix de base (PriceEngine)
     * 2. Modifiers channel
     * 3. Remise duree de sejour (retournee separement, appliquee sur le total)
     * 4. Supplement occupation (par nuit)
     */
    public BigDecimal resolveChannelPrice(Long propertyId, LocalDate date,
                                          ChannelName channel, int nights,
                                          int guests, Long orgId) {
        BigDecimal channelPrice = resolveChannelPrice(propertyId, date, channel, orgId);
        if (channelPrice == null) return null;

        BigDecimal occupancyAdj = calculateOccupancyAdjustment(propertyId, guests, orgId);
        return channelPrice.add(occupancyAdj);
    }

    /**
     * Resout les prix channel pour une plage de dates.
     */
    public Map<LocalDate, BigDecimal> resolveChannelPriceRange(Long propertyId, LocalDate from,
                                                                LocalDate to, ChannelName channel,
                                                                Long orgId) {
        Map<LocalDate, BigDecimal> basePrices = priceEngine.resolvePriceRange(propertyId, from, to, orgId);
        List<ChannelRateModifier> modifiers = channelRateModifierRepository
                .findByPropertyIdAndChannel(propertyId, channel, orgId);

        Map<LocalDate, BigDecimal> result = new LinkedHashMap<>();
        basePrices.forEach((date, basePrice) -> {
            if (basePrice == null) {
                result.put(date, null);
                return;
            }
            BigDecimal adjusted = applyModifierList(basePrice, modifiers, date);
            result.put(date, adjusted);
        });

        return result;
    }

    /**
     * Calendrier tarifaire complet : prix de base + tous les channels.
     */
    public List<RateCalendarDto> getRateCalendar(Long propertyId, LocalDate from,
                                                  LocalDate to, Long orgId) {
        Map<LocalDate, BigDecimal> basePrices = priceEngine.resolvePriceRange(propertyId, from, to, orgId);

        // Charger les modifiers par channel en une seule query
        List<ChannelRateModifier> allModifiers = channelRateModifierRepository
                .findActiveByPropertyId(propertyId, orgId);

        Map<ChannelName, List<ChannelRateModifier>> modifiersByChannel = allModifiers.stream()
                .collect(Collectors.groupingBy(ChannelRateModifier::getChannelName));

        // Charger les yield rules et pre-calculer leurs fenetres d'application
        List<YieldRule> yieldRules = yieldRuleRepository.findActiveByPropertyId(propertyId, orgId);
        List<YieldRuleWindow> yieldWindows = resolveYieldRuleWindows(propertyId, yieldRules);

        List<RateCalendarDto> calendar = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            final BigDecimal basePrice = basePrices.get(date);

            // Calculer le prix par channel
            Map<ChannelName, BigDecimal> channelPrices = new EnumMap<>(ChannelName.class);
            for (var entry : modifiersByChannel.entrySet()) {
                BigDecimal channelPrice = basePrice != null
                        ? applyModifierList(basePrice, entry.getValue(), date)
                        : null;
                channelPrices.put(entry.getKey(), channelPrice);
            }

            // Yield rule applicable a CETTE date (Z5-BUGS-09 : l'ancien findFirst
            // sans filtre de date affichait la meme regle sur tous les jours)
            final LocalDate currentDate = date;
            String appliedYieldRule = yieldWindows.stream()
                    .filter(window -> window.contains(currentDate))
                    .findFirst()
                    .map(YieldRuleWindow::ruleName)
                    .orElse(null);

            calendar.add(new RateCalendarDto(
                    propertyId,
                    date,
                    basePrice,
                    channelPrices,
                    null, // appliedRatePlan : necessiterait un lookup supplementaire
                    appliedYieldRule,
                    null, // occupancyAdjustment : depend du nombre de voyageurs
                    null  // losDiscount : depend de la duree
            ));
        }

        return calendar;
    }

    /**
     * Evalue et applique les regles de yield pour une propriete.
     * Cree/met a jour des RateOverrides et log les changements.
     */
    @Transactional
    public void applyYieldRules(Long propertyId, Long orgId) {
        List<YieldRule> rules = yieldRuleRepository.findActiveByPropertyId(propertyId, orgId);
        if (rules.isEmpty()) {
            log.debug("Aucune regle de yield active pour property={}", propertyId);
            return;
        }

        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            log.warn("Propriete introuvable: {}", propertyId);
            return;
        }

        // « Aujourd'hui » dans la timezone de la propriete, pas celle de la JVM
        // (audit Z5-BUGS-08) : evite les ajustements last-minute/anticipation
        // appliques au mauvais jour autour de minuit.
        LocalDate today = LocalDate.now(resolvePropertyZone(property));
        LocalDate horizon = today.plusDays(90); // 90 jours d'horizon

        for (YieldRule rule : rules) {
            evaluateYieldRule(rule, property, today, horizon, orgId);
        }
    }

    /**
     * Calcule la remise totale pour une duree de sejour.
     */
    public BigDecimal calculateLosDiscount(Long propertyId, int nights,
                                           BigDecimal totalBasePrice, Long orgId) {
        if (totalBasePrice == null || nights <= 0) return BigDecimal.ZERO;

        List<LengthOfStayDiscount> discounts = lengthOfStayDiscountRepository
                .findApplicable(propertyId, nights, orgId);

        if (discounts.isEmpty()) return BigDecimal.ZERO;

        // Prendre la remise la plus genereuse (premier resultat, tri par minNights DESC)
        LengthOfStayDiscount best = discounts.getFirst();

        return switch (best.getDiscountType()) {
            case PERCENTAGE -> totalBasePrice
                    .multiply(best.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            case FIXED_PER_NIGHT -> best.getDiscountValue()
                    .multiply(BigDecimal.valueOf(nights));
        };
    }

    /**
     * Calcule le supplement par nuit pour des voyageurs supplementaires.
     */
    public BigDecimal calculateOccupancyAdjustment(Long propertyId, int guests, Long orgId) {
        if (guests <= 0) return BigDecimal.ZERO;

        return occupancyPricingRepository.findByPropertyId(propertyId, orgId)
                .map(pricing -> pricing.calculateAdjustment(guests))
                .orElse(BigDecimal.ZERO);
    }

    // ── Methodes privees ────────────────────────────────────────────────────

    /**
     * Fenetre [fromInclusive, toExclusive) pendant laquelle une yield rule cible
     * des dates — utilisee uniquement pour l'affichage calendrier (Z5-BUGS-09).
     */
    private record YieldRuleWindow(String ruleName, LocalDate fromInclusive, LocalDate toExclusive) {
        boolean contains(LocalDate date) {
            return !date.isBefore(fromInclusive) && date.isBefore(toExclusive);
        }
    }

    /**
     * Pre-calcule les fenetres d'application des regles actives pour l'affichage
     * (Z5-BUGS-09) : « aujourd'hui » est resolu dans la timezone de la propriete,
     * comme dans {@link #applyYieldRules}.
     */
    private List<YieldRuleWindow> resolveYieldRuleWindows(Long propertyId, List<YieldRule> rules) {
        if (rules.isEmpty()) return List.of();

        LocalDate today = LocalDate.now(propertyRepository.findById(propertyId)
                .map(AdvancedRateManager::resolvePropertyZone)
                .orElse(DEFAULT_PROPERTY_ZONE));

        List<YieldRuleWindow> windows = new ArrayList<>();
        for (YieldRule rule : rules) {
            if (!rule.isActive()) continue;
            YieldRuleWindow window = toDisplayWindow(rule, today);
            if (window != null) {
                windows.add(window);
            }
        }
        return windows;
    }

    /**
     * Reproduit la fenetre de ciblage du moteur ({@link #evaluateDaysBeforeArrival},
     * {@link #evaluateLastMinuteFill}) pour l'affichage. OCCUPANCY_THRESHOLD et
     * GAP_FILL ne sont pas evalues par le moteur (donnees d'occupation requises) :
     * ils ne sont donc jamais affiches comme appliques (Z5-BUGS-09).
     */
    private YieldRuleWindow toDisplayWindow(YieldRule rule, LocalDate today) {
        try {
            JsonNode condition = objectMapper.readTree(rule.getTriggerCondition());
            return switch (rule.getRuleType()) {
                case DAYS_BEFORE_ARRIVAL -> {
                    int daysAhead = condition.has("daysAhead")
                            ? condition.get("daysAhead").asInt() : DEFAULT_DAYS_AHEAD;
                    LocalDate target = today.plusDays(daysAhead);
                    yield new YieldRuleWindow(rule.getName(), target, target.plusDays(1));
                }
                case LAST_MINUTE_FILL -> {
                    int withinDays = condition.has("withinDays")
                            ? condition.get("withinDays").asInt() : DEFAULT_WITHIN_DAYS;
                    yield new YieldRuleWindow(rule.getName(), today, today.plusDays(withinDays));
                }
                case OCCUPANCY_THRESHOLD, GAP_FILL -> null;
            };
        } catch (JsonProcessingException e) {
            log.warn("TriggerCondition illisible pour yield rule '{}' (id={}) : {}",
                    rule.getName(), rule.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Timezone de la propriete ; fallback {@link #DEFAULT_PROPERTY_ZONE} si la
     * timezone est absente ou invalide (audit Z5-BUGS-08).
     */
    private static ZoneId resolvePropertyZone(Property property) {
        String timezone = property.getTimezone();
        if (timezone == null || timezone.isBlank()) {
            return DEFAULT_PROPERTY_ZONE;
        }
        try {
            return ZoneId.of(timezone);
        } catch (DateTimeException e) {
            log.warn("Timezone invalide '{}' pour property={}, fallback {}",
                    timezone, property.getId(), DEFAULT_PROPERTY_ZONE);
            return DEFAULT_PROPERTY_ZONE;
        }
    }

    private BigDecimal applyChannelModifiers(BigDecimal basePrice, Long propertyId,
                                             LocalDate date, ChannelName channel, Long orgId) {
        List<ChannelRateModifier> modifiers = channelRateModifierRepository
                .findByPropertyIdAndChannel(propertyId, channel, orgId);

        return applyModifierList(basePrice, modifiers, date);
    }

    private BigDecimal applyModifierList(BigDecimal price, List<ChannelRateModifier> modifiers,
                                         LocalDate date) {
        BigDecimal result = price;
        for (ChannelRateModifier modifier : modifiers) {
            if (modifier.appliesTo(date)) {
                result = modifier.applyTo(result);
            }
        }
        return result;
    }

    private void evaluateYieldRule(YieldRule rule, Property property,
                                   LocalDate from, LocalDate to, Long orgId) {
        try {
            JsonNode condition = objectMapper.readTree(rule.getTriggerCondition());

            switch (rule.getRuleType()) {
                case DAYS_BEFORE_ARRIVAL -> evaluateDaysBeforeArrival(rule, property, condition, from, to, orgId);
                case LAST_MINUTE_FILL -> evaluateLastMinuteFill(rule, property, condition, from, orgId);
                case OCCUPANCY_THRESHOLD, GAP_FILL -> {
                    // Ces types necessitent des donnees d'occupation (reservations).
                    // Implementation simplifiee : log et skip.
                    log.debug("YieldRule type {} necessite des donnees d'occupation, skip pour property={}",
                            rule.getRuleType(), property.getId());
                }
            }
        } catch (Exception e) {
            log.error("Erreur evaluation yield rule '{}' pour property={}: {}",
                    rule.getName(), property.getId(), e.getMessage());
        }
    }

    private void evaluateDaysBeforeArrival(YieldRule rule, Property property,
                                           JsonNode condition, LocalDate from,
                                           LocalDate to, Long orgId) {
        int daysAhead = condition.has("daysAhead") ? condition.get("daysAhead").asInt() : DEFAULT_DAYS_AHEAD;
        LocalDate targetDate = from.plusDays(daysAhead);

        if (targetDate.isAfter(to)) return;

        applyYieldRuleToDate(rule, property, targetDate, orgId);
    }

    private void evaluateLastMinuteFill(YieldRule rule, Property property,
                                        JsonNode condition, LocalDate from, Long orgId) {
        int daysThreshold = condition.has("withinDays") ? condition.get("withinDays").asInt() : DEFAULT_WITHIN_DAYS;
        LocalDate limit = from.plusDays(daysThreshold);

        for (LocalDate date = from; date.isBefore(limit); date = date.plusDays(1)) {
            applyYieldRuleToDate(rule, property, date, orgId);
        }
    }

    /**
     * Applique une regle de yield a une date, de facon idempotente (audit Z5-BUGS-02) :
     * <ul>
     *   <li>l'ajustement est calcule depuis le prix de base HORS overrides
     *       YIELD_RULE — deux runs successifs produisent le meme prix (pas de
     *       derive composee sur le resultat du run precedent) ;</li>
     *   <li>un override d'une autre source (MANUAL, EXTERNAL_PRICING, OTA:*)
     *       n'est JAMAIS ecrase par le yield ;</li>
     *   <li>si la regle n'a pas de minPrice/maxPrice, un garde-fou ±50% du prix
     *       de base est applique ({@link #DEFAULT_YIELD_CLAMP_RATIO}).</li>
     * </ul>
     */
    private void applyYieldRuleToDate(YieldRule rule, Property property, LocalDate date, Long orgId) {
        Optional<RateOverride> existing = rateOverrideRepository
                .findByPropertyIdAndDate(property.getId(), date, orgId);

        if (existing.isPresent() && !YIELD_RULE_SOURCE.equals(existing.get().getSource())) {
            log.debug("YieldRule '{}' : override source={} existant pour property={} date={}, non ecrase",
                    rule.getName(), existing.get().getSource(), property.getId(), date);
            return;
        }

        BigDecimal basePrice = priceEngine.resolvePrice(property.getId(), date, orgId,
                Set.of(YIELD_RULE_SOURCE));
        if (basePrice == null) return;

        BigDecimal adjustedPrice = applyYieldAdjustment(basePrice, rule);
        BigDecimal clampedPrice = clampWithDefaultBounds(adjustedPrice, basePrice, rule);

        BigDecimal currentPrice = existing.map(RateOverride::getNightlyPrice).orElse(basePrice);
        if (clampedPrice.compareTo(currentPrice) != 0) {
            createOrUpdateOverride(property, date, currentPrice, clampedPrice,
                    existing.orElse(null), rule, orgId);
        }
    }

    private BigDecimal applyYieldAdjustment(BigDecimal price, YieldRule rule) {
        return switch (rule.getAdjustmentType()) {
            case PERCENTAGE -> {
                BigDecimal adj = price.multiply(rule.getAdjustmentValue())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                yield price.add(adj).max(BigDecimal.ZERO);
            }
            case FIXED_AMOUNT -> price.add(rule.getAdjustmentValue()).max(BigDecimal.ZERO);
        };
    }

    /**
     * Applique les bornes de la regle, puis le garde-fou par defaut ±50% du prix
     * de base pour chaque borne absente (minPrice/maxPrice nullables).
     */
    private BigDecimal clampWithDefaultBounds(BigDecimal adjustedPrice, BigDecimal basePrice,
                                              YieldRule rule) {
        BigDecimal clamped = rule.clampPrice(adjustedPrice);

        if (rule.getMinPrice() == null) {
            BigDecimal floor = basePrice.multiply(BigDecimal.ONE.subtract(DEFAULT_YIELD_CLAMP_RATIO))
                    .setScale(2, RoundingMode.HALF_UP);
            if (clamped.compareTo(floor) < 0) {
                clamped = floor;
            }
        }
        if (rule.getMaxPrice() == null) {
            BigDecimal ceiling = basePrice.multiply(BigDecimal.ONE.add(DEFAULT_YIELD_CLAMP_RATIO))
                    .setScale(2, RoundingMode.HALF_UP);
            if (clamped.compareTo(ceiling) > 0) {
                clamped = ceiling;
            }
        }
        return clamped;
    }

    private void createOrUpdateOverride(Property property, LocalDate date,
                                        BigDecimal previousPrice, BigDecimal newPrice,
                                        RateOverride existingOverride,
                                        YieldRule rule, Long orgId) {
        if (existingOverride != null) {
            existingOverride.setNightlyPrice(newPrice);
            existingOverride.setSource(YIELD_RULE_SOURCE);
            rateOverrideRepository.save(existingOverride);
        } else {
            RateOverride override = new RateOverride(property, date, newPrice, YIELD_RULE_SOURCE, orgId);
            override.setCreatedBy("SYSTEM");
            rateOverrideRepository.save(override);
        }

        // Audit log
        RateAuditLog auditLog = new RateAuditLog(
                orgId, property.getId(), date,
                previousPrice, newPrice,
                YIELD_RULE_SOURCE, "SYSTEM", rule.getName()
        );
        rateAuditLogRepository.save(auditLog);

        log.info("YieldRule '{}' : property={} date={} {} -> {}",
                rule.getName(), property.getId(), date, previousPrice, newPrice);
    }
}
