package com.clenzy.service;

import com.clenzy.exception.DocumentStorageException;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Service de stockage des documents generes (PDF) sur le filesystem.
 * Structure : {documentsDir}/{DocumentType}/{YYYY-MM}/{uuid}_{filename}.pdf
 */
@Service
public class DocumentStorageService extends AbstractFileStorageService {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    public DocumentStorageService(
            @Value("${clenzy.uploads.documents-dir:/app/uploads/documents}") String documentsDir,
            MeterRegistry meterRegistry
    ) {
        super(Paths.get(documentsDir), meterRegistry, "clenzy.storage.documents");
    }

    /**
     * Stocke un document PDF genere.
     * Structure : {type}/{YYYY-MM}/{uuid}_{filename}.pdf
     */
    public String store(String documentType, String filename, byte[] pdfContent) {
        try {
            String monthDir = LocalDate.now().format(MONTH_FMT);
            Path targetDir = baseDir.resolve(documentType).resolve(monthDir);
            Files.createDirectories(targetDir);

            String diskFilename = generateDiskFilename(filename);
            Path target = targetDir.resolve(diskFilename).normalize();

            if (!target.startsWith(baseDir)) {
                throw new SecurityException("Path traversal attempt detected");
            }

            Files.write(target, pdfContent, StandardOpenOption.CREATE_NEW);
            log.info("Stored generated document: {}/{}/{}", documentType, monthDir, diskFilename);

            return documentType + "/" + monthDir + "/" + diskFilename;
        } catch (IOException e) {
            throw new DocumentStorageException("Failed to store generated document", e);
        }
    }
}
