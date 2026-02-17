package com.clenzy.service;

import com.clenzy.exception.DocumentStorageException;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
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

    private final AtomicLong totalBytes = new AtomicLong(0);
    private final AtomicLong fileCount = new AtomicLong(0);
    private final AtomicLong diskFreeBytes = new AtomicLong(0);
    private final AtomicLong diskTotalBytes = new AtomicLong(0);

    protected AbstractFileStorageService(Path baseDir, MeterRegistry meterRegistry, String metricsPrefix) {
        this.baseDir = baseDir.toAbsolutePath().normalize();

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
            log.error("Cannot create storage directory: {}", baseDir, e);
            throw new DocumentStorageException("Cannot create storage directory", e);
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
     * Charge un fichier en streaming.
     */
    public Resource load(String storagePath) {
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
     * Charge un fichier en bytes.
     */
    public byte[] loadAsBytes(String storagePath) {
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
     * Verifie l'existence d'un fichier.
     */
    public boolean exists(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return false;
        Path filePath = baseDir.resolve(storagePath).normalize();
        return filePath.startsWith(baseDir) && Files.exists(filePath);
    }
}
