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

/**
 * Service de stockage des templates de documents (.odt) sur le filesystem.
 * Les fichiers sont stockes sous : {templatesDir}/{uuid}_{filename}
 */
@Service
public class DocumentTemplateStorageService extends AbstractFileStorageService {

    public DocumentTemplateStorageService(
            @Value("${clenzy.uploads.templates-dir:/app/uploads/templates}") String templatesDir,
            MeterRegistry meterRegistry
    ) {
        super(Paths.get(templatesDir), meterRegistry, "clenzy.storage.templates");
    }

    /**
     * Stocke un template .odt sur le disque.
     */
    public String store(MultipartFile file) {
        try {
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.isBlank()) {
                originalFilename = "template.odt";
            }

            String diskFilename = generateDiskFilename(originalFilename);
            Path target = baseDir.resolve(diskFilename).normalize();

            if (!target.startsWith(baseDir)) {
                throw new SecurityException("Path traversal attempt detected");
            }

            Files.copy(file.getInputStream(), target);
            log.info("Stored template: {}", diskFilename);
            return diskFilename;
        } catch (IOException e) {
            throw new DocumentStorageException("Failed to store template", e);
        }
    }

    /**
     * Retourne le Path absolu d'un template pour le traitement XDocReport.
     */
    public Path getAbsolutePath(String storagePath) {
        return resolveAndValidate(storagePath);
    }

    /**
     * Supprime un template du disque.
     */
    public void delete(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) return;
        try {
            Path filePath = resolveAndValidate(storagePath);
            Files.deleteIfExists(filePath);
            log.info("Deleted template: {}", storagePath);
        } catch (IOException e) {
            log.warn("Failed to delete template {}: {}", storagePath, e.getMessage());
        }
    }
}
