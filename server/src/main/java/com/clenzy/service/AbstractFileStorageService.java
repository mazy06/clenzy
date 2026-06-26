package com.clenzy.service;

import com.clenzy.exception.DocumentStorageException;
import com.clenzy.service.storage.DocumentBinaryStore;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.annotation.Scheduled;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Classe abstraite factorant la logique commune de stockage fichier.
 * Gere le repertoire de base, les metriques Micrometer, la securite path traversal.
 */
public abstract class AbstractFileStorageService {

    protected final Logger log = LoggerFactory.getLogger(getClass());

    protected final Path baseDir;

    /**
     * Strategie de stockage objet, injectee uniquement quand {@code clenzy.storage.documents=object}
     * (sinon {@code null} → stockage disque historique). Voir {@link DocumentBinaryStore}.
     */
    @Nullable
    private final DocumentBinaryStore objectStore;

    private final AtomicLong totalBytes = new AtomicLong(0);
    private final AtomicLong fileCount = new AtomicLong(0);
    private final AtomicLong diskFreeBytes = new AtomicLong(0);
    private final AtomicLong diskTotalBytes = new AtomicLong(0);

    protected AbstractFileStorageService(Path baseDir,
                                         MeterRegistry meterRegistry,
                                         String metricsPrefix,
                                         @Nullable DocumentBinaryStore objectStore) {
        this.baseDir = baseDir.toAbsolutePath().normalize();
        this.objectStore = objectStore;

        Gauge.builder(metricsPrefix + ".total_bytes", totalBytes, AtomicLong::doubleValue)
                .description("Taille totale des fichiers stockes (bytes)")
                .baseUnit("bytes")
                .register(meterRegistry);

        Gauge.builder(metricsPrefix + ".file_count", fileCount, AtomicLong::doubleValue)
                .description("Nombre de fichiers stockes")
                .register(meterRegistry);

        Gauge.builder(metricsPrefix + ".disk_free_bytes", diskFreeBytes, AtomicLong::doubleValue)
                .description("Espace libre sur la partition de stockage (bytes)")
                .baseUnit("bytes")
                .register(meterRegistry);

        Gauge.builder(metricsPrefix + ".disk_total_bytes", diskTotalBytes, AtomicLong::doubleValue)
                .description("Espace total de la partition de stockage (bytes)")
                .baseUnit("bytes")
                .register(meterRegistry);
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(baseDir);
            log.info("Storage directory initialized: {}", baseDir);
            updateStorageMetrics();
        } catch (IOException e) {
            // Ne pas crasher le backend si le repertoire ne peut pas etre cree.
            // Certains services de stockage sont optionnels (ex: templates).
            // Les operations de lecture/ecriture echoueront au moment de l'appel.
            log.warn("Cannot create storage directory {}. File operations will fail until the directory exists: {}",
                    baseDir, e.getMessage());
        }
    }

    @Scheduled(fixedRate = 60_000, initialDelay = 15_000)
    public void updateStorageMetrics() {
        try {
            long[] result = computeDirectoryStats();
            totalBytes.set(result[0]);
            fileCount.set(result[1]);

            FileStore store = Files.getFileStore(baseDir);
            diskFreeBytes.set(store.getUsableSpace());
            diskTotalBytes.set(store.getTotalSpace());
        } catch (Exception e) {
            log.warn("Failed to update storage metrics: {}", e.getMessage());
        }
    }

    private long[] computeDirectoryStats() throws IOException {
        if (!Files.exists(baseDir)) {
            return new long[]{0, 0};
        }
        long[] stats = {0, 0};
        Files.walkFileTree(baseDir, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (attrs.isRegularFile()) {
                    stats[0] += attrs.size();
                    stats[1]++;
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) {
                return FileVisitResult.CONTINUE;
            }
        });
        return stats;
    }

    /**
     * Resout et valide un chemin relatif contre le repertoire de base (anti path-traversal).
     */
    protected Path resolveAndValidate(String relativePath) {
        Path resolved = baseDir.resolve(relativePath).normalize();
        if (!resolved.startsWith(baseDir)) {
            throw new SecurityException("Path traversal attempt detected");
        }
        return resolved;
    }

    /**
     * Genere un nom de fichier securise sur le disque : uuid_sanitizedName.
     */
    protected String generateDiskFilename(String originalFilename) {
        String safeName = originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
        return UUID.randomUUID() + "_" + safeName;
    }

    /**
     * Charge un fichier en streaming. Route vers le stockage objet quand actif
     * ({@code clenzy.storage.documents=object}), sinon lecture disque historique.
     */
    public Resource load(String storagePath) {
        if (objectStore != null) {
            return objectStore.load(storagePath);
        }
        try {
            Path filePath = resolveAndValidate(storagePath);
            if (!Files.exists(filePath)) {
                throw new DocumentStorageException("File not found: " + storagePath);
            }
            InputStream inputStream = Files.newInputStream(filePath);
            return new InputStreamResource(inputStream);
        } catch (IOException e) {
            throw new DocumentStorageException("Failed to load file: " + storagePath, e);
        }
    }

    /**
     * Charge un fichier en bytes. Route vers le stockage objet quand actif, sinon disque.
     */
    public byte[] loadAsBytes(String storagePath) {
        if (objectStore != null) {
            return objectStore.loadAsBytes(storagePath);
        }
        try {
            Path filePath = resolveAndValidate(storagePath);
            if (!Files.exists(filePath)) {
                throw new DocumentStorageException("File not found: " + storagePath);
            }
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            throw new DocumentStorageException("Failed to load file bytes: " + storagePath, e);
        }
    }

    /**
     * Verifie l'existence d'un fichier. Route vers le stockage objet quand actif, sinon disque.
     */
    public boolean exists(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return false;
        if (objectStore != null) {
            return objectStore.exists(storagePath);
        }
        Path filePath = baseDir.resolve(storagePath).normalize();
        return filePath.startsWith(baseDir) && Files.exists(filePath);
    }

    // ── Seam stockage objet vs disque ────────────────────────────────────────

    /**
     * Indique si le stockage objet est actif ({@code clenzy.storage.documents=object}).
     * Les sous-classes branchent leur {@code store(...)}/{@code delete(...)} sur ce drapeau :
     * {@code true} → {@link #storeViaObject}/{@link #deleteRef} ; {@code false} → ecriture disque.
     */
    protected boolean isObjectStoreActive() {
        return objectStore != null;
    }

    /**
     * Persiste des octets via le stockage objet sous la cle logique fournie et retourne la
     * reference org-scopee a persister en base. A n'appeler que si {@link #isObjectStoreActive()}.
     *
     * @param logicalKey  cle logique relative (ex : {@code FACTURE/2026-06/<uuid>_nom.pdf})
     * @param data        octets a stocker
     * @param contentType type MIME (peut etre {@code null})
     */
    protected String storeViaObject(String logicalKey, byte[] data, String contentType) {
        return objectStore.write(logicalKey, data, contentType);
    }

    /**
     * Supprime une reference de stockage objet (idempotent). A n'appeler que si
     * {@link #isObjectStoreActive()}.
     */
    protected void deleteRef(String storageRef) {
        objectStore.delete(storageRef);
    }
}
