package com.clenzy.service;

import com.clenzy.dto.PropertyPhotoDto;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
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
    private static final int MAX_PHOTOS_PER_PROPERTY = 50;

    private final PropertyPhotoRepository photoRepository;
    private final PropertyRepository propertyRepository;
    private final PhotoStorageService storageService;
    private final TenantContext tenantContext;
    private final OrganizationAccessGuard organizationAccessGuard;

    public PropertyPhotoService(PropertyPhotoRepository photoRepository,
                                PropertyRepository propertyRepository,
                                PhotoStorageService storageService,
                                TenantContext tenantContext,
                                OrganizationAccessGuard organizationAccessGuard) {
        this.photoRepository = photoRepository;
        this.propertyRepository = propertyRepository;
        this.storageService = storageService;
        this.tenantContext = tenantContext;
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

    @Transactional
    @CacheEvict(value = "properties", key = "#propertyId")
    public PropertyPhotoDto uploadPhoto(Long propertyId, MultipartFile file, String caption) {
        validateFile(file);
        validatePhotoLimit(propertyId);

        final Property property = requirePropertyInOrganization(propertyId);

        final Long orgId = tenantContext.getRequiredOrganizationId();
        final int nextOrder = photoRepository.countByPropertyId(propertyId);

        byte[] fileData;
        try {
            fileData = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read uploaded file", e);
        }

        final PropertyPhoto photo = new PropertyPhoto();
        photo.setProperty(property);
        photo.setOrganizationId(orgId);
        photo.setOriginalFilename(file.getOriginalFilename());
        photo.setContentType(file.getContentType() != null ? file.getContentType() : "image/jpeg");
        photo.setFileSize(file.getSize());
        photo.setData(fileData);
        photo.setSortOrder(nextOrder);
        photo.setCaption(caption);
        photo.setSource(PropertyPhoto.PhotoSource.MANUAL);

        final PropertyPhoto saved = photoRepository.save(photo);

        // Set storageKey to the persisted ID (for the storage abstraction contract)
        saved.setStorageKey(String.valueOf(saved.getId()));
        photoRepository.save(saved);

        log.info("Uploaded photo id={} for property={} (size={})", saved.getId(), propertyId, file.getSize());
        return toDto(saved);
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
    @CacheEvict(value = "properties", key = "#propertyId")
    public void deletePhoto(Long propertyId, Long photoId) {
        requirePropertyInOrganization(propertyId);
        final PropertyPhoto photo = photoRepository.findByIdAndPropertyId(photoId, propertyId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Photo not found: id=" + photoId + ", propertyId=" + propertyId));

        if (photo.getStorageKey() != null) {
            storageService.delete(photo.getStorageKey());
        }
        photoRepository.deleteByIdAndPropertyId(photoId, propertyId);
        log.info("Deleted photo id={} for property={}", photoId, propertyId);
    }

    @Transactional
    @CacheEvict(value = "properties", key = "#propertyId")
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

    private void validatePhotoLimit(Long propertyId) {
        final int count = photoRepository.countByPropertyId(propertyId);
        if (count >= MAX_PHOTOS_PER_PROPERTY) {
            throw new IllegalArgumentException(
                    "Maximum of " + MAX_PHOTOS_PER_PROPERTY + " photos per property reached");
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
