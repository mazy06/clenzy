package com.clenzy.service.retention;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler quotidien de la purge de retention. <b>Totalement inerte par defaut.</b>
 *
 * <p>Bean trivial : il delegue au {@link RetentionPurgeService} et ne contient aucune logique.
 * Il ne declenche une purge automatique que si les <b>deux</b> flags sont actives :
 * {@code clenzy.retention.purge.enabled} ET {@code clenzy.retention.purge.scheduler-enabled}
 * (les deux {@code false} par defaut). Tant que l'un des deux est faux, la methode planifiee est
 * un no-op silencieux — aucune suppression possible via le scheduler.</p>
 *
 * <p>Quand il tourne, il appelle {@code purgeAllConfigured(false)} : purge <b>reelle</b> de toutes
 * les cibles configurees. Le mode reel ici est intentionnel — une purge planifiee qui resterait
 * en dry-run ne supprimerait jamais rien. La protection vient des deux flags d'activation, qui
 * exigent une decision explicite de l'exploitant.</p>
 *
 * <p>Cron : 3h30 UTC tous les jours ({@code "0 30 3 * * *"}), creneau de faible charge, decale du
 * job RGPD existant (3h00) pour ne pas concentrer les suppressions. {@code @EnableScheduling} est
 * actif globalement sur {@code ClenzyApplication}.</p>
 */
@Component
public class RetentionPurgeScheduler {

    private static final Logger log = LoggerFactory.getLogger(RetentionPurgeScheduler.class);

    private final RetentionPurgeService purgeService;
    private final RetentionPurgeProperties properties;

    public RetentionPurgeScheduler(RetentionPurgeService purgeService,
                                   RetentionPurgeProperties properties) {
        this.purgeService = purgeService;
        this.properties = properties;
    }

    /**
     * Creneau quotidien 3h30 UTC. No-op tant que {@code enabled && scheduler-enabled} n'est pas
     * vrai (les deux flags false par defaut) — le scheduler est alors totalement inerte.
     */
    @Scheduled(cron = "0 30 3 * * *")
    public void runDaily() {
        if (!properties.enabled() || !properties.schedulerEnabled()) {
            log.debug("RetentionPurgeScheduler : inactif (enabled={}, schedulerEnabled={}) : skip.",
                    properties.enabled(), properties.schedulerEnabled());
            return;
        }
        log.info("RetentionPurgeScheduler : declenchement de la purge reelle de toutes les cibles configurees.");
        purgeService.purgeAllConfigured(false);
    }
}
