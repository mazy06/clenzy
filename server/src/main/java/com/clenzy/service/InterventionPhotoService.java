package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.service.storage.InterventionPhotoBinaryStore;
import com.clenzy.service.storage.ObjectStorageTransactions;
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
    private final InterventionPhotoBinaryStore binaryStore;

    public InterventionPhotoService(InterventionPhotoRepository interventionPhotoRepository,
                                    TenantContext tenantContext,
                                    InterventionPhotoBinaryStore binaryStore) {
        this.interventionPhotoRepository = interventionPhotoRepository;
        this.tenantContext = tenantContext;
        this.binaryStore = binaryStore;
    }

    /**
     * Une photo recue, deja ecrite sur le stockage ({@code storageKey}) — ou, en mode {@code bytea}
     * (developpement), gardee en memoire pour la colonne {@code data} ({@code inlineData}).
     */
    public record PreparedPhoto(String storageKey, byte[] inlineData, String contentType,
                                long size, String originalFilename) {
    }

    /**
     * Ecrit les photos recues sur le stockage, HORS transaction (regle audit n°2) : en production
     * elles partent directement au stockage objet OVH, et seule leur cle sera enregistree en base.
     * Les fichiers vides et les formats refuses sont ignores. Si une ecriture echoue, les objets
     * deja ecrits sont supprimes avant de relancer l'erreur.
     */
    public List<PreparedPhoto> preparePhotos(List<MultipartFile> photos) {
        final long orgId = tenantContext.getRequiredOrganizationId();
        final List<PreparedPhoto> prepared = new ArrayList<>();
        try {
            for (MultipartFile photo : photos) {
                if (photo.isEmpty()) {
                    continue;
                }
                final String contentType = photo.getContentType();
                if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
                    log.warn("Rejected photo with unsupported MIME type: {}", contentType);
                    continue;
                }
                final byte[] bytes = readBytes(photo);
                final String key = binaryStore.store(orgId, bytes, contentType);
                prepared.add(new PreparedPhoto(key, key == null ? bytes : null, contentType,
                        photo.getSize(), photo.getOriginalFilename()));
            }
        } catch (RuntimeException e) {
            discardPhotos(prepared);
            throw e;
        }
        return prepared;
    }

    /**
     * Enregistre les photos preparees sur l'intervention, dans la transaction de l'appelant.
     *
     * @param photoType "before", "after" ou "issue" (anomalie terrain, Moteur Menage 3C)
     */
    public void attachPhotos(Intervention intervention, List<PreparedPhoto> photos, String photoType) {
        final InterventionPhoto.PhotoPhase phase = switch (photoType) {
            case "before" -> InterventionPhoto.PhotoPhase.BEFORE;
            case "issue" -> InterventionPhoto.PhotoPhase.ISSUE;
            default -> InterventionPhoto.PhotoPhase.AFTER;
        };
        for (PreparedPhoto prepared : photos) {
            final InterventionPhoto photo = new InterventionPhoto();
            photo.setIntervention(intervention);
            photo.setStorageKey(prepared.storageKey());
            photo.setData(prepared.inlineData());
            photo.setOrganizationId(tenantContext.getRequiredOrganizationId());
            photo.setFileSize(prepared.size());
            photo.setContentType(prepared.contentType());
            photo.setOriginalFilename(prepared.originalFilename());
            photo.setPhase(phase);
            interventionPhotoRepository.save(photo);
        }
        log.debug("Photos {} saved for intervention: id={}, count={}", photoType, intervention.getId(), photos.size());
    }

    /** Supprime du stockage les objets de photos preparees mais non enregistrees. */
    public void discardPhotos(List<PreparedPhoto> photos) {
        ObjectStorageTransactions.discard(photos.stream().map(PreparedPhoto::storageKey).toList(),
                this::deleteStoredObject);
    }

    /** Supprime un objet du stockage des photos d'intervention. */
    public void deleteStoredObject(String storageKey) {
        binaryStore.delete(storageKey);
    }

    private static byte[] readBytes(MultipartFile photo) {
        try {
            return photo.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Erreur lors de la lecture du fichier photo: " + e.getMessage(), e);
        }
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
        InterventionPhoto.PhotoPhase phase = "before".equals(photoType) ? InterventionPhoto.PhotoPhase.BEFORE : InterventionPhoto.PhotoPhase.AFTER;
        List<InterventionPhoto> photos = interventionPhotoRepository.findByInterventionIdAndPhaseOrderByCreatedAtAsc(
                intervention.getId(), phase, tenantContext.getRequiredOrganizationId());

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
        InterventionPhoto.PhotoPhase phase = "before".equals(photoType) ? InterventionPhoto.PhotoPhase.BEFORE : InterventionPhoto.PhotoPhase.AFTER;
        List<InterventionPhoto> photos = interventionPhotoRepository.findByInterventionIdAndPhaseOrderByCreatedAtAsc(
                intervention.getId(), phase, tenantContext.getRequiredOrganizationId());

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
        final String storageKey = photo.getStorageKey();
        if (storageKey != null) {
            // L'objet n'est detruit qu'une fois la suppression de la ligne validee (regle audit n°2).
            ObjectStorageTransactions.afterCommit("suppression photo d'intervention " + storageKey,
                    () -> binaryStore.delete(storageKey));
        }
        log.debug("Photo deleted: id={}, interventionId={}, type={}", photoId, interventionId, photo.getPhase() != null ? photo.getPhase().name() : "BEFORE");
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
            if (photo.getPhase() == InterventionPhoto.PhotoPhase.BEFORE) beforePhotos.add(photo);
            else if (photo.getPhase() == InterventionPhoto.PhotoPhase.AFTER) afterPhotos.add(photo);
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
            byte[] photoData = resolvePhotoBytes(photo);
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

    /**
     * Resout les octets d'une photo selon la strategie de stockage active. Modele identique a
     * {@code PropertyPhotoService.getPhotoData} : si la photo a ete migree ({@code storageKey}
     * non-null), on delegue au {@link InterventionPhotoBinaryStore} (BYTEA ou objet selon le
     * flag {@code clenzy.storage.intervention-photos}) ; sinon on lit directement le BYTEA.
     */
    private byte[] resolvePhotoBytes(InterventionPhoto photo) {
        if (photo.getStorageKey() != null) {
            return binaryStore.resolveBytes(photo);
        }
        return photo.getData();
    }
}
