package com.clenzy.service.yield;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.MinNightsOverride;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.YieldOrgConfig;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.MinNightsOverrideRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Min-stay dynamique (RMS R2) — réduction LAST-MINUTE du séjour minimum :
 * une nuit encore libre à moins de {@code minStayReduceWithinDays} jours a peu
 * de chances de se vendre avec un min-stay élevé — on l'abaisse à
 * {@code minStayReducedValue} (pattern PriceLabs), via des
 * {@code min_nights_overrides} source {@value #SOURCE}, réversibles.
 *
 * <p>Protections : les overrides d'une autre source (MANUAL, événement,
 * {@code ORPHAN_GAP} — plus spécifique) ne sont JAMAIS touchés ; sans min-stay
 * nominal supérieur à la valeur réduite, aucune écriture. Le nettoyage supprime
 * les écritures {@value #SOURCE} sorties de la fenêtre ou devenues inutiles.
 * Transaction par bien (REQUIRES_NEW).</p>
 */
@Service
public class MinStayAutoEngine {

    private static final Logger log = LoggerFactory.getLogger(MinStayAutoEngine.class);

    static final String SOURCE = "MINSTAY_AUTO";
    /** Plage de nettoyage : couvre toute fenêtre configurable (max 60 j). */
    static final int CLEANUP_HORIZON_DAYS = 60;

    private final PropertyRepository propertyRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final MinNightsOverrideRepository minNightsOverrideRepository;
    private final TransactionTemplate perPropertyTx;

    public MinStayAutoEngine(PropertyRepository propertyRepository,
                             CalendarDayRepository calendarDayRepository,
                             MinNightsOverrideRepository minNightsOverrideRepository,
                             PlatformTransactionManager transactionManager) {
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.minNightsOverrideRepository = minNightsOverrideRepository;
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
                log.error("Min-stay auto : échec org={} property={} : {}", orgId, property.getId(), e.getMessage());
            }
        }
    }

    private void evaluateProperty(YieldOrgConfig config, Property property, LocalDate today, Long orgId) {
        final LocalDate cleanupEndExclusive = today.plusDays(CLEANUP_HORIZON_DAYS);
        final List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), today, cleanupEndExclusive.minusDays(1), orgId);
        final Set<LocalDate> occupied = days.stream()
                .filter(d -> d.getStatus() != CalendarDayStatus.AVAILABLE)
                .map(CalendarDay::getDate)
                .collect(Collectors.toSet());

        final Set<LocalDate> desired = desiredReductions(
                property.getMinimumNights(), config, occupied, today);

        final Map<LocalDate, MinNightsOverride> existing = minNightsOverrideRepository
                .findByPropertyIdAndDateRange(property.getId(), today, cleanupEndExclusive, orgId).stream()
                .collect(Collectors.toMap(MinNightsOverride::getDate, Function.identity(), (a, b) -> a));

        int applied = 0;
        for (LocalDate date : desired) {
            final MinNightsOverride current = existing.get(date);
            if (current == null) {
                minNightsOverrideRepository.save(new MinNightsOverride(
                        property, date, config.getMinStayReducedValue(), SOURCE, orgId));
                applied++;
            } else if (SOURCE.equals(current.getSource())
                    && current.getMinNights() != config.getMinStayReducedValue()) {
                current.setMinNights(config.getMinStayReducedValue());
                minNightsOverrideRepository.save(current);
                applied++;
            }
            // Autre source : jamais écrasée (MANUAL / événement / ORPHAN_GAP).
        }

        int cleaned = 0;
        for (MinNightsOverride override : existing.values()) {
            if (SOURCE.equals(override.getSource()) && !desired.contains(override.getDate())) {
                minNightsOverrideRepository.delete(override);
                cleaned++;
            }
        }
        if (applied > 0 || cleaned > 0) {
            log.info("Min-stay auto : org={} property={} — {} nuit(s) réduite(s), {} résidu(s) nettoyé(s)",
                    orgId, property.getId(), applied, cleaned);
        }
    }

    // ── Cœur pur (testable sans base) ───────────────────────────────────────

    /**
     * Nuits à réduire : LIBRES, dans [today, today+fenêtre), avec un min-stay
     * nominal strictement supérieur à la valeur réduite.
     */
    static Set<LocalDate> desiredReductions(Integer baseMinNights, YieldOrgConfig config,
                                            Set<LocalDate> occupied, LocalDate today) {
        if (baseMinNights == null || baseMinNights <= config.getMinStayReducedValue()) {
            return Set.of();
        }
        final LocalDate endExclusive = today.plusDays(config.getMinStayReduceWithinDays());
        return today.datesUntil(endExclusive)
                .filter(d -> !occupied.contains(d))
                .collect(Collectors.toSet());
    }
}
