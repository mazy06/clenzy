package com.clenzy.scheduler;

import com.clenzy.service.storage.offload.InlineBinaryOffloadService;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Reprise automatique vers le stockage objet OVH des fichiers encore en base ou sur le disque :
 * un premier passage peu après le démarrage, puis à intervalle régulier. Sans effet tant qu'aucune
 * famille n'est basculée ({@code clenzy.storage.*=object}), donc inerte en développement.
 *
 * <p>Un seul nœud à la fois (ShedLock). Chaque passage reprend tout ce qui reste ; un fichier en
 * échec garde son ancienne copie et est retenté au passage suivant.</p>
 */
@Component
public class StorageOffloadScheduler {

    private final InlineBinaryOffloadService offloadService;

    public StorageOffloadScheduler(InlineBinaryOffloadService offloadService) {
        this.offloadService = offloadService;
    }

    @Scheduled(initialDelayString = "${clenzy.storage.offload.initial-delay-ms:60000}",
            fixedDelayString = "${clenzy.storage.offload.interval-ms:900000}")
    @SchedulerLock(name = "storage-offload", lockAtMostFor = "PT2H")
    public void offload() {
        offloadService.offloadAll();
    }
}
