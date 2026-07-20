package com.clenzy.service;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.CalendarDaySnapshotJdbcRepository;
import com.clenzy.repository.CalendarDaySnapshotJdbcRepository.SnapshotRow;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Photo quotidienne du calendrier publié (fondations RMS R1).
 *
 * <p>Pour chaque propriété ACTIVE de l'org : prix résolus par la cascade
 * {@link PriceEngine#resolvePriceRangeWithSource} + état {@code calendar_days}
 * (convention projet : <b>absence de ligne = disponible</b> — le snapshot la
 * matérialise en AVAILABLE), fusionnés en {@value #HORIZON_DAYS} lignes append-only.
 * Écriture batch idempotente (ON CONFLICT DO NOTHING) : rejouer le job du jour ne
 * duplique rien et ne réécrit jamais une photo déjà prise.</p>
 *
 * <p>Un échec sur une propriété est journalisé et n'interrompt pas les autres —
 * un trou d'un jour dans une courbe est acceptable, un job entier perdu non.</p>
 */
@Service
public class CalendarSnapshotService {

    private static final Logger log = LoggerFactory.getLogger(CalendarSnapshotService.class);

    /** Horizon photographié : la nuit du jour J jusqu'à J+364 (365 lignes/propriété). */
    static final int HORIZON_DAYS = 365;

    private final PropertyRepository propertyRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final CalendarDaySnapshotJdbcRepository snapshotRepository;
    private final PriceEngine priceEngine;

    public CalendarSnapshotService(PropertyRepository propertyRepository,
                                   CalendarDayRepository calendarDayRepository,
                                   CalendarDaySnapshotJdbcRepository snapshotRepository,
                                   PriceEngine priceEngine) {
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.snapshotRepository = snapshotRepository;
        this.priceEngine = priceEngine;
    }

    /**
     * Photographie toutes les propriétés ACTIVE de l'org pour {@code snapshotDate}.
     * À appeler DANS un contexte tenant ({@code TenantScopedExecutor}).
     *
     * @return nombre de propriétés photographiées avec succès
     */
    public int snapshotOrganization(Long orgId, LocalDate snapshotDate) {
        final List<Property> properties =
                propertyRepository.findByOrganizationIdAndStatus(orgId, PropertyStatus.ACTIVE);
        int done = 0;
        long insertedTotal = 0;
        for (Property property : properties) {
            try {
                insertedTotal += snapshotProperty(orgId, property, snapshotDate);
                done++;
            } catch (RuntimeException e) {
                log.error("Snapshot calendrier : échec org={} property={} : {}",
                        orgId, property.getId(), e.getMessage());
            }
        }
        if (done > 0) {
            log.info("Snapshot calendrier : org={} — {}/{} propriétés, {} lignes insérées",
                    orgId, done, properties.size(), insertedTotal);
        }
        return done;
    }

    private int snapshotProperty(Long orgId, Property property, LocalDate snapshotDate) {
        final LocalDate toExclusive = snapshotDate.plusDays(HORIZON_DAYS);
        final Map<LocalDate, PriceEngine.ResolvedPrice> prices =
                priceEngine.resolvePriceRangeWithSource(property.getId(), snapshotDate, toExclusive, orgId);
        // findByPropertyAndDateRange : bornes INCLUSES -> to = dernière nuit de l'horizon.
        final List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), snapshotDate, toExclusive.minusDays(1), orgId);
        final List<SnapshotRow> rows = buildRows(
                orgId, property.getId(), property.getDefaultCurrency(), snapshotDate, prices, days);
        return snapshotRepository.insertIgnoreDuplicates(rows);
    }

    /**
     * Fusion prix résolus + état calendrier en lignes de snapshot (cœur pur, testable
     * sans base). Une nuit sans ligne {@code calendar_days} est matérialisée AVAILABLE
     * avec min_stay null (non défini au niveau nuit).
     */
    static List<SnapshotRow> buildRows(Long orgId, Long propertyId, String currency,
                                       LocalDate snapshotDate,
                                       Map<LocalDate, PriceEngine.ResolvedPrice> prices,
                                       List<CalendarDay> calendarDays) {
        final Map<LocalDate, CalendarDay> byDate = calendarDays.stream()
                .collect(Collectors.toMap(CalendarDay::getDate, Function.identity(), (a, b) -> a));
        final List<SnapshotRow> rows = new ArrayList<>(HORIZON_DAYS);
        for (int i = 0; i < HORIZON_DAYS; i++) {
            final LocalDate stayDate = snapshotDate.plusDays(i);
            final CalendarDay day = byDate.get(stayDate);
            final PriceEngine.ResolvedPrice resolved = prices.get(stayDate);
            rows.add(new SnapshotRow(
                    orgId,
                    propertyId,
                    stayDate,
                    snapshotDate,
                    resolved != null ? resolved.price() : null,
                    currency,
                    resolved != null ? resolved.source() : PriceEngine.SOURCE_PROPERTY_DEFAULT,
                    day != null ? day.getStatus().name() : "AVAILABLE",
                    day != null ? day.getMinStay() : null));
        }
        return rows;
    }
}
