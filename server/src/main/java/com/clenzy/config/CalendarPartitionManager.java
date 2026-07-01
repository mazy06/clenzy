package com.clenzy.config;

import com.clenzy.model.Incident.IncidentType;
import com.clenzy.service.IncidentService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Cree automatiquement les partitions mensuelles de calendar_days
 * 6 mois a l'avance. Execute chaque 1er du mois a 03h00.
 *
 * <p><b>Echec non silencieux (Z1-BUGS-10)</b> : un echec de creation est
 * logge en ERROR, comptabilise (Micrometer) et remonte aux SUPER_ADMIN /
 * SUPER_MANAGER via un incident dedupliqué ({@link IncidentService}). Sans
 * cela, la panne ne se manifestait que ~18 mois plus tard quand les INSERT
 * dans calendar_days echouaient faute de partition. Le job ne propage
 * jamais l'exception : un mois en echec n'empeche pas les suivants et le
 * scheduler continue de tourner (degradation assumee, l'alerte prend le
 * relais).</p>
 *
 * Niveau 8 — Scalabilite : gestion automatique des partitions.
 */
@Component
public class CalendarPartitionManager {

    private static final Logger log = LoggerFactory.getLogger(CalendarPartitionManager.class);
    private static final DateTimeFormatter PARTITION_FMT = DateTimeFormatter.ofPattern("yyyy_MM");

    /** Nom de service utilise pour la deduplication des incidents. */
    static final String INCIDENT_SERVICE_NAME = "calendar-partition-manager";

    private final JdbcTemplate jdbcTemplate;
    private final IncidentService incidentService;
    private final Counter partitionFailureCounter;

    public CalendarPartitionManager(JdbcTemplate jdbcTemplate,
                                    IncidentService incidentService,
                                    MeterRegistry meterRegistry) {
        this.jdbcTemplate = jdbcTemplate;
        this.incidentService = incidentService;
        this.partitionFailureCounter = Counter.builder("clenzy.calendar.partition.creation.failures")
                .description("Nombre d'echecs de creation de partition mensuelle calendar_days")
                .register(meterRegistry);
    }

    /**
     * Cree 6 partitions futures (18 a 24 mois a l'avance).
     * La migration V54 cree deja 24 mois a l'avance, donc ce job
     * s'assure que de nouvelles partitions sont toujours disponibles.
     */
    @Scheduled(cron = "0 0 3 1 * *") // 1er du mois a 03h00
    public void createFuturePartitions() {
        // Selon l'environnement, calendar_days peut etre une table PLATE (dev, recreee
        // par Hibernate ddl-auto) et non partitionnee. Y creer une partition echouerait
        // systematiquement ("table is not partitioned") — erreur NON transitoire → on
        // skip proprement (log) au lieu de spammer un incident chaque mois.
        if (!isCalendarDaysPartitioned()) {
            log.info("calendar_days non partitionnee — creation de partitions ignoree (table plate).");
            return;
        }

        LocalDate today = LocalDate.now();
        List<String> failedPartitions = new ArrayList<>();

        for (int i = 0; i < 6; i++) {
            LocalDate month = today.plusMonths(18 + i);
            String partitionName = "calendar_days_" + month.format(PARTITION_FMT);
            String fromDate = month.withDayOfMonth(1).toString();
            String toDate = month.plusMonths(1).withDayOfMonth(1).toString();

            try {
                if (partitionExists(partitionName)) {
                    log.debug("Partition deja existante: {}", partitionName);
                    continue;
                }

                // IF NOT EXISTS : supprime la course check-then-act si plusieurs
                // instances executent le job simultanement (Z1-BUGS-10) — le
                // pre-check ci-dessus n'est qu'une optimisation de log.
                String sql = String.format(
                        "CREATE TABLE IF NOT EXISTS %s PARTITION OF calendar_days FOR VALUES FROM ('%s') TO ('%s')",
                        partitionName, fromDate, toDate
                );
                jdbcTemplate.execute(sql);
                log.info("Partition creee: {}", partitionName);
            } catch (Exception e) {
                log.error("Erreur creation partition {}", partitionName, e);
                partitionFailureCounter.increment();
                failedPartitions.add(partitionName);
            }
        }

        if (!failedPartitions.isEmpty()) {
            alertPartitionCreationFailure(failedPartitions);
        }
    }

    /** True si {@code calendar_days} est une table partitionnee (vs table plate en dev). */
    private boolean isCalendarDaysPartitioned() {
        Boolean partitioned = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM pg_partitioned_table pt "
                        + "JOIN pg_class c ON c.oid = pt.partrelid WHERE c.relname = 'calendar_days')",
                Boolean.class);
        return Boolean.TRUE.equals(partitioned);
    }

    private boolean partitionExists(String partitionName) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = ?)",
                Boolean.class, partitionName);
        return Boolean.TRUE.equals(exists);
    }

    /**
     * Alerte plateforme : ouvre un incident dedupliqué (type + service) qui
     * notifie les SUPER_ADMIN/SUPER_MANAGER via INCIDENT_OPENED — meme
     * philosophie que notifyLedgerReconciliationRequired cote Stripe.
     * Best-effort : un echec d'alerte est loggue sans bloquer le job.
     */
    private void alertPartitionCreationFailure(List<String> failedPartitions) {
        try {
            incidentService.openIncident(
                    IncidentType.SERVICE_DOWN,
                    INCIDENT_SERVICE_NAME,
                    "Echec creation partitions calendar_days",
                    "La creation des partitions mensuelles a echoue pour : "
                            + String.join(", ", failedPartitions)
                            + ". Sans correction, les INSERT dans calendar_days echoueront"
                            + " des que ces mois seront atteints (panne differee).");
        } catch (Exception alertEx) {
            log.error("Impossible d'ouvrir l'incident pour l'echec de creation des partitions {}",
                    failedPartitions, alertEx);
        }
    }
}
