package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Disk-based storage for user avatars / profile pictures.
 *
 * <h2>Layout</h2>
 * Files are stored at {@code {uploadDir}/users/{userId}/{uuid}.{ext}}.
 * The returned storage path is the relative path from {@code uploadDir} (e.g.
 * {@code users/42/9b3...png}). That path is stored on
 * {@link com.clenzy.model.User#profilePictureUrl} so the streaming endpoint can serve it.
 *
 * <h2>Why a dedicated service</h2>
 * The existing {@link PhotoStorageService} is coupled to {@code PropertyPhoto} (BYTEA in
 * Postgres). Avatars are small files served frequently — disk + streaming + browser cache is
 * cheaper. {@link ContactFileStorageService} has the same pattern.
 *
 * <h2>Scalability</h2>
 * Backed by local disk in v1; swap with an S3-backed implementation behind a Spring profile
 * for multi-instance deployments. Path validation prevents directory traversal, content-type
 * is whitelisted, size is capped by Spring's multipart-config and by the controller.
 */
@Service
public class UserAvatarStorageService {

    private static final Logger log = LoggerFactory.getLogger(UserAvatarStorageService.class);

    /** Whitelist of accepted image content types. */
    public static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );

    /** Maximum file size — 5 MB. Spring's multipart limits are the first line; this is defence in depth. */
    public static final long MAX_BYTES = 5L * 1024 * 1024;

    private final Path uploadDir;

    public UserAvatarStorageService(
            @Value("${clenzy.uploads.user-avatar-dir:/app/uploads/user-avatars}") String avatarDir
    ) {
        this.uploadDir = Paths.get(avatarDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    void init() {
        try {
            Files.createDirectories(uploadDir);
            log.info("User avatar upload directory initialized: {}", uploadDir);
        } catch (IOException e) {
            log.error("Cannot create user avatar upload directory: {}", uploadDir, e);
            throw new RuntimeException("Cannot create user avatar upload directory", e);
        }
    }

    /**
     * Store an uploaded avatar for a given user. Returns the relative storage path.
     *
     * @throws IllegalArgumentException if validation fails (size / type / empty)
     */
    public String store(Long userId, MultipartFile file) {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        validate(file);

        try {
            Path userDir = uploadDir.resolve("users").resolve(String.valueOf(userId));
            Files.createDirectories(userDir);

            String ext = extensionFor(file);
            String diskFilename = UUID.randomUUID() + "." + ext;
            Path target = userDir.resolve(diskFilename).normalize();
            assertWithinUploadDir(target);

            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            String relative = "users/" + userId + "/" + diskFilename;
            log.debug("Stored avatar for user {} at {}", userId, relative);
            return relative;
        } catch (IOException e) {
            log.error("Failed to store avatar for user {}: {}", userId, e.getMessage());
            throw new RuntimeException("Failed to store avatar", e);
        }
    }

    public Resource load(String storagePath) {
        try {
            Path filePath = uploadDir.resolve(storagePath).normalize();
            assertWithinUploadDir(filePath);

            if (!Files.exists(filePath)) {
                throw new NoSuchFileException("Avatar not found: " + storagePath);
            }

            InputStream inputStream = Files.newInputStream(filePath);
            return new InputStreamResource(inputStream);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load avatar: " + storagePath, e);
        }
    }

    public void delete(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return;
        try {
            Path filePath = uploadDir.resolve(storagePath).normalize();
            assertWithinUploadDir(filePath);
            Files.deleteIfExists(filePath);
            log.debug("Deleted avatar at {}", storagePath);
        } catch (IOException | SecurityException e) {
            log.warn("Failed to delete avatar at {}: {}", storagePath, e.getMessage());
        }
    }

    public boolean exists(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return false;
        Path filePath = uploadDir.resolve(storagePath).normalize();
        return filePath.startsWith(uploadDir) && Files.exists(filePath);
    }

    /** Infer the content type from the file extension (used when streaming back). */
    public String contentTypeFor(String storagePath) {
        if (storagePath == null) return "application/octet-stream";
        String lower = storagePath.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        return "application/octet-stream";
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Avatar file is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Avatar exceeds maximum size of " + (MAX_BYTES / (1024 * 1024)) + " MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
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

    private void assertWithinUploadDir(Path candidate) {
        if (!candidate.startsWith(uploadDir)) {
            throw new SecurityException("Path traversal attempt detected: " + candidate);
        }
    }
}
