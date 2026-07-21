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
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Moteur de resolution de prix par nuit.
 *
 * Algorithme de resolution pour un (propertyId, date), en cascade :
 * <ol>
 *   <li>{@link com.clenzy.model.RateOverride} (prix exact par date — priorite max)</li>
 *   <li>{@link RatePlanType#PROMOTIONAL} (promo explicite avec plage de dates)</li>
 *   <li>{@link RatePlanType#EVENT} (event-specific dates, ex: festival local)</li>
 *   <li>{@link RatePlanType#WEEKEND} (day-of-week recurrent, fri/sat/sun)</li>
 *   <li>{@link RatePlanType#SEASONAL} (broad season, ete/hiver)</li>
 *   <li>{@link RatePlanType#EARLY_BIRD} (reservation X jours a l'avance)</li>
 *   <li>{@link RatePlanType#LAST_MINUTE} (booking proche check-in)</li>
 *   <li>{@link RatePlanType#BASE} (tarif de base configurable)</li>
 *   <li>{@link com.clenzy.model.Property#getNightlyPrice} (fallback compat)</li>
 * </ol>
 *
 * <p><b>Phase 5 OTA pricing</b> : ajout de {@link RatePlanType#EVENT},
 * {@link RatePlanType#WEEKEND} et {@link RatePlanType#EARLY_BIRD} dans
 * {@link #TYPE_PRIORITY}. WEEKEND est notamment cree a l'import OTA
 * depuis {@code rate_plan.settings.weekend_price} (Phase 1) mais n'etait
 * pas resolu — le PriceEngine ignorait le tarif weekend.</p>
 *
 * <p><b>Lead time (audit Z5-BUGS-05)</b> : les types EARLY_BIRD et LAST_MINUTE
 * sont evalues par rapport au delai entre la date de resolution (aujourd'hui)
 * et la date du sejour. Bornes explicites via {@link RatePlan#getMinLeadDays()}
 * / {@link RatePlan#getMaxLeadDays()} ; a defaut, fenetres par defaut :
 * LAST_MINUTE ne s'applique que dans les {@link #DEFAULT_LAST_MINUTE_MAX_LEAD_DAYS}
 * jours, EARLY_BIRD qu'au-dela de {@link #DEFAULT_EARLY_BIRD_MIN_LEAD_DAYS} jours.</p>
 *
 * <p>{@link RatePlanType#OCCUPANCY_BASED} et {@link RatePlanType#LONG_STAY}
 * restent hors de TYPE_PRIORITY car ce sont des AJUSTEMENTS (per-guest et
 * per-night-count) et non des rates par-date. Ils sont calcules separement
 * par {@link com.clenzy.model.OccupancyPricing#calculateAdjustment} et
 * {@link com.clenzy.model.LengthOfStayDiscount#appliesTo}.</p>
 *
 * Pour les calculs sur plage, les queries sont batch-optimisees :
 * 2 queries max (overrides + plans) puis resolution en memoire.
 */
@Service
@Transactional(readOnly = true)
public class PriceEngine {

    private static final Logger log = LoggerFactory.getLogger(PriceEngine.class);

    /** Source affichee quand le prix vient d'un RateOverride. */
    public static final String SOURCE_OVERRIDE = "OVERRIDE";

    /** Source affichee quand le prix retombe sur Property.nightlyPrice. */
    public static final String SOURCE_PROPERTY_DEFAULT = "PROPERTY_DEFAULT";

    /**
     * Fenetre par defaut d'un plan LAST_MINUTE sans maxLeadDays configure :
     * il ne s'applique que si le sejour est dans au plus 7 jours.
     */
    public static final int DEFAULT_LAST_MINUTE_MAX_LEAD_DAYS = 7;

    /**
     * Fenetre par defaut d'un plan EARLY_BIRD sans minLeadDays configure :
     * il ne s'applique que si le sejour est dans au moins 30 jours.
     */
    public static final int DEFAULT_EARLY_BIRD_MIN_LEAD_DAYS = 30;

    /**
     * Prix resolu accompagne de sa source dans la cascade :
     * {@link #SOURCE_OVERRIDE}, un nom de {@link RatePlanType},
     * ou {@link #SOURCE_PROPERTY_DEFAULT}.
     */
    public record ResolvedPrice(BigDecimal price, String source) {}

    /**
     * Ordre de resolution des types de plans, du plus prioritaire au fallback.
     *
     * <p>Phase 5 OTA pricing : ajout de EVENT (entre PROMOTIONAL et WEEKEND),
     * WEEKEND (entre EVENT et SEASONAL) et EARLY_BIRD (entre SEASONAL et
     * LAST_MINUTE). Rationale : EVENT > WEEKEND > SEASONAL car plus la
     * granularite temporelle est specifique, plus la priorite est haute.</p>
     */
    private static final List<RatePlanType> TYPE_PRIORITY = List.of(
            RatePlanType.PROMOTIONAL,
            RatePlanType.EVENT,
            RatePlanType.WEEKEND,
            RatePlanType.SEASONAL,
            RatePlanType.EARLY_BIRD,
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
        return resolvePrice(propertyId, date, orgId, Set.of());
    }

    /**
     * Resout le prix par nuit pour une date specifique en IGNORANT les
     * overrides dont la source figure dans {@code excludedOverrideSources}.
     *
     * <p>Utilise par le yield management (audit Z5-BUGS-02) pour calculer
     * l'ajustement depuis le prix de base hors overrides YIELD_RULE, de facon
     * idempotente d'un run a l'autre (pas de derive composee).</p>
     *
     * @param propertyId              propriete cible
     * @param date                    date a resoudre
     * @param orgId                   organisation
     * @param excludedOverrideSources sources d'override a ignorer (ex: "YIELD_RULE")
     * @return prix par nuit, ou null si aucun prix n'est applicable
     */
    public BigDecimal resolvePrice(Long propertyId, LocalDate date, Long orgId,
                                   Set<String> excludedOverrideSources) {
        // 1. Override specifique (priorite max), sauf sources exclues
        Optional<RateOverride> override = rateOverrideRepository
                .findByPropertyIdAndDate(propertyId, date, orgId)
                .filter(o -> !excludedOverrideSources.contains(o.getSource()));
        if (override.isPresent()) {
            return override.get().getNightlyPrice();
        }

        // 2-5. Rate plans par type de priorite (avec evaluation du lead time)
        List<RatePlan> plans = ratePlanRepository.findActiveByPropertyId(propertyId, orgId);
        Optional<ResolvedPrice> planPrice = resolveFromPlans(plans, date, LocalDate.now());
        if (planPrice.isPresent()) {
            return planPrice.get().price();
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
        return resolvePriceRange(propertyId, from, to, orgId, Set.of());
    }

    /**
     * Variante de {@link #resolvePriceRange(Long, LocalDate, LocalDate, Long)}
     * qui IGNORE les overrides dont la source figure dans
     * {@code excludedOverrideSources} — l'equivalent batch de
     * {@link #resolvePrice(Long, LocalDate, Long, Set)} (audit Z5-BUGS-02,
     * utilise par le yield management pour calculer depuis le prix de base
     * hors overrides YIELD_RULE, sans derive composee).
     */
    public Map<LocalDate, BigDecimal> resolvePriceRange(Long propertyId, LocalDate from,
                                                          LocalDate to, Long orgId,
                                                          Set<String> excludedOverrideSources) {
        Map<LocalDate, BigDecimal> result = new LinkedHashMap<>();
        resolvePriceRangeWithSource(propertyId, from, to, orgId, excludedOverrideSources)
                .forEach((date, resolved) -> result.put(date, resolved.price()));
        return result;
    }

    /**
     * Resout les prix pour une plage de dates [from, to) en exposant la source
     * de chaque prix (override, type de plan, fallback propriete).
     *
     * <p>Source de verite unique de la cascade (audit T-ARCH-04) : les appelants
     * qui affichent la provenance du prix (ex: GET /api/calendar/{id}/pricing)
     * DOIVENT passer par cette methode plutot que re-implementer l'algorithme.</p>
     *
     * @return map date → (prix, source) ; le prix peut etre null si aucun
     *         tarif n'est applicable (source = PROPERTY_DEFAULT)
     */
    public Map<LocalDate, ResolvedPrice> resolvePriceRangeWithSource(Long propertyId, LocalDate from,
                                                                      LocalDate to, Long orgId) {
        return resolvePriceRangeWithSource(propertyId, from, to, orgId, Set.of());
    }

    /**
     * Variante de {@link #resolvePriceRangeWithSource(Long, LocalDate, LocalDate, Long)}
     * qui IGNORE les overrides dont la source figure dans
     * {@code excludedOverrideSources} (meme semantique que
     * {@link #resolvePrice(Long, LocalDate, Long, Set)}, en batch).
     */
    public Map<LocalDate, ResolvedPrice> resolvePriceRangeWithSource(Long propertyId, LocalDate from,
                                                                      LocalDate to, Long orgId,
                                                                      Set<String> excludedOverrideSources) {
        // Batch : charger tous les overrides et plans en 2 queries
        List<RateOverride> overrides = rateOverrideRepository.findByPropertyIdAndDateRange(propertyId, from, to, orgId);
        Map<LocalDate, BigDecimal> overrideMap = overrides.stream()
                .filter(o -> !excludedOverrideSources.contains(o.getSource()))
                .collect(Collectors.toMap(RateOverride::getDate, RateOverride::getNightlyPrice));

        List<RatePlan> plans = ratePlanRepository.findActiveByPropertyId(propertyId, orgId);

        // Fallback Property price
        BigDecimal propertyPrice = propertyRepository.findById(propertyId)
                .map(p -> p.getNightlyPrice())
                .orElse(null);

        LocalDate resolutionDate = LocalDate.now();

        // Resolution en memoire pour chaque date
        Map<LocalDate, ResolvedPrice> result = new LinkedHashMap<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            // 1. Override
            if (overrideMap.containsKey(date)) {
                result.put(date, new ResolvedPrice(overrideMap.get(date), SOURCE_OVERRIDE));
                continue;
            }

            // 2-5. Plans par type
            Optional<ResolvedPrice> planPrice = resolveFromPlans(plans, date, resolutionDate);
            if (planPrice.isPresent()) {
                result.put(date, planPrice.get());
                continue;
            }

            // 6. Fallback
            result.put(date, new ResolvedPrice(propertyPrice, SOURCE_PROPERTY_DEFAULT));
        }

        return result;
    }

    // ── Methodes privees ────────────────────────────────────────────────────

    /**
     * Resout le prix depuis les plans actifs pour une date, dans l'ordre
     * {@link #TYPE_PRIORITY}, en appliquant le filtre de lead time.
     */
    private Optional<ResolvedPrice> resolveFromPlans(List<RatePlan> plans, LocalDate date,
                                                     LocalDate resolutionDate) {
        for (RatePlanType type : TYPE_PRIORITY) {
            Optional<BigDecimal> price = plans.stream()
                    .filter(p -> p.getType() == type
                            && p.appliesTo(date)
                            && matchesLeadTime(p, date, resolutionDate))
                    .max(Comparator.comparingInt(RatePlan::getPriority))
                    .map(RatePlan::getNightlyPrice);
            if (price.isPresent()) {
                return Optional.of(new ResolvedPrice(price.get(), type.name()));
            }
        }
        return Optional.empty();
    }

    /**
     * Evalue la condition de lead time d'un plan : delai (en jours) entre la
     * date de resolution (aujourd'hui) et la date du sejour.
     *
     * <ul>
     *   <li>Bornes explicites minLeadDays/maxLeadDays : appliquees telles quelles
     *       (quel que soit le type de plan).</li>
     *   <li>Aucune borne configuree : fenetre par defaut pour LAST_MINUTE
     *       (sejour dans ≤ {@link #DEFAULT_LAST_MINUTE_MAX_LEAD_DAYS} jours) et
     *       EARLY_BIRD (sejour dans ≥ {@link #DEFAULT_EARLY_BIRD_MIN_LEAD_DAYS}
     *       jours) ; les autres types s'appliquent sans condition de delai.</li>
     * </ul>
     */
    private boolean matchesLeadTime(RatePlan plan, LocalDate date, LocalDate resolutionDate) {
        long leadDays = ChronoUnit.DAYS.between(resolutionDate, date);

        Integer minLead = plan.getMinLeadDays();
        Integer maxLead = plan.getMaxLeadDays();

        if (minLead == null && maxLead == null) {
            // Fenetre par defaut documentee pour les types a semantique lead-time
            if (plan.getType() == RatePlanType.LAST_MINUTE) {
                return leadDays <= DEFAULT_LAST_MINUTE_MAX_LEAD_DAYS;
            }
            if (plan.getType() == RatePlanType.EARLY_BIRD) {
                return leadDays >= DEFAULT_EARLY_BIRD_MIN_LEAD_DAYS;
            }
            return true;
        }

        if (minLead != null && leadDays < minLead) {
            return false;
        }
        return maxLead == null || leadDays <= maxLead;
    }
}
