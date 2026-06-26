package com.clenzy.service.storage;

import com.clenzy.service.storage.PhotoStorageMigrationService.MigrationResult;
import com.clenzy.service.storage.PhotoStorageMigrationService.PhotoSnapshot;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de l'orchestration de migration BYTEA -> stockage objet.
 *
 * <p>On mocke {@link PhotoStorageMigrationTx} (couche DB transactionnelle) et
 * {@link ObjectStorageClient} (IO objet) pour exercer la logique du service :
 * upload + verification + ecriture de la cle, idempotence, et garantie de
 * non-alteration du BYTEA en cas d'echec.</p>
 */
@ExtendWith(MockitoExtension.class)
class PhotoStorageMigrationServiceTest {

    @Mock private PhotoStorageMigrationTx tx;
    @Mock private ObjectStorageClient objectStorageClient;
    @InjectMocks private PhotoStorageMigrationService service;

    private static final byte[] BYTES = "image-bytes".getBytes(StandardCharsets.UTF_8);

    /** Page contenant une seule photo (id=1), sans page suivante. */
    private void singlePhotoPage(Long id) {
        final Pageable pageable = PageRequest.of(0, PhotoStorageMigrationService.DEFAULT_BATCH_SIZE);
        final Page<Long> page = new PageImpl<>(List.of(id), pageable, 1);
        when(tx.loadPhotoIdsPage(any(Pageable.class))).thenReturn(page);
    }

    @Nested
    @DisplayName("migration nominale")
    class HappyPath {

        @Test
        @DisplayName("migre une photo BYTEA : put appele + cle objet ecrite dans storageKey")
        void migratesOnePhoto() {
            singlePhotoPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(
                    new PhotoSnapshot(42L, "image/jpeg", BYTES, "1", false));
            // Verification : le re-get renvoie les memes bytes.
            when(objectStorageClient.get(anyString())).thenReturn(BYTES);

            final MigrationResult result = service.migrate(100);

            // put appele avec une cle org-scopee + les bons bytes + content-type.
            final ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
            verify(objectStorageClient).put(keyCaptor.capture(), eq(BYTES), eq("image/jpeg"));
            final String objectKey = keyCaptor.getValue();
            assertThat(objectKey).matches("^org/42/photos/[0-9a-f\\-]+$");

            // La MEME cle est ecrite dans storage_key (c'est ce que l'app lira apres bascule).
            verify(tx).writeStorageKey(1L, objectKey);

            assertThat(result.migrated()).isEqualTo(1);
            assertThat(result.scanned()).isEqualTo(1);
            assertThat(result.failed()).isZero();
        }
    }

    @Nested
    @DisplayName("idempotence")
    class Idempotence {

        @Test
        @DisplayName("photo deja migree (storageKey au format objet) -> sautee, pas de put")
        void skipsAlreadyMigrated() {
            singlePhotoPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(
                    new PhotoSnapshot(42L, "image/jpeg", BYTES, "org/42/photos/abc", true));

            final MigrationResult result = service.migrate(100);

            verify(objectStorageClient, never()).put(anyString(), any(), anyString());
            verify(tx, never()).writeStorageKey(any(Long.class), anyString());
            assertThat(result.skipped()).isEqualTo(1);
            assertThat(result.migrated()).isZero();
        }

        @Test
        @DisplayName("photo sans bytes (externalUrl-only) -> sautee, pas de put")
        void skipsExternalUrlOnly() {
            singlePhotoPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(
                    new PhotoSnapshot(42L, "image/jpeg", null, null, false));

            final MigrationResult result = service.migrate(100);

            verify(objectStorageClient, never()).put(anyString(), any(), anyString());
            assertThat(result.skipped()).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("robustesse / non-destructif")
    class FailureSafety {

        @Test
        @DisplayName("echec d'upload -> storageKey NON ecrit (BYTEA intact), compteur failed")
        void uploadFailureLeavesByteaIntact() {
            singlePhotoPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(
                    new PhotoSnapshot(42L, "image/jpeg", BYTES, "1", false));
            org.mockito.Mockito.doThrow(new IllegalStateException("S3 down"))
                    .when(objectStorageClient).put(anyString(), any(), anyString());

            final MigrationResult result = service.migrate(100);

            // Le storageKey n'est PAS reecrit -> la photo reste resolvable via BYTEA.
            verify(tx, never()).writeStorageKey(any(Long.class), anyString());
            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.migrated()).isZero();
        }

        @Test
        @DisplayName("verification KO (taille differente) -> storageKey NON ecrit, compteur failed")
        void verificationMismatchLeavesByteaIntact() {
            singlePhotoPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(
                    new PhotoSnapshot(42L, "image/jpeg", BYTES, "1", false));
            // Le re-get renvoie des bytes differents (taille differente) -> verification echoue.
            when(objectStorageClient.get(anyString()))
                    .thenReturn("corrupt".getBytes(StandardCharsets.UTF_8));

            final MigrationResult result = service.migrate(100);

            verify(objectStorageClient).put(anyString(), eq(BYTES), eq("image/jpeg"));
            verify(tx, never()).writeStorageKey(any(Long.class), anyString());
            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.migrated()).isZero();
        }
    }
}
