package com.clenzy.service;

import com.clenzy.model.ContactAttachmentFile;
import com.clenzy.repository.ContactAttachmentFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pièces jointes de contact : écrites sur le stockage (OVH en production), seule leur clé est
 * enregistrée, et un échec ne laisse pas d'objet orphelin.
 */
@ExtendWith(MockitoExtension.class)
class ContactAttachmentStoreTest {

    @Mock private PhotoStorageService storage;
    @Mock private ContactAttachmentFileRepository repository;
    @Mock private PlatformTransactionManager transactionManager;

    private ContactAttachmentStore store;

    private final ContactAttachmentStore.PendingAttachment pdf =
            new ContactAttachmentStore.PendingAttachment("att-1", new byte[]{1, 2}, "application/pdf", "devis.pdf", 2L);
    private final ContactAttachmentStore.PendingAttachment png =
            new ContactAttachmentStore.PendingAttachment("att-2", new byte[]{3}, "image/png", "photo.png", 1L);

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        store = new ContactAttachmentStore(storage, repository, transactionManager);
    }

    @Test
    void whenStoring_thenWritesEachFileAndSavesOnlyTheKeys() {
        when(storage.store(new byte[]{1, 2}, "application/pdf", "devis.pdf")).thenReturn("org/1/photos/a");
        when(storage.store(new byte[]{3}, "image/png", "photo.png")).thenReturn("org/1/photos/b");

        store.store(42L, List.of(pdf, png));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ContactAttachmentFile>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).extracting(ContactAttachmentFile::getStorageKey)
                .containsExactly("org/1/photos/a", "org/1/photos/b");
        assertThat(captor.getValue()).allSatisfy(file -> {
            assertThat(file.getData()).isNull();
            assertThat(file.getMessageId()).isEqualTo(42L);
        });
    }

    @Test
    void whenTheSecondWriteFails_thenDeletesTheFirstObject() {
        when(storage.store(new byte[]{1, 2}, "application/pdf", "devis.pdf")).thenReturn("org/1/photos/a");
        when(storage.store(new byte[]{3}, "image/png", "photo.png")).thenThrow(new IllegalStateException("ovh down"));

        assertThatThrownBy(() -> store.store(42L, List.of(pdf, png))).isInstanceOf(IllegalStateException.class);

        verify(storage).delete("org/1/photos/a");
        verify(repository, never()).saveAll(anyList());
    }

    @Test
    void whenSavingFails_thenDeletesTheWrittenObjects() {
        when(storage.store(any(), any(), any())).thenReturn("org/1/photos/a");
        when(repository.saveAll(anyList())).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> store.store(42L, List.of(pdf))).isInstanceOf(IllegalStateException.class);

        verify(storage).delete("org/1/photos/a");
    }

    @Test
    void whenReading_thenUsesTheObjectOrTheOldInlineBytes() {
        ContactAttachmentFile stored = ContactAttachmentFile.stored(1L, "a", "org/1/photos/a", "image/png", "a.png", 1L);
        ContactAttachmentFile old = new ContactAttachmentFile(1L, "b", new byte[]{9}, "image/png", "b.png", 1L);
        when(storage.retrieve("org/1/photos/a")).thenReturn(new byte[]{7});

        assertThat(store.read(stored)).containsExactly(7);
        assertThat(store.read(old)).containsExactly(9);
    }
}
