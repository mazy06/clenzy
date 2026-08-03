package com.clenzy.service.agent.supervision;

import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/**
 * Règles de scan DÉTERMINISTES pricing (vague B de la constellation métiers) :
 * <ul>
 *   <li><b>Séjour minimum week-end</b> (agent Revenue) : fenêtre à forte occupation
 *       sans aucun override min-stay → carte {@code MIN_STAY_RESTRICTION} (min 2 nuits
 *       les vendredis/samedis — les nuits isolées partent en séjours d'une nuit à fort
 *       coût de ménage) ;</li>
 *   <li><b>Promotions qui se cannibalisent</b> (agent Revenue) : early bird ET
 *       last-minute actifs sur des fenêtres qui se recouvrent → carte
 *       {@code PROMO_DEACTIVATE} ciblant l'early bird (prioritaire dans le PriceEngine,
 *       c'est lui qui écrase l'autre) ;</li>
 *   <li><b>Promo last-minute</b> (agent Croissance) : semaine à venir quasi vide sans
 *       plan LAST_MINUTE actif → carte {@code PRICE_DROP} bornée (−15 % sur 7 jours,
 *       prix re-résolus et floor respecté à l'apply par le handler existant).</li>
 * </ul>
 *
 * <p>Zéro coût token. Dédup par intitulé stable. Best-effort par règle.</p>
 */
@Service
public class RevenuePlanScanner {

    private static final Logger log = LoggerFactory.getLogger(RevenuePlanScanner.class);

    /** Fenêtre d'analyse du min-stay et seuil d'occupation qui déclenche la carte. */
    static final int MIN_STAY_WINDOW_DAYS = 30;
    static final double MIN_STAY_OCCUPANCY_THRESHOLD = 0.6;
    /** Fenêtre de la promo last-minute et occupation maximale qui la déclenche. */
    static final int LAST_MINUTE_WINDOW_DAYS = 7;
    static final int LAST_MINUTE_MAX_BOOKED = 2;
    static final int LAST_MINUTE_PERCENT = 15;

    private final CalendarDayRepository calendarDayRepository;
    private final MinNightsOverrideRepository minNightsOverrideRepository;
    private final RatePlanRepository ratePlanRepository;
    private final com.clenzy.repository.MarketDataSnapshotRepository marketDataSnapshotRepository;
    private final com.clenzy.repository.PropertyRepository propertyRepository;
    private final com.clenzy.service.PriceEngine priceEngine;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public RevenuePlanScanner(CalendarDayRepository calendarDayRepository,
                              MinNightsOverrideRepository minNightsOverrideRepository,
                              RatePlanRepository ratePlanRepository,
                              com.clenzy.repository.MarketDataSnapshotRepository marketDataSnapshotRepository,
                              com.clenzy.repository.PropertyRepository propertyRepository,
                              com.clenzy.service.PriceEngine priceEngine,
                              SupervisionSuggestionService suggestionService,
                              Clock clock) {
        this.calendarDayRepository = calendarDayRepository;
        this.minNightsOverrideRepository = minNightsOverrideRepository;
        this.ratePlanRepository = ratePlanRepository;
        this.marketDataSnapshotRepository = marketDataSnapshotRepository;
        this.propertyRepository = propertyRepository;
        this.priceEngine = priceEngine;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /** Évalue les trois règles pour un logement. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            scanMinStay(orgId, propertyId);
        } catch (Exception e) {
            log.debug("min-stay scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
        try {
            scanCannibalPromos(orgId, propertyId);
        } catch (Exception e) {
            log.debug("promo scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
        try {
            scanLastMinutePromo(orgId, propertyId);
        } catch (Exception e) {
            log.debug("last-minute scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
        try {
            scanMarketAlign(orgId, propertyId);
        } catch (Exception e) {
            log.debug("market align scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
    }

    /** Sous-tarification vs marché : on propose une hausse quand on est ≥ 15 % sous l'ADR. */
    static final java.math.BigDecimal MARKET_UNDERPRICED_RATIO = new java.math.BigDecimal("0.85");
    /** Cible de la hausse (95 % de l'ADR marché — jamais collé au médian) et plafond. */
    static final java.math.BigDecimal MARKET_TARGET_RATIO = new java.math.BigDecimal("0.95");
    static final int MARKET_MAX_RAISE_PERCENT = 10;
    static final int MARKET_MIN_RAISE_PERCENT = 3;

    /**
     * MARKET_ALIGN (vague C) — alignement sur le marché local : l'ADR k-anonyme de la
     * ville (chantier market data, échantillon ≥ 5 annonces garanti à l'ingestion) est
     * comparé à NOTRE prix moyen résolu sur 30 jours. Sous-tarification ≥ 15 % → carte
     * {@code PRICE_DROP} direction HAUSSE (handler existant : prix re-résolus et bornés
     * à l'apply), hausse bornée à {@value #MARKET_MAX_RAISE_PERCENT} %.
     */
    private void scanMarketAlign(Long orgId, Long propertyId) {
        final var property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || property.getOrganizationId() == null
                || !property.getOrganizationId().equals(orgId)
                || property.getCity() == null || property.getCity().isBlank()) {
            return;
        }
        final String month = java.time.YearMonth.from(LocalDate.now(clock)).toString();
        final java.math.BigDecimal marketAdr = marketDataSnapshotRepository
                .findLatestByArea(property.getCity().strip()).stream()
                .filter(s -> month.equals(s.getStayMonth()) && s.getAdr() != null)
                .map(com.clenzy.model.MarketDataSnapshot::getAdr)
                .findFirst().orElse(null);
        if (marketAdr == null || marketAdr.signum() <= 0) {
            return; // pas de photo marché pour la ville ce mois-ci
        }
        final LocalDate today = LocalDate.now(clock);
        final var prices = priceEngine.resolvePriceRange(propertyId, today, today.plusDays(30), orgId);
        if (prices.isEmpty()) {
            return;
        }
        final java.math.BigDecimal ourAvg = prices.values().stream()
                .filter(p -> p != null && p.signum() > 0)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)
                .divide(java.math.BigDecimal.valueOf(prices.size()), 2, java.math.RoundingMode.HALF_UP);
        if (ourAvg.signum() <= 0
                || ourAvg.compareTo(marketAdr.multiply(MARKET_UNDERPRICED_RATIO)) >= 0) {
            return; // pas (assez) sous le marché
        }
        final int percent = Math.min(MARKET_MAX_RAISE_PERCENT,
                marketAdr.multiply(MARKET_TARGET_RATIO)
                        .divide(ourAvg, 4, java.math.RoundingMode.HALF_UP)
                        .subtract(java.math.BigDecimal.ONE)
                        .movePointRight(2)
                        .setScale(0, java.math.RoundingMode.DOWN)
                        .intValue());
        if (percent < MARKET_MIN_RAISE_PERCENT) {
            return; // hausse trop faible pour mériter une carte
        }
        suggestionService.recordActionable(
                orgId, propertyId, "rev",
                "Alignement marché — " + property.getCity().strip(),
                "ADR du marché local " + marketAdr + " € (échantillon anonymisé ≥ 5 annonces), "
                        + "votre prix moyen résolu " + ourAvg + " € sur 30 jours. « Appliquer » "
                        + "hausse de " + percent + " % ces nuits — prix re-résolus et plafonds "
                        + "respectés au moment de l'application.",
                SupervisionActionType.PRICE_DROP,
                "{\"direction\":\"up\",\"segments\":[{\"from\":\"" + today + "\",\"to\":\""
                        + today.plusDays(30) + "\",\"percent\":" + percent + "}]}",
                null, "info");
    }

    private void scanMinStay(Long orgId, Long propertyId) {
        final LocalDate today = LocalDate.now(clock);
        final LocalDate to = today.plusDays(MIN_STAY_WINDOW_DAYS);
        final int booked = calendarDayRepository
                .findBookedDatesInRange(propertyId, today, to, orgId).size();
        if ((double) booked / MIN_STAY_WINDOW_DAYS < MIN_STAY_OCCUPANCY_THRESHOLD) {
            return; // demande insuffisante : restreindre ferait perdre des séjours courts
        }
        if (!minNightsOverrideRepository
                .findByPropertyIdAndDateRange(propertyId, today, to, orgId).isEmpty()) {
            return; // des overrides existent déjà (manuels ou moteurs) — on ne se superpose pas
        }
        suggestionService.recordActionable(
                orgId, propertyId, "rev",
                "Séjour minimum 2 nuits sur les week-ends à venir",
                "Occupation à " + Math.round(100.0 * booked / MIN_STAY_WINDOW_DAYS) + " % sur "
                        + MIN_STAY_WINDOW_DAYS + " jours : les nuits isolées du week-end partent en "
                        + "séjours d'une nuit à fort coût de ménage. « Restreindre » pose un séjour "
                        + "minimum de 2 nuits les vendredis et samedis de la fenêtre (réversible).",
                SupervisionActionType.MIN_STAY_RESTRICTION,
                "{\"from\":\"" + today + "\",\"to\":\"" + to
                        + "\",\"minNights\":2,\"weekendsOnly\":true}",
                null, "info");
    }

    private void scanCannibalPromos(Long orgId, Long propertyId) {
        final List<RatePlan> plans = ratePlanRepository.findActiveByPropertyId(propertyId, orgId);
        final List<RatePlan> earlyBirds = plans.stream()
                .filter(p -> p.getType() == RatePlanType.EARLY_BIRD).toList();
        final List<RatePlan> lastMinutes = plans.stream()
                .filter(p -> p.getType() == RatePlanType.LAST_MINUTE).toList();
        for (RatePlan earlyBird : earlyBirds) {
            for (RatePlan lastMinute : lastMinutes) {
                if (!datesOverlap(earlyBird, lastMinute)) {
                    continue;
                }
                suggestionService.recordActionable(
                        orgId, propertyId, "rev",
                        "Promotions qui se cannibalisent (« " + earlyBird.getName() + " »)",
                        "« " + earlyBird.getName() + " » (early bird) et « " + lastMinute.getName()
                                + " » (last-minute) couvrent les mêmes dates : l'early bird, "
                                + "prioritaire, écrase l'autre et cumule les remises sur la période. "
                                + "« Désactiver » coupe l'early bird (réversible dans Tarification).",
                        SupervisionActionType.PROMO_DEACTIVATE,
                        "{\"ratePlanId\":" + earlyBird.getId() + "}", null, "info");
                return; // une carte à la fois par logement — dédup par intitulé de toute façon
            }
        }
    }

    private void scanLastMinutePromo(Long orgId, Long propertyId) {
        final LocalDate today = LocalDate.now(clock);
        final LocalDate to = today.plusDays(LAST_MINUTE_WINDOW_DAYS);
        final int booked = calendarDayRepository
                .findBookedDatesInRange(propertyId, today, to, orgId).size();
        if (booked > LAST_MINUTE_MAX_BOOKED) {
            return; // la semaine se vend — pas besoin de brader
        }
        final boolean hasLastMinutePlan = ratePlanRepository
                .findActiveByPropertyId(propertyId, orgId).stream()
                .anyMatch(p -> p.getType() == RatePlanType.LAST_MINUTE);
        if (hasLastMinutePlan) {
            return; // un plan last-minute couvre déjà ce créneau
        }
        // Réutilise le handler PRICE_DROP existant (prix re-résolus + floor à l'apply) —
        // seule la PROVENANCE change : c'est la carte distribution de l'agent Croissance.
        suggestionService.recordActionable(
                orgId, propertyId, "gro",
                "Promo last-minute −" + LAST_MINUTE_PERCENT + " % sur la semaine creuse",
                (LAST_MINUTE_WINDOW_DAYS - booked) + " nuit(s) libres sur les " + LAST_MINUTE_WINDOW_DAYS
                        + " prochains jours et aucun plan last-minute actif. « Appliquer » baisse de "
                        + LAST_MINUTE_PERCENT + " % ces nuits seulement — prix re-résolus et plancher "
                        + "respecté au moment de l'application.",
                SupervisionActionType.PRICE_DROP,
                "{\"direction\":\"down\",\"segments\":[{\"from\":\"" + today + "\",\"to\":\"" + to
                        + "\",\"percent\":" + LAST_MINUTE_PERCENT + "}]}",
                null, "info");
    }

    /** Recouvrement de fenêtres de dates ; borne absente = fenêtre ouverte de ce côté. */
    private static boolean datesOverlap(RatePlan a, RatePlan b) {
        final LocalDate aStart = a.getStartDate();
        final LocalDate aEnd = a.getEndDate();
        final LocalDate bStart = b.getStartDate();
        final LocalDate bEnd = b.getEndDate();
        final boolean aBeforeB = aEnd != null && bStart != null && aEnd.isBefore(bStart);
        final boolean bBeforeA = bEnd != null && aStart != null && bEnd.isBefore(aStart);
        return !aBeforeB && !bBeforeA;
    }
}
