package com.clenzy.service;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service de stockage des pieces jointes du module Contact sur le filesystem.
 * Les fichiers sont organises par message : {uploadDir}/{messageId}/{uuid}_{filename}
 * <p>
 * Expose des metriques Micrometer pour le monitoring Grafana :
 * - clenzy.storage.contact.total_bytes   : taille totale des fichiers
 * - clenzy.storage.contact.file_count    : nombre de fichiers
 * - clenzy.storage.contact.disk_free_bytes  : espace libre sur la partition
 * - clenzy.storage.contact.disk_total_bytes : espace total de la partition
 */
@Service
public class ContactFileStorageService {

    private static final Logger log = LoggerFactory.getLogger(ContactFileStorageService.class);

    private final Path uploadDir;

    // Metriques de stockage (mise a jour periodique)
    private final AtomicLong totalBytes = new AtomicLong(0);
    private final AtomicLong fileCount = new AtomicLong(0);
    private final AtomicLong diskFreeBytes = new AtomicLong(0);
    private final AtomicLong diskTotalBytes = new AtomicLong(0);

    public ContactFileStorageService(
            @Value("${clenzy.uploads.contact-dir:/app/uploads/contact}") String contactDir,
            MeterRegistry meterRegistry
    ) {
        this.uploadDir = Paths.get(contactDir).toAbsolutePath().normalize();

        // Enregistrer les gauges Micrometer
        Gauge.builder("clenzy.storage.contact.total_bytes", totalBytes, AtomicLong::doubleValue)
                .description("Taille totale des pieces jointes stockees (bytes)")
                .baseUnit("bytes")
                .register(meterRegistry);

        Gauge.builder("clenzy.storage.contact.file_count", fileCount, AtomicLong::doubleValue)
                .description("Nombre de fichiers stockes")
                .register(meterRegistry);

        Gauge.builder("clenzy.storage.contact.disk_free_bytes", diskFreeBytes, AtomicLong::doubleValue)
                .description("Espace libre sur la partition de stockage (bytes)")
                .baseUnit("bytes")
                .register(meterRegistry);

        Gauge.builder("clenzy.storage.contact.disk_total_bytes", diskTotalBytes, AtomicLong::doubleValue)
                .description("Espace total de la partition de stockage (bytes)")
                .baseUnit("bytes")
                .register(meterRegistry);
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(uploadDir);
            log.info("Contact upload directory initialized: {}", uploadDir);
            // Premiere collecte des metriques au demarrage
            updateStorageMetrics();
        } catch (IOException e) {
            log.error("Cannot create contact upload directory: {}", uploadDir, e);
            throw new RuntimeException("Cannot create contact upload directory", e);
        }
    }

    /**
     * Met a jour les metriques de stockage toutes les 60 secondes.
     */
    @Scheduled(fixedRate = 60_000, initialDelay = 10_000)
    public void updateStorageMetrics() {
        try {
            long[] result = computeDirectoryStats();
            totalBytes.set(result[0]);
            fileCount.set(result[1]);

            FileStore store = Files.getFileStore(uploadDir);
            diskFreeBytes.set(store.getUsableSpace());
            diskTotalBytes.set(store.getTotalSpace());
        } catch (Exception e) {
            log.warn("Failed to update storage metrics: {}", e.getMessage());
        }
    }

    /**
     * Parcourt le repertoire d'uploads et retourne [totalSize, fileCount].
     */
    private long[] computeDirectoryStats() throws IOException {
        if (!Files.exists(uploadDir)) {
            return new long[]{0, 0};
        }
        long[] stats = {0, 0}; // [totalSize, count]
        Files.walkFileTree(uploadDir, new SimpleFileVisitor<>() {
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
     * Stocke un fichier sur le disque.
     *
     * @param messageId     ID du message parent
     * @param attachmentId  UUID de la piece jointe
     * @param filename      Nom sanitise du fichier
     * @param file          Fichier uploade
     * @return Chemin relatif pour stockage en JSONB (ex: "42/abc-uuid_report.pdf")
     */
    public String store(Long messageId, String attachmentId, String filename, MultipartFile file) {
        try {
            Path messageDir = uploadDir.resolve(String.valueOf(messageId));
            Files.createDirectories(messageDir);

            String diskFilename = attachmentId + "_" + filename;
            Path target = messageDir.resolve(diskFilename).normalize();

            // Securite : empecher le path traversal
            if (!target.startsWith(uploadDir)) {
                throw new SecurityException("Path traversal attempt detected");
            }

            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            log.debug("Stored attachment {} for message {}: {}", attachmentId, messageId, target);

            return messageId + "/" + diskFilename;
        } catch (IOException e) {
            log.error("Failed to store attachment {} for message {}: {}", attachmentId, messageId, e.getMessage());
            throw new RuntimeException("Failed to store attachment", e);
        }
    }

    /**
     * Charge un fichier depuis le disque en streaming (pas de chargement complet en memoire).
     *
     * @param storagePath Chemin relatif stocke dans les metadonnees JSONB
     * @return Resource streamable
     */
    public Resource load(String storagePath) {
        try {
            Path filePath = uploadDir.resolve(storagePath).normalize();

            if (!filePath.startsWith(uploadDir)) {
                throw new SecurityException("Path traversal attempt detected");
            }

            if (!Files.exists(filePath)) {
                throw new NoSuchFileException("File not found: " + storagePath);
            }

            InputStream inputStream = Files.newInputStream(filePath);
            return new InputStreamResource(inputStream);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load attachment: " + storagePath, e);
        }
    }

    /**
     * Verifie si un fichier existe sur le disque.
     */
    public boolean exists(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return false;
        Path filePath = uploadDir.resolve(storagePath).normalize();
        return filePath.startsWith(uploadDir) && Files.exists(filePath);
    }
}
