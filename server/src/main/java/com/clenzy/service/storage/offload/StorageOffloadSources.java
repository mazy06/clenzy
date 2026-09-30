package com.clenzy.service.storage.offload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import java.nio.file.Paths;

/**
 * Les familles de fichiers reprises vers le stockage objet. Chacune n'est active que lorsque sa
 * famille est basculée ({@code clenzy.storage.*=object}) : en mode base ou disque (développement),
 * la reprise ne fait rien.
 */
@Configuration
public class StorageOffloadSources {

    private static final String OBJECT = "object";

    @Bean
    InlineBinarySource propertyPhotosOffload(JdbcTemplate jdbc,
                                             @Value("${clenzy.storage.photos:bytea}") String mode) {
        return new ByteaColumnSource(jdbc, "photos-logements", "property_photos",
                "t.organization_id", "photos", () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource interventionPhotosOffload(JdbcTemplate jdbc,
                                                 @Value("${clenzy.storage.intervention-photos:bytea}") String mode) {
        return new ByteaColumnSource(jdbc, "photos-interventions", "intervention_photos",
                "t.organization_id", "intervention-photos", () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource issuePhotosOffload(JdbcTemplate jdbc,
                                          @Value("${clenzy.storage.photos:bytea}") String mode) {
        return new ByteaColumnSource(jdbc, "photos-signalements", "issue_photos",
                "t.organization_id", "photos", () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource contactAttachmentsOffload(JdbcTemplate jdbc,
                                                 @Value("${clenzy.storage.photos:bytea}") String mode) {
        return new ByteaColumnSource(jdbc, "pieces-jointes-contact", "contact_attachment_files",
                "(SELECT m.organization_id FROM contact_messages m WHERE m.id = t.message_id)", "photos",
                () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource binaryAssetsOffload(JdbcTemplate jdbc,
                                           @Value("${clenzy.storage.binary-assets:postgres}") String mode) {
        return new BinaryAssetSource(jdbc, () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource upsellImagesOffload(JdbcTemplate jdbc, PlatformTransactionManager transactionManager,
                                           @Value("${clenzy.storage.photos:bytea}") String mode) {
        return new UpsellImageSource(jdbc, transactionManager, () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource generatedDocumentsOffload(JdbcTemplate jdbc,
                                                 @Value("${clenzy.storage.documents:disk}") String mode,
                                                 @Value("${clenzy.uploads.documents-dir:/app/uploads/documents}") String dir) {
        return new DiskDocumentSource(jdbc, "documents-generes", "document_generations", "file_path",
                Paths.get(dir), () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource signedMandatesOffload(JdbcTemplate jdbc,
                                             @Value("${clenzy.storage.documents:disk}") String mode,
                                             @Value("${clenzy.uploads.documents-dir:/app/uploads/documents}") String dir) {
        return new DiskDocumentSource(jdbc, "mandats-signes", "contract_signature_requests", "signed_document_path",
                Paths.get(dir), () -> OBJECT.equals(mode));
    }

    @Bean
    InlineBinarySource expenseReceiptsOffload(JdbcTemplate jdbc,
                                              @Value("${clenzy.storage.documents:disk}") String mode,
                                              @Value("${clenzy.uploads.receipts-dir:/app/uploads/receipts}") String dir) {
        return new DiskDocumentSource(jdbc, "justificatifs-depenses", "provider_expenses", "receipt_path",
                Paths.get(dir), () -> OBJECT.equals(mode));
    }
}
