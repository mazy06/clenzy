package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.storage.StoredObject;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transaction courte de l'envoi d'une photo de logement : enregistre la clé d'un objet déjà écrit
 * sur le stockage. Bean distinct de {@link PropertyPhotoService} pour que {@code @Transactional}
 * passe par le proxy Spring (règle audit n°6) et que l'écriture du fichier reste hors transaction
 * (règle audit n°2).
 */
@Service
public class PropertyPhotoWriter {

    static final int MAX_PHOTOS_PER_PROPERTY = 50;

    private final PropertyPhotoRepository photoRepository;
    private final PropertyRepository propertyRepository;
    private final TenantContext tenantContext;
    private final OrganizationAccessGuard organizationAccessGuard;

    public PropertyPhotoWriter(PropertyPhotoRepository photoRepository,
                               PropertyRepository propertyRepository,
                               TenantContext tenantContext,
                               OrganizationAccessGuard organizationAccessGuard) {
        this.photoRepository = photoRepository;
        this.propertyRepository = propertyRepository;
        this.tenantContext = tenantContext;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Crée la photo manuelle d'un logement à partir d'un objet déjà stocké : seule sa clé est
     * enregistrée, jamais ses octets. Le logement et la limite de photos sont revérifiés dans la
     * transaction.
     */
    @Transactional
    public PropertyPhoto saveManualPhoto(Long propertyId, StoredObject stored, String caption) {
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Property not found: " + propertyId));
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Logement hors de votre organisation");

        final int nextOrder = photoRepository.countByPropertyId(propertyId);
        if (nextOrder >= MAX_PHOTOS_PER_PROPERTY) {
            throw new IllegalArgumentException(
                    "Maximum of " + MAX_PHOTOS_PER_PROPERTY + " photos per property reached");
        }

        final PropertyPhoto photo = new PropertyPhoto();
        photo.setProperty(property);
        photo.setOrganizationId(tenantContext.getRequiredOrganizationId());
        photo.setOriginalFilename(stored.originalFilename());
        photo.setContentType(stored.contentType());
        photo.setFileSize(stored.size());
        photo.setStorageKey(stored.key());
        photo.setSortOrder(nextOrder);
        photo.setCaption(caption);
        photo.setSource(PropertyPhoto.PhotoSource.MANUAL);
        return photoRepository.save(photo);
    }
}
