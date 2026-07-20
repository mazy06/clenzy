package com.clenzy.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Types;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

/**
 * Écritures et maintenance de {@code calendar_day_snapshots} (fondations RMS R1).
 *
 * <p>JDBC volontairement (pas JPA) : ~365 lignes par propriété et par jour — batch
 * insert avec {@code ON CONFLICT DO NOTHING} (idempotence : rejouer le job du jour
 * ne duplique rien et ne réécrit pas une photo déjà prise).</p>
 */
@Repository
public class CalendarDaySnapshotJdbcRepository {

    private static final String INSERT_SQL = """
            INSERT INTO calendar_day_snapshots
              (organization_id, property_id, stay_date, snapshot_date,
               published_price, currency, price_source, status, min_stay)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (property_id, stay_date, snapshot_date) DO NOTHING
            """;

    private final JdbcTemplate jdbcTemplate;

    public CalendarDaySnapshotJdbcRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Ligne à photographier — construite par {@code CalendarSnapshotService.buildRows}. */
    public record SnapshotRow(
            Long organizationId,
            Long propertyId,
            LocalDate stayDate,
            LocalDate snapshotDate,
            BigDecimal publishedPrice,
            String currency,
            String priceSource,
            String status,
            Integer minStay) {
    }

    /** Insère en batch, ignore les doublons (PK). Retourne le nombre de lignes réellement insérées. */
    public int insertIgnoreDuplicates(List<SnapshotRow> rows) {
        if (rows.isEmpty()) {
            return 0;
        }
        int[][] results = jdbcTemplate.batchUpdate(INSERT_SQL, rows, rows.size(),
                (PreparedStatement ps, SnapshotRow r) -> {
                    ps.setLong(1, r.organizationId());
                    ps.setLong(2, r.propertyId());
                    ps.setDate(3, Date.valueOf(r.stayDate()));
                    ps.setDate(4, Date.valueOf(r.snapshotDate()));
                    if (r.publishedPrice() != null) {
                        ps.setBigDecimal(5, r.publishedPrice());
                    } else {
                        ps.setNull(5, Types.NUMERIC);
                    }
                    ps.setString(6, r.currency());
                    ps.setString(7, r.priceSource());
                    ps.setString(8, r.status());
                    if (r.minStay() != null) {
                        ps.setInt(9, r.minStay());
                    } else {
                        ps.setNull(9, Types.INTEGER);
                    }
                });
        // ON CONFLICT DO NOTHING : 1 = insérée, 0 = photo déjà prise (rejeu idempotent).
        return Arrays.stream(results).flatMapToInt(Arrays::stream).map(c -> Math.max(c, 0)).sum();
    }

    /**
     * snapshot_date compactables : plus vieux que {@code cutoff} et pas un lundi
     * (on ne garde qu'une photo hebdomadaire au-delà de la rétention pleine).
     */
    public List<LocalDate> findCompactableSnapshotDates(LocalDate cutoff, int limit) {
        return jdbcTemplate.queryForList("""
                SELECT DISTINCT snapshot_date FROM calendar_day_snapshots
                WHERE snapshot_date < ? AND EXTRACT(ISODOW FROM snapshot_date) <> 1
                ORDER BY snapshot_date
                LIMIT ?
                """, LocalDate.class, cutoff, limit);
    }

    /** Purge toutes les photos d'un snapshot_date donné (compaction par tranche). */
    public int deleteSnapshotDate(LocalDate snapshotDate) {
        return jdbcTemplate.update(
                "DELETE FROM calendar_day_snapshots WHERE snapshot_date = ?", snapshotDate);
    }
}
