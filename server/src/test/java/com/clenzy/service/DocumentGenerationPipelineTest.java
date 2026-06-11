package com.clenzy.service;

import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.tenant.TenantContext;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("DocumentGenerationPipeline")
class DocumentGenerationPipelineTest {

    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentStorageService documentStorageService;
    @Mock private TagResolverService tagResolverService;
    @Mock private LibreOfficeConversionService conversionService;
    @Mock private DocumentNumberingService numberingService;
    @Mock private DocumentComplianceService complianceService;
    @Mock private InvoiceGeneratorService invoiceGeneratorService;
    @Mock private NotificationService notificationService;
    @Mock private AuditLogService auditLogService;
    @Mock private TenantContext tenantContext;
    @Mock private DocumentGenerationFailureRecorder failureRecorder;
    @Mock private DocumentEmailDispatcher emailDispatcher;
    @Mock private DocumentTemplateRenderer renderer;

    private SimpleMeterRegistry meterRegistry;
    private DocumentGenerationPipeline pipeline;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        pipeline = new DocumentGenerationPipeline(
                generationRepository, documentStorageService, tagResolverService, conversionService,
                numberingService, complianceService, invoiceGeneratorService, notificationService,
                auditLogService, tenantContext, failureRecorder, emailDispatcher, renderer, meterRegistry);
    }

    // ─── recordMissingTemplateFailure ───────────────────────────────────────

    @Nested
    @DisplayName("recordMissingTemplateFailure")
    class RecordMissingTemplateFailure {

        @Test
        void whenNoActiveTemplate_thenPersistsExplicitFailureRow() {
            // Act
            pipeline.recordMissingTemplateFailure(
                    DocumentType.DEVIS, 100L, ReferenceType.RECEIVED_FORM, 7L, "guest@test.com");

            // Assert : ligne FAILED persistee via le recorder REQUIRES_NEW, message
            // explicite mentionnant le type de template manquant, duree 0.
            ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
            verify(failureRecorder).recordFailure(
                    eq(DocumentType.DEVIS), eq(100L), eq(ReferenceType.RECEIVED_FORM),
                    eq(7L), eq((Long) null), eq("guest@test.com"), messageCaptor.capture(), eq(0));
            assertThat(messageCaptor.getValue())
                    .contains("Aucun template actif")
                    .contains("DEVIS");
        }

        @Test
        void whenNoActiveTemplate_thenFailureCounterIncremented() {
            // Act
            pipeline.recordMissingTemplateFailure(
                    DocumentType.FACTURE, 1L, ReferenceType.INTERVENTION, null, null);

            // Assert
            assertThat(meterRegistry.counter("clenzy.documents.generation.failure").count())
                    .isEqualTo(1.0);
            assertThat(meterRegistry.counter("clenzy.documents.generation.success").count())
                    .isEqualTo(0.0);
        }
    }

    // ─── Helpers statiques (noms de fichier + taille) ───────────────────────

    @Nested
    @DisplayName("buildPdfFilename / formatFileSize")
    class StaticHelpers {

        @Test
        void whenReferenceIdProvided_thenFilenameContainsRefAndPdfExtension() {
            // Act
            String name = DocumentGenerationPipeline.buildPdfFilename(DocumentType.FACTURE, 42L);

            // Assert
            assertThat(name).contains("_REF-42_").endsWith(".pdf");
        }

        @Test
        void whenReferenceIdNull_thenFilenameOmitsRef() {
            // Act
            String name = DocumentGenerationPipeline.buildPdfFilename(DocumentType.DEVIS, null);

            // Assert
            assertThat(name).doesNotContain("_REF-").endsWith(".pdf");
        }

        @Test
        void whenBytesBelowOneKb_thenFormattedInBytes() {
            assertThat(DocumentGenerationPipeline.formatFileSize(512L)).isEqualTo("512 B");
        }

        @Test
        void whenBytesInKbRange_thenFormattedInKb() {
            assertThat(DocumentGenerationPipeline.formatFileSize(2048L)).contains("KB");
        }

        @Test
        void whenBytesInMbRange_thenFormattedInMb() {
            assertThat(DocumentGenerationPipeline.formatFileSize(5_242_880L)).contains("MB");
        }
    }
}
