package com.clenzy.service;

import com.clenzy.service.storage.BinaryAssetStorage;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Stockage des photos de profil des voyageurs.
 *
 * <p>Delegue a {@link BinaryAssetStorage} — Postgres BYTEA aujourd'hui, S3 le
 * jour ou l'on bascule {@code clenzy.storage.binary-assets}. Le
 * {@code storage_key} suit la convention {@code "guests/{guestId}/{uuid}.{ext}"}
 * et se range a cote de {@code "users/{userId}/..."} pose par
 * {@link UserAvatarStorageService}.</p>
 *
 * <h3>Pourquoi un service distinct de celui des utilisateurs</h3>
 * <p>Le service des utilisateurs entre par un {@code MultipartFile} : il valide
 * un formulaire d'upload. Les photos voyageurs arrivent en octets — d'un import
 * de canal, d'un jeu de demonstration — et n'ont pas de formulaire. Partager le
 * code aurait demande de generaliser une API de validation dont un seul des deux
 * appelants a besoin, pour economiser une trentaine de lignes.</p>
 */
@Service
public class GuestPhotoStorageService {

    /** Formats acceptes. Meme liste que les avatars utilisateurs. */
    private static final java.util.Set<String> ALLOWED_CONTENT_TYPES =
            java.util.Set.of("image/jpeg", "image/png", "image/webp");

    /** Plafond volontairement bas : un avatar s'affiche entre 26 et 44 px. */
    public static final long MAX_BYTES = 2L * 1024 * 1024;

    private final BinaryAssetStorage storage;

    public GuestPhotoStorageService(BinaryAssetStorage storage) {
        this.storage = storage;
    }

    /**
     * Persiste la photo et retourne le {@code storage_key} a poser sur
     * {@code guests.avatar_url}.
     *
     * @throws IllegalArgumentException si le format ou la taille est refuse
     */
    public String store(Long guestId, String contentType, byte[] bytes) {
        if (guestId == null) throw new IllegalArgumentException("guestId est obligatoire");
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("Photo vide");
        if (bytes.length > MAX_BYTES) {
            throw new IllegalArgumentException("Photo trop lourde (max " + (MAX_BYTES / 1024) + " Ko)");
        }
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (!ALLOWED_CONTENT_TYPES.contains(type)) {
            throw new IllegalArgumentException("Format non supporte : " + contentType);
        }
        String key = "guests/" + guestId + "/" + UUID.randomUUID() + "." + extensionFor(type);
        storage.store(key, type, bytes);
        return key;
    }

    /**
     * Charge la photo pour le streaming HTTP, ou {@link Optional#empty()} si la
     * cle ne designe rien — un objet efface hors flux Baitly ne doit pas faire
     * remonter une erreur 500.
     */
    public Optional<Resource> load(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return Optional.empty();
        return storage.load(storageKey).map(asset -> new ByteArrayResource(asset.bytes()));
    }

    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        storage.delete(storageKey);
    }

    /** Content type deduit de l'extension du storage_key, sinon relu avec les octets. */
    public String contentTypeFor(String storageKey) {
        if (storageKey == null) return "application/octet-stream";
        String lower = storageKey.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        return storage.load(storageKey)
                .map(asset -> asset.contentType())
                .orElse("application/octet-stream");
    }

    private static String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }
}
