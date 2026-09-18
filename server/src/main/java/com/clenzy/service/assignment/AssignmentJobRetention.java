package com.clenzy.service.assignment;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Purge des reveils deja traites.
 *
 * <p>La file est alimentee par des triggers a chaque transition metier : sans
 * purge, elle ne fait que croitre. L'index partiel des taches en attente garde
 * les lectures rapides quoi qu'il arrive — le probleme est le stockage, pas le
 * temps de reponse. La suppression est donc lente et bornee : un lot par
 * passage, jamais un DELETE massif qui bloquerait les insertions du trigger.</p>
 *
 * <p>Une tache terminee ne porte aucune information reprise ailleurs : l'etat du
 * besoin vit dans {@code service_requests} et {@code service_assignment_proposals},
 * et l'historique des envois dans {@code service_assignment_notifications}.</p>
 */
@Component
public class AssignmentJobRetention {
    private static final int BATCH = 5_000;

    private final JdbcTemplate db;
    private final int retentionDays;

    public AssignmentJobRetention(JdbcTemplate db,
            @Value("${baitly.assignment.jobs.retention-days:7}") int retentionDays) {
        this.db = db;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${baitly.assignment.jobs.purge-cron:0 20 3 * * *}")
    @SchedulerLock(name = "baitly-assignment-job-retention", lockAtMostFor = "PT30M")
    public void purgeCompleted() {
        while (db.update("""
                DELETE FROM baitly_assignment_jobs WHERE id IN (
                  SELECT id FROM baitly_assignment_jobs
                   WHERE completed_at < CURRENT_TIMESTAMP - make_interval(days => ?)
                   ORDER BY completed_at LIMIT ?)
                """, retentionDays, BATCH) == BATCH) {
            // Lot suivant : la boucle s'arrete des qu'un lot est incomplet.
        }
    }
}
