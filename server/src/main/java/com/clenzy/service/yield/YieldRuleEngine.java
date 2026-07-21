package com.clenzy.service.yield;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.RateOverride;
import com.clenzy.model.YieldAdjustment;
import com.clenzy.model.YieldMode;
import com.clenzy.model.YieldOrgConfig;
import com.clenzy.model.YieldRule;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.YieldAdjustmentRepository;
import com.clenzy.repository.YieldOrgConfigRepository;
import com.clenzy.repository.YieldRuleRepository;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SearchCacheInvalidator;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Moteur des règles de yield v1 (F8a) — « si occupation &lt; X % à J-Y →
 * baisser de Z % » / « si occupation &gt; X % → hausser de Z % », sous 3 modes
 * progressifs PAR ORG ({@link YieldMode}).
 *
 * <p>Garde-fous (tous journalisés dans {@code yield_adjustments}) :</p>
 * <ul>
 *   <li><b>Bornes par bien obligatoires</b> : plancher ET plafond yield sur le
 *       logement, sinon skip NO_BOUNDS — jamais d'action sans les deux ;</li>
 *   <li><b>Cap journalier</b> : ampleur bornée par {@code maxDailyChangePct}
 *       (défaut 10 %) ET au plus UNE évaluation effective par bien et par jour
 *       calendaire (timezone du bien) — vérifié via le journal, la course
 *       étant couverte par l'index unique partiel DB sur les lignes APPLIED ;</li>
 *   <li><b>Overrides protégés</b> : un override MANUAL / OTA / externe n'est
 *       jamais écrasé ; le yield ne re-tarife jamais une nuit BOOKED ;</li>
 *   <li><b>Idempotence de sens</b> : le prix courant est le prix EFFECTIF
 *       (override yield précédent inclus) — combiné au cap « un run par jour »,
 *       la dérive composée est bornée à N %/jour.</li>
 * </ul>
 *
 * <p>Un échec sur un bien est journalisé (EVALUATION_ERROR) et n'interrompt pas
 * les autres biens : chaque bien est traité dans sa propre transaction
 * (REQUIRES_NEW).</p>
 */
@Service
public class YieldRuleEngine {

    private static final Logger log = LoggerFactory.getLogger(YieldRuleEngine.class);

    /** Source des overrides écrits par le yield (partagée avec l'existant). */
    static final String YIELD_OVERRIDE_SOURCE = "YIELD_RULE";
    static final ZoneId DEFAULT_PROPERTY_ZONE = ZoneId.of("Europe/Paris");
    static final String SUGGESTION_MODULE_KEY = "pricing";
    /** Module « Revenue » de la constellation (feed « En direct »). */
    static final String REVENUE_MODULE_KEY = "rev";

    private final YieldOrgConfigRepository configRepository;
    private final YieldRuleRepository yieldRuleRepository;
    private final YieldAdjustmentRepository journalRepository;
    private final PropertyRepository propertyRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final RateOverrideRepository rateOverrideRepository;
    private final PriceEngine priceEngine;
    private final SupervisionSuggestionService suggestionService;
    private final SupervisionActivityService activityService;
    private final SearchCacheInvalidator searchCacheInvalidator;
    private final Clock clock;
    /**
     * Garde-fou d'impact (R1) : en mode AUTO, un ajustement dont l'ampleur dépasse
     * ce seuil (en points de %) n'est PAS appliqué automatiquement — il bascule en
     * carte HITL (comme le mode SUGGEST). Défaut 12 %.
     */
    private final BigDecimal autoHitlImpactPct;
    private final TransactionTemplate requiresNewTx;

    public YieldRuleEngine(YieldOrgConfigRepository configRepository,
                           YieldRuleRepository yieldRuleRepository,
                           YieldAdjustmentRepository journalRepository,
                           PropertyRepository propertyRepository,
                           CalendarDayRepository calendarDayRepository,
                           RateOverrideRepository rateOverrideRepository,
                           PriceEngine priceEngine,
                           SupervisionSuggestionService suggestionService,
                           SupervisionActivityService activityService,
                           SearchCacheInvalidator searchCacheInvalidator,
                           Clock clock,
                           @Value("${clenzy.yield.v1.auto-hitl-impact-pct:12}") BigDecimal autoHitlImpactPct,
                           PlatformTransactionManager transactionManager) {
        this.configRepository = configRepository;
        this.yieldRuleRepository = yieldRuleRepository;
        this.journalRepository = journalRepository;
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.rateOverrideRepository = rateOverrideRepository;
        this.priceEngine = priceEngine;
        this.suggestionService = suggestionService;
        this.activityService = activityService;
        this.searchCacheInvalidator = searchCacheInvalidator;
        this.clock = clock;
        this.autoHitlImpactPct = autoHitlImpactPct;
        this.requiresNewTx = new TransactionTemplate(transactionManager);
        this.requiresNewTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Évalue les règles yield v1 actives d'une org (appelé par le scheduler
     * DANS un contexte tenant posé, ou après vérification d'org côté API).
     * No-op si kill-switch OFF ou aucune règle active.
     */
    public void evaluateOrganization(Long organizationId) {
        final YieldOrgConfig config = configRepository.findByOrganizationId(organizationId).orElse(null);
        if (config == null || !config.isEnabled()) {
            return; // kill-switch org : rien, pas même une simulation
        }
        final List<YieldRule> rules = yieldRuleRepository.findActiveV1ByOrganization(organizationId);
        if (rules.isEmpty()) {
            return;
        }
        final List<Property> properties =
                propertyRepository.findByOrganizationIdAndStatus(organizationId, PropertyStatus.ACTIVE);
        int evaluated = 0;
        for (Property property : properties) {
            final List<YieldRule> applicable = rules.stream()
                    .filter(r -> r.getProperty() == null
                            || r.getProperty().getId().equals(property.getId()))
                    .toList();
            if (applicable.isEmpty()) {
                continue;
            }
            try {
                requiresNewTx.executeWithoutResult(status ->
                        evaluateProperty(config, property, applicable));
                evaluated++;
            } catch (DataIntegrityViolationException e) {
                // Course sur l'index unique partiel (double APPLIED même jour) :
                // la transaction du bien est annulée, on journalise le cap.
                journalSkipInNewTx(config, property, YieldAdjustment.SKIP_DAILY_CAP_REACHED,
                        "Ajustement concurrent détecté (index unique) — non ré-appliqué");
            } catch (RuntimeException e) {
                log.warn("Yield v1 : échec évaluation org={} property={} : {}",
                        organizationId, property.getId(), e.getMessage());
                journalSkipInNewTx(config, property, YieldAdjustment.SKIP_EVALUATION_ERROR,
                        truncate(e.getMessage(), 300));
            }
        }
        if (evaluated > 0) {
            log.info("Yield v1 : org={} — {} bien(s) évalué(s) en mode {}",
                    organizationId, evaluated, config.getMode());
        }
    }

    // ── Évaluation d'un bien ────────────────────────────────────────────────

    private void evaluateProperty(YieldOrgConfig config, Property property, List<YieldRule> rules) {
        final Long orgId = config.getOrganizationId();
        final LocalDate today = LocalDate.ofInstant(clock.instant(), propertyZone(property));

        final BigDecimal floor = property.getYieldPriceFloor();
        final BigDecimal ceiling = property.getYieldPriceCeiling();
        if (floor == null || ceiling == null) {
            journalSkip(config, property, today, YieldAdjustment.SKIP_NO_BOUNDS,
                    "Plancher/plafond yield non configurés sur le bien — aucune action");
            return;
        }
        if (journalRepository.existsByPropertyIdAndAdjustmentDayAndSkipReasonIsNull(
                property.getId(), today)) {
            journalSkip(config, property, today, YieldAdjustment.SKIP_DAILY_CAP_REACHED,
                    "Un ajustement a déjà été évalué aujourd'hui sur ce bien (cap journalier)");
            return;
        }

        // Première règle déclenchée (priorité décroissante) : les suivantes
        // sont ignorées — jamais plus d'un ajustement par bien et par jour.
        for (YieldRule rule : rules) {
            final int window = rule.getWindowDaysAhead();
            final List<LocalDate> bookedDates = calendarDayRepository.findBookedDatesInRange(
                    property.getId(), today, today.plusDays(window), orgId);
            final BigDecimal occupancy = BigDecimal.valueOf(bookedDates.size() * 100L)
                    .divide(BigDecimal.valueOf(window), 2, RoundingMode.HALF_UP);
            if (!isTriggered(rule, occupancy)) {
                continue;
            }
            act(config, property, rule, today, occupancy, new HashSet<>(bookedDates), floor, ceiling);
            return;
        }
    }

    private boolean isTriggered(YieldRule rule, BigDecimal occupancy) {
        return switch (rule.getComparison()) {
            case BELOW -> occupancy.compareTo(rule.getOccupancyThresholdPct()) < 0;
            case ABOVE -> occupancy.compareTo(rule.getOccupancyThresholdPct()) > 0;
        };
    }

    private void act(YieldOrgConfig config, Property property, YieldRule rule, LocalDate today,
                     BigDecimal occupancy, Set<LocalDate> bookedDates,
                     BigDecimal floor, BigDecimal ceiling) {
        final Long orgId = config.getOrganizationId();
        final int window = rule.getWindowDaysAhead();
        // Ampleur bornée par le cap journalier de la règle ; sens déduit de la comparaison.
        final BigDecimal magnitude = rule.getAdjustmentPct().abs().min(rule.getMaxDailyChangePct().abs());
        final BigDecimal signedPct = rule.getComparison() == YieldRule.Comparison.BELOW
                ? magnitude.negate() : magnitude;
        final BigDecimal factor = BigDecimal.ONE.add(
                signedPct.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        final String reason = String.format("Occupation %s %% %s seuil %s %% (fenêtre %d j)",
                occupancy.toPlainString(),
                rule.getComparison() == YieldRule.Comparison.BELOW ? "<" : ">",
                rule.getOccupancyThresholdPct().toPlainString(), window);

        // R1 — Garde-fou d'impact + mode effectif : en AUTO au-delà du seuil,
        // on bascule en carte HITL (asSuggestion) plutôt que d'appliquer.
        final boolean overThreshold = magnitude.compareTo(autoHitlImpactPct) > 0;
        final boolean applyNow = config.getMode() == YieldMode.AUTO && !overThreshold;
        final boolean asSuggestion = config.getMode() == YieldMode.SUGGEST
                || (config.getMode() == YieldMode.AUTO && overThreshold);
        final YieldAdjustment.Mode effectiveJournalMode = applyNow ? YieldAdjustment.Mode.APPLIED
                : asSuggestion ? YieldAdjustment.Mode.SUGGESTED
                : YieldAdjustment.Mode.SIMULATED;

        // Batch (audit perf P1-2) : overrides + prix EFFECTIFS de toute la
        // fenêtre préchargés en 3-4 requêtes (au lieu de 2-4 par nuit) ;
        // la sémantique par nuit ci-dessous est inchangée.
        final LocalDate windowEnd = today.plusDays(window);
        final Map<LocalDate, RateOverride> overridesByDate = rateOverrideRepository
                .findByPropertyIdAndDateRange(property.getId(), today, windowEnd, orgId).stream()
                .collect(Collectors.toMap(RateOverride::getDate, override -> override));
        final Map<LocalDate, BigDecimal> effectivePrices =
                priceEngine.resolvePriceRange(property.getId(), today, windowEnd, orgId);

        final List<YieldAdjustment> pending = new ArrayList<>();
        for (LocalDate date = today; date.isBefore(windowEnd); date = date.plusDays(1)) {
            if (bookedDates.contains(date)) {
                continue; // nuit réservée : jamais re-tarifée
            }
            final RateOverride existing = overridesByDate.get(date);
            if (existing != null && !YIELD_OVERRIDE_SOURCE.equals(existing.getSource())) {
                continue; // override MANUAL / OTA / externe : jamais écrasé
            }
            final BigDecimal current = effectivePrices.get(date);
            if (current == null || current.signum() <= 0) {
                continue; // pas de prix résolu → rien à ajuster ce jour
            }
            final BigDecimal target = current.multiply(factor).setScale(2, RoundingMode.HALF_UP)
                    .max(floor).min(ceiling);
            if (target.compareTo(current) == 0) {
                continue; // déjà à la borne (ou variation nulle)
            }
            final YieldAdjustment line = new YieldAdjustment(
                    orgId, property.getId(), today, effectiveJournalMode);
            line.setRuleId(rule.getId());
            line.setTargetDate(date);
            line.setPriceBefore(current);
            line.setPriceAfter(target);
            line.setOccupancyPct(occupancy);
            line.setThresholdPct(rule.getOccupancyThresholdPct());
            line.setComparison(rule.getComparison().name());
            line.setReason(reason);
            pending.add(line);

            if (applyNow) {
                writeOverride(property, date, target, existing, orgId);
            }
        }
        if (pending.isEmpty()) {
            return; // rien n'aurait changé : pas de bruit dans le journal
        }

        if (asSuggestion) {
            final Optional<Long> suggestionId = recordSuggestion(
                    property, rule, today, window, signedPct, occupancy, reason, pending);
            if (suggestionId.isEmpty()) {
                return; // proposition identique déjà en attente : pas de doublon journal
            }
            pending.forEach(line -> line.setSuggestionId(suggestionId.get()));
        }

        journalRepository.saveAll(pending);
        if (applyNow) {
            searchCacheInvalidator.onAvailabilityOrPriceChanged();
            // Feed « En direct » de la constellation : l'agent Revenue a agi (R1).
            activityService.recordModuleAct(orgId, property.getId(), REVENUE_MODULE_KEY,
                    "yield_price_adjusted",
                    String.format("Tarif %s de %s %% sur %d nuit(s) — %s",
                            signedPct.signum() < 0 ? "baissé" : "haussé",
                            signedPct.abs().toPlainString(), pending.size(), rule.getName()));
            log.info("Yield v1 AUTO : org={} property={} règle '{}' {} % sur {} nuit(s)",
                    orgId, property.getId(), rule.getName(), signedPct, pending.size());
        }
    }

    private void writeOverride(Property property, LocalDate date, BigDecimal target,
                               RateOverride existing, Long orgId) {
        final String currency = property.getDefaultCurrency() != null
                ? property.getDefaultCurrency() : "EUR";
        final RateOverride override = existing != null ? existing
                : new RateOverride(property, date, target, YIELD_OVERRIDE_SOURCE, orgId);
        override.setNightlyPrice(target);
        override.setSource(YIELD_OVERRIDE_SOURCE);
        override.setCurrency(currency);
        override.setCreatedBy("system:yield");
        rateOverrideRepository.save(override);
    }

    private Optional<Long> recordSuggestion(Property property, YieldRule rule, LocalDate today,
                                            int window, BigDecimal signedPct, BigDecimal occupancy,
                                            String reason, List<YieldAdjustment> pending) {
        final long impactCents = pending.stream()
                .mapToLong(l -> l.getPriceAfter().subtract(l.getPriceBefore())
                        .movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact())
                .sum();
        final String direction = signedPct.signum() < 0 ? "Baisser" : "Hausser";
        final String title = String.format("Yield « %s » : %s de %s %% (%d nuit(s), %s)",
                rule.getName(), direction.toLowerCase(), signedPct.abs().toPlainString(),
                pending.size(), property.getName());
        final String params = String.format(
                "{\"from\":\"%s\",\"to\":\"%s\",\"percent\":%s,\"ruleId\":%d}",
                today, today.plusDays(window), signedPct.toPlainString(), rule.getId());
        return suggestionService.recordActionableWithId(
                property.getOrganizationId(), property.getId(), SUGGESTION_MODULE_KEY, null,
                title, reason + " — montants re-calculés à l'application",
                SupervisionActionType.YIELD_PRICE_ADJUST, params, impactCents, "info");
    }

    // ── Journal des skips ───────────────────────────────────────────────────

    private void journalSkip(YieldOrgConfig config, Property property, LocalDate day,
                             String skipReason, String detail) {
        final YieldAdjustment line = new YieldAdjustment(
                config.getOrganizationId(), property.getId(), day, journalMode(config.getMode()));
        line.setSkipReason(skipReason);
        line.setReason(truncate(detail, 300));
        journalRepository.save(line);
    }

    /** Skip journalisé dans une transaction NEUVE (la transaction du bien a été annulée). */
    private void journalSkipInNewTx(YieldOrgConfig config, Property property,
                                    String skipReason, String detail) {
        final LocalDate day = LocalDate.ofInstant(clock.instant(), propertyZone(property));
        try {
            requiresNewTx.executeWithoutResult(status ->
                    journalSkip(config, property, day, skipReason, detail));
        } catch (RuntimeException e) {
            log.warn("Yield v1 : journalisation du skip {} impossible pour property={} : {}",
                    skipReason, property.getId(), e.getMessage());
        }
    }

    private static YieldAdjustment.Mode journalMode(YieldMode mode) {
        return switch (mode) {
            case SIMULATION -> YieldAdjustment.Mode.SIMULATED;
            case SUGGEST -> YieldAdjustment.Mode.SUGGESTED;
            case AUTO -> YieldAdjustment.Mode.APPLIED;
        };
    }

    private static ZoneId propertyZone(Property property) {
        final String timezone = property.getTimezone();
        if (timezone == null || timezone.isBlank()) {
            return DEFAULT_PROPERTY_ZONE;
        }
        try {
            return ZoneId.of(timezone);
        } catch (DateTimeException e) {
            log.warn("Yield v1 : timezone invalide '{}' pour property={}, repli {}",
                    timezone, property.getId(), DEFAULT_PROPERTY_ZONE);
            return DEFAULT_PROPERTY_ZONE;
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
