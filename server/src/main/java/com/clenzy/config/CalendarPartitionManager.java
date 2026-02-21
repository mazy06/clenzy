package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Cree automatiquement les partitions mensuelles de calendar_days
 * 6 mois a l'avance. Execute chaque 1er du mois a 03h00.
 *
 * Niveau 8 — Scalabilite : gestion automatique des partitions.
 */
@Component
public class CalendarPartitionManager {

    private static final Logger log = LoggerFactory.getLogger(CalendarPartitionManager.class);
    private static final DateTimeFormatter PARTITION_FMT = DateTimeFormatter.ofPattern("yyyy_MM");

    private final JdbcTemplate jdbcTemplate;

    public CalendarPartitionManager(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Cree 6 partitions futures (18 a 24 mois a l'avance).
     * La migration V54 cree deja 24 mois a l'avance, donc ce job
     * s'assure que de nouvelles partitions sont toujours disponibles.
     */
    @Scheduled(cron = "0 0 3 1 * *") // 1er du mois a 03h00
    public void createFuturePartitions() {
        LocalDate today = LocalDate.now();

        for (int i = 0; i < 6; i++) {
            LocalDate month = today.plusMonths(18 + i);
            String partitionName = "calendar_days_" + month.format(PARTITION_FMT);
            String fromDate = month.withDayOfMonth(1).toString();
            String toDate = month.plusMonths(1).withDayOfMonth(1).toString();

            try {
                String checkSql = "SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = ?)";
                Boolean exists = jdbcTemplate.queryForObject(checkSql, Boolean.class, partitionName);

                if (Boolean.TRUE.equals(exists)) {
                    log.debug("Partition deja existante: {}", partitionName);
                    continue;
                }

                String sql = String.format(
                        "CREATE TABLE %s PARTITION OF calendar_days FOR VALUES FROM ('%s') TO ('%s')",
                        partitionName, fromDate, toDate
                );
                jdbcTemplate.execute(sql);
                log.info("Partition creee: {}", partitionName);
            } catch (Exception e) {
                log.warn("Erreur creation partition {}: {}", partitionName, e.getMessage());
            }
        }
    }
}
