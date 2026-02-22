package com.clenzy.integration.channel.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.model.ChannelSyncLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ChannelSyncLogRepository extends JpaRepository<ChannelSyncLog, Long> {

    /**
     * Derniers logs de sync pour une connexion (plus recents en premier).
     * Filtre par orgId pour isolation multi-tenant.
     */
    @Query("SELECT sl FROM ChannelSyncLog sl WHERE sl.connection.id = :connectionId " +
           "AND sl.organizationId = :orgId ORDER BY sl.createdAt DESC")
    List<ChannelSyncLog> findByConnectionId(
            @Param("connectionId") Long connectionId,
            @Param("orgId") Long orgId);

    /**
     * Derniers logs de sync pour un mapping specifique.
     * Filtre par orgId pour isolation multi-tenant.
     */
    @Query("SELECT sl FROM ChannelSyncLog sl WHERE sl.mapping.id = :mappingId " +
           "AND sl.organizationId = :orgId ORDER BY sl.createdAt DESC")
    List<ChannelSyncLog> findByMappingId(
            @Param("mappingId") Long mappingId,
            @Param("orgId") Long orgId);

    /**
     * Nettoyage des logs anciens (retention configurable).
     */
    @Modifying
    @Query("DELETE FROM ChannelSyncLog sl WHERE sl.createdAt < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDateTime threshold);

    // ── Admin queries (cross-org, SUPER_ADMIN only) ─────────────────────────

    /**
     * Tous les logs de sync, pagines, plus recents en premier.
     * Cross-org — reserve au dashboard SUPER_ADMIN.
     */
    @Query("SELECT sl FROM ChannelSyncLog sl ORDER BY sl.createdAt DESC")
    Page<ChannelSyncLog> findRecentCrossOrg(Pageable pageable);

    /**
     * Count par status (pour stats dashboard).
     */
    @Query("SELECT COUNT(sl) FROM ChannelSyncLog sl WHERE sl.status = :status")
    long countByStatusStr(@Param("status") String status);

    /**
     * Recherche filtree cross-org (channel, status, date minimum).
     */
    @Query("SELECT sl FROM ChannelSyncLog sl JOIN sl.connection cc " +
           "WHERE (:channel IS NULL OR cc.channel = :channel) " +
           "AND (:status IS NULL OR sl.status = :status) " +
           "AND (:from IS NULL OR sl.createdAt >= :from) " +
           "ORDER BY sl.createdAt DESC")
    Page<ChannelSyncLog> findFiltered(
            @Param("channel") ChannelName channel,
            @Param("status") String status,
            @Param("from") LocalDateTime from,
            Pageable pageable);
}
