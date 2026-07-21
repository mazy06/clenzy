package com.clenzy.scheduler;

import com.clenzy.model.KbChunk;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.KbChunkRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.kb.EmbeddingService;
import com.clenzy.service.agent.kb.IngestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Sante du pipeline d'embeddings RAG — comble deux angles morts :
 *
 * <ol>
 *   <li><b>Feature EMBEDDINGS jamais assignee</b> : le probe quotidien
 *       ({@link AiModelAvailabilityScheduler}) ne verifie que les modeles deja
 *       configures. Si aucun modele n'est assigne a la feature, le RAG degrade
 *       silencieusement partout (recherche vide, chunks sans vecteur, memoire en
 *       recence) sans aucun signal. Ici : check au boot + quotidien, notification
 *       staff plateforme si la KB contient des chunks introuvables.</li>
 *   <li><b>Chunks orphelins</b> ({@code embedding IS NULL}) : l'ingestion persiste
 *       les chunks meme quand le provider echoue — sans re-embedding, ces docs
 *       restent invisibles a la recherche pour toujours. Ici : job periodique qui
 *       re-embed les orphelins des qu'un modele est disponible.</li>
 * </ol>
 *
 * <p>NB multi-instance : redondant mais sans danger (les deux instances ecriraient
 * les memes vecteurs ; la notification serait dupliquee au pire une fois).</p>
 */
@Component
public class KbEmbeddingHealthScheduler {

    private static final Logger log = LoggerFactory.getLogger(KbEmbeddingHealthScheduler.class);
    /** Aligne sur le batch Voyage (128 inputs max par requete). */
    private static final int REEMBED_BATCH_SIZE = 128;
    /** Garde-fou par run : evite de monopoliser l'API sur une tres grosse panne. */
    private static final int MAX_BATCHES_PER_RUN = 10;

    /** Docs re-decoupes par run quand le chunker a ete bumpe (convergence douce). */
    private static final int REINGEST_BATCH_PER_RUN = 25;

    private final EmbeddingService embeddingService;
    private final KbChunkRepository chunkRepository;
    private final NotificationService notificationService;
    private final IngestionService ingestionService;
    private final boolean enabled;

    public KbEmbeddingHealthScheduler(EmbeddingService embeddingService,
                                        KbChunkRepository chunkRepository,
                                        NotificationService notificationService,
                                        IngestionService ingestionService,
                                        @Value("${clenzy.assistant.kb.health-check-enabled:true}") boolean enabled) {
        this.embeddingService = embeddingService;
        this.chunkRepository = chunkRepository;
        this.notificationService = notificationService;
        this.ingestionService = ingestionService;
        this.enabled = enabled;
    }

    /** Au boot (apres Liquibase) : detecte tout de suite une config manquante. */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        checkConfiguration();
    }

    /** Quotidien 6h15 UTC — apres le probe de disponibilite des modeles (6h). */
    @Scheduled(cron = "0 15 6 * * *")
    @SchedulerLock(name = "kb-embedding-health-check", lockAtMostFor = "PT10M")
    public void runDailyCheck() {
        checkConfiguration();
    }

    /**
     * Toutes les 30 min : (1) re-embed les chunks orphelins, (2) re-ingere un lot
     * de documents decoupes avec un ancien chunker. Les deux exigent un modele
     * EMBEDDINGS disponible.
     */
    @Scheduled(cron = "0 5/30 * * * *")
    @SchedulerLock(name = "kb-embedding-maintenance", lockAtMostFor = "PT20M")
    public void runMaintenance() {
        if (!enabled) return;
        reembedOrphans();
        reingestOutdated();
    }

    void reingestOutdated() {
        if (!embeddingService.isConfigured()) return;
        try {
            ingestionService.reingestOutdatedDocuments(REINGEST_BATCH_PER_RUN);
        } catch (Exception e) {
            log.warn("KbEmbeddingHealthScheduler : re-ingestion chunker echouee : {}", e.getMessage());
        }
    }

    void reembedOrphans() {
        long orphans;
        try {
            orphans = chunkRepository.countByEmbeddingIsNull();
        } catch (Exception e) {
            log.debug("KbEmbeddingHealthScheduler : count orphelins impossible : {}", e.getMessage());
            return;
        }
        if (orphans == 0) return;
        if (!embeddingService.isConfigured()) {
            log.debug("KbEmbeddingHealthScheduler : {} chunks orphelins mais aucun modele EMBEDDINGS — re-embedding differe",
                    orphans);
            return;
        }

        int reembedded = 0;
        for (int batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
            List<KbChunk> chunks = chunkRepository.findByEmbeddingIsNull(
                    PageRequest.of(0, REEMBED_BATCH_SIZE));
            if (chunks.isEmpty()) break;
            try {
                List<String> vectors = embeddingService.embedBatchAsVectorStrings(
                        chunks.stream().map(KbChunk::getContent).toList());
                for (int i = 0; i < chunks.size() && i < vectors.size(); i++) {
                    chunks.get(i).setEmbedding(vectors.get(i));
                }
                chunkRepository.saveAll(chunks);
                reembedded += chunks.size();
            } catch (Exception e) {
                log.warn("KbEmbeddingHealthScheduler : re-embedding interrompu apres {} chunks : {}",
                        reembedded, e.getMessage());
                break;
            }
        }
        if (reembedded > 0) {
            log.info("KbEmbeddingHealthScheduler : {} chunks orphelins re-embeddes ({} restants)",
                    reembedded, Math.max(0, orphans - reembedded));
        }
    }

    /**
     * Notifie le staff plateforme quand la KB contient du contenu mais qu'aucun
     * modele EMBEDDINGS exploitable n'est assigne : c'est le scenario « RAG
     * silencieusement casse post-deploy ». Une KB vide ne declenche rien (pas de
     * bruit sur les environnements ou l'assistant n'est pas utilise).
     */
    void checkConfiguration() {
        if (!enabled) return;
        try {
            if (embeddingService.isConfigured()) return;
            long chunkCount = chunkRepository.count();
            if (chunkCount == 0) return;

            log.warn("KbEmbeddingHealthScheduler : {} chunks en base mais aucun modele EMBEDDINGS "
                    + "assigne — la recherche documentaire de l'assistant est inactive", chunkCount);
            notificationService.notifyAllPlatformStaff(
                    NotificationKey.AI_MODEL_EOL,
                    "Base de connaissances assistant inactive",
                    "La base de connaissances contient " + chunkCount + " extraits mais aucun modele "
                            + "d'embeddings n'est assigne (ou disponible) pour la feature « Embeddings ». "
                            + "L'assistant repond sans documentation Baitly. Assignez un modele dans "
                            + "Parametres > IA.",
                    "/settings?tab=ai");
        } catch (Exception e) {
            log.warn("KbEmbeddingHealthScheduler : check configuration echoue : {}", e.getMessage());
        }
    }
}
