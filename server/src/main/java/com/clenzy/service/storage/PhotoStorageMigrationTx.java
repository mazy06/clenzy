package com.clenzy.service.storage;

import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Operations DB <b>transactionnelles courtes</b> de la migration des photos, isolees
 * dans un bean dedie pour que les {@code @Transactional} passent bien par le proxy Spring.
 *
 * <p>Regle audit #6 (auto-invocation {@code @Transactional}) : si ces methodes etaient
 * dans {@link PhotoStorageMigrationService}, l'appel intra-classe court-circuiterait le
 * proxy et la transaction serait silencieusement absente. On les met donc dans un bean
 * separe, injecte dans le service.</p>
 *
 * <p>Chaque methode = une transaction courte. AUCUN appel reseau (S3) ici : l'upload et la
 * verification se font dans le service, HORS transaction (regle audit #2).</p>
 */
@Component
public class PhotoStorageMigrationTx {

    /** Marque d'idempotence : un storageKey deja au format objet = deja migre. */
    static final Pattern OBJECT_KEY_PATTERN = Pattern.compile("^org/\\d+/photos/.+$");

    private final PropertyPhotoRepository photoRepository;

    public PhotoStorageMigrationTx(PropertyPhotoRepository photoRepository) {
        this.photoRepository = photoRepository;
    }

    /**
     * Page d'IDS uniquement (pas de bytes) — transaction read-only courte. On ne renvoie
     * que les IDS pour ne pas conserver de bytes BYTEA en memoire le temps du batch.
     */
    @Transactional(readOnly = true)
    public Page<Long> loadPhotoIdsPage(Pageable pageable) {
        final Page<PropertyPhoto> page = photoRepository.findAll(pageable);
        final List<Long> ids = page.getContent().stream().map(PropertyPhoto::getId).toList();
        return new PageImpl<>(ids, pageable, page.getTotalElements());
    }

    /** Lecture courte des bytes + metadonnees d'une photo (null si disparue). */
    @Transactional(readOnly = true)
    public PhotoStorageMigrationService.PhotoSnapshot loadSnapshot(Long photoId) {
        return photoRepository.findById(photoId)
                .map(p -> new PhotoStorageMigrationService.PhotoSnapshot(
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
        final PropertyPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new IllegalStateException("Photo disparue avant ecriture: " + photoId));
        photo.setStorageKey(objectKey);
        photoRepository.save(photo);
    }

    static boolean isObjectKey(String storageKey) {
        return storageKey != null && OBJECT_KEY_PATTERN.matcher(storageKey).matches();
    }
}
