package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.service.PlatformAiConfigService;
import com.clenzy.service.agent.kb.KbGlobalSeeder;
import com.clenzy.service.agent.kb.KbRetrievalEvalService;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.util.Locale;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * Evaluation OFFLINE du retrieval avec la VRAIE API Voyage, hors production —
 * meme logique que le bouton « Evaluer le retrieval » de l'ecran admin
 * ({@link KbRetrievalEvalService} partage), mais sur un environnement jetable
 * (Testcontainers) avec seed complet du corpus. Utile AVANT deploiement pour
 * mesurer l'impact d'un changement de chunking/seuils/modele.
 *
 * <p>Execution :
 * <pre>
 * CLENZY_IT=true TESTCONTAINERS_RYUK_DISABLED=true \
 * CLENZY_RAG_EVAL_VOYAGE_KEY=pa-... \
 * [CLENZY_RAG_EVAL_MODEL=voyage-3-large] \
 * mvn test -Dtest=KbRetrievalEvalIT
 * </pre>
 * Sans {@code CLENZY_RAG_EVAL_VOYAGE_KEY}, le test est skippe proprement.
 * En production, utiliser plutot le bouton dans Parametres > IA > Base de
 * connaissances (aucune variable requise, la cle vient de la config DB).</p>
 */
@TestPropertySource(properties = "clenzy.assistant.kb.seed-enabled=true")
class KbRetrievalEvalIT extends AbstractIntegrationTest {

    private static final String EVAL_KEY = System.getenv("CLENZY_RAG_EVAL_VOYAGE_KEY");
    private static final String EVAL_MODEL = System.getenv().getOrDefault(
            "CLENZY_RAG_EVAL_MODEL", "voyage-3-large");
    /** Plancher assume : en-dessous, le retrieval est objectivement casse. */
    private static final double MIN_RECALL_AT_4 = 0.60;

    @Autowired private KbGlobalSeeder kbGlobalSeeder;
    @Autowired private KbRetrievalEvalService kbRetrievalEvalService;
    @Autowired private com.clenzy.repository.KbDocumentRepository kbDocumentRepository;
    @Autowired private com.clenzy.repository.KbChunkRepository kbChunkRepository;

    /**
     * Remplace la config IA DB : le modele EMBEDDINGS pointe vers la vraie API
     * Voyage avec la cle d'eval (le rerank Voyage reutilise ces credentials →
     * le pipeline evalue est EXACTEMENT celui de la prod : hybride + RRF + rerank).
     */
    @MockBean private PlatformAiConfigService platformAiConfigService;

    @BeforeEach
    void wireEvalModel() {
        Assumptions.assumeTrue(EVAL_KEY != null && !EVAL_KEY.isBlank(),
                "CLENZY_RAG_EVAL_VOYAGE_KEY absente — eval retrieval skippee");
        PlatformAiModel model = new PlatformAiModel();
        model.setProvider("voyage");
        model.setModelId(EVAL_MODEL);
        model.setApiKey(EVAL_KEY);
        model.setAvailabilityStatus(AiModelAvailability.AVAILABLE);
        lenient().when(platformAiConfigService.getActiveModelForFeature(anyString()))
                .thenReturn(Optional.of(model));
    }

    @Test
    void recallAt4_onGoldenSet_meetsFloor() {
        // Seed du corpus reel avec de vrais embeddings. Le seed du boot de
        // contexte a pu ingerer les docs SANS embeddings (config mockee pas
        // encore stubbee) : on repart d'une base vide.
        kbChunkRepository.deleteAll();
        kbDocumentRepository.deleteAll();
        int ingested = kbGlobalSeeder.seed();
        assertTrue(ingested >= 20, "le corpus doit etre seede (ingere=" + ingested + ")");

        KbRetrievalEvalService.EvalReport report = kbRetrievalEvalService.evaluate();

        StringBuilder out = new StringBuilder();
        out.append(String.format(Locale.ROOT,
                "%n=== EVAL RETRIEVAL KB (modele=%s) ===%nrecall@%d = %.2f (%d/%d)   MRR = %.3f%n",
                EVAL_MODEL, KbRetrievalEvalService.TOP_K,
                report.recallAtK(), report.hits(), report.total(), report.mrr()));
        report.entries().stream().filter(e -> e.rank() != 0).forEach(e ->
                out.append(String.format(Locale.ROOT, "[%s] « %s »  attendu=%s  obtenu=%s%n",
                        e.rank() < 0 ? "MISS" : "rang " + (e.rank() + 1),
                        e.question(), e.expected(), e.retrieved())));
        System.out.println(out);

        assertTrue(report.recallAtK() >= MIN_RECALL_AT_4, String.format(Locale.ROOT,
                "recall@%d %.2f sous le plancher %.2f — voir le rapport ci-dessus",
                KbRetrievalEvalService.TOP_K, report.recallAtK(), MIN_RECALL_AT_4));
    }
}
