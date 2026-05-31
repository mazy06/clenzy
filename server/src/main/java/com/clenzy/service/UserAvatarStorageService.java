package com.clenzy.service;

import com.clenzy.service.storage.BinaryAssetStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Storage des avatars / photos de profil utilisateur.
 *
 * <h3>Backend</h3>
 * Delegue a {@link BinaryAssetStorage} (Postgres BYTEA en V1 via
 * {@code PostgresBinaryAssetStorage}, S3 prevu en V2 quand on passera sous AWS).
 *
 * <h3>Layout</h3>
 * Le {@code storage_key} stocke en DB (sur {@code users.profile_picture_url})
 * suit la convention {@code "users/{userId}/{uuid}.{ext}"}. Le format reste
 * stable a la migration S3 — seul le backend physique change.
 *
 * <h3>Validation</h3>
 * Taille max 5 MB, formats whitelistes (jpeg/png/webp/gif), defense en profondeur
 * en plus de Spring multipart-config.
 *
 * <h3>TODO migration S3</h3>
 * Aucun changement de code attendu ici a la migration — il suffit de basculer
 * {@code clenzy.storage.binary-assets=s3} et d'activer {@code S3BinaryAssetStorage}.
 * Les paths existants en DB restent valides (le backend resout via le storage_key).
 */
@Service
public class UserAvatarStorageService {

    private static final Logger log = LoggerFactory.getLogger(UserAvatarStorageService.class);

    /** Whitelist des content types images acceptes. */
    public static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    );

    /** Taille max 5 MB. Defense en profondeur en plus de la config multipart Spring. */
    public static final long MAX_BYTES = 5L * 1024 * 1024;

    private final BinaryAssetStorage storage;

    public UserAvatarStorageService(BinaryAssetStorage storage) {
        this.storage = storage;
    }

    /**
     * Persiste l'avatar uploade pour l'utilisateur et retourne le storage_key
     * (qu'on stocke ensuite sur {@code users.profile_picture_url}).
     *
     * @throws IllegalArgumentException si la validation echoue (taille / type / vide)
     */
    public String store(Long userId, MultipartFile file) {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        validate(file);

        String ext = extensionFor(file);
        String storageKey = "users/" + userId + "/" + UUID.randomUUID() + "." + ext;
        try {
            storage.store(storageKey, file.getContentType(), file.getBytes());
            log.debug("Stored avatar for user {} at {}", userId, storageKey);
            return storageKey;
        } catch (IOException e) {
            throw new RuntimeException("Failed to read uploaded avatar bytes", e);
        }
    }

    /**
     * Charge l'avatar par son storage_key sous forme de {@link Resource} pour
     * le streaming HTTP. Wrappe les bytes dans un {@link ByteArrayResource} —
     * acceptable pour avatars &lt;5 MB. Pour de gros assets, voir
     * {@code S3BinaryAssetStorage} (V2) qui pourra streamer.
     */
    public Resource load(String storageKey) {
        return storage.load(storageKey)
            .map(asset -> (Resource) new ByteArrayResource(asset.bytes()))
            .orElseThrow(() -> new RuntimeException("Avatar not found: " + storageKey));
    }

    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        storage.delete(storageKey);
    }

    public boolean exists(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return false;
        return storage.exists(storageKey);
    }

    /**
     * Resout le content type a partir du storage_key (qui contient l'extension).
     * Fallback : on tente le content type effectif via {@link BinaryAssetStorage#load}
     * si l'extension est absente / inconnue.
     */
    public String contentTypeFor(String storageKey) {
        if (storageKey == null) return "application/octet-stream";
        String lower = storageKey.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        // Fallback : aller chercher le content type stocke avec les bytes.
        return storage.load(storageKey)
            .map(BinaryAssetStorage.StoredBinaryAsset::contentType)
            .orElse("application/octet-stream");
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Avatar file is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException(
                "Avatar exceeds maximum size of " + (MAX_BYTES / (1024 * 1024)) + " MB");
        }
        String contentType = file.getContentType();
        if (contentType == null
            || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Unsupported content type: " + contentType);
        }
    }

    private static String extensionFor(MultipartFile file) {
        String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        return switch (ct) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            default -> "jpg";
        };
    }
}
