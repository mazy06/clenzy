package com.clenzy.service.agent.kb;

import com.clenzy.model.KbChunk;
import com.clenzy.model.KbDocument;
import com.clenzy.repository.KbChunkRepository;
import com.clenzy.repository.KbDocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

class IngestionServiceTest {

    private KbDocumentRepository documentRepository;
    private KbChunkRepository chunkRepository;
    private EmbeddingService embeddingService;
    private IngestionService service;

    @BeforeEach
    void setUp() {
        documentRepository = mock(KbDocumentRepository.class);
        chunkRepository = mock(KbChunkRepository.class);
        embeddingService = mock(EmbeddingService.class);
        service = new IngestionService(documentRepository, chunkRepository, embeddingService,
                mock(org.springframework.transaction.PlatformTransactionManager.class));

        when(documentRepository.save(any(KbDocument.class))).thenAnswer(inv -> {
            KbDocument d = inv.getArgument(0);
            if (d.getId() == null) d.setId(1L);
            return d;
        });
        when(chunkRepository.save(any(KbChunk.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void extractTitle_picksFirstH1() {
        assertEquals("Mon titre",
                service.extractTitle("# Mon titre\n\nContenu", "doc.md"));
        assertEquals("Section 2",
                service.extractTitle("intro\n## Section 1\n# Section 2\n", "doc.md"));
    }

    @Test
    void extractTitle_fallsBackToFilename() {
        assertEquals("guide onboarding",
                service.extractTitle("pas de h1", "/path/to/guide_onboarding.md"));
        assertEquals("readme",
                service.extractTitle("texte sans header", "/path/to/readme.md"));
    }

    @Test
    void splitIntoChunks_simpleDoc_yieldsOneChunk() {
        List<String> chunks = service.splitIntoChunks("# Titre\nContenu court.");
        assertEquals(1, chunks.size());
        assertTrue(chunks.get(0).contains("Contenu court"));
    }

    @Test
    void splitIntoChunks_splitsBySection() {
        String md = """
                # Titre principal
                Intro non trivialement courte pour passer le seuil minimum.
                Encore quelques mots pour bien remplir.

                ## Section A
                Contenu A.

                ## Section B
                Contenu B.
                """;
        List<String> chunks = service.splitIntoChunks(md);
        // Preambule (avec H1 trop court devrait etre garde si > MIN_CHARS_PER_CHUNK)
        // + 2 sections H2
        assertTrue(chunks.size() >= 2);
        assertTrue(chunks.stream().anyMatch(c -> c.contains("## Section A")));
        assertTrue(chunks.stream().anyMatch(c -> c.contains("## Section B")));
    }

    @Test
    void splitIntoChunks_largeSection_reChunkedByParagraph() {
        // Section unique de 6000+ caracteres → re-decoupage
        String big = "## Section\n\n" + "a".repeat(900) + "\n\n" + "b".repeat(900)
                + "\n\n" + "c".repeat(900) + "\n\n" + "d".repeat(900);
        List<String> chunks = service.splitIntoChunks(big);
        assertTrue(chunks.size() > 1, "Section trop longue doit etre re-chunked");
        chunks.forEach(c -> assertTrue(c.length() <= 2500,
                "Chaque chunk doit rester sous ~2000 caracteres : " + c.length()));
    }

    @Test
    void splitIntoChunks_subChunks_keepSectionTitleAsContinuation() {
        // Section > 2000 chars avec paragraphes courts → re-decoupage : les
        // sous-chunks suivants doivent porter le titre de section "(suite)"
        String big = "## Politique d'annulation\n\n" + ("phrase utile. ".repeat(40) + "\n\n").repeat(8);
        List<String> chunks = service.splitIntoChunks(big);
        assertTrue(chunks.size() > 1);
        assertTrue(chunks.get(0).startsWith("## Politique d'annulation"));
        for (int i = 1; i < chunks.size(); i++) {
            assertTrue(chunks.get(i).startsWith("## Politique d'annulation (suite)"),
                    "Sous-chunk " + i + " doit garder le contexte de section");
        }
    }

    @Test
    void splitIntoChunks_withDocTitle_prefixesChunksWithoutH1() {
        String md = "intro assez longue pour depasser le seuil minimal de deux cents caracteres, "
                + "encore quelques mots pour y arriver tranquillement sans forcer le remplissage."
                + "x".repeat(80)
                + "\n\n## Section A\nContenu A.\n\n## Section B\nContenu B.";
        List<String> chunks = service.splitIntoChunks(md, "Guide des reservations");
        assertFalse(chunks.isEmpty());
        chunks.forEach(c -> assertTrue(c.startsWith("Document : Guide des reservations"),
                "Chaque chunk sans H1 doit etre contextualise : " + c.substring(0, Math.min(60, c.length()))));
    }

    @Test
    void splitByParagraph_overlapCarriesLastShortParagraph() {
        // Paragraphes de ~150 chars (< OVERLAP_MAX_CHARS=240) → l'overlap s'applique :
        // le premier paragraphe d'un sous-chunk n>0 repete le dernier du precedent
        StringBuilder md = new StringBuilder("## Section\n\n");
        for (int i = 0; i < 30; i++) {
            md.append("p").append(i).append(" ").append("mot ".repeat(35)).append("\n\n");
        }
        List<String> chunks = service.splitIntoChunks(md.toString());
        assertTrue(chunks.size() > 1);
        // Le chunk 2 commence par le dernier paragraphe du chunk 1 (apres le titre "(suite)")
        String tailOfFirst = chunks.get(0).substring(chunks.get(0).lastIndexOf("\n\n") + 2);
        assertTrue(chunks.get(1).contains(tailOfFirst.substring(0, Math.min(20, tailOfFirst.length()))),
                "Le sous-chunk suivant doit reprendre le dernier paragraphe du precedent");
    }

    @Test
    void ingestMarkdown_savesDocumentAndChunks() {
        when(documentRepository.findBySourcePathAndOrg(any(), any())).thenReturn(Optional.empty());
        when(embeddingService.embedBatchAsVectorStrings(anyList()))
                .thenAnswer(inv -> {
                    List<String> texts = inv.getArgument(0);
                    return texts.stream().map(t -> "[0.1,0.2,0.3]").toList();
                });

        String md = "# Titre\n\nIntro tres longue " + "x".repeat(300)
                + "\n\n## Section A\nContenu A " + "y".repeat(200)
                + "\n\n## Section B\nContenu B";

        KbDocument doc = service.ingestMarkdown("doc.md", md, null);

        assertNotNull(doc);
        assertEquals("Titre", doc.getTitle());
        verify(documentRepository).save(any(KbDocument.class));
        // Au moins 2 chunks sauves
        ArgumentCaptor<KbChunk> cap = ArgumentCaptor.forClass(KbChunk.class);
        verify(chunkRepository, atLeast(2)).save(cap.capture());
        // Chaque chunk a un embedding non-null
        cap.getAllValues().forEach(c -> assertNotNull(c.getEmbedding()));
    }

    @Test
    void ingestMarkdown_reIngest_deletesOldChunksFirst() {
        KbDocument existing = new KbDocument("doc.md", "Old", "old content", "fr", null);
        existing.setId(42L);
        when(documentRepository.findBySourcePathAndOrg("doc.md", null))
                .thenReturn(Optional.of(existing));
        when(embeddingService.embedBatchAsVectorStrings(anyList()))
                .thenReturn(List.of("[0,0,0]"));

        service.ingestMarkdown("doc.md", "# Nouveau titre\nContenu", null);

        verify(chunkRepository).deleteByDocumentId(42L);
    }

    @Test
    void ingestMarkdown_embeddingFailure_savesChunksWithoutEmbedding() {
        when(documentRepository.findBySourcePathAndOrg(any(), any())).thenReturn(Optional.empty());
        when(embeddingService.embedBatchAsVectorStrings(anyList()))
                .thenThrow(new EmbeddingProvider.EmbeddingException("API down"));

        KbDocument doc = service.ingestMarkdown("doc.md", "# Titre\nContenu", null);

        assertNotNull(doc);
        ArgumentCaptor<KbChunk> cap = ArgumentCaptor.forClass(KbChunk.class);
        verify(chunkRepository, atLeastOnce()).save(cap.capture());
        // Embeddings null mais les chunks sont quand meme sauves
        cap.getAllValues().forEach(c -> assertNull(c.getEmbedding()));
    }

    @Test
    void ingestMarkdown_blankContent_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> service.ingestMarkdown("doc.md", "", null));
        assertThrows(IllegalArgumentException.class,
                () -> service.ingestMarkdown("doc.md", null, null));
    }

    @Test
    void deleteDocument_ownershipChecked() {
        KbDocument global = new KbDocument("global.md", "Global", "content", "fr", null);
        global.setId(7L);
        when(documentRepository.findById(7L)).thenReturn(Optional.of(global));

        // Non-admin → refuse de supprimer un doc global
        assertThrows(SecurityException.class,
                () -> service.deleteDocument(7L, 1L, false));

        // Admin → OK
        service.deleteDocument(7L, 1L, true);
        verify(documentRepository).delete(global);
    }

    @Test
    void deleteDocument_crossOrg_refused() {
        KbDocument otherOrgDoc = new KbDocument("doc.md", "T", "content", "fr", 2L);
        otherOrgDoc.setId(8L);
        when(documentRepository.findById(8L)).thenReturn(Optional.of(otherOrgDoc));

        assertThrows(SecurityException.class,
                () -> service.deleteDocument(8L, 1L, false));
    }
}
