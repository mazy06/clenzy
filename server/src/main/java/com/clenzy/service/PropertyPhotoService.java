package com.clenzy.service;

import com.clenzy.dto.PropertyPhotoDto;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.storage.ObjectStorageTransactions;
import com.clenzy.service.storage.StoredObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Service
public class PropertyPhotoService {

    private static final Logger log = LoggerFactory.getLogger(PropertyPhotoService.class);

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    private final PropertyPhotoRepository photoRepository;
    private final PropertyRepository propertyRepository;
    private final PhotoStorageService storageService;
    private final PropertyPhotoWriter photoWriter;
    private final OrganizationAccessGuard organizationAccessGuard;

    public PropertyPhotoService(PropertyPhotoRepository photoRepository,
                                PropertyRepository propertyRepository,
                                PhotoStorageService storageService,
                                PropertyPhotoWriter photoWriter,
                                OrganizationAccessGuard organizationAccessGuard) {
        this.photoRepository = photoRepository;
        this.propertyRepository = propertyRepository;
        this.storageService = storageService;
        this.photoWriter = photoWriter;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Refuse l'acces si le logement vise n'appartient pas a l'organisation courante.
     *
     * <p>Toutes les operations sur les photos sont ancrees sur un {@code propertyId} pris
     * dans l'URL, et le depot ne filtre que sur ce {@code propertyId} : rien ne bornait la
     * portee au tenant. {@code PropertyPhoto} porte pourtant un {@code organizationId},
     * simplement jamais relu (audit securite 2026-07-26, constat P1-07).
     *
     * <p>Le {@code DELETE} detruit aussi le binaire via {@link PhotoStorageService#delete} :
     * l'absence de controle rendait possible une destruction irreversible chez un tiers.
     */
    private Property requirePropertyInOrganization(Long propertyId) {
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Property not found: " + propertyId));
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Logement hors de votre organisation");
        return property;
    }

    @Transactional(readOnly = true)
    public List<PropertyPhotoDto> listPhotos(Long propertyId) {
        requirePropertyInOrganization(propertyId);
        return photoRepository.findByPropertyIdOrderBySortOrderAsc(propertyId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Envoie une photo de logement. Les octets partent directement au stockage
     * ({@link PhotoStorageService#store} : stockage objet OVH en production), et seule la clé
     * org-scopée {@code org/{orgId}/photos/{uuid}} est enregistrée en base : plus aucun octet de
     * photo dans PostgreSQL.
     *
     * <p>Pas de {@code @Transactional} ici : le fichier est écrit AVANT la transaction courte qui
     * enregistre sa clé ({@link PropertyPhotoWriter}, règle audit n°2) ; si elle échoue, l'objet
     * est supprimé pour ne pas rester orphelin.</p>
     */
    // Eviction GLOBALE du cache : la cle porte desormais l'organisation
    // (cf. PropertyService#currentTenantCacheKey), une eviction par id seul
    // ne correspondrait plus a rien et laisserait des fiches perimees.
    @CacheEvict(value = "properties", allEntries = true)
    public PropertyPhotoDto uploadPhoto(Long propertyId, MultipartFile file, String caption) {
        validateFile(file);
        validatePhotoLimit(propertyId);
        requirePropertyInOrganization(propertyId);

        final StoredObject stored = storeBytes(file);
        final PropertyPhoto saved = ObjectStorageTransactions.persistOrDiscard(
                List.of(stored.key()), storageService::delete,
                () -> photoWriter.saveManualPhoto(propertyId, stored, caption));

        log.info("Uploaded photo id={} for property={} (size={})", saved.getId(), propertyId, stored.size());
        return toDto(saved);
    }

    private StoredObject storeBytes(MultipartFile file) {
        final byte[] fileData;
        try {
            fileData = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read uploaded file", e);
        }
        final String contentType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
        final String key = storageService.store(fileData, contentType, file.getOriginalFilename());
        return new StoredObject(key, contentType, file.getSize(), file.getOriginalFilename());
    }

    @Transactional(readOnly = true)
    public byte[] getPhotoData(Long propertyId, Long photoId) {
        requirePropertyInOrganization(propertyId);
        final PropertyPhoto photo = photoRepository.findByIdAndPropertyId(photoId, propertyId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Photo not found: id=" + photoId + ", propertyId=" + propertyId));

        if (photo.getStorageKey() != null) {
            return storageService.retrieve(photo.getStorageKey());
        }
        return photo.getData();
    }

    @Transactional(readOnly = true)
    public String getPhotoContentType(Long propertyId, Long photoId) {
        requirePropertyInOrganization(propertyId);
        return photoRepository.findByIdAndPropertyId(photoId, propertyId)
                .map(PropertyPhoto::getContentType)
                .orElse("image/jpeg");
    }

    @Transactional
    // Eviction GLOBALE du cache : la cle porte desormais l'organisation
    // (cf. PropertyService#currentTenantCacheKey), une eviction par id seul
    // ne correspondrait plus a rien et laisserait des fiches perimees.
    @CacheEvict(value = "properties", allEntries = true)
    public void deletePhoto(Long propertyId, Long photoId) {
        requirePropertyInOrganization(propertyId);
        final PropertyPhoto photo = photoRepository.findByIdAndPropertyId(photoId, propertyId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Photo not found: id=" + photoId + ", propertyId=" + propertyId));

        final String storageKey = photo.getStorageKey();
        photoRepository.deleteByIdAndPropertyId(photoId, propertyId);
        if (storageKey != null) {
            // Le binaire n'est detruit qu'une fois la suppression de la ligne validee (regle audit n°2).
            ObjectStorageTransactions.afterCommit("suppression photo " + storageKey,
                    () -> storageService.delete(storageKey));
        }
        log.info("Deleted photo id={} for property={}", photoId, propertyId);
    }

    @Transactional
    // Eviction GLOBALE du cache : la cle porte desormais l'organisation
    // (cf. PropertyService#currentTenantCacheKey), une eviction par id seul
    // ne correspondrait plus a rien et laisserait des fiches perimees.
    @CacheEvict(value = "properties", allEntries = true)
    public void reorderPhotos(Long propertyId, List<Long> photoIds) {
        requirePropertyInOrganization(propertyId);
        final List<PropertyPhoto> photos = photoRepository.findByPropertyIdOrderBySortOrderAsc(propertyId);

        for (int i = 0; i < photoIds.size(); i++) {
            final Long targetId = photoIds.get(i);
            final int newOrder = i;
            photos.stream()
                    .filter(p -> p.getId().equals(targetId))
                    .findFirst()
                    .ifPresent(p -> p.setSortOrder(newOrder));
        }

        photoRepository.saveAll(photos);
        log.info("Reordered {} photos for property={}", photoIds.size(), propertyId);
    }

    // --- Private helpers ---

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum of 10 MB");
        }
        final String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Only image files are accepted, got: " + contentType);
        }
    }

    /** Refus anticipé, avant tout envoi de fichier ; revérifié dans la transaction d'écriture. */
    private void validatePhotoLimit(Long propertyId) {
        final int count = photoRepository.countByPropertyId(propertyId);
        if (count >= PropertyPhotoWriter.MAX_PHOTOS_PER_PROPERTY) {
            throw new IllegalArgumentException(
                    "Maximum of " + PropertyPhotoWriter.MAX_PHOTOS_PER_PROPERTY + " photos per property reached");
        }
    }

    private PropertyPhotoDto toDto(PropertyPhoto photo) {
        return new PropertyPhotoDto(
                photo.getId(),
                photo.getProperty().getId(),
                photo.getOriginalFilename(),
                photo.getContentType(),
                photo.getFileSize(),
                photo.getSortOrder(),
                photo.getCaption(),
                photo.getSource() != null ? photo.getSource().name() : null,
                photo.getCreatedAt()
        );
    }
}
