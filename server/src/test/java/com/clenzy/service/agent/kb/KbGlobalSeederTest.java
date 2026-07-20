package com.clenzy.service.agent.kb;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Le corpus reel ({@code src/main/resources/kb/{fr,en,ar}/*.md}) est sur le
 * classpath de test : ces tests verifient a la fois le comportement du seeder
 * ET la presence/structure du corpus multilingue.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KbGlobalSeederTest {

    @Mock private IngestionService ingestionService;

    private KbGlobalSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new KbGlobalSeeder(ingestionService, true);
    }

    @Test
    void seed_ingestsWholeCorpusInGlobalScope_withLangFromSubdir() {
        when(ingestionService.ingestMarkdownIfChanged(anyString(), anyString(), isNull(), anyString()))
                .thenReturn(true);

        int ingested = seeder.seed();

        // 20 fiches par langue (fr toujours ; en/ar selon l'etat du corpus)
        assertTrue(ingested >= 20, "corpus attendu >= 20 fiches, ingere=" + ingested);

        ArgumentCaptor<String> sourcePaths = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> langs = ArgumentCaptor.forClass(String.class);
        verify(ingestionService, atLeast(20)).ingestMarkdownIfChanged(
                sourcePaths.capture(), anyString(), isNull(), langs.capture());

        // sourcePath = baitly/<lang>/<fichier>, lang coherente avec le chemin
        List<String> paths = sourcePaths.getAllValues();
        List<String> langValues = langs.getAllValues();
        for (int i = 0; i < paths.size(); i++) {
            String path = paths.get(i);
            assertTrue(path.startsWith(KbGlobalSeeder.SOURCE_PREFIX),
                    "sourcePath seede doit etre prefixe : " + path);
            assertEquals(path.split("/")[1], langValues.get(i),
                    "la langue doit correspondre au sous-dossier : " + path);
        }
        Set<String> seenLangs = langValues.stream().collect(Collectors.toSet());
        assertTrue(seenLangs.contains("fr"), "le corpus fr doit etre present");
    }

    @Test
    void seed_upToDateCorpus_reportsZeroIngested() {
        when(ingestionService.ingestMarkdownIfChanged(anyString(), anyString(), isNull(), anyString()))
                .thenReturn(false);

        assertEquals(0, seeder.seed());
    }

    @Test
    void seed_disabled_doesNothing() {
        KbGlobalSeeder disabled = new KbGlobalSeeder(ingestionService, false);
        assertEquals(0, disabled.seed());
        verifyNoInteractions(ingestionService);
    }

    @Test
    void seed_singleDocFailure_doesNotBlockRest() {
        when(ingestionService.ingestMarkdownIfChanged(anyString(), anyString(), isNull(), anyString()))
                .thenThrow(new RuntimeException("boom"))
                .thenReturn(true);

        int ingested = seeder.seed();

        // Le 1er doc echoue, les autres passent
        assertTrue(ingested >= 19);
    }
}
