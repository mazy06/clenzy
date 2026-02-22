package com.clenzy.repository;

import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface SecurityAuditLogRepository
        extends JpaRepository<SecurityAuditLog, Long>, JpaSpecificationExecutor<SecurityAuditLog> {

    Page<SecurityAuditLog> findByEventTypeOrderByCreatedAtDesc(
            SecurityAuditEventType eventType, Pageable pageable);

    Page<SecurityAuditLog> findByActorIdOrderByCreatedAtDesc(
            String actorId, Pageable pageable);

    long countByEventTypeAndCreatedAtAfter(SecurityAuditEventType eventType, Instant after);

    /** Listing pagine de tous les logs, tri decroissant */
    Page<SecurityAuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Dernier incident securite parmi les types donnes */
    Optional<SecurityAuditLog> findTopByEventTypeInOrderByCreatedAtDesc(
            List<SecurityAuditEventType> eventTypes);
}
