package com.clenzy.service;

import com.clenzy.model.RateOverride;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Moteur de resolution de prix par nuit.
 *
 * Algorithme de resolution pour un (propertyId, date) :
 * 1. RateOverride (prix specifique par date — priorite maximale)
 * 2. RatePlan PROMOTIONAL (offre promo active, plus haute priorite)
 * 3. RatePlan SEASONAL (tarif saisonnier)
 * 4. RatePlan LAST_MINUTE (tarif derniere minute)
 * 5. RatePlan BASE (tarif de base)
 * 6. Property.nightlyPrice (fallback compatibilite arriere)
 *
 * Pour les calculs sur plage, les queries sont batch-optimisees :
 * 2 queries max (overrides + plans) puis resolution en memoire.
 */
@Service
@Transactional(readOnly = true)
public class PriceEngine {

    private static final Logger log = LoggerFactory.getLogger(PriceEngine.class);

    /** Ordre de resolution des types de plans (du plus prioritaire au fallback) */
    private static final List<RatePlanType> TYPE_PRIORITY = List.of(
            RatePlanType.PROMOTIONAL,
            RatePlanType.SEASONAL,
            RatePlanType.LAST_MINUTE,
            RatePlanType.BASE
    );

    private final RateOverrideRepository rateOverrideRepository;
    private final RatePlanRepository ratePlanRepository;
    private final PropertyRepository propertyRepository;

    public PriceEngine(RateOverrideRepository rateOverrideRepository,
                       RatePlanRepository ratePlanRepository,
                       PropertyRepository propertyRepository) {
        this.rateOverrideRepository = rateOverrideRepository;
        this.ratePlanRepository = ratePlanRepository;
        this.propertyRepository = propertyRepository;
    }

    /**
     * Resout le prix par nuit pour une date specifique.
     *
     * @param propertyId propriete cible
     * @param date       date a resoudre
     * @param orgId      organisation
     * @return prix par nuit, ou null si aucun prix n'est applicable
     */
    public BigDecimal resolvePrice(Long propertyId, LocalDate date, Long orgId) {
        // 1. Override specifique (priorite max)
        Optional<RateOverride> override = rateOverrideRepository.findByPropertyIdAndDate(propertyId, date, orgId);
        if (override.isPresent()) {
            return override.get().getNightlyPrice();
        }

        // 2-5. Rate plans par type de priorite
        List<RatePlan> plans = ratePlanRepository.findActiveByPropertyId(propertyId, orgId);
        for (RatePlanType type : TYPE_PRIORITY) {
            Optional<BigDecimal> price = plans.stream()
                    .filter(p -> p.getType() == type && p.appliesTo(date))
                    .max(Comparator.comparingInt(RatePlan::getPriority))
                    .map(RatePlan::getNightlyPrice);
            if (price.isPresent()) {
                return price.get();
            }
        }

        // 6. Fallback : Property.nightlyPrice
        return propertyRepository.findById(propertyId)
                .map(p -> p.getNightlyPrice())
                .orElse(null);
    }

    /**
     * Resout les prix pour une plage de dates [from, to).
     * Optimise avec 2 queries batch + resolution en memoire.
     *
     * @param propertyId propriete cible
     * @param from       premier jour (inclus)
     * @param to         dernier jour (exclus)
     * @param orgId      organisation
     * @return map date → prix par nuit (les dates sans prix ont la valeur null)
     */
    public Map<LocalDate, BigDecimal> resolvePriceRange(Long propertyId, LocalDate from,
                                                          LocalDate to, Long orgId) {
        // Batch : charger tous les overrides et plans en 2 queries
        List<RateOverride> overrides = rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId);
        Map<LocalDate, BigDecimal> overrideMap = overrides.stream()
                .collect(Collectors.toMap(RateOverride::getDate, RateOverride::getNightlyPrice));

        List<RatePlan> plans = ratePlanRepository.findActiveByPropertyId(propertyId, orgId);

        // Fallback Property price
        BigDecimal propertyPrice = propertyRepository.findById(propertyId)
                .map(p -> p.getNightlyPrice())
                .orElse(null);

        // Resolution en memoire pour chaque date
        Map<LocalDate, BigDecimal> result = new LinkedHashMap<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            // 1. Override
            if (overrideMap.containsKey(date)) {
                result.put(date, overrideMap.get(date));
                continue;
            }

            // 2-5. Plans par type
            BigDecimal resolved = null;
            final LocalDate currentDate = date;
            for (RatePlanType type : TYPE_PRIORITY) {
                Optional<BigDecimal> price = plans.stream()
                        .filter(p -> p.getType() == type && p.appliesTo(currentDate))
                        .max(Comparator.comparingInt(RatePlan::getPriority))
                        .map(RatePlan::getNightlyPrice);
                if (price.isPresent()) {
                    resolved = price.get();
                    break;
                }
            }

            // 6. Fallback
            result.put(date, resolved != null ? resolved : propertyPrice);
        }

        return result;
    }
}
