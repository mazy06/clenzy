package com.clenzy.service;

import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.NotificationKey;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.HashMap;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("DocumentGenerationPipeline")
class DocumentGenerationPipelineTest {

    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentStorageService documentStorageService;
    @Mock private TagResolverService tagResolverService;
    @Mock private BaitlyPdfEngine conversionService;
    @Mock private DocumentNumberingService numberingService;
    @Mock private DocumentComplianceService complianceService;
    @Mock private InvoiceGeneratorService invoiceGeneratorService;
    @Mock private InvoicePdfService invoicePdfService;
    @Mock private BaitlyInvoicePdfStore invoicePdfStore;
    @Mock private NotificationService notificationService;
    @Mock private AuditLogService auditLogService;
    @Mock private TenantContext tenantContext;
    @Mock private DocumentGenerationFailureRecorder failureRecorder;
    @Mock private DocumentEmailDispatcher emailDispatcher;
    @Mock private DocumentTemplateRenderer renderer;
    @Mock private PlatformTransactionManager transactionManager;

    private SimpleMeterRegistry meterRegistry;
    private DocumentGenerationPipeline pipeline;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        pipeline = new DocumentGenerationPipeline(
                generationRepository, documentStorageService, tagResolverService, conversionService,
                numberingService, complianceService, invoiceGeneratorService, invoicePdfService, invoicePdfStore, notificationService,
                auditLogService, tenantContext, failureRecorder, emailDispatcher, renderer, meterRegistry,
                transactionManager);
    }

    @Test void canonicalInvoiceArchiveIsUsedWithoutASecondNumberOrTemplateRender() {
        var invoice=BaitlyDocumentVerificationTest.invoice();invoice.setId(8L);invoice.setOrganizationId(7L);
        var template=new DocumentTemplate();template.setDocumentType(DocumentType.FACTURE);template.setOrganizationId(7L);
        byte[] bytes=BaitlyPdfEngineTest.pdf("TEST facture canonique");
        when(generationRepository.save(any())).thenAnswer(call->{DocumentGeneration g=call.getArgument(0);g.setId(99L);return g;});
        when(invoiceGeneratorService.createIssuedFromDocumentGeneration(ReferenceType.RESERVATION,5L,7L,null,null)).thenReturn(invoice);
        when(invoicePdfStore.existing(7L,8L)).thenReturn(bytes);
        when(invoicePdfStore.archive(eq(7L),eq(8L),anyString(),eq(bytes))).thenReturn(bytes);
        when(documentStorageService.store(anyString(),anyString(),eq(bytes))).thenReturn("archive/99.pdf");
        var result=pipeline.execute(new DocumentGenerationPipeline.GenerationCommand(template,5L,ReferenceType.RESERVATION,null,false,"reviewer",null,7L,"FR",false,null,null));
        assertThat(result.legalNumber()).isEqualTo(invoice.getInvoiceNumber());
        assertThat(invoice.getDocumentGenerationId()).isEqualTo(99L);
        org.mockito.Mockito.verifyNoInteractions(renderer,conversionService,invoicePdfService,tagResolverService,numberingService);
        verify(complianceService).lockDocument(any(),eq(bytes));
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

    // ─── Envoi email apres commit ───────────────────────────────────────────

    @Nested
    @DisplayName("envoi email apres commit")
    class EmailAfterCommit {

        @Test
        void whenCallerCommits_thenEmailLeavesThenItsOutcomeIsWrittenInANewTransaction() throws Exception {
            // Apres commit, la transaction de la generation reste liee au thread : l'issue
            // (SENT + notification) doit ouvrir sa propre transaction, sinon elle est perdue.
            DocumentTemplate template = new DocumentTemplate();
            template.setDocumentType(DocumentType.DEVIS);
            template.setOrganizationId(7L);
            template.setOriginalFilename("devis.odt");
            DocumentGeneration[] saved = new DocumentGeneration[1];
            when(generationRepository.save(any())).thenAnswer(inv -> {
                DocumentGeneration g = inv.getArgument(0);
                if (g.getId() == null) {
                    g.setId(99L);
                }
                saved[0] = g;
                return g;
            });
            when(renderer.resolveTemplateContent(template)).thenReturn(new byte[] {1});
            when(tagResolverService.resolveTagsForDocument(any(), any(), any(), any(), any())).thenReturn(new HashMap<>());
            when(renderer.fillTemplate(any(), any())).thenReturn(new byte[] {2});
            when(conversionService.html(anyString())).thenReturn(new byte[] {3});
            when(documentStorageService.store(any(), any(), any())).thenReturn("devis/DEVIS-5.pdf");
            when(generationRepository.findById(99L)).thenAnswer(inv -> Optional.of(saved[0]));

            TransactionSynchronizationManager.initSynchronization();
            try {
                pipeline.execute(new DocumentGenerationPipeline.GenerationCommand(template, 5L,
                        ReferenceType.RESERVATION, "guest@test.fr", true, "system", null, 7L, "FR",
                        false, null, null));
                verify(tagResolverService).resolveTagsForDocument(DocumentType.DEVIS, 5L, "RESERVATION", 7L, "FR");
                verify(emailDispatcher, never()).sendDocumentByEmail(any(), any(), any(), any(), any(), any());

                TransactionSynchronizationManager.getSynchronizations()
                        .forEach(TransactionSynchronization::afterCommit);
            } finally {
                TransactionSynchronizationManager.clearSynchronization();
            }

            InOrder order = inOrder(emailDispatcher, transactionManager, generationRepository, notificationService);
            order.verify(emailDispatcher).sendDocumentByEmail(eq(template), eq("guest@test.fr"),
                    any(), any(), any(), any());
            order.verify(transactionManager).getTransaction(argThat(definition ->
                    definition.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW));
            order.verify(generationRepository).findById(99L);
            order.verify(notificationService).notifyAdminsAndManagers(eq(NotificationKey.DOCUMENT_SENT_BY_EMAIL),
                    anyString(), anyString(), anyString(), eq(7L));
            order.verify(transactionManager).commit(any());
            assertThat(saved[0].getEmailStatus()).isEqualTo("SENT");
        }
    }
}
