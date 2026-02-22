package com.clenzy.service;

import com.clenzy.exception.DocumentComplianceException;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
    class ComputeHash {

        @Test
        void whenValidContent_thenReturnsSha256Hex() {
            byte[] content = "Hello World".getBytes();

            String hash = service.computeHash(content);

            assertThat(hash).hasSize(64); // SHA-256 = 64 hex chars
            assertThat(hash).matches("[0-9a-f]+");
        }

        @Test
        void whenSameContent_thenSameHash() {
            byte[] content = "Clenzy Document".getBytes();

            String hash1 = service.computeHash(content);
            String hash2 = service.computeHash(content);

            assertThat(hash1).isEqualTo(hash2);
        }

        @Test
        void whenDifferentContent_thenDifferentHash() {
            String hash1 = service.computeHash("Document A".getBytes());
            String hash2 = service.computeHash("Document B".getBytes());

            assertThat(hash1).isNotEqualTo(hash2);
        }
    }

    // ===== LOCK DOCUMENT =====

    @Nested
    class LockDocument {

        @Test
        void whenCalled_thenSetsHashAndLocksDocument() {
            DocumentGeneration generation = new DocumentGeneration();
            generation.setId(1L);
            generation.setLegalNumber("FAC-2026-0001");
            byte[] pdfBytes = "pdf content".getBytes();

            service.lockDocument(generation, pdfBytes);

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
    class VerifyDocumentIntegrity {

        @Test
        void whenDocumentNotFound_thenThrows() {
            when(generationRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.verifyDocumentIntegrity(99L))
                    .isInstanceOf(DocumentNotFoundException.class);
        }

        @Test
        void whenNoHash_thenNotVerified() {
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setDocumentHash(null);
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));

            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            assertThat(result.get("verified")).isEqualTo(false);
        }

        @Test
        void whenHashMatches_thenVerified() {
            byte[] content = "pdf content".getBytes();
            String expectedHash = service.computeHash(content);

            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setDocumentHash(expectedHash);
            gen.setFilePath("/docs/test.pdf");
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));
            when(storageService.loadAsBytes("/docs/test.pdf")).thenReturn(content);

            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            assertThat(result.get("verified")).isEqualTo(true);
        }

        @Test
        void whenHashMismatch_thenNotVerified() {
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setDocumentHash("aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aabb7788ccdd9900");
            gen.setFilePath("/docs/tampered.pdf");
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));
            when(storageService.loadAsBytes("/docs/tampered.pdf")).thenReturn("different content".getBytes());

            Map<String, Object> result = service.verifyDocumentIntegrity(1L);

            assertThat(result.get("verified")).isEqualTo(false);
        }
    }

    // ===== RESOLVE NF TAGS =====

    @Nested
    class ResolveNfTags {

        @Test
        void whenFacture_thenIncludesConditionsPaiement() {
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.FACTURE))
                    .thenReturn(List.of());

            Map<String, Object> nfTags = service.resolveNfTags(DocumentType.FACTURE, "FAC-2026-0001");

            assertThat(nfTags.get("numero_legal")).isEqualTo("FAC-2026-0001");
            assertThat(nfTags.get("date_emission")).isNotNull();
            assertThat((String) nfTags.get("conditions_paiement")).contains("Paiement");
        }

        @Test
        void whenDevis_thenIncludesDureeValidite() {
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(DocumentType.DEVIS))
                    .thenReturn(List.of());

            Map<String, Object> nfTags = service.resolveNfTags(DocumentType.DEVIS, "DEV-2026-0001");

            assertThat(nfTags.get("numero_legal")).isEqualTo("DEV-2026-0001");
            assertThat((String) nfTags.get("duree_validite")).contains("30 jours");
        }

        @Test
        void whenNullLegalNumber_thenEmptyString() {
            when(legalRequirementRepository.findByDocumentTypeAndActiveTrueOrderByDisplayOrderAsc(any()))
                    .thenReturn(List.of());

            Map<String, Object> nfTags = service.resolveNfTags(DocumentType.BON_INTERVENTION, null);

            assertThat(nfTags.get("numero_legal")).isEqualTo("");
        }
    }

    // ===== MARK AS CORRECTION =====

    @Nested
    class MarkAsCorrection {

        @Test
        void whenOriginalNotLocked_thenThrows() {
            DocumentGeneration newGen = new DocumentGeneration();
            newGen.setId(2L);
            DocumentGeneration originalGen = new DocumentGeneration();
            originalGen.setId(1L);
            originalGen.setLocked(false);

            when(generationRepository.findById(2L)).thenReturn(Optional.of(newGen));
            when(generationRepository.findById(1L)).thenReturn(Optional.of(originalGen));

            assertThatThrownBy(() -> service.markAsCorrection(2L, 1L))
                    .isInstanceOf(DocumentComplianceException.class);
        }

        @Test
        void whenOriginalLocked_thenSetsCorrectsId() {
            DocumentGeneration newGen = new DocumentGeneration();
            newGen.setId(2L);
            DocumentGeneration originalGen = new DocumentGeneration();
            originalGen.setId(1L);
            originalGen.setLocked(true);
            originalGen.setLegalNumber("FAC-2026-0001");

            when(generationRepository.findById(2L)).thenReturn(Optional.of(newGen));
            when(generationRepository.findById(1L)).thenReturn(Optional.of(originalGen));

            service.markAsCorrection(2L, 1L);

            assertThat(newGen.getCorrectsId()).isEqualTo(1L);
            verify(generationRepository).save(newGen);
        }
    }

    // ===== COMPLIANCE STATS =====

    @Nested
    class ComplianceStats {

        @Test
        void whenCalled_thenAggregatesCounts() {
            when(generationRepository.count()).thenReturn(100L);
            when(generationRepository.countByLockedTrue()).thenReturn(50L);
            when(generationRepository.countByDocumentType(any())).thenReturn(0L);
            when(generationRepository.countByDocumentType(DocumentType.FACTURE)).thenReturn(30L);
            when(generationRepository.countByDocumentTypeAndLockedTrue(DocumentType.FACTURE)).thenReturn(25L);
            when(generationRepository.countByDocumentType(DocumentType.DEVIS)).thenReturn(20L);
            when(generationRepository.countByDocumentTypeAndLockedTrue(DocumentType.DEVIS)).thenReturn(15L);
            when(complianceReportRepository.findMaxCheckedAt()).thenReturn(Optional.empty());
            when(complianceReportRepository.findAverageScore()).thenReturn(85);

            var stats = service.getComplianceStats();

            assertThat(stats.totalDocuments()).isEqualTo(100L);
            assertThat(stats.totalLocked()).isEqualTo(50L);
        }
    }
}
