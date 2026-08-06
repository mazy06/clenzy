package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
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
 * <p>Politiques APPLIQUEES :</p>
 * <ul>
 *   <li>Snapshots KPI &gt; 90 jours : suppression</li>
 *   <li>Notifications in-app &gt; 90 jours : suppression</li>
 * </ul>
 *
 * <p>Politiques declarees mais <b>NON IMPLEMENTEES</b> (audit securite 2026-07-26,
 * constat P4-04) — anonymisation des inactifs, purge des logs d'audit et des
 * webhook events :</p>
 * <ul>
 *   <li>Elles retournent 0 sans rien faire, et se signalent desormais en WARN. Le
 *       journal et l'entree d'audit distinguent explicitement ce qui a ete applique
 *       de ce qui ne l'est pas — auparavant, une politique jamais executee se lisait
 *       comme une politique sans rien a purger, et l'entree d'audit affirmait
 *       « Retention RGPD » appliquee. Un rapport de conformite trompeur est pire que
 *       pas de rapport du tout : il ferme la question.</li>
 *   <li>Les durees sont des decisions juridiques, pas techniques — cf.
 *       {@code server/PLAN-RGPD-2026-08-06.md}.</li>
 * </ul>
 *
 * <p>Execute chaque jour a 3h du matin.</p>
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
    @SchedulerLock(name = "data-retention-policies", lockAtMostFor = "PT30M")
    public void executeRetentionPolicies() {
        log.info("Demarrage du job de retention des donnees RGPD");

        anonymizeInactiveUsers();
        cleanupOldAuditLogs();
        cleanupOldWebhookEvents();
        int deletedKpiSnapshots = cleanupOldKpiSnapshots();
        int deletedNotifications = cleanupOldNotifications();

        log.info("Job de retention termine — APPLIQUE : {} KPI snapshots supprimes, {} notifications supprimees. "
                        + "NON IMPLEMENTE ({}) : {}",
                deletedKpiSnapshots, deletedNotifications, POLITIQUES_NON_IMPLEMENTEES.size(),
                String.join(", ", POLITIQUES_NON_IMPLEMENTEES));

        // Entree d'audit : elle sert de preuve de conformite, elle doit donc dire
        // exactement ce qui a tourne. Melanger les deux etats reviendrait a produire
        // la preuve d'une purge qui n'a pas eu lieu.
        auditLogService.logAction(AuditAction.DELETE, "DataRetention", "CRON",
                null, null,
                String.format("Retention RGPD — applique : %d KPI snapshots, %d notifications. "
                                + "NON IMPLEMENTE : %s (cf. audit 2026-07-26 P4-04)",
                        deletedKpiSnapshots, deletedNotifications,
                        String.join(", ", POLITIQUES_NON_IMPLEMENTEES)),
                AuditSource.CRON);
    }

    /** Politiques declarees par ce service mais sans implementation (constat P4-04). */
    private static final List<String> POLITIQUES_NON_IMPLEMENTEES = List.of(
            "anonymisation des comptes inactifs",
            "purge des logs d'audit",
            "purge des webhook events");

    /**
     * Anonymise les utilisateurs DELETED/INACTIVE depuis plus de 3 ans.
     */
    private int anonymizeInactiveUsers() {
        // NON IMPLEMENTE. Le journal annoncait « Recherche des utilisateurs inactifs
        // depuis plus de 3 ans » avant de retourner 0 sans rien chercher : la trace
        // decrivait un travail qui n'a jamais eu lieu.
        log.warn("RETENTION/NON-APPLIQUE : anonymisation des comptes inactifs — aucune "
                + "requete n'existe (UserRepository), aucun compte n'est anonymise. "
                + "Duree de 3 ans a arbitrer, cf. server/PLAN-RGPD-2026-08-06.md.");
        return 0;
    }

    /**
     * Supprime les logs d'audit de plus de 2 ans.
     */
    private int cleanupOldAuditLogs() {
        // NON IMPLEMENTE — cf. anonymizeInactiveUsers.
        log.warn("RETENTION/NON-APPLIQUE : purge des logs d'audit — aucun log n'est "
                + "supprime. La duree (2 ans annonces) engage la capacite a prouver "
                + "un incident : arbitrage juridique, cf. server/PLAN-RGPD-2026-08-06.md.");
        return 0;
    }

    /**
     * Supprime les webhook events de plus de 90 jours.
     */
    private int cleanupOldWebhookEvents() {
        // NON IMPLEMENTE — cf. anonymizeInactiveUsers.
        log.warn("RETENTION/NON-APPLIQUE : purge des webhook events — aucun evenement "
                + "n'est supprime. Ces charges utiles portent des donnees de "
                + "reservation, donc des PII. Cf. server/PLAN-RGPD-2026-08-06.md.");
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
