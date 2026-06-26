package com.clenzy.service.storage;

import com.clenzy.service.storage.BinaryAssetStorage.StoredBinaryAsset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests du stockage objet des {@link BinaryAssetStorage} (avatars).
 *
 * <p>Particularite vs photos/documents : la cle logique (ex {@code users/42/<uuid>.png}) est
 * stockee <b>verbatim</b> comme cle objet (pas de prefixe org). On verifie que store/load/delete
 * delegent au {@link ObjectStorageClient} sur le bucket media avec la cle inchangee.</p>
 */
@ExtendWith(MockitoExtension.class)
class ObjectBinaryAssetStorageTest {

    private static final String BUCKET = "clenzy-media";
    private static final String KEY = "users/42/abc-123.png";
    private static final byte[] BYTES = "avatar".getBytes(StandardCharsets.UTF_8);

    @Mock private ObjectStorageClient client;

    private ObjectBinaryAssetStorage storage;

    @BeforeEach
    void setUp() {
        lenient().when(client.bucket()).thenReturn(BUCKET);
        storage = new ObjectBinaryAssetStorage(client);
    }

    @Nested
    @DisplayName("store")
    class Store {

        @Test
        @DisplayName("delegue a client.put avec la cle logique verbatim + content-type")
        void delegatesPutVerbatim() {
            storage.store(KEY, "image/png", BYTES);

            verify(client).put(BUCKET, KEY, BYTES, "image/png");
        }

        @Test
        @DisplayName("content-type null -> application/octet-stream")
        void nullContentType_defaults() {
            storage.store(KEY, null, BYTES);

            verify(client).put(BUCKET, KEY, BYTES, "application/octet-stream");
        }
    }

    @Nested
    @DisplayName("load")
    class Load {

        @Test
        @DisplayName("objet present -> bytes lus depuis le bucket media")
        void present_returnsBytes() {
            when(client.exists(BUCKET, KEY)).thenReturn(true);
            when(client.get(BUCKET, KEY)).thenReturn(BYTES);

            Optional<StoredBinaryAsset> result = storage.load(KEY);

            assertThat(result).isPresent();
            assertThat(result.get().bytes()).isEqualTo(BYTES);
            assertThat(result.get().fileSize()).isEqualTo(BYTES.length);
        }

        @Test
        @DisplayName("objet absent -> Optional.empty, pas de get")
        void absent_empty() {
            when(client.exists(BUCKET, KEY)).thenReturn(false);

            assertThat(storage.load(KEY)).isEmpty();
            verify(client).exists(BUCKET, KEY);
        }
    }

    @Nested
    @DisplayName("exists / delete")
    class ExistsDelete {

        @Test
        @DisplayName("exists delegue a client.exists")
        void existsDelegates() {
            when(client.exists(BUCKET, KEY)).thenReturn(true);

            assertThat(storage.exists(KEY)).isTrue();
        }

        @Test
        @DisplayName("cle null/blanche -> exists=false, pas d'IO objet")
        void blankKey_noIo() {
            assertThat(storage.exists(null)).isFalse();
            assertThat(storage.exists("  ")).isFalse();
        }

        @Test
        @DisplayName("delete delegue a client.delete avec la cle verbatim")
        void deleteDelegates() {
            storage.delete(KEY);

            verify(client).delete(BUCKET, KEY);
        }

        @Test
        @DisplayName("delete cle null -> no-op, pas d'IO objet")
        void deleteNull_noOp() {
            ObjectStorageClient freshClient = org.mockito.Mockito.mock(ObjectStorageClient.class);
            ObjectBinaryAssetStorage freshStorage = new ObjectBinaryAssetStorage(freshClient);

            freshStorage.delete(null);

            verifyNoInteractions(freshClient);
        }
    }
}
