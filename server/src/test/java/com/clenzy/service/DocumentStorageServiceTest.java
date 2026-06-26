package com.clenzy.service;

import com.clenzy.service.storage.DocumentBinaryStore;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.ObjectProvider;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Verifie le seam disque/objet de {@link DocumentStorageService} selon le flag
 * {@code clenzy.storage.documents} (materialise par la disponibilite d'un
 * {@link DocumentBinaryStore} via l'{@link ObjectProvider}).
 */
class DocumentStorageServiceTest {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    @SuppressWarnings("unchecked")
    private static ObjectProvider<DocumentBinaryStore> providerOf(DocumentBinaryStore store) {
        ObjectProvider<DocumentBinaryStore> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(store);
        return provider;
    }

    @Nested
    @DisplayName("flag absent (defaut) → disque")
    class DefaultDisk {

        @TempDir
        Path tempDir;

        @Test
        @DisplayName("ecrit sur le disque et n'instancie aucun stockage objet")
        void writesToDiskWhenNoObjectStore() throws IOException {
            MeterRegistry registry = new SimpleMeterRegistry();
            DocumentStorageService service =
                    new DocumentStorageService(tempDir.toString(), registry, providerOf(null));
            service.init();

            byte[] pdf = "PDF-bytes".getBytes(StandardCharsets.UTF_8);
            String ref = service.store("FACTURE", "facture.pdf", pdf);

            String monthDir = LocalDate.now().format(MONTH_FMT);
            assertThat(ref).startsWith("FACTURE/" + monthDir + "/");
            assertThat(ref).endsWith("_facture.pdf");

            Path onDisk = tempDir.resolve(ref);
            assertThat(Files.exists(onDisk)).isTrue();
            assertThat(Files.readAllBytes(onDisk)).isEqualTo(pdf);
        }
    }

    @Nested
    @DisplayName("flag object → delegue a la strategie objet")
    class ObjectMode {

        @TempDir
        Path tempDir;

        @Test
        @DisplayName("delegue write() a la strategie objet et ne touche pas le disque")
        void delegatesToObjectStore() {
            MeterRegistry registry = new SimpleMeterRegistry();
            DocumentBinaryStore objectStore = mock(DocumentBinaryStore.class);
            when(objectStore.write(any(), any(), any())).thenReturn("org/42/documents/FACTURE/x.pdf");

            DocumentStorageService service =
                    new DocumentStorageService(tempDir.toString(), registry, providerOf(objectStore));
            service.init();

            byte[] pdf = "PDF-bytes".getBytes(StandardCharsets.UTF_8);
            String ref = service.store("FACTURE", "facture.pdf", pdf);

            assertThat(ref).isEqualTo("org/42/documents/FACTURE/x.pdf");
            // La cle logique passee a la strategie garde la structure {type}/{yyyy-MM}/{uuid}_{filename}.
            String monthDir = LocalDate.now().format(MONTH_FMT);
            verify(objectStore).write(
                    org.mockito.ArgumentMatchers.argThat(k ->
                            k.startsWith("FACTURE/" + monthDir + "/") && k.endsWith("_facture.pdf")),
                    eq(pdf), eq("application/pdf"));
        }

        @Test
        @DisplayName("load delegue a la strategie objet (pas de lecture disque)")
        void loadDelegatesToObjectStore() {
            MeterRegistry registry = new SimpleMeterRegistry();
            DocumentBinaryStore objectStore = mock(DocumentBinaryStore.class);
            DocumentStorageService service =
                    new DocumentStorageService(tempDir.toString(), registry, providerOf(objectStore));
            service.init();

            service.load("org/42/documents/FACTURE/x.pdf");

            verify(objectStore).load("org/42/documents/FACTURE/x.pdf");
        }

        @Test
        @DisplayName("loadAsBytes delegue a la strategie objet")
        void loadAsBytesDelegates() {
            MeterRegistry registry = new SimpleMeterRegistry();
            DocumentBinaryStore objectStore = mock(DocumentBinaryStore.class);
            when(objectStore.loadAsBytes("org/42/documents/FACTURE/x.pdf"))
                    .thenReturn("data".getBytes(StandardCharsets.UTF_8));
            DocumentStorageService service =
                    new DocumentStorageService(tempDir.toString(), registry, providerOf(objectStore));
            service.init();

            assertThat(service.loadAsBytes("org/42/documents/FACTURE/x.pdf"))
                    .isEqualTo("data".getBytes(StandardCharsets.UTF_8));
            verify(objectStore).loadAsBytes("org/42/documents/FACTURE/x.pdf");
        }
    }
}
