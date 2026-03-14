package com.clenzy.service;

import com.clenzy.exception.DocumentStorageException;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Stockage des justificatifs (recus/factures) des depenses prestataires.
 * Structure : {receiptsDir}/{orgId}/{YYYY-MM}/{uuid}_{filename}
 */
@Service
public class ReceiptStorageService extends AbstractFileStorageService {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    private static final java.util.Set<String> ALLOWED_TYPES = java.util.Set.of(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    public ReceiptStorageService(
            @Value("${clenzy.uploads.receipts-dir:/app/uploads/receipts}") String receiptsDir,
            MeterRegistry meterRegistry
    ) {
        super(Paths.get(receiptsDir), meterRegistry, "clenzy.storage.receipts");
    }

    /**
     * Stocke un justificatif uploade.
     * @return chemin relatif pour stockage en DB
     */
    public String store(Long orgId, MultipartFile file) {
        validateFile(file);

        try {
            String monthDir = LocalDate.now().format(MONTH_FMT);
            Path targetDir = baseDir.resolve(String.valueOf(orgId)).resolve(monthDir);
            Files.createDirectories(targetDir);

            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.isBlank()) {
                originalFilename = "receipt.pdf";
            }

            String diskFilename = generateDiskFilename(originalFilename);
            Path target = targetDir.resolve(diskFilename).normalize();

            if (!target.startsWith(baseDir)) {
                throw new SecurityException("Path traversal attempt detected");
            }

            Files.copy(file.getInputStream(), target);
            log.info("Stored receipt: {}/{}/{}", orgId, monthDir, diskFilename);

            return orgId + "/" + monthDir + "/" + diskFilename;
        } catch (IOException e) {
            throw new DocumentStorageException("Failed to store receipt", e);
        }
    }

    /**
     * Supprime un justificatif du disque.
     */
    public void delete(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return;
        try {
            Path filePath = resolveAndValidate(storagePath);
            Files.deleteIfExists(filePath);
            log.info("Deleted receipt: {}", storagePath);
        } catch (IOException e) {
            log.warn("Failed to delete receipt {}: {}", storagePath, e.getMessage());
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier est vide");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Le fichier depasse la taille maximale de 10 MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Type de fichier non supporte. Types acceptes : PDF, JPEG, PNG, WebP");
        }
    }
}
