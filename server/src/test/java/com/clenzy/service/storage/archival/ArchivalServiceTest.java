package com.clenzy.service.storage.archival;

import com.clenzy.service.storage.ObjectStorageClient;
import com.clenzy.service.storage.archival.ArchivalService.ArchivalResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires du moteur d'archivage froid.
 *
 * <p>On mocke {@link ObjectStorageClient} (IO objet) et on injecte une {@link ArchivalSource}
 * factice + un vrai {@link ObjectMapper}. Invariants verifies : inerte si desactive, export
 * vers le bucket d'archive si active, et <b>aucune suppression</b> (le moteur n'expose aucune
 * methode de delete et n'appelle jamais {@code delete} sur le client).</p>
 */
@ExtendWith(MockitoExtension.class)
class ArchivalServiceTest {

    @Mock private ObjectStorageClient objectStorageClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String TARGET = "reservations-cold";

    /** Ligne d'archive serialisable (record immuable), comme attendu d'une vraie ArchivalSource. */
    record SampleRow(long id, String label) {}

    /** Source factice : une page de 2 lignes, puis vide (fin d'export). */
    private static ArchivalSource sourceWithTwoRows() {
        return new ArchivalSource() {
            @Override
            public String targetName() {
                return TARGET;
            }

            @Override
            public List<?> fetchBatch(Pageable pageable) {
                if (pageable.getPageNumber() == 0) {
                    return List.of(new SampleRow(1L, "a"), new SampleRow(2L, "b"));
                }
                return List.of();
            }
        };
    }

    private ArchivalProperties props(boolean enabled, ArchivalProperties.Target... targets) {
        return new ArchivalProperties(enabled, 500, List.of(targets));
    }

    private ArchivalProperties.Target target() {
        return new ArchivalProperties.Target(TARGET, "Reservations cloturees anciennes");
    }

    @Nested
    @DisplayName("desactive par defaut (inerte)")
    class Disabled {

        @Test
        @DisplayName("enabled=false -> no-op : aucune lecture source, aucun putArchive")
        void disabledIsNoop() {
            // Source presente mais ne doit jamais etre lue quand desactive.
            final ArchivalService service = new ArchivalService(
                    props(false, target()), objectStorageClient, objectMapper,
                    List.of(sourceWithTwoRows()));

            final ArchivalResult result = service.archive(TARGET);

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("archival-disabled");
            assertThat(result.records()).isZero();
            verify(objectStorageClient, never()).putArchive(anyString(), any(), anyString());
            verify(objectStorageClient, never()).isArchiveConfigured();
        }
    }

    @Nested
    @DisplayName("active : export")
    class Enabled {

        @Test
        @DisplayName("enabled=true + source -> exporte un echantillon NDJSON vers le bucket d'archive")
        void exportsSampleToArchiveBucket() {
            when(objectStorageClient.isArchiveConfigured()).thenReturn(true);
            lenient().when(objectStorageClient.archiveBucket()).thenReturn("clenzy-cold-archive");

            final ArchivalService service = new ArchivalService(
                    props(true, target()), objectStorageClient, objectMapper,
                    List.of(sourceWithTwoRows()));

            final ArchivalResult result = service.archive(TARGET);

            // Une seule page (2 lignes < batchSize) -> un seul putArchive, cle deterministe.
            final ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
            final ArgumentCaptor<byte[]> bytesCaptor = ArgumentCaptor.forClass(byte[].class);
            verify(objectStorageClient, times(1))
                    .putArchive(keyCaptor.capture(), bytesCaptor.capture(), anyString());

            assertThat(keyCaptor.getValue()).isEqualTo("archive/" + TARGET + "/page-000000.ndjson");

            final String ndjson = new String(bytesCaptor.getValue(), StandardCharsets.UTF_8);
            // NDJSON : une ligne JSON par enregistrement, terminee par un saut de ligne.
            assertThat(ndjson).contains("\"id\":1").contains("\"label\":\"a\"")
                    .contains("\"id\":2").contains("\"label\":\"b\"");
            assertThat(ndjson.lines()).hasSize(2);

            assertThat(result.executed()).isTrue();
            assertThat(result.batches()).isEqualTo(1);
            assertThat(result.records()).isEqualTo(2);
        }

        @Test
        @DisplayName("n'efface RIEN : aucun delete n'est appele sur le client objet")
        void neverDeletesAnything() {
            when(objectStorageClient.isArchiveConfigured()).thenReturn(true);
            lenient().when(objectStorageClient.archiveBucket()).thenReturn("clenzy-cold-archive");

            final ArchivalService service = new ArchivalService(
                    props(true, target()), objectStorageClient, objectMapper,
                    List.of(sourceWithTwoRows()));

            service.archive(TARGET);

            // Aucune des deux signatures de delete ne doit etre invoquee.
            verify(objectStorageClient, never()).delete(anyString());
            verify(objectStorageClient, never()).delete(anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("garde-fous (no-op explicite)")
    class Guards {

        @Test
        @DisplayName("cible inconnue -> no-op (unknown-target), pas d'IO objet")
        void unknownTargetIsNoop() {
            final ArchivalService service = new ArchivalService(
                    props(true, target()), objectStorageClient, objectMapper,
                    List.of(sourceWithTwoRows()));

            final ArchivalResult result = service.archive("does-not-exist");

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("unknown-target");
            verify(objectStorageClient, never()).putArchive(anyString(), any(), anyString());
        }

        @Test
        @DisplayName("bucket d'archive non configure -> no-op (archive-bucket-missing)")
        void missingArchiveBucketIsNoop() {
            when(objectStorageClient.isArchiveConfigured()).thenReturn(false);

            final ArchivalService service = new ArchivalService(
                    props(true, target()), objectStorageClient, objectMapper,
                    List.of(sourceWithTwoRows()));

            final ArchivalResult result = service.archive(TARGET);

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("archive-bucket-missing");
            verify(objectStorageClient, never()).putArchive(anyString(), any(), anyString());
        }

        @Test
        @DisplayName("aucune source enregistree pour la cible -> no-op (no-source-registered)")
        void noSourceRegisteredIsNoop() {
            when(objectStorageClient.isArchiveConfigured()).thenReturn(true);

            // Cible configuree mais AUCUNE ArchivalSource fournie (cas par defaut de la phase).
            final ArchivalService service = new ArchivalService(
                    props(true, target()), objectStorageClient, objectMapper,
                    List.of());

            final ArchivalResult result = service.archive(TARGET);

            assertThat(result.executed()).isFalse();
            assertThat(result.reason()).isEqualTo("no-source-registered");
            verify(objectStorageClient, never()).putArchive(anyString(), any(), anyString());
        }
    }
}
