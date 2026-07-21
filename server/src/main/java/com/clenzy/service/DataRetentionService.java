package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Service de retention des donnees — conformite RGPD.
 *
 * Execute automatiquement les politiques de retention :
 * - Utilisateurs supprimes/inactifs depuis > 3 ans : anonymisation
 * - Logs d'audit > 2 ans : suppression
 * - Webhook events > 90 jours : suppression
 * - Notifications in-app > 90 jours : suppression
 *
 * Execute chaque jour a 3h du matin.
 */
@Service
public class DataRetentionService {

    private static final Logger log = LoggerFactory.getLogger(DataRetentionService.class);

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final GdprService gdprService;
    private final KpiSnapshotRepository kpiSnapshotRepository;
    private final NotificationRepository notificationRepository;

    public DataRetentionService(UserRepository userRepository,
                                AuditLogService auditLogService,
                                GdprService gdprService,
                                KpiSnapshotRepository kpiSnapshotRepository,
                                NotificationRepository notificationRepository) {
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.gdprService = gdprService;
        this.kpiSnapshotRepository = kpiSnapshotRepository;
        this.notificationRepository = notificationRepository;
    }

    /**
     * Job planifie : nettoyage des donnees selon la politique de retention.
     * Execute chaque jour a 3h00.
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void executeRetentionPolicies() {
        log.info("Demarrage du job de retention des donnees RGPD");

        int anonymizedUsers = anonymizeInactiveUsers();
        int deletedAuditLogs = cleanupOldAuditLogs();
        int deletedWebhookEvents = cleanupOldWebhookEvents();
        int deletedKpiSnapshots = cleanupOldKpiSnapshots();
        int deletedNotifications = cleanupOldNotifications();

        log.info("Job de retention termine : {} utilisateurs anonymises, {} logs d'audit supprimes, {} webhook events supprimes, {} KPI snapshots supprimes, {} notifications supprimees",
                anonymizedUsers, deletedAuditLogs, deletedWebhookEvents, deletedKpiSnapshots, deletedNotifications);

        // Audit du job
        auditLogService.logAction(AuditAction.DELETE, "DataRetention", "CRON",
                null, null,
                String.format("Retention RGPD : %d users anonymises, %d audit logs supprimes, %d webhook events supprimes, %d KPI snapshots supprimes, %d notifications supprimees",
                        anonymizedUsers, deletedAuditLogs, deletedWebhookEvents, deletedKpiSnapshots, deletedNotifications),
                AuditSource.CRON);
    }

    /**
     * Anonymise les utilisateurs DELETED/INACTIVE depuis plus de 3 ans.
     */
    private int anonymizeInactiveUsers() {
        LocalDateTime threshold = LocalDateTime.now().minusYears(3);
        // Find users with status DELETED and updatedAt < threshold
        // For each, call gdprService.anonymizeUser if not already anonymized
        // Return count
        // Implementation: query users where status = DELETED and updatedAt < threshold and firstName != 'Anonyme'
        log.info("Recherche des utilisateurs inactifs depuis plus de 3 ans (avant {})", threshold);
        // TODO: implement when UserRepository has the needed query
        return 0;
    }

    /**
     * Supprime les logs d'audit de plus de 2 ans.
     */
    private int cleanupOldAuditLogs() {
        Instant threshold = Instant.now().minus(730, ChronoUnit.DAYS); // ~2 years
        // TODO: implement with AuditLogRepository.deleteByTimestampBefore(threshold)
        log.info("Suppression des logs d'audit anterieurs a {}", threshold);
        return 0;
    }

    /**
     * Supprime les webhook events de plus de 90 jours.
     */
    private int cleanupOldWebhookEvents() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(90);
        // TODO: implement with AirbnbWebhookEventRepository.deleteByCreatedAtBefore(threshold)
        log.info("Suppression des webhook events anterieurs a {}", threshold);
        return 0;
    }

    /**
     * Supprime les notifications in-app de plus de 90 jours. Sans purge, la
     * table croissait indefiniment par utilisateur (audit perf 2026-07-21) ;
     * le front n'affiche de toute facon que les plus recentes.
     */
    private int cleanupOldNotifications() {
        Instant threshold = Instant.now().minus(90, ChronoUnit.DAYS);
        int deleted = notificationRepository.deleteByCreatedAtBefore(threshold);
        if (deleted > 0) {
            log.info("[Retention] {} notifications supprimees (anterieures a {})", deleted, threshold);
        }
        return deleted;
    }

    /**
     * Supprime les snapshots KPI de plus de 6 mois (retention historique).
     */
    private int cleanupOldKpiSnapshots() {
        LocalDateTime threshold = LocalDateTime.now().minusMonths(6);
        int deleted = kpiSnapshotRepository.deleteOlderThan(threshold);
        if (deleted > 0) {
            log.info("[Retention] Purged {} KPI snapshots older than 6 months", deleted);
        }
        return deleted;
    }
}
