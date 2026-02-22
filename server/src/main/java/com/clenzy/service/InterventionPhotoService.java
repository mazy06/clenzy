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
                    if (contentType == null) {
                        contentType = "image/jpeg";
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

    // ── Private helpers ─────────────────────────────────────────────────────

    private String toBase64JsonArray(List<InterventionPhoto> photos) {
        List<String> base64Urls = new ArrayList<>();
        for (InterventionPhoto photo : photos) {
            byte[] photoData = photo.getPhotoData();
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
