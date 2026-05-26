package com.clenzy.scheduler;

import com.clenzy.repository.AssistantMemoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Cleanup hebdomadaire de la memoire long-terme de l'assistant.
 *
 * <p>Cron : lundi 3h UTC ({@code "0 0 3 * * 1"}). Deux types de suppression :
 * <ul>
 *   <li><b>Memoires inactives</b> : {@code last_accessed_at} depuis plus de
 *       {@value #STALE_MONTHS} mois. Le bump est fait a chaque lecture, donc
 *       un user actif voit ses memoires preservees.</li>
 *   <li><b>Memoires expirees</b> : {@code expires_at} renseigne et depasse.
 *       Utilise quand le LLM pose une date limite explicite (ex: "promo Noel
 *       2026").</li>
 * </ul>
 *
 * <p>Une seule query SQL pour les deux cas (efficace, idempotent). Le
 * {@link Clock} est injectable pour les tests deterministes.</p>
 */
@Component
public class AssistantMemoryCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(AssistantMemoryCleanupScheduler.class);
    private static final int STALE_MONTHS = 6;

    private final AssistantMemoryRepository repository;
    private final Clock clock;
    private final boolean enabled;

    public AssistantMemoryCleanupScheduler(AssistantMemoryRepository repository,
                                            @Value("${clenzy.assistant.memory.cleanup-enabled:true}") boolean enabled) {
        this(repository, Clock.systemUTC(), enabled);
    }

    AssistantMemoryCleanupScheduler(AssistantMemoryRepository repository,
                                     Clock clock,
                                     boolean enabled) {
        this.repository = repository;
        this.clock = clock;
        this.enabled = enabled;
    }

    /**
     * Lundi 3h UTC : creneau de faible charge.
     *
     * <p>{@code @Transactional} present ici (et pas seulement sur {@link #runOnce()})
     * pour que la transaction couvre l'execution declenchee par Spring Scheduler :
     * sinon l'appel interne {@code this.runOnce()} bypass le proxy AOP et le
     * {@code @Transactional} de {@code runOnce} est ignore.</p>
     */
    @Scheduled(cron = "0 0 3 * * MON")
    @Transactional
    public void runWeekly() {
        runOnce();
    }

    /**
     * Execution effective — separee du cron pour permettre l'appel direct dans
     * les tests sans avoir a attendre le scheduler Spring. Le {@code @Transactional}
     * sert quand un caller externe (test, endpoint admin) invoque la methode
     * sans transaction existante.
     */
    @Transactional
    public int runOnce() {
        if (!enabled) {
            log.debug("AssistantMemoryCleanupScheduler : disabled, skip");
            return 0;
        }
        LocalDateTime now = LocalDateTime.now(clock.withZone(ZoneId.of("UTC")));
        LocalDateTime staleBefore = now.minusMonths(STALE_MONTHS);
        int deleted;
        try {
            deleted = repository.deleteStaleAndExpired(staleBefore, now);
        } catch (Exception e) {
            log.error("AssistantMemoryCleanupScheduler failed", e);
            return 0;
        }
        if (deleted > 0) {
            log.info("AssistantMemoryCleanupScheduler : {} entrees supprimees "
                    + "(stale before {} OR expires_at < {})",
                    deleted, staleBefore, now);
        } else {
            log.debug("AssistantMemoryCleanupScheduler : aucune entree a supprimer");
        }
        return deleted;
    }
}
