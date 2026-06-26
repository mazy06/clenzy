package com.clenzy.service;

import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/**
 * PostgreSQL BYTEA-based photo storage implementation.
 *
 * The storage key is the property_photos.id as a String.
 * Binary data is stored in the 'data' column.
 *
 * <p><b>Activation (defaut)</b> : impl par defaut du {@link PhotoStorageService},
 * active tant que le flag {@code clenzy.storage.photos} est absent ou vaut
 * {@code bytea} ({@code matchIfMissing = true}). Le flag {@code clenzy.storage.type}
 * (legacy) reste pris en compte : positionner {@code clenzy.storage.type=s3}
 * desactive cet impl au profit de {@code S3PhotoStorageService} (chemin AWS legacy).</p>
 *
 * <p>Pour basculer sur le stockage objet OVH (MinIO, vendor-neutral) :
 * {@code clenzy.storage.photos=object} → {@link ObjectStoragePhotoService} devient
 * l'impl {@code @Primary}. Les deux conditions etant mutuellement exclusives sur
 * {@code clenzy.storage.photos}, il n'y a JAMAIS deux {@code @Primary} actifs
 * simultanement.</p>
 */
@Service
@Primary
@ConditionalOnProperty(name = "clenzy.storage.type", havingValue = "local", matchIfMissing = true)
@ConditionalOnProperty(name = "clenzy.storage.photos", havingValue = "bytea", matchIfMissing = true)
public class LocalPhotoStorageService implements PhotoStorageService {

    private final PropertyPhotoRepository photoRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    public LocalPhotoStorageService(PropertyPhotoRepository photoRepository,
                                    OrganizationAccessGuard organizationAccessGuard) {
        this.photoRepository = photoRepository;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * For local storage, the actual persist is done by the caller (PropertyPhotoService)
     * because the entity needs other fields set first. This method returns a placeholder
     * key that will be replaced with the actual ID after persist.
     *
     * In the S3 implementation, this would upload to S3 and return the S3 key.
     */
    @Override
    public String store(byte[] data, String contentType, String originalFilename) {
        // For local BYTEA storage, we don't store separately.
        // The data is persisted directly on the entity.
        // Return a temporary key; PropertyPhotoService will set the real ID after save.
        return "pending";
    }

    @Override
    public byte[] retrieve(String storageKey) {
        final long id = Long.parseLong(storageKey);
        return photoRepository.findById(id)
                .map(PropertyPhoto::getData)
                .orElseThrow(() -> new IllegalArgumentException("Photo not found: " + storageKey));
    }

    /**
     * Storage local : la cle est l'{@code id} d'un {@code property_photos}.
     * On charge la photo (findById — qui ne traverse PAS le filtre Hibernate
     * organizationFilter) et on valide son {@code organizationId} via
     * {@link OrganizationAccessGuard} (fail-closed, bypass platform staff/org SYSTEM).
     *
     * <p>Cle malformee ou photo inexistante → refus (AccessDenied) plutot que
     * de propager l'exception brute : on ne distingue pas "pas autorise" de
     * "n'existe pas" pour eviter l'enumeration de cles.</p>
     */
    @Override
    public void assertReadableInCurrentOrg(String storageKey) {
        final long id;
        try {
            id = Long.parseLong(storageKey);
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("Attachment non autorise");
        }
        PropertyPhoto photo = photoRepository.findById(id)
                .orElseThrow(() -> new AccessDeniedException("Attachment non autorise"));
        organizationAccessGuard.requireSameOrganization(
                photo.getOrganizationId(), "Attachment non autorise");
    }

    @Override
    public void delete(String storageKey) {
        // For local storage, deletion is handled by JPA cascade or repository.delete().
        // In S3 implementation, this would delete the S3 object.
    }
}
