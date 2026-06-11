package com.clenzy.service;

import com.clenzy.dto.SecurityAuditLogDto;
import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Requetes de monitoring plateforme : logs d'audit securite, metriques
 * utilisateurs et indicateurs securite 7 jours.
 *
 * <p>Extrait de {@code MonitoringController} (dette T-ARCH-01 : les controllers
 * ne dependent plus des repositories). Donnees <b>cross-org par design</b> :
 * ces requetes alimentent l'ecran de monitoring reserve aux SUPER_ADMIN
 * (le {@code @PreAuthorize} du controller fait foi) — aucune validation
 * d'organisation n'est applicable ici.</p>
 */
@Service
@Transactional(readOnly = true)
public class MonitoringQueryService {

    private static final List<SecurityAuditEventType> SECURITY_INCIDENT_TYPES = List.of(
            SecurityAuditEventType.LOGIN_FAILURE,
            SecurityAuditEventType.PERMISSION_DENIED,
            SecurityAuditEventType.SUSPICIOUS_ACTIVITY
    );

    private final SecurityAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public MonitoringQueryService(SecurityAuditLogRepository auditLogRepository,
                                  UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    /**
     * Listing pagine des logs d'audit securite, avec filtres optionnels
     * par eventType, actorId et result (les filtres blancs sont ignores).
     */
    public Page<SecurityAuditLogDto> searchAuditLogs(SecurityAuditEventType eventType,
                                                     String actorId,
                                                     String result,
                                                     Pageable pageable) {
        Specification<SecurityAuditLog> spec = Specification.where(null);

        if (eventType != null) {
            spec = spec.and((root, query, cb) ->
                cb.equal(root.get("eventType"), eventType));
        }
        if (actorId != null && !actorId.isBlank()) {
            spec = spec.and((root, query, cb) ->
                cb.equal(root.get("actorId"), actorId));
        }
        if (result != null && !result.isBlank()) {
            spec = spec.and((root, query, cb) ->
                cb.equal(root.get("result"), result));
        }

        return auditLogRepository.findAll(spec, pageable)
            .map(SecurityAuditLogDto::from);
    }

    /** Compteurs utilisateurs plateforme : total, actifs, inactifs, nouveaux 7 jours. */
    public Map<String, Object> userMetrics() {
        long total = userRepository.count();
        long active = userRepository.countByStatus(UserStatus.ACTIVE);
        long inactive = total - active;
        long newThisWeek = userRepository.countByCreatedAtAfter(
            LocalDateTime.now().minusDays(7));

        Map<String, Object> users = new LinkedHashMap<>();
        users.put("total", total);
        users.put("active", active);
        users.put("inactive", inactive);
        users.put("newThisWeek", newThisWeek);
        return users;
    }

    /**
     * Indicateurs securite sur 7 jours glissants : echecs de login, refus de
     * permission, activite suspecte, et date du dernier incident securite.
     */
    public Map<String, Object> securityMetrics() {
        Instant oneWeekAgo = Instant.now().minus(7, ChronoUnit.DAYS);

        long failedLogins = auditLogRepository.countByEventTypeAndCreatedAtAfter(
            SecurityAuditEventType.LOGIN_FAILURE, oneWeekAgo);
        long permissionDenied = auditLogRepository.countByEventTypeAndCreatedAtAfter(
            SecurityAuditEventType.PERMISSION_DENIED, oneWeekAgo);
        long suspiciousActivity = auditLogRepository.countByEventTypeAndCreatedAtAfter(
            SecurityAuditEventType.SUSPICIOUS_ACTIVITY, oneWeekAgo);

        String lastIncident = auditLogRepository
            .findTopByEventTypeInOrderByCreatedAtDesc(SECURITY_INCIDENT_TYPES)
            .map(entry -> entry.getCreatedAt().toString())
            .orElse(null);

        Map<String, Object> sec = new LinkedHashMap<>();
        sec.put("failedLogins", failedLogins);
        sec.put("permissionDenied", permissionDenied);
        sec.put("suspiciousActivity", suspiciousActivity);
        sec.put("lastIncident", lastIncident);
        return sec;
    }
}
