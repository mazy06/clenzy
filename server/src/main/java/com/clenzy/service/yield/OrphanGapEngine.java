package com.clenzy.service.yield;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.MinNightsOverride;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.RateOverride;
import com.clenzy.model.YieldOrgConfig;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.service.PriceEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Orphan gap pricing (RMS R2) — automatisation DÉTERMINISTE et RÉVERSIBLE :
 * un creux court (1..{@code orphanGapMaxNights} nuits libres ENTRE deux nuits
 * occupées) est difficile à vendre au tarif nominal — on y applique une remise
 * (bornée par le floor du bien) et on abaisse le min-stay à la longueur du creux
 * pour le rendre réservable (pattern PriceLabs).
 *
 * <p>Réversible par construction : les écritures portent la source
 * {@value #SOURCE} (rate_overrides + min_nights_overrides) et sont supprimées au
 * run suivant dès que le creux disparaît (réservé, voisin libéré, feature OFF le
 * lendemain via l'absence de nouveau run... les résidus sont nettoyés au
 * ré-enable). Mêmes protections que le yield v1 : les overrides MANUAL / OTA /
 * externes ne sont JAMAIS touchés, une nuit occupée n'est jamais re-tarifée,
 * floor obligatoire (sinon skip). Transaction par bien (REQUIRES_NEW).</p>
 */
@Service
public class OrphanGapEngine {

    private static final Logger log = LoggerFactory.getLogger(OrphanGapEngine.class);

    static final String SOURCE = "ORPHAN_GAP";
    /** Horizon d'évaluation : les creux au-delà de 60 j ont le temps de se vendre. */
    static final int HORIZON_DAYS = 60;

    private final PropertyRepository propertyRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final RateOverrideRepository rateOverrideRepository;
    private final MinNightsOverrideRepository minNightsOverrideRepository;
    private final PriceEngine priceEngine;
    private final TransactionTemplate perPropertyTx;

    public OrphanGapEngine(PropertyRepository propertyRepository,
                           CalendarDayRepository calendarDayRepository,
                           RateOverrideRepository rateOverrideRepository,
                           MinNightsOverrideRepository minNightsOverrideRepository,
                           PriceEngine priceEngine,
                           PlatformTransactionManager transactionManager) {
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.rateOverrideRepository = rateOverrideRepository;
        this.minNightsOverrideRepository = minNightsOverrideRepository;
        this.priceEngine = priceEngine;
        this.perPropertyTx = new TransactionTemplate(transactionManager);
        this.perPropertyTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** À appeler DANS un contexte tenant. Un échec par bien n'interrompt pas les autres. */
    public void evaluateOrganization(YieldOrgConfig config, LocalDate today) {
        final Long orgId = config.getOrganizationId();
        for (Property property : propertyRepository.findByOrganizationIdAndStatus(orgId, PropertyStatus.ACTIVE)) {
            try {
                perPropertyTx.executeWithoutResult(status -> evaluateProperty(config, property, today, orgId));
            } catch (RuntimeException e) {
                log.error("Orphan gap : échec org={} property={} : {}", orgId, property.getId(), e.getMessage());
            }
        }
    }

    private void evaluateProperty(YieldOrgConfig config, Property property, LocalDate today, Long orgId) {
        if (property.getYieldPriceFloor() == null) {
            log.debug("Orphan gap : property={} sans floor — skip", property.getId());
            return;
        }
        final LocalDate horizonInclusive = today.plusDays(HORIZON_DAYS - 1L);
        final List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), today, horizonInclusive, orgId);
        final Set<LocalDate> occupied = days.stream()
                .filter(d -> d.getStatus() != CalendarDayStatus.AVAILABLE)
                .map(CalendarDay::getDate)
                .collect(Collectors.toSet());

        final Map<LocalDate, Integer> orphans =
                findOrphanGaps(occupied, today, HORIZON_DAYS, config.getOrphanGapMaxNights());

        final Map<LocalDate, RateOverride> rateByDate = rateOverrideRepository
                .findByPropertyIdAndDateRange(property.getId(), today, horizonInclusive, orgId).stream()
                .collect(Collectors.toMap(RateOverride::getDate, Function.identity(), (a, b) -> a));
        final Map<LocalDate, MinNightsOverride> minByDate = minNightsOverrideRepository
                .findByPropertyIdAndDateRange(property.getId(), today, horizonInclusive.plusDays(1), orgId).stream()
                .collect(Collectors.toMap(MinNightsOverride::getDate, Function.identity(), (a, b) -> a));

        int applied = 0;
        for (Map.Entry<LocalDate, Integer> orphan : orphans.entrySet()) {
            final LocalDate date = orphan.getKey();
            final int gapNights = orphan.getValue();
            if (applyPrice(config, property, date, rateByDate.get(date), orgId)) {
                applied++;
            }
            applyMinStay(property, date, gapNights, minByDate.get(date), orgId);
        }

        final int cleaned = cleanup(orphans.keySet(), rateByDate, minByDate);
        if (applied > 0 || cleaned > 0) {
            log.info("Orphan gap : org={} property={} — {} nuit(s) remisée(s), {} résidu(s) nettoyé(s)",
                    orgId, property.getId(), applied, cleaned);
        }
    }

    /** @return true si un override de prix a été posé/mis à jour. */
    private boolean applyPrice(YieldOrgConfig config, Property property, LocalDate date,
                               RateOverride existing, Long orgId) {
        if (existing != null && !SOURCE.equals(existing.getSource())) {
            return false; // override MANUAL / OTA / yield : jamais écrasé
        }
        final BigDecimal base = priceEngine.resolvePrice(property.getId(), date, orgId, Set.of(SOURCE));
        if (base == null) {
            return false;
        }
        final BigDecimal target = discounted(base, config.getOrphanGapDiscountPct(), property.getYieldPriceFloor());
        final RateOverride override = existing != null ? existing
                : new RateOverride(property, date, target, SOURCE, orgId);
        override.setNightlyPrice(target);
        override.setSource(SOURCE);
        override.setCurrency(property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR");
        override.setCreatedBy("system:orphan-gap");
        rateOverrideRepository.save(override);
        return true;
    }

    private void applyMinStay(Property property, LocalDate date, int gapNights,
                              MinNightsOverride existing, Long orgId) {
        final Integer baseMinNights = property.getMinimumNights();
        if (baseMinNights == null || baseMinNights <= gapNights) {
            return; // le creux est déjà réservable au min-stay nominal
        }
        if (existing == null) {
            minNightsOverrideRepository.save(
                    new MinNightsOverride(property, date, gapNights, SOURCE, orgId));
        } else if (SOURCE.equals(existing.getSource()) && existing.getMinNights() != gapNights) {
            existing.setMinNights(gapNights);
            minNightsOverrideRepository.save(existing);
        }
        // Autre source (MANUAL, événement) : jamais écrasée.
    }

    /** Supprime les écritures {@value #SOURCE} dont le creux n'existe plus. */
    private int cleanup(Set<LocalDate> orphanDates,
                        Map<LocalDate, RateOverride> rateByDate,
                        Map<LocalDate, MinNightsOverride> minByDate) {
        int cleaned = 0;
        for (RateOverride override : rateByDate.values()) {
            if (SOURCE.equals(override.getSource()) && !orphanDates.contains(override.getDate())) {
                rateOverrideRepository.delete(override);
                cleaned++;
            }
        }
        for (MinNightsOverride override : minByDate.values()) {
            if (SOURCE.equals(override.getSource()) && !orphanDates.contains(override.getDate())) {
                minNightsOverrideRepository.delete(override);
                cleaned++;
            }
        }
        return cleaned;
    }

    // ── Cœur pur (testable sans base) ───────────────────────────────────────

    /**
     * Creux orphelins : chaque run de nuits LIBRES de longueur 1..{@code maxGapNights}
     * strictement ENCADRÉ par deux nuits occupées, dans [start, start+horizon).
     *
     * @return map nuit orpheline -> longueur du creux auquel elle appartient
     */
    static Map<LocalDate, Integer> findOrphanGaps(Set<LocalDate> occupied, LocalDate start,
                                                  int horizonDays, int maxGapNights) {
        final Map<LocalDate, Integer> orphans = new LinkedHashMap<>();
        final LocalDate endExclusive = start.plusDays(horizonDays);
        LocalDate cursor = start;
        while (cursor.isBefore(endExclusive)) {
            if (occupied.contains(cursor)) {
                cursor = cursor.plusDays(1);
                continue;
            }
            // Début d'un run libre : l'étendre.
            final LocalDate runStart = cursor;
            LocalDate runEnd = cursor;
            while (runEnd.plusDays(1).isBefore(endExclusive) && !occupied.contains(runEnd.plusDays(1))) {
                runEnd = runEnd.plusDays(1);
            }
            final int length = (int) (runEnd.toEpochDay() - runStart.toEpochDay() + 1);
            final boolean boundedBefore = occupied.contains(runStart.minusDays(1));
            final boolean boundedAfter = occupied.contains(runEnd.plusDays(1));
            if (boundedBefore && boundedAfter && length <= maxGapNights) {
                for (LocalDate d = runStart; !d.isAfter(runEnd); d = d.plusDays(1)) {
                    orphans.put(d, length);
                }
            }
            cursor = runEnd.plusDays(1);
        }
        return orphans;
    }

    static BigDecimal discounted(BigDecimal base, BigDecimal discountPct, BigDecimal floor) {
        final BigDecimal factor = BigDecimal.ONE.subtract(
                discountPct.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
        final BigDecimal target = base.multiply(factor).setScale(2, RoundingMode.HALF_UP);
        return floor != null && target.compareTo(floor) < 0 ? floor : target;
    }
}
