package com.clenzy.repository;

import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface SecurityAuditLogRepository extends JpaRepository<SecurityAuditLog, Long> {

    Page<SecurityAuditLog> findByEventTypeOrderByCreatedAtDesc(
            SecurityAuditEventType eventType, Pageable pageable);

    Page<SecurityAuditLog> findByActorIdOrderByCreatedAtDesc(
            String actorId, Pageable pageable);

    long countByEventTypeAndCreatedAtAfter(SecurityAuditEventType eventType, Instant after);
}
