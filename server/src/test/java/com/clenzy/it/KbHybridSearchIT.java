package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.KbChunk;
import com.clenzy.model.KbDocument;
import com.clenzy.repository.KbChunkRepository;
import com.clenzy.repository.KbDocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;

/**
 * IT pgvector : exerce les DEUX volets SQL de la recherche hybride kb contre un
 * vrai Postgres (image pgvector) — l'operateur cosine {@code <=>}, la colonne
 * generee {@code content_tsv} (websearch_to_tsquery) et le filtre tenant.
 * C'etait un angle mort : ces native queries n'etaient couvertes que par des
 * mocks, une regression de syntaxe pgvector passait les tests.
 */
class KbHybridSearchIT extends AbstractIntegrationTest {

    private static final int DIMS = 1024;

    @Autowired private KbDocumentRepository documentRepository;
    @Autowired private KbChunkRepository chunkRepository;

    private Long globalDocId;
    private Long org1DocId;
    private Long org2DocId;
    private Long enDocId;

    @BeforeEach
    void seedKb() {
        chunkRepository.deleteAll();
        documentRepository.deleteAll();

        // Doc global (visible par toutes les orgs)
        KbDocument global = documentRepository.save(new KbDocument(
                "baitly/taxe.md", "Taxe de sejour", "contenu", "fr", null));
        globalDocId = global.getId();
        chunkRepository.save(new KbChunk(globalDocId, 0,
                "La taxe de sejour est collectee pour chaque reservation.",
                basisVector(0), 12));

        // Doc org 1
        KbDocument org1 = documentRepository.save(new KbDocument(
                "notes/menage.md", "Consignes menage", "contenu", "fr", 1L));
        org1DocId = org1.getId();
        chunkRepository.save(new KbChunk(org1DocId, 0,
                "Le menage de fin de sejour inclut la verification du lave-vaisselle.",
                basisVector(1), 12));

        // Doc org 2 (ne doit JAMAIS remonter pour l'org 1)
        KbDocument org2 = documentRepository.save(new KbDocument(
                "notes/secret.md", "Notes privees", "contenu", "fr", 2L));
        org2DocId = org2.getId();
        chunkRepository.save(new KbChunk(org2DocId, 0,
                "La taxe de sejour de l'organisation deux est confidentielle.",
                basisVector(2), 12));

        // Chunk global sans embedding (panne provider pendant l'ingestion)
        chunkRepository.save(new KbChunk(globalDocId, 1,
                "Le bareme de la taxe de sejour depend de la commune.", null, 12));

        // Doc global ANGLAIS : sert le filtre par langue + le stemming english
        KbDocument globalEn = documentRepository.save(new KbDocument(
                "baitly/en/bookings.md", "Manage bookings", "content", "en", null));
        enDocId = globalEn.getId();
        KbChunk enChunk = new KbChunk(enDocId, 0,
                "You can cancel a booking from the reservation details screen.",
                basisVector(3), 12);
        enChunk.setLang("en");
        chunkRepository.save(enChunk);
    }

    @Test
    void cosineSearch_ordersByDistance_andFiltersTenant() {
        // Query proche de basisVector(0) → le chunk global doit sortir premier
        List<Object[]> rows = chunkRepository.searchByCosineSimilarity(
                basisVector(0), 1L, "fr", 10);

        assertFalse(rows.isEmpty());
        assertEquals(globalDocId, ((Number) rows.get(0)[4]).longValue());
        double bestDistance = ((Number) rows.get(0)[5]).doubleValue();
        assertTrue(bestDistance < 0.01, "distance cosine ~0 attendue : " + bestDistance);
        // Le doc de l'org 2 est exclu, le doc de l'org 1 est present
        assertTrue(rows.stream().noneMatch(r -> ((Number) r[4]).longValue() == org2DocId));
        assertTrue(rows.stream().anyMatch(r -> ((Number) r[4]).longValue() == org1DocId));
        // Le chunk sans embedding est exclu du volet vectoriel
        assertEquals(2, rows.size());
    }

    @Test
    void textSearch_findsExactTerms_filtersTenant_andExposesNullDistance() {
        List<Object[]> rows = chunkRepository.searchByTextRank(
                "taxe de sejour", basisVector(0), 1L, "fr", 10);

        // 2 chunks du doc global matchent « taxe de sejour » ; celui de l'org 2 est exclu
        assertEquals(2, rows.size());
        assertTrue(rows.stream().allMatch(r -> ((Number) r[4]).longValue() == globalDocId));
        // Le chunk sans embedding remonte avec une distance NULL
        assertTrue(rows.stream().anyMatch(r -> r[5] == null));
        // Le chunk avec embedding expose sa distance cosine
        assertTrue(rows.stream().anyMatch(r -> r[5] != null));
    }

    @Test
    void textSearch_noMatch_returnsEmpty() {
        List<Object[]> rows = chunkRepository.searchByTextRank(
                "conciergerie marrakech", basisVector(0), 1L, "fr", 10);
        assertTrue(rows.isEmpty());
    }

    @Test
    void textSearch_englishUser_getsEnglishGlobalDocs_withEnglishStemming() {
        // "cancel bookings" (pluriel) matche "cancel a booking" grace au stemming
        // english — la config de la requete suit la langue de l'utilisateur.
        List<Object[]> rows = chunkRepository.searchByTextRank(
                "cancel bookings", basisVector(0), 1L, "en", 10);
        assertEquals(1, rows.size());
        assertEquals(enDocId, ((Number) rows.get(0)[4]).longValue());
    }

    @Test
    void search_frenchUser_neverSeesEnglishGlobalDocs() {
        // Filtre de langue sur les docs globaux : le doc anglais est invisible en fr
        List<Object[]> text = chunkRepository.searchByTextRank(
                "cancel bookings", basisVector(0), 1L, "fr", 10);
        assertTrue(text.isEmpty());
        List<Object[]> vector = chunkRepository.searchByCosineSimilarity(
                basisVector(3), 1L, "fr", 10);
        assertTrue(vector.stream().noneMatch(r -> ((Number) r[4]).longValue() == enDocId));
        // ... mais visible pour un utilisateur anglophone via le volet vectoriel
        List<Object[]> vectorEn = chunkRepository.searchByCosineSimilarity(
                basisVector(3), 1L, "en", 10);
        assertTrue(vectorEn.stream().anyMatch(r -> ((Number) r[4]).longValue() == enDocId));
    }

    @Test
    void orphanCounters_seeOnlyNullEmbeddings() {
        assertEquals(1, chunkRepository.countByEmbeddingIsNull());
    }

    /** Vecteur unitaire 1024d sur l'axe {@code axis} — distances cosine controlees. */
    private static String basisVector(int axis) {
        StringBuilder sb = new StringBuilder(DIMS * 2 + 2);
        sb.append('[');
        for (int i = 0; i < DIMS; i++) {
            if (i > 0) sb.append(',');
            sb.append(String.format(Locale.ROOT, "%.1f", i == axis ? 1.0 : 0.0));
        }
        return sb.append(']').toString();
    }
}
