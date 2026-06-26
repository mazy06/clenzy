package com.clenzy.service.storage;

import com.clenzy.service.storage.BinaryAssetMigrationService.AssetSnapshot;
import com.clenzy.service.storage.BinaryAssetMigrationService.MigrationResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de la migration BYTEA -> stockage objet des {@code binary_asset} (avatars).
 *
 * <p>On mocke {@link BinaryAssetMigrationTx} (DB) et {@link ObjectStorageClient} (IO objet). La cle
 * objet = la cle logique verbatim ; aucune reecriture DB. Idempotence par {@code exists}.</p>
 */
@ExtendWith(MockitoExtension.class)
class BinaryAssetMigrationServiceTest {

    private static final String BUCKET = "clenzy-media";
    private static final String KEY = "users/42/abc.png";
    private static final byte[] BYTES = "avatar-bytes".getBytes(StandardCharsets.UTF_8);

    @Mock private BinaryAssetMigrationTx tx;
    @Mock private ObjectStorageClient objectStorageClient;
    @InjectMocks private BinaryAssetMigrationService service;

    private void singleAssetPage(Long id) {
        final Pageable pageable = PageRequest.of(0, BinaryAssetMigrationService.DEFAULT_BATCH_SIZE);
        final Page<Long> page = new PageImpl<>(List.of(id), pageable, 1);
        when(tx.loadAssetIdsPage(any(Pageable.class))).thenReturn(page);
        lenient().when(objectStorageClient.bucket()).thenReturn(BUCKET);
    }

    @Nested
    @DisplayName("migration nominale")
    class HappyPath {

        @Test
        @DisplayName("copie un asset BYTEA : put sous la cle logique verbatim, pas de reecriture DB")
        void migratesOneAsset() {
            singleAssetPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(new AssetSnapshot(KEY, "image/png", BYTES));
            when(objectStorageClient.exists(BUCKET, KEY)).thenReturn(false);
            when(objectStorageClient.get(BUCKET, KEY)).thenReturn(BYTES);

            final MigrationResult result = service.migrate(100);

            verify(objectStorageClient).put(BUCKET, KEY, BYTES, "image/png");
            assertThat(result.migrated()).isEqualTo(1);
            assertThat(result.failed()).isZero();
        }
    }

    @Nested
    @DisplayName("idempotence")
    class Idempotence {

        @Test
        @DisplayName("objet deja present -> saute, pas de put")
        void skipsWhenObjectExists() {
            singleAssetPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(new AssetSnapshot(KEY, "image/png", BYTES));
            when(objectStorageClient.exists(BUCKET, KEY)).thenReturn(true);

            final MigrationResult result = service.migrate(100);

            verify(objectStorageClient, never()).put(anyString(), anyString(), any(), anyString());
            assertThat(result.skipped()).isEqualTo(1);
            assertThat(result.migrated()).isZero();
        }

        @Test
        @DisplayName("asset sans bytes -> saute, pas de put")
        void skipsNoBytes() {
            singleAssetPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(new AssetSnapshot(KEY, "image/png", null));
            when(objectStorageClient.exists(BUCKET, KEY)).thenReturn(false);

            final MigrationResult result = service.migrate(100);

            verify(objectStorageClient, never()).put(anyString(), anyString(), any(), anyString());
            assertThat(result.skipped()).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("robustesse / non-destructif")
    class FailureSafety {

        @Test
        @DisplayName("verification KO (taille differente) -> compteur failed, BYTEA jamais touche")
        void verificationMismatch_failed() {
            singleAssetPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(new AssetSnapshot(KEY, "image/png", BYTES));
            when(objectStorageClient.exists(BUCKET, KEY)).thenReturn(false);
            when(objectStorageClient.get(BUCKET, KEY))
                    .thenReturn("corrupt".getBytes(StandardCharsets.UTF_8));

            final MigrationResult result = service.migrate(100);

            verify(objectStorageClient).put(BUCKET, KEY, BYTES, "image/png");
            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.migrated()).isZero();
        }

        @Test
        @DisplayName("echec d'upload -> compteur failed (le binary_asset reste source de verite)")
        void uploadFailure_failed() {
            singleAssetPage(1L);
            when(tx.loadSnapshot(1L)).thenReturn(new AssetSnapshot(KEY, "image/png", BYTES));
            when(objectStorageClient.exists(BUCKET, KEY)).thenReturn(false);
            org.mockito.Mockito.doThrow(new IllegalStateException("S3 down"))
                    .when(objectStorageClient).put(eq(BUCKET), eq(KEY), any(), anyString());

            final MigrationResult result = service.migrate(100);

            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.migrated()).isZero();
        }
    }
}
