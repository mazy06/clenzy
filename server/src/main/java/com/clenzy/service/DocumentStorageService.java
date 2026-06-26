package com.clenzy.service;

import com.clenzy.exception.DocumentStorageException;
import com.clenzy.service.storage.DocumentBinaryStore;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.ObjectProvider;
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
            MeterRegistry meterRegistry,
            ObjectProvider<DocumentBinaryStore> objectStoreProvider
    ) {
        super(Paths.get(documentsDir), meterRegistry, "clenzy.storage.documents",
                objectStoreProvider.getIfAvailable());
    }

    /**
     * Stocke un document PDF genere.
     * Structure (disque) : {type}/{YYYY-MM}/{uuid}_{filename}.pdf
     * Structure (objet)  : org/{orgId}/documents/{type}/{YYYY-MM}/{uuid}_{filename}.pdf
     *
     * @return reference de stockage (chemin relatif disque, ou cle objet org-scopee)
     */
    public String store(String documentType, String filename, byte[] pdfContent) {
        if (isObjectStoreActive()) {
            String monthDir = LocalDate.now().format(MONTH_FMT);
            String logicalKey = documentType + "/" + monthDir + "/" + generateDiskFilename(filename);
            return storeViaObject(logicalKey, pdfContent, "application/pdf");
        }
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
