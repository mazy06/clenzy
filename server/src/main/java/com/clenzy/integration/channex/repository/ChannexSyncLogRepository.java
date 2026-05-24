package com.clenzy.integration.channex.repository;

import com.clenzy.integration.channex.model.ChannexSyncLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ChannexSyncLogRepository extends JpaRepository<ChannexSyncLog, Long> {

    /** Historique des logs d'une property (le plus recent en premier). */
    @Query("SELECT l FROM ChannexSyncLog l WHERE l.organizationId = :orgId AND l.clenzyPropertyId = :propertyId ORDER BY l.startedAt DESC")
    List<ChannexSyncLog> findByPropertyOrdered(@Param("orgId") Long orgId,
                                                @Param("propertyId") Long propertyId,
                                                Pageable pageable);

    /** Tous les logs d'une org (UI dashboard "activite recente Channex"). */
    @Query("SELECT l FROM ChannexSyncLog l WHERE l.organizationId = :orgId ORDER BY l.startedAt DESC")
    List<ChannexSyncLog> findByOrgOrdered(@Param("orgId") Long orgId, Pageable pageable);

    /** Purge des logs anciens (job de retention, par defaut > 90 jours). */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM ChannexSyncLog l WHERE l.startedAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
