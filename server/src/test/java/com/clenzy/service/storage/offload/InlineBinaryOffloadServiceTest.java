package com.clenzy.service.storage.offload;

import com.clenzy.service.storage.ObjectStorageClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * La reprise ne supprime jamais l'ancienne copie d'un fichier tant que l'objet n'est pas écrit et
 * relu à l'identique ; un échec n'arrête pas les autres fichiers.
 */
@ExtendWith(MockitoExtension.class)
class InlineBinaryOffloadServiceTest {

    @Mock private ObjectStorageClient client;
    @Mock private InlineBinarySource source;

    private InlineBinaryOffloadService service;

    private final PendingBinary photo = new PendingBinary(4L, "image/jpeg", new byte[]{1, 2, 3}, null);

    @BeforeEach
    void setUp() {
        service = new InlineBinaryOffloadService(client, List.of(source));
        lenient().when(source.active()).thenReturn(true);
        lenient().when(source.family()).thenReturn("photos-logements");
        lenient().when(source.bucket()).thenReturn(InlineBinarySource.Bucket.MEDIA);
        lenient().when(client.bucket()).thenReturn("baitly-media");
        lenient().when(client.documentsBucket()).thenReturn("baitly-media");
    }

    private void pending(Long... ids) {
        when(source.pendingIdsAfter(0L, InlineBinaryOffloadService.BATCH_SIZE)).thenReturn(List.of(ids));
        lenient().when(source.pendingIdsAfter(ids[ids.length - 1], InlineBinaryOffloadService.BATCH_SIZE))
                .thenReturn(List.of());
    }

    @Test
    void whenTheCopyIsIdentical_thenCompletesAndErasesTheOldCopy() {
        pending(10L);
        when(source.load(10L)).thenReturn(photo);
        when(source.objectKey(photo)).thenReturn("org/4/photos/k");
        when(client.get("baitly-media", "org/4/photos/k")).thenReturn(new byte[]{1, 2, 3});
        when(source.complete(10L, photo, "org/4/photos/k")).thenReturn(true);

        List<InlineBinaryOffloadService.OffloadResult> results = service.offloadAll();

        verify(client).put("baitly-media", "org/4/photos/k", new byte[]{1, 2, 3}, "image/jpeg");
        assertThat(results).containsExactly(new InlineBinaryOffloadService.OffloadResult("photos-logements", 1, 0, 0));
    }

    @Test
    void whenTheCopyDiffers_thenKeepsTheOldCopy() {
        pending(10L);
        when(source.load(10L)).thenReturn(photo);
        when(source.objectKey(photo)).thenReturn("org/4/photos/k");
        when(client.get("baitly-media", "org/4/photos/k")).thenReturn(new byte[]{1, 2, 9});

        List<InlineBinaryOffloadService.OffloadResult> results = service.offloadAll();

        verify(source, never()).complete(anyLong(), any(), any());
        assertThat(results.get(0).failed()).isEqualTo(1);
    }

    @Test
    void whenOneFileFails_thenTheNextOnesAreStillOffloaded() {
        pending(10L, 11L);
        PendingBinary other = new PendingBinary(4L, "image/png", new byte[]{5}, null);
        when(source.load(10L)).thenReturn(photo);
        when(source.load(11L)).thenReturn(other);
        when(source.objectKey(photo)).thenReturn("org/4/photos/a");
        when(source.objectKey(other)).thenReturn("org/4/photos/b");
        doThrow(new IllegalStateException("ovh down")).when(client)
                .put(eq("baitly-media"), eq("org/4/photos/a"), any(), any());
        when(client.get("baitly-media", "org/4/photos/b")).thenReturn(new byte[]{5});
        when(source.complete(11L, other, "org/4/photos/b")).thenReturn(true);

        List<InlineBinaryOffloadService.OffloadResult> results = service.offloadAll();

        assertThat(results).containsExactly(new InlineBinaryOffloadService.OffloadResult("photos-logements", 1, 0, 1));
    }

    @Test
    void whenTheFamilyIsNotSwitchedToObjectStorage_thenNothingHappens() {
        when(source.active()).thenReturn(false);

        assertThat(service.offloadAll()).isEmpty();
        verify(source, never()).pendingIdsAfter(anyLong(), anyInt());
    }

    @Test
    void whenAFileVanished_thenItIsSkipped() {
        pending(10L);
        when(source.load(10L)).thenReturn(null);

        assertThat(service.offloadAll().get(0).skipped()).isEqualTo(1);
        verify(client, never()).put(any(), any(), any(), any());
    }

    @Test
    void whenTheSourceHoldsDocuments_thenWritesToTheDocumentsBucket() {
        when(source.bucket()).thenReturn(InlineBinarySource.Bucket.DOCUMENTS);
        when(client.documentsBucket()).thenReturn("baitly-documents");
        pending(10L);
        when(source.load(10L)).thenReturn(photo);
        when(source.objectKey(photo)).thenReturn("org/4/documents/FACTURE/x.pdf");
        when(client.get("baitly-documents", "org/4/documents/FACTURE/x.pdf")).thenReturn(new byte[]{1, 2, 3});
        when(source.complete(10L, photo, "org/4/documents/FACTURE/x.pdf")).thenReturn(true);

        service.offloadAll();

        verify(client).put("baitly-documents", "org/4/documents/FACTURE/x.pdf", new byte[]{1, 2, 3}, "image/jpeg");
    }
}
