package com.clenzy.service;

import com.clenzy.dto.MediaAssetDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.MediaAsset;
import com.clenzy.repository.MediaAssetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Médiathèque org-scopée du Studio (2.1) : upload (validé image + taille), liste, suppression, et
 * service public du binaire. Le binaire est délégué au {@link PhotoStorageService} (S3 ou BYTEA) ;
 * {@link MediaAsset} porte les métadonnées + le lien org. Ownership : tout chargement admin passe par
 * {@code ...AndOrganizationId} (audit #3). Le service public résout l'org via l'id du média.
 */
@Service
public class MediaLibraryService {

    private static final Logger log = LoggerFactory.getLogger(MediaLibraryService.class);
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_MIME =
        Set.of("image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml");

    private final MediaAssetRepository repository;
    private final PhotoStorageService storage;

    public MediaLibraryService(MediaAssetRepository repository, PhotoStorageService storage) {
        this.repository = repository;
        this.storage = storage;
    }

    @Transactional
    public MediaAssetDto upload(Long orgId, MultipartFile file) {
        validate(file);
        final byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Lecture du fichier impossible");
        }
        String contentType = file.getContentType();
        String key = storage.store(bytes, contentType, file.getOriginalFilename());
        MediaAsset m = new MediaAsset();
        m.setOrganizationId(orgId);
        m.setStorageKey(key);
        m.setContentType(contentType);
        m.setFileName(file.getOriginalFilename());
        m.setFileSize(file.getSize());
        return MediaAssetDto.from(repository.save(m));
    }

    @Transactional(readOnly = true)
    public List<MediaAssetDto> list(Long orgId) {
        return repository.findByOrganizationIdOrderByCreatedAtDesc(orgId).stream()
            .map(MediaAssetDto::from)
            .toList();
    }

    @Transactional
    public void delete(Long orgId, Long id) {
        MediaAsset m = repository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new NotFoundException("Média introuvable: " + id));
        String key = m.getStorageKey();
        repository.delete(m);
        try {
            storage.delete(key);
        } catch (Exception e) {
            log.warn("Suppression du binaire {} KO (média {} déjà retiré en base) : {}", key, id, e.getMessage());
        }
    }

    /** Sert le binaire d'un média (public). NULL si introuvable. L'id résout un média réel (garde-fou). */
    @Transactional(readOnly = true)
    public ServedMedia serve(Long id) {
        MediaAsset m = repository.findById(id).orElse(null);
        if (m == null) {
            return null;
        }
        byte[] data = storage.retrieve(m.getStorageKey());
        return new ServedMedia(data, m.getContentType());
    }

    public record ServedMedia(byte[] data, String contentType) {}

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file est requis");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Fichier trop volumineux (max " + (MAX_BYTES / (1024 * 1024)) + " MB)");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException(
                "Type de fichier non supporté (" + contentType + "). Acceptés : " + String.join(", ", ALLOWED_MIME));
        }
    }
}
