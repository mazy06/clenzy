package com.clenzy.service;

import com.clenzy.dto.ComplianceReportDto;
import com.clenzy.dto.ComplianceStatsDto;
import com.clenzy.exception.DocumentComplianceException;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentComplianceServiceTest {

    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentLegalRequirementRepository legalRequirementRepository;
    @Mock private TemplateComplianceReportRepository complianceReportRepository;
    @Mock private DocumentTemplateRepository templateRepository;
    @Mock private DocumentTemplateTagRepository templateTagRepository;
    @Mock private DocumentStorageService storageService;
    @Mock private AuditLogService auditLogService;

    private DocumentComplianceService service;

    @BeforeEach
    void setUp() {
        service = new DocumentComplianceService(generationRepository, legalRequirementRepository,
                complianceReportRepository, templateRepository, templateTagRepository,
                storageService, auditLogService);
    }

    // ===== COMPUTE HASH =====

    @Nested
    @DisplayName("computeHash")
    class ComputeHash {

        @Test
        @DisplayName("returns 64-char hex SHA-256 for valid content")
        void whenValidContent_thenReturnsSha256Hex() {
            // Arrange
            byte[] content = "Hello World".getBytes();

            // Act
            String hash = service.computeHash(content);

            // Assert
            assertThat(hash).hasSize(64);
            assertThat(hash).matches("[0-9a-f]+");
        }

        @Test
        @DisplayName("returns same hash for identical content")
        void whenSameContent_thenSameHash() {
            // Arrange
            byte[] content = "Clenzy Document".getBytes();

            // Act
            String hash1 = service.computeHash(content);
            String hash2 = service.computeHash(content);

            // Assert
            assertThat(hash1).isEqualTo(hash2);
        }

        @Test
        @DisplayName("returns different hash for different content")
        void whenDifferentContent_thenDifferentHash() {
            // Act
            String hash1 = service.computeHash("Document A".getBytes());
            String hash2 = service.computeHash("Document B".getBytes());

            // Assert
            assertThat(hash1).isNotEqualTo(hash2);
        }
    }

    // ===== LOCK DOCUMENT =====

    @Nested
    @DisplayName("lockDocument")
    class LockDocument {

        @Test
        @DisplayName("sets hash, locks document, and saves")
        void whenCalled_thenSetsHashAndLocksDocument() {
            // Arrange
            DocumentGeneration generation = new DocumentGeneration();
            generation.setId(1L);
            generation.setLegalNumber("FAC-2026-0001");
            byte[] pdfBytes = "pdf content".getBytes();

            // Act
            service.lockDocument(generation, pdfBytes);

            // Assert
            assertThat(generation.getDocumentHash()).isNotNull().hasSize(64);
            assertThat(generation.isLocked()).isTrue();
            assertThat(generation.getLockedAt()).isNotNull();
            verify(generationRepository).save(generation);
            verify(auditLogService).logAction(eq(AuditAction.DOCUMENT_LOCK), anyString(), anyString(),
                    any(), any(), anyString(), any());
        }
    }

    // ===== VERIFY DOCUMENT INTEGRITY =====

    @Nested
    @DisplayName("verifyDocumentIntegrity")
    class VerifyDocumentIntegrity {

        @Test
        @DisplayName("throws DocumentNotFoundException when document not found")
        void whenDocumentNotFound_thenThrows() {
            // Arrange
            when(generationRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.verifyDocumentIntegrity(99L))
                    .isInstanceOf(DocumentNotFoundException.class);
        }

        @Test
        @DisplayName("returns not verified when document has no hash")
        void whenNoHash_thenNotVerified() {
            // Arrange
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setDocumentHash(null);
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));

            // Act
            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            // Assert
            assertThat(result.get("verified")).isEqualTo(false);
            assertThat(result.get("reason")).isEqualTo("Document sans hash ou sans fichier");
        }

        @Test
        @DisplayName("returns not verified when document has no filePath")
        void whenNoFilePath_thenNotVerified() {
            // Arrange
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setDocumentHash("somehash");
            gen.setFilePath(null);
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));

            // Act
            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            // Assert
            assertThat(result.get("verified")).isEqualTo(false);
        }

        @Test
        @DisplayName("returns verified=true when hash matches")
        void whenHashMatches_thenVerified() {
            // Arrange
            byte[] content = "pdf content".getBytes();
            String expectedHash = service.computeHash(content);

            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setLegalNumber("FAC-2026-0001");
            gen.setDocumentHash(expectedHash);
            gen.setFilePath("/docs/test.pdf");
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));
            when(storageService.loadAsBytes("/docs/test.pdf")).thenReturn(content);

            // Act
            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            // Assert
            assertThat(result.get("verified")).isEqualTo(true);
            assertThat(result.get("storedHash")).isEqualTo(expectedHash);
            assertThat(result.get("computedHash")).isEqualTo(expectedHash);
            verify(auditLogService).logAction(eq(AuditAction.DOCUMENT_VERIFY), anyString(),
                    anyString(), any(), any(), anyString(), any());
        }

        @Test
        @DisplayName("returns verified=false when hash does not match (tampered)")
        void whenHashMismatch_thenNotVerified() {
            // Arrange
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setLegalNumber("FAC-2026-0001");
            gen.setDocumentHash("aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aabb7788ccdd9900");
            gen.setFilePath("/docs/tampered.pdf");
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));
            when(storageService.loadAsBytes("/docs/tampered.pdf")).thenReturn("different content".getBytes());

            // Act
            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            // Assert
            assertThat(result.get("verified")).isEqualTo(false);
        }

        @Test
        @DisplayName("returns not verified when file read throws exception")
        void whenFileReadFails_thenNotVerified() {
            // Arrange
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setDocumentHash("somehash123");
            gen.setFilePath("/docs/missing.pdf");
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));
            when(storageService.loadAsBytes("/docs/missing.pdf")).thenThrow(new RuntimeException("File not found"));

            // Act
            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            // Assert
            assertThat(result.get("verified")).isEqualTo(false);
            assertThat((String) result.get("reason")).contains("Erreur lecture fichier");
        }
    }

    // ===== CHECK TEMPLATE COMPLIANCE =====

    @Nested
    @DisplayName("checkTemplateCompliance")
    class CheckTemplateCompliance {

        @Test
        @DisplayName("throws when template not found")
        void whenTemplateNotFound_thenThrows() {
            // Arrange
            when(templateRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.checkTemplateCompliance(99L, "admin"))
                    .isInstanceOf(DocumentNotFoundException.class);
        }

        @Test
        @DisplayName("returns compliant when all required tags present")
        void whenAllTagsPresent_thenCompliant() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Facture Standard");
            template.setDocumentType(DocumentType.FACTURE);
            when(templateRepository.findById(1L)).thenReturn(Optional.of(template));

            // Template tags include the required tags
            DocumentTemplateTag tag1 = new DocumentTemplateTag();
            tag1.setTagName("nf.numero_legal");
            DocumentTemplateTag tag2 = new DocumentTemplateTag();
            tag2.setTagName("entreprise.nom");
            DocumentTemplateTag tag3 = new DocumentTemplateTag();
            tag3.setTagName("client.nom");
            DocumentTemplateTag tag4 = new DocumentTemplateTag();
            tag4.setTagName("intervention.titre");
            DocumentTemplateTag tag5 = new DocumentTemplateTag();
            tag5.setTagName("paiement.montant");
            when(templateTagRepository.findByTemplateId(1L)).thenReturn(List.of(tag1, tag2, tag3, tag4, tag5));

            // Requirements that map to the tags we have
            DocumentLegalRequirement req1 = buildRequirement("numero_facture", "Numero facture", true, null);
            DocumentLegalRequirement req2 = buildRequirement("identite_vendeur", "Identite vendeur", true, null);
            DocumentLegalRequirement req3 = buildRequirement("identite_acheteur", "Identite acheteur", true, null);
            DocumentLegalRequirement req4 = buildRequirement("designation_prestations", "Designation", true, null);
            DocumentLegalRequirement req5 = buildRequirement("montant_total", "Montant total", true, null);
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.FACTURE))
                    .thenReturn(List.of(req1, req2, req3, req4, req5));

            when(complianceReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Act
            ComplianceReportDto result = service.checkTemplateCompliance(1L, "admin");

            // Assert
            assertThat(result.compliant()).isTrue();
            assertThat(result.score()).isEqualTo(100);
            verify(complianceReportRepository).save(any(TemplateComplianceReport.class));
            verify(auditLogService).logAction(eq(AuditAction.COMPLIANCE_CHECK), anyString(), anyString(),
                    any(), any(), anyString(), any());
        }

        @Test
        @DisplayName("returns non-compliant when required tags missing")
        void whenRequiredTagsMissing_thenNonCompliant() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Template Vide");
            template.setDocumentType(DocumentType.FACTURE);
            when(templateRepository.findById(1L)).thenReturn(Optional.of(template));

            // No tags in the template
            when(templateTagRepository.findByTemplateId(1L)).thenReturn(List.of());

            // Multiple required requirements
            DocumentLegalRequirement req = buildRequirement("numero_facture", "Numero facture", true, null);
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.FACTURE))
                    .thenReturn(List.of(req));

            when(complianceReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Act
            ComplianceReportDto result = service.checkTemplateCompliance(1L, "admin");

            // Assert
            assertThat(result.compliant()).isFalse();
            assertThat(result.score()).isEqualTo(0);
        }

        @Test
        @DisplayName("defaults checkedBy to 'system' when null or blank")
        void whenCheckedByNull_thenDefaultsToSystem() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Template");
            template.setDocumentType(DocumentType.DEVIS);
            when(templateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(templateTagRepository.findByTemplateId(1L)).thenReturn(List.of());
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.DEVIS))
                    .thenReturn(List.of());
            when(complianceReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // Act
            service.checkTemplateCompliance(1L, null);

            // Assert
            ArgumentCaptor<TemplateComplianceReport> captor = ArgumentCaptor.forClass(TemplateComplianceReport.class);
            verify(complianceReportRepository).save(captor.capture());
            assertThat(captor.getValue().getCheckedBy()).isEqualTo("system");
        }

        private DocumentLegalRequirement buildRequirement(String key, String label, boolean required, String defaultValue) {
            DocumentLegalRequirement req = new DocumentLegalRequirement();
            req.setRequirementKey(key);
            req.setLabel(label);
            req.setRequired(required);
            req.setDefaultValue(defaultValue);
            return req;
        }
    }

    // ===== RESOLVE NF TAGS =====

    @Nested
    @DisplayName("resolveNfTags")
    class ResolveNfTags {

        @Test
        @DisplayName("includes conditions_paiement for FACTURE")
        void whenFacture_thenIncludesConditionsPaiement() {
            // Arrange
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.FACTURE))
                    .thenReturn(List.of());

            // Act
            Map<String, Object> nfTags = service.resolveNfTags(DocumentType.FACTURE, "FAC-2026-0001");

            // Assert
            assertThat(nfTags.get("numero_legal")).isEqualTo("FAC-2026-0001");
            assertThat(nfTags.get("date_emission")).isNotNull();
            assertThat((String) nfTags.get("conditions_paiement")).contains("Paiement");
        }

        @Test
        @DisplayName("includes duree_validite for DEVIS")
        void whenDevis_thenIncludesDureeValidite() {
            // Arrange
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.DEVIS))
                    .thenReturn(List.of());

            // Act
            Map<String, Object> nfTags = service.resolveNfTags(DocumentType.DEVIS, "DEV-2026-0001");

            // Assert
            assertThat(nfTags.get("numero_legal")).isEqualTo("DEV-2026-0001");
            assertThat((String) nfTags.get("duree_validite")).contains("30 jours");
        }

        @Test
        @DisplayName("uses empty string when legal number is null")
        void whenNullLegalNumber_thenEmptyString() {
            // Arrange
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(any()))
                    .thenReturn(List.of());

            // Act
            Map<String, Object> nfTags = service.resolveNfTags(DocumentType.BON_INTERVENTION, null);

            // Assert
            assertThat(nfTags.get("numero_legal")).isEqualTo("");
        }

        @Test
        @DisplayName("includes default values from requirements as mentions")
        void whenRequirementsHaveDefaults_thenIncludedInTags() {
            // Arrange
            DocumentLegalRequirement req = new DocumentLegalRequirement();
            req.setRequirementKey("custom_key");
            req.setLabel("Custom label");
            req.setDefaultValue("Default text");
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.FACTURE))
                    .thenReturn(List.of(req));

            // Act
            Map<String, Object> nfTags = service.resolveNfTags(DocumentType.FACTURE, "FAC-001");

            // Assert
            assertThat(nfTags.get("custom_key")).isEqualTo("Default text");
            @SuppressWarnings("unchecked")
            List<String> mentions = (List<String>) nfTags.get("mentions");
            assertThat(mentions).contains("Custom label");
        }
    }

    // ===== MARK AS CORRECTION =====

    @Nested
    @DisplayName("markAsCorrection")
    class MarkAsCorrection {

        @Test
        @DisplayName("throws when original document is not locked")
        void whenOriginalNotLocked_thenThrows() {
            // Arrange
            DocumentGeneration newGen = new DocumentGeneration();
            newGen.setId(2L);
            DocumentGeneration originalGen = new DocumentGeneration();
            originalGen.setId(1L);
            originalGen.setLocked(false);

            when(generationRepository.findById(2L)).thenReturn(Optional.of(newGen));
            when(generationRepository.findById(1L)).thenReturn(Optional.of(originalGen));

            // Act & Assert
            assertThatThrownBy(() -> service.markAsCorrection(2L, 1L))
                    .isInstanceOf(DocumentComplianceException.class);
        }

        @Test
        @DisplayName("sets correctsId when original is locked")
        void whenOriginalLocked_thenSetsCorrectsId() {
            // Arrange
            DocumentGeneration newGen = new DocumentGeneration();
            newGen.setId(2L);
            DocumentGeneration originalGen = new DocumentGeneration();
            originalGen.setId(1L);
            originalGen.setLocked(true);
            originalGen.setLegalNumber("FAC-2026-0001");

            when(generationRepository.findById(2L)).thenReturn(Optional.of(newGen));
            when(generationRepository.findById(1L)).thenReturn(Optional.of(originalGen));

            // Act
            service.markAsCorrection(2L, 1L);

            // Assert
            assertThat(newGen.getCorrectsId()).isEqualTo(1L);
            verify(generationRepository).save(newGen);
            verify(auditLogService).logAction(eq(AuditAction.DOCUMENT_CORRECT), anyString(), anyString(),
                    any(), any(), anyString(), any());
        }

        @Test
        @DisplayName("throws when new generation not found")
        void whenNewGenNotFound_thenThrows() {
            // Arrange
            when(generationRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.markAsCorrection(99L, 1L))
                    .isInstanceOf(DocumentNotFoundException.class);
        }

        @Test
        @DisplayName("throws when original generation not found")
        void whenOriginalGenNotFound_thenThrows() {
            // Arrange
            DocumentGeneration newGen = new DocumentGeneration();
            newGen.setId(2L);
            when(generationRepository.findById(2L)).thenReturn(Optional.of(newGen));
            when(generationRepository.findById(99L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.markAsCorrection(2L, 99L))
                    .isInstanceOf(DocumentNotFoundException.class);
        }
    }

    // ===== COMPLIANCE STATS =====

    @Nested
    @DisplayName("getComplianceStats")
    class GetComplianceStats {

        @Test
        @DisplayName("aggregates all document counts correctly")
        void whenCalled_thenAggregatesCounts() {
            // Arrange
            when(generationRepository.count()).thenReturn(100L);
            when(generationRepository.countByLockedTrue()).thenReturn(50L);
            when(generationRepository.countByDocumentType(any())).thenReturn(0L);
            when(generationRepository.countByDocumentType(DocumentType.FACTURE)).thenReturn(30L);
            when(generationRepository.countByDocumentTypeAndLockedTrue(DocumentType.FACTURE)).thenReturn(25L);
            when(generationRepository.countByDocumentType(DocumentType.DEVIS)).thenReturn(20L);
            when(generationRepository.countByDocumentTypeAndLockedTrue(DocumentType.DEVIS)).thenReturn(15L);
            when(complianceReportRepository.findMaxCheckedAt()).thenReturn(Optional.empty());
            when(complianceReportRepository.findAverageScore()).thenReturn(85);

            // Act
            ComplianceStatsDto stats = service.getComplianceStats();

            // Assert
            assertThat(stats.totalDocuments()).isEqualTo(100L);
            assertThat(stats.totalLocked()).isEqualTo(50L);
            assertThat(stats.totalFactures()).isEqualTo(30L);
            assertThat(stats.totalFacturesLocked()).isEqualTo(25L);
            assertThat(stats.totalDevis()).isEqualTo(20L);
            assertThat(stats.totalDevisLocked()).isEqualTo(15L);
            assertThat(stats.averageComplianceScore()).isEqualTo(85);
        }

        @Test
        @DisplayName("includes documentsByType map for non-zero counts")
        void whenDocumentsExist_thenMapContainsEntries() {
            // Arrange
            when(generationRepository.count()).thenReturn(30L);
            when(generationRepository.countByLockedTrue()).thenReturn(10L);
            when(generationRepository.countByDocumentType(any())).thenReturn(0L);
            when(generationRepository.countByDocumentType(DocumentType.FACTURE)).thenReturn(30L);
            when(generationRepository.countByDocumentTypeAndLockedTrue(any())).thenReturn(0L);
            when(generationRepository.countByDocumentTypeAndLockedTrue(DocumentType.FACTURE)).thenReturn(10L);
            when(complianceReportRepository.findMaxCheckedAt()).thenReturn(Optional.of(LocalDateTime.now()));
            when(complianceReportRepository.findAverageScore()).thenReturn(90);

            // Act
            ComplianceStatsDto stats = service.getComplianceStats();

            // Assert
            assertThat(stats.documentsByType()).containsEntry("FACTURE", 30L);
        }
    }

    // ===== GET LAST COMPLIANCE REPORT =====

    @Nested
    @DisplayName("getLastComplianceReport")
    class GetLastComplianceReport {

        @Test
        @DisplayName("returns empty when template not found")
        void whenTemplateNotFound_thenReturnsEmpty() {
            // Arrange
            when(templateRepository.findById(99L)).thenReturn(Optional.empty());

            // Act
            Optional<ComplianceReportDto> result = service.getLastComplianceReport(99L);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty when no report exists for template")
        void whenNoReport_thenReturnsEmpty() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Test Template");
            template.setDocumentType(DocumentType.FACTURE);
            when(templateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(complianceReportRepository.findTopByTemplateOrderByCheckedAtDesc(template))
                    .thenReturn(Optional.empty());

            // Act
            Optional<ComplianceReportDto> result = service.getLastComplianceReport(1L);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns report DTO when report exists")
        void whenReportExists_thenReturnsDto() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Facture Standard");
            template.setDocumentType(DocumentType.FACTURE);
            when(templateRepository.findById(1L)).thenReturn(Optional.of(template));

            TemplateComplianceReport report = new TemplateComplianceReport();
            report.setId(10L);
            report.setTemplate(template);
            report.setCompliant(true);
            report.setCheckedBy("admin");
            report.setScore(100);
            report.setMissingTags("");
            report.setMissingMentions("");
            report.setWarnings("");
            when(complianceReportRepository.findTopByTemplateOrderByCheckedAtDesc(template))
                    .thenReturn(Optional.of(report));

            // Act
            Optional<ComplianceReportDto> result = service.getLastComplianceReport(1L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get().compliant()).isTrue();
            assertThat(result.get().templateName()).isEqualTo("Facture Standard");
            assertThat(result.get().documentType()).isEqualTo("FACTURE");
        }
    }
}
