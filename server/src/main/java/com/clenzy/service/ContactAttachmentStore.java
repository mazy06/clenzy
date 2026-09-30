package com.clenzy.service;

import com.clenzy.model.ContactAttachmentFile;
import com.clenzy.repository.ContactAttachmentFileRepository;
import com.clenzy.service.storage.ObjectStorageTransactions;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;

/**
 * Fichiers des pièces jointes de contact, sur le stockage objet (OVH en production) : plus aucun
 * octet de pièce jointe dans PostgreSQL.
 *
 * <p>Un message et son e-mail partent dans une transaction ; les pièces jointes sont écrites sur le
 * stockage <b>après</b> sa validation (règle audit n°2), puis leurs clés enregistrées dans une
 * transaction à part. L'opération reste « au mieux », comme avant : l'e-mail est déjà parti, un
 * échec est journalisé en erreur et la pièce jointe s'affiche « non disponible ».</p>
 */
@Component
public class ContactAttachmentStore {

    private final PhotoStorageService storage;
    private final ContactAttachmentFileRepository repository;
    private final TransactionTemplate newTransaction;

    public ContactAttachmentStore(PhotoStorageService storage,
                                  ContactAttachmentFileRepository repository,
                                  PlatformTransactionManager transactionManager) {
        this.storage = storage;
        this.repository = repository;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Une pièce jointe reçue, lue en mémoire, à écrire après la validation du message. */
    public record PendingAttachment(String attachmentId, byte[] data, String contentType,
                                    String originalName, long size) {
    }

    /** Écrit les pièces jointes après la validation de la transaction du message. */
    public void storeAfterCommit(Long messageId, List<PendingAttachment> attachments) {
        if (attachments.isEmpty()) {
            return;
        }
        ObjectStorageTransactions.afterCommit("pièces jointes du message " + messageId,
                () -> store(messageId, attachments));
    }

    void store(Long messageId, List<PendingAttachment> attachments) {
        final List<String> keys = new ArrayList<>();
        final List<ContactAttachmentFile> rows = new ArrayList<>();
        try {
            for (PendingAttachment attachment : attachments) {
                final String key = storage.store(attachment.data(), attachment.contentType(), attachment.originalName());
                keys.add(key);
                rows.add(ContactAttachmentFile.stored(messageId, attachment.attachmentId(), key,
                        attachment.contentType(), attachment.originalName(), attachment.size()));
            }
        } catch (RuntimeException e) {
            ObjectStorageTransactions.discard(keys, storage::delete);
            throw e;
        }
        ObjectStorageTransactions.persistOrDiscard(keys, storage::delete,
                () -> newTransaction.execute(status -> repository.saveAll(rows)));
    }

    /** Octets d'une pièce jointe : l'objet stocké, ou les octets en base des pièces jointes anciennes. */
    public byte[] read(ContactAttachmentFile file) {
        if (file.getStorageKey() != null) {
            return storage.retrieve(file.getStorageKey());
        }
        return file.getData();
    }
}
