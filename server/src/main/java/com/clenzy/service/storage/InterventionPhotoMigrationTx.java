package com.clenzy.service.storage;

import com.clenzy.model.InterventionPhoto;
import com.clenzy.repository.InterventionPhotoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Operations DB <b>transactionnelles courtes</b> de la migration des photos d'intervention,
 * isolees dans un bean dedie pour que les {@code @Transactional} passent bien par le proxy Spring
 * (regle audit #6 : pas d'auto-invocation {@code @Transactional}).
 *
 * <p>Jumeau d'{@link PhotoStorageMigrationTx} pour {@code intervention_photos}. Chaque methode =
 * une transaction courte ; AUCUN appel reseau (S3) ici (regle audit #2).</p>
 */
@Component
public class InterventionPhotoMigrationTx {

    /** Marque d'idempotence : un storageKey deja au format objet = deja migre. */
    static final Pattern OBJECT_KEY_PATTERN = Pattern.compile("^org/\\d+/intervention-photos/.+$");

    private final InterventionPhotoRepository photoRepository;

    public InterventionPhotoMigrationTx(InterventionPhotoRepository photoRepository) {
        this.photoRepository = photoRepository;
    }

    /**
     * Page d'IDS uniquement (pas de bytes) — transaction read-only courte. On ne garde pas de
     * BYTEA en memoire le temps du batch.
     */
    @Transactional(readOnly = true)
    public Page<Long> loadPhotoIdsPage(Pageable pageable) {
        final Page<InterventionPhoto> page = photoRepository.findAll(pageable);
        final List<Long> ids = page.getContent().stream().map(InterventionPhoto::getId).toList();
        return new PageImpl<>(ids, pageable, page.getTotalElements());
    }

    /** Lecture courte des bytes + metadonnees d'une photo (null si disparue). */
    @Transactional(readOnly = true)
    public InterventionPhotoMigrationService.PhotoSnapshot loadSnapshot(Long photoId) {
        return photoRepository.findById(photoId)
                .map(p -> new InterventionPhotoMigrationService.PhotoSnapshot(
                        p.getOrganizationId(),
                        p.getContentType(),
                        p.getData(),
                        p.getStorageKey(),
                        isObjectKey(p.getStorageKey())))
                .orElse(null);
    }

    /**
     * Ecrit la cle objet dans {@code storage_key} (transaction WRITE courte).
     * Ne touche PAS la colonne {@code data} (BYTEA conserve, migration reversible).
     */
    @Transactional
    public void writeStorageKey(Long photoId, String objectKey) {
        final InterventionPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new IllegalStateException("Photo disparue avant ecriture: " + photoId));
        photo.setStorageKey(objectKey);
        photoRepository.save(photo);
    }

    static boolean isObjectKey(String storageKey) {
        return storageKey != null && OBJECT_KEY_PATTERN.matcher(storageKey).matches();
    }
}
