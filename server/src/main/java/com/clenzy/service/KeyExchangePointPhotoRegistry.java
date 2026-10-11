package com.clenzy.service;

import com.clenzy.dto.keyexchange.KeyExchangePointPhotoDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.KeyExchangePoint;
import com.clenzy.model.KeyExchangePointPhoto;
import com.clenzy.model.User;
import com.clenzy.repository.KeyExchangePointPhotoRepository;
import com.clenzy.repository.KeyExchangePointRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.storage.ObjectStorageTransactions;
import com.clenzy.service.storage.StoredObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Métadonnées des photos d'emplacement d'un point de remise des clés : chaque
 * opération est une transaction courte, sans aucun appel au stockage objet
 * (règle audit n°2) — c'est {@link KeyExchangePointPhotoService} qui écrit et lit
 * les octets, avant ou après ces transactions.
 *
 * <p>Les points sont chargés par identifiant : l'appartenance à l'organisation
 * est vérifiée explicitement (règle audit n°3).</p>
 */
@Service
public class KeyExchangePointPhotoRegistry {

    /** Quelques vues suffisent à trouver l'endroit : rue, accès, boîte ou comptoir. */
    static final int MAX_PHOTOS_PER_POINT = 6;
    static final long MAX_PHOTO_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_PHOTO_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final KeyExchangePointRepository pointRepository;
    private final KeyExchangePointPhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final OrganizationAccessGuard accessGuard;

    public KeyExchangePointPhotoRegistry(KeyExchangePointRepository pointRepository,
                                         KeyExchangePointPhotoRepository photoRepository,
                                         UserRepository userRepository,
                                         OrganizationAccessGuard accessGuard) {
        this.pointRepository = pointRepository;
        this.photoRepository = photoRepository;
        this.userRepository = userRepository;
        this.accessGuard = accessGuard;
    }

    /** Où lire les octets d'une photo. */
    public record PhotoContent(String storageKey, String contentType) {
    }

    /** Une photo à envoyer : seules sa taille et son type comptent pour le refus anticipé. */
    public record PhotoCandidate(long size, String contentType) {
    }

    /** Refus anticipé, AVANT d'écrire le moindre fichier : point de l'organisation, nombre, taille, format. */
    @Transactional(readOnly = true)
    public void checkUpload(Long pointId, List<PhotoCandidate> candidates) {
        requirePoint(pointId);
        requireRoom(pointId, candidates.size());
        candidates.forEach(candidate -> validatePhoto(candidate.size(), candidate.contentType()));
    }

    /** Enregistre les clés de fichiers déjà écrits sur le stockage. */
    @Transactional
    public List<KeyExchangePointPhotoDto> attach(Long pointId, List<StoredObject> stored, String uploaderKeycloakId) {
        KeyExchangePoint point = requirePoint(pointId);
        requireRoom(pointId, stored.size());
        Long uploaderId = userRepository.findByKeycloakId(uploaderKeycloakId).map(User::getId).orElse(null);
        for (StoredObject object : stored) {
            KeyExchangePointPhoto photo = new KeyExchangePointPhoto();
            photo.setPointId(point.getId());
            photo.setOrganizationId(point.getOrganizationId());
            photo.setStorageKey(object.key());
            photo.setContentType(object.contentType());
            photo.setFileSize(object.size());
            photo.setOriginalFilename(object.originalFilename());
            photo.setUploadedById(uploaderId);
            photoRepository.save(photo);
        }
        return listFor(pointId);
    }

    @Transactional(readOnly = true)
    public PhotoContent findContent(Long pointId, Long photoId) {
        KeyExchangePointPhoto photo = requirePhoto(pointId, photoId);
        return new PhotoContent(photo.getStorageKey(), photo.getContentType());
    }

    /**
     * Supprime la ligne ; le fichier n'est détruit qu'après validation de la
     * transaction (une annulation ne laisse pas une ligne pointer vers un objet disparu).
     */
    @Transactional
    public void remove(Long pointId, Long photoId, Consumer<String> deleteObject) {
        KeyExchangePointPhoto photo = requirePhoto(pointId, photoId);
        photoRepository.delete(photo);
        String key = photo.getStorageKey();
        ObjectStorageTransactions.afterCommit("photo point de remise " + photoId, () -> deleteObject.accept(key));
    }

    @Transactional(readOnly = true)
    public List<KeyExchangePointPhotoDto> listFor(Long pointId) {
        return photoRepository.findByPointIdOrderByIdAsc(pointId).stream()
                .map(photo -> new KeyExchangePointPhotoDto(photo.getId(), KeyExchangePointPhotoDto.dataUrl(pointId, photo.getId())))
                .toList();
    }

    /** Photos de plusieurs points en une requête (listing des points). */
    @Transactional(readOnly = true)
    public Map<Long, List<KeyExchangePointPhotoDto>> listFor(Collection<Long> pointIds) {
        if (pointIds.isEmpty()) return Map.of();
        return photoRepository.findByPointIdInOrderByIdAsc(pointIds).stream()
                .collect(Collectors.groupingBy(KeyExchangePointPhoto::getPointId,
                        Collectors.mapping(photo -> new KeyExchangePointPhotoDto(photo.getId(),
                                KeyExchangePointPhotoDto.dataUrl(photo.getPointId(), photo.getId())), Collectors.toList())));
    }

    private KeyExchangePoint requirePoint(Long pointId) {
        KeyExchangePoint point = pointRepository.findById(pointId)
                .orElseThrow(() -> new NotFoundException("Point d'echange introuvable"));
        accessGuard.requireSameOrganization(point.getOrganizationId(), "Point d'echange hors de votre organisation");
        return point;
    }

    private KeyExchangePointPhoto requirePhoto(Long pointId, Long photoId) {
        KeyExchangePointPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new NotFoundException("Photo introuvable"));
        if (!Objects.equals(photo.getPointId(), pointId)) {
            throw new NotFoundException("Photo introuvable");
        }
        accessGuard.requireSameOrganization(photo.getOrganizationId(), "Photo " + photoId);
        return photo;
    }

    private void requireRoom(Long pointId, int adding) {
        long existing = photoRepository.countByPointId(pointId);
        if (existing + adding > MAX_PHOTOS_PER_POINT) {
            throw new IllegalArgumentException(
                    "Maximum " + MAX_PHOTOS_PER_POINT + " photos par point de remise (deja " + existing + ").");
        }
    }

    private static void validatePhoto(long size, String contentType) {
        if (size > MAX_PHOTO_BYTES) {
            throw new IllegalArgumentException("Chaque photo doit peser moins de 5 Mo.");
        }
        if (contentType == null || !ALLOWED_PHOTO_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Formats acceptes : JPEG, PNG, WEBP, GIF.");
        }
    }
}
