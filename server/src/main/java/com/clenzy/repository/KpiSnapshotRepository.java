package com.clenzy.repository;

import com.clenzy.model.KpiSnapshot;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository pour les snapshots KPI de certification.
 * Pas de @Filter("organizationFilter") : cross-org pour SUPER_ADMIN.
 */
public interface KpiSnapshotRepository extends JpaRepository<KpiSnapshot, Long> {

    /** Snapshots les plus recents (paginable) */
    @Query("SELECT k FROM KpiSnapshot k ORDER BY k.capturedAt DESC")
    Page<KpiSnapshot> findRecentPaged(Pageable pageable);

    /** Historique dans une plage de dates (ordonne chronologiquement) */
    @Query("SELECT k FROM KpiSnapshot k " +
           "WHERE k.capturedAt >= :from AND k.capturedAt <= :to " +
           "ORDER BY k.capturedAt ASC")
    List<KpiSnapshot> findByDateRange(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /** Dernier snapshot capture */
    @Query("SELECT k FROM KpiSnapshot k ORDER BY k.capturedAt DESC LIMIT 1")
    Optional<KpiSnapshot> findLatest();

    /** Purge des snapshots anterieurs au seuil (retention 6 mois) */
    @Modifying
    @Query("DELETE FROM KpiSnapshot k WHERE k.capturedAt < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDateTime threshold);
}
