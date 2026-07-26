package com.clenzy.scheduler;

import com.clenzy.model.NotificationKey;
import com.clenzy.repository.RlsAuditFindingRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.tenant.RlsAuditBuffer;
import com.clenzy.util.StringUtils;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Persiste l'inventaire de l'audit RLS et alerte le personnel plateforme — audit sécurité
 * 2026-07-26, plan REM-T-01.
 *
 * <p><b>Pourquoi persister.</b> Les constats sont agrégés en mémoire par
 * {@link RlsAuditBuffer}. L'inventaire doit courir plusieurs semaines pour couvrir un cycle
 * d'usage complet — fins de mois, exports, tâches rares. Sans persistance, chaque
 * redéploiement le remettrait à zéro, et son silence ne prouverait rien : ce serait celui
 * d'un compteur neuf.
 *
 * <p><b>Pourquoi alerter.</b> Un inventaire qu'il faut penser à consulter finit par ne plus
 * l'être. Chaque chemin <b>nouveau</b> déclenche une notification au personnel plateforme —
 * une seule, à la première apparition : les occurrences suivantes n'alimentent que le
 * compteur. Une alerte qui se répète cesse d'être lue.
 */
@Component
public class RlsAuditFlushScheduler {

    private static final Logger log = LoggerFactory.getLogger(RlsAuditFlushScheduler.class);

    private final RlsAuditFindingRepository repository;
    private final NotificationService notificationService;
    private final boolean auditActif;

    public RlsAuditFlushScheduler(RlsAuditFindingRepository repository,
                                  NotificationService notificationService,
                                  @Value("${clenzy.security.rls.audit-missing-guc:false}") boolean auditActif) {
        this.repository = repository;
        this.notificationService = notificationService;
        this.auditActif = auditActif;
    }

    /**
     * Vide le tampon toutes les cinq minutes.
     *
     * <p>Le verrou ShedLock évite que deux instances persistent le même lot : les compteurs
     * seraient doublés et l'ordre de grandeur — qui sert justement à prioriser — deviendrait
     * faux.
     */
    @Scheduled(fixedDelay = 300_000)
    @SchedulerLock(name = "rls-audit-flush", lockAtMostFor = "PT4M", lockAtLeastFor = "PT30S")
    @Transactional
    public void viderLeTampon() {
        if (!auditActif) {
            return;
        }
        Map<String, RlsAuditBuffer.Constat> constats = RlsAuditBuffer.viderEtRecuperer();
        if (constats.isEmpty()) {
            return;
        }

        int nouveaux = 0;
        for (RlsAuditBuffer.Constat constat : constats.values()) {
            boolean inedit = repository
                    .findByOriginAndTableName(constat.origin(), constat.tableName())
                    .isEmpty();

            repository.upsert(constat.origin(), constat.tableName(), constat.sqlExcerpt(),
                    constat.lastSeenAt(), constat.occurrences());

            if (inedit) {
                nouveaux++;
                alerterPersonnelPlateforme(constat);
            }
        }

        log.info("RLS/AUDIT : {} chemin(s) persiste(s), dont {} nouveau(x).",
                constats.size(), nouveaux);
    }

    /**
     * Alerte à la <b>première</b> apparition d'un chemin, jamais aux suivantes.
     *
     * <p>Le message dit ce qui se passerait si la RLS était activée en l'état — c'est
     * l'information qui permet de décider s'il faut agir tout de suite ou non. Un
     * avertissement qui ne dit pas ce qu'il risque n'aide pas à trancher.
     */
    private void alerterPersonnelPlateforme(RlsAuditBuffer.Constat constat) {
        String titre = "Isolation RLS : nouveau chemin sans contexte tenant";
        String message = String.format(
                "Une requete sur la table '%s' s'execute sans contexte tenant.%n%n"
                        + "Origine : %s%n%n"
                        + "Consequence si la RLS etait activee en l'etat : cette requete "
                        + "renverrait ZERO ligne, sans lever d'erreur — ecrans vides ou "
                        + "exports incomplets, sans trace dans les logs.%n%n"
                        + "L'activation de la RLS reste bloquee tant que ce chemin n'est pas traite.",
                constat.tableName(), constat.origin());

        notificationService.notifyAllPlatformStaff(
                NotificationKey.OPS_ALERT,
                StringUtils.escapeHtml(titre),
                StringUtils.escapeHtml(message),
                "/admin/monitoring?tab=rls-audit");
    }

    /**
     * Alerte distincte quand le tampon sature : la diversité des chemins dépasse alors ce
     * qui était anticipé, et des constats sont perdus. Le silence qui suivrait serait
     * trompeur — d'où cette alerte, une fois par heure au plus.
     */
    @Scheduled(fixedDelay = 3_600_000)
    @SchedulerLock(name = "rls-audit-saturation", lockAtMostFor = "PT10M")
    public void alerterSiSaturation() {
        if (!auditActif || !RlsAuditBuffer.plafondAtteint()) {
            return;
        }
        notificationService.notifyAllPlatformStaff(
                NotificationKey.OPS_ALERT,
                StringUtils.escapeHtml("Isolation RLS : inventaire sature"),
                StringUtils.escapeHtml(
                        "Le tampon d'audit a atteint son plafond : de nouveaux chemins ne sont "
                                + "plus enregistres. L'inventaire est donc INCOMPLET, et son "
                                + "silence ne vaut plus feu vert. Traiter les chemins deja "
                                + "remontes avant de poursuivre la mesure."),
                "/admin/monitoring?tab=rls-audit");
        log.warn("RLS/AUDIT : tampon sature ({} chemins), personnel plateforme alerte.",
                RlsAuditBuffer.enAttente());
    }

    /** Horodatage de référence pour les tests. */
    static LocalDateTime maintenant() {
        return LocalDateTime.now();
    }
}
