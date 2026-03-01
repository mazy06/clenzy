package com.clenzy.service;

import com.clenzy.dto.rate.RateCalendarDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
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

        // Charger les yield rules et LOS pour l'affichage
        List<YieldRule> yieldRules = yieldRuleRepository.findActiveByPropertyId(propertyId, orgId);

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

            // Trouver la yield rule applicable (pour info)
            final LocalDate currentDate = date;
            String appliedYieldRule = yieldRules.stream()
                    .filter(YieldRule::isActive)
                    .findFirst()
                    .map(YieldRule::getName)
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

        LocalDate today = LocalDate.now();
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
        int daysAhead = condition.has("daysAhead") ? condition.get("daysAhead").asInt() : 30;
        LocalDate targetDate = from.plusDays(daysAhead);

        if (targetDate.isAfter(to)) return;

        BigDecimal currentPrice = priceEngine.resolvePrice(property.getId(), targetDate, orgId);
        if (currentPrice == null) return;

        BigDecimal adjustedPrice = applyYieldAdjustment(currentPrice, rule);
        BigDecimal clampedPrice = rule.clampPrice(adjustedPrice);

        if (!clampedPrice.equals(currentPrice)) {
            createOrUpdateOverride(property, targetDate, currentPrice, clampedPrice, rule, orgId);
        }
    }

    private void evaluateLastMinuteFill(YieldRule rule, Property property,
                                        JsonNode condition, LocalDate from, Long orgId) {
        int daysThreshold = condition.has("withinDays") ? condition.get("withinDays").asInt() : 3;
        LocalDate limit = from.plusDays(daysThreshold);

        for (LocalDate date = from; date.isBefore(limit); date = date.plusDays(1)) {
            BigDecimal currentPrice = priceEngine.resolvePrice(property.getId(), date, orgId);
            if (currentPrice == null) continue;

            BigDecimal adjustedPrice = applyYieldAdjustment(currentPrice, rule);
            BigDecimal clampedPrice = rule.clampPrice(adjustedPrice);

            if (!clampedPrice.equals(currentPrice)) {
                createOrUpdateOverride(property, date, currentPrice, clampedPrice, rule, orgId);
            }
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

    @Transactional
    private void createOrUpdateOverride(Property property, LocalDate date,
                                        BigDecimal previousPrice, BigDecimal newPrice,
                                        YieldRule rule, Long orgId) {
        Optional<RateOverride> existing = rateOverrideRepository
                .findByPropertyIdAndDate(property.getId(), date, orgId);

        if (existing.isPresent()) {
            RateOverride override = existing.get();
            override.setNightlyPrice(newPrice);
            override.setSource("YIELD_RULE");
            rateOverrideRepository.save(override);
        } else {
            RateOverride override = new RateOverride(property, date, newPrice, "YIELD_RULE", orgId);
            override.setCreatedBy("SYSTEM");
            rateOverrideRepository.save(override);
        }

        // Audit log
        RateAuditLog auditLog = new RateAuditLog(
                orgId, property.getId(), date,
                previousPrice, newPrice,
                "YIELD_RULE", "SYSTEM", rule.getName()
        );
        rateAuditLogRepository.save(auditLog);

        log.info("YieldRule '{}' : property={} date={} {} -> {}",
                rule.getName(), property.getId(), date, previousPrice, newPrice);
    }
}
