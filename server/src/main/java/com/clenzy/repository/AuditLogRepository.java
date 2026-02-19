package com.clenzy.repository;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

/**
 * Repository pour les logs d'audit.
 * Retention minimum : 2 ans (exigence Airbnb Partner).
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findByUserIdOrderByTimestampDesc(String userId, Pageable pageable);

    Page<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(
        String entityType, String entityId, Pageable pageable);

    Page<AuditLog> findByActionOrderByTimestampDesc(AuditAction action, Pageable pageable);

    List<AuditLog> findByTimestampBetweenOrderByTimestampDesc(Instant from, Instant to);

    @Query("SELECT a FROM AuditLog a WHERE a.entityType = :entityType " +
           "AND a.timestamp >= :from AND a.organizationId = :orgId ORDER BY a.timestamp DESC")
    Page<AuditLog> findByEntityTypeAfter(
        @Param("entityType") String entityType,
        @Param("from") Instant from,
        Pageable pageable,
        @Param("orgId") Long orgId);

    long countByAction(AuditAction action);

    long countByTimestampAfter(Instant from);
}
