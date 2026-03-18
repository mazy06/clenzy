package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Handles photo storage and conversion for interventions.
 * Extracted from InterventionService to respect SRP.
 */
@Service
public class InterventionPhotoService {

    private static final Logger log = LoggerFactory.getLogger(InterventionPhotoService.class);

    private static final java.util.Set<String> ALLOWED_MIME_TYPES = java.util.Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif");

    private final InterventionPhotoRepository interventionPhotoRepository;
    private final TenantContext tenantContext;

    public InterventionPhotoService(InterventionPhotoRepository interventionPhotoRepository,
                                    TenantContext tenantContext) {
        this.interventionPhotoRepository = interventionPhotoRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Save uploaded photos to the intervention_photos table.
     *
     * @param intervention the parent intervention (must already be persisted)
     * @param photos       multipart files uploaded by the user
     * @param photoType    "before" or "after"
     */
    public void savePhotos(Intervention intervention, List<MultipartFile> photos, String photoType) {
        String photoTypeUpper = "before".equals(photoType) ? "BEFORE" : "AFTER";

        for (MultipartFile photo : photos) {
            if (!photo.isEmpty()) {
                try {
                    byte[] photoData = photo.getBytes();
                    String contentType = photo.getContentType();
                    if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
                        log.warn("Rejected photo with unsupported MIME type: {}", contentType);
                        continue;
                    }

                    InterventionPhoto interventionPhoto = new InterventionPhoto();
                    interventionPhoto.setIntervention(intervention);
                    interventionPhoto.setPhotoData(photoData);
                    interventionPhoto.setContentType(contentType);
                    interventionPhoto.setFileName(photo.getOriginalFilename());
                    interventionPhoto.setPhotoType(photoTypeUpper);

                    interventionPhotoRepository.save(interventionPhoto);
                } catch (IOException e) {
                    throw new RuntimeException("Erreur lors de la lecture du fichier photo: " + e.getMessage(), e);
                }
            }
        }

        log.debug("Photos {} saved for intervention: id={}, count={}", photoType, intervention.getId(), photos.size());
    }

    /**
     * Converts all photos (BEFORE and AFTER) to base64 data URLs.
     * Falls back to the legacy {@code intervention.getPhotos()} field if no rows exist.
     */
    public String convertPhotosToBase64Urls(Intervention intervention) {
        List<InterventionPhoto> photos = interventionPhotoRepository.findAllByInterventionId(
                intervention.getId(), tenantContext.getRequiredOrganizationId());

        if (photos.isEmpty()) {
            return intervention.getPhotos();
        }

        return toBase64JsonArray(photos);
    }

    /**
     * Converts photos of a specific type (BEFORE or AFTER) to base64 data URLs.
     * Falls back to the legacy before/after URL fields if no rows exist.
     */
    public String convertPhotosToBase64UrlsByType(Intervention intervention, String photoType) {
        String photoTypeUpper = "before".equals(photoType) ? "BEFORE" : "AFTER";
        List<InterventionPhoto> photos = interventionPhotoRepository.findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(
                intervention.getId(), photoTypeUpper, tenantContext.getRequiredOrganizationId());

        if (photos.isEmpty()) {
            return "before".equals(photoType)
                    ? intervention.getBeforePhotosUrls()
                    : intervention.getAfterPhotosUrls();
        }

        return toBase64JsonArray(photos);
    }

    /**
     * Returns a JSON array of photo IDs for a given type, matching the order
     * of {@link #convertPhotosToBase64UrlsByType}.
     */
    public String getPhotoIdsByType(Intervention intervention, String photoType) {
        String photoTypeUpper = "before".equals(photoType) ? "BEFORE" : "AFTER";
        List<InterventionPhoto> photos = interventionPhotoRepository.findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(
                intervention.getId(), photoTypeUpper, tenantContext.getRequiredOrganizationId());

        if (photos.isEmpty()) {
            return null;
        }

        return "[" + photos.stream()
                .map(p -> String.valueOf(p.getId()))
                .collect(Collectors.joining(",")) + "]";
    }

    /**
     * Delete a single photo by ID, validating it belongs to the given intervention and organization.
     */
    public void deletePhoto(Long photoId, Long interventionId) {
        InterventionPhoto photo = interventionPhotoRepository.findByIdAndInterventionId(
                photoId, interventionId, tenantContext.getRequiredOrganizationId())
                .orElseThrow(() -> new RuntimeException("Photo introuvable ou accès refusé"));

        interventionPhotoRepository.delete(photo);
        log.debug("Photo deleted: id={}, interventionId={}, type={}", photoId, interventionId, photo.getPhotoType());
    }

    public long getPhotoCount(Intervention intervention) {
        return interventionPhotoRepository.countByInterventionId(
                intervention.getId(), tenantContext.getRequiredOrganizationId());
    }

    /**
     * Load all photo data for a single intervention in one query,
     * returning before/after URLs and IDs pre-split.
     */
    public record PhotoBundle(String allPhotosJson, String beforeUrls, String afterUrls, String beforeIds, String afterIds) {}

    public PhotoBundle loadPhotoBundle(Intervention intervention) {
        List<InterventionPhoto> allPhotos = interventionPhotoRepository.findAllByInterventionId(
                intervention.getId(), tenantContext.getRequiredOrganizationId());

        if (allPhotos.isEmpty()) {
            return new PhotoBundle(
                    intervention.getPhotos(),
                    intervention.getBeforePhotosUrls(),
                    intervention.getAfterPhotosUrls(),
                    null, null);
        }

        List<InterventionPhoto> beforePhotos = new ArrayList<>();
        List<InterventionPhoto> afterPhotos = new ArrayList<>();
        for (InterventionPhoto photo : allPhotos) {
            if ("BEFORE".equals(photo.getPhotoType())) beforePhotos.add(photo);
            else if ("AFTER".equals(photo.getPhotoType())) afterPhotos.add(photo);
        }

        // Sort by createdAt to match the previous behavior
        beforePhotos.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return a.getCreatedAt().compareTo(b.getCreatedAt());
        });
        afterPhotos.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return a.getCreatedAt().compareTo(b.getCreatedAt());
        });

        String allJson = toBase64JsonArray(allPhotos);
        String beforeUrlsStr = beforePhotos.isEmpty() ? intervention.getBeforePhotosUrls() : toBase64JsonArray(beforePhotos);
        String afterUrlsStr = afterPhotos.isEmpty() ? intervention.getAfterPhotosUrls() : toBase64JsonArray(afterPhotos);

        String beforeIdsStr = beforePhotos.isEmpty() ? null :
                "[" + beforePhotos.stream().map(p -> String.valueOf(p.getId())).collect(Collectors.joining(",")) + "]";
        String afterIdsStr = afterPhotos.isEmpty() ? null :
                "[" + afterPhotos.stream().map(p -> String.valueOf(p.getId())).collect(Collectors.joining(",")) + "]";

        return new PhotoBundle(allJson, beforeUrlsStr, afterUrlsStr, beforeIdsStr, afterIdsStr);
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private String toBase64JsonArray(List<InterventionPhoto> photos) {
        List<String> base64Urls = new ArrayList<>();
        for (InterventionPhoto photo : photos) {
            byte[] photoData = photo.getPhotoData();
            if (photoData == null) {
                log.warn("Skipping photo with null data: id={}", photo.getId());
                continue;
            }
            String contentType = photo.getContentType() != null ? photo.getContentType() : "image/jpeg";
            String base64 = Base64.getEncoder().encodeToString(photoData);
            String dataUrl = "data:" + contentType + ";base64," + base64;
            base64Urls.add(dataUrl);
        }

        return "[" + base64Urls.stream()
                .map(url -> "\"" + url.replace("\"", "\\\"") + "\"")
                .collect(Collectors.joining(",")) + "]";
    }
}
