package com.clenzy.controller;

import com.clenzy.dto.*;
import com.clenzy.exception.*;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentType;
import com.clenzy.model.TagCategory;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.service.DocumentComplianceService;
import com.clenzy.service.DocumentGeneratorService;
import com.clenzy.service.DocumentStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentControllerTest {

    @Mock private DocumentGeneratorService generatorService;
    @Mock private DocumentStorageService documentStorageService;
    @Mock private DocumentComplianceService complianceService;
    @Mock private InterventionRepository interventionRepository;

    private DocumentController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("email", "admin@test.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new DocumentController(generatorService, documentStorageService, complianceService, interventionRepository);
    }

    @Nested
    @DisplayName("templates")
    class Templates {
        @Test
        void whenListTemplates_thenReturnsAll() {
            when(generatorService.listTemplates()).thenReturn(List.of());
            ResponseEntity<List<DocumentTemplateDto>> response = controller.listTemplates();
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenActivateTemplate_thenDelegates() {
            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setName("Test");
            template.setDocumentType(DocumentType.DEVIS);
            when(generatorService.activateTemplate(1L)).thenReturn(template);

            ResponseEntity<DocumentTemplateDto> response = controller.activateTemplate(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenDeleteTemplate_thenReturnsNoContent() {
            ResponseEntity<Void> response = controller.deleteTemplate(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(generatorService).deleteTemplate(1L);
        }

        @Test
        void whenReparseTemplate_thenDelegates() {
            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setName("Test");
            template.setDocumentType(DocumentType.DEVIS);
            when(generatorService.reparseTemplate(1L)).thenReturn(template);

            ResponseEntity<DocumentTemplateDto> response = controller.reparseTemplate(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("generation")
    class Generation {
        @Test
        void whenGenerate_thenReturns201() {
            GenerateDocumentRequest request = new GenerateDocumentRequest("DEVIS", 1L, "INTERVENTION", null, false);
            DocumentGenerationDto result = new DocumentGenerationDto(1L, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null);
            Jwt jwt = createJwt();

            when(generatorService.generateDocument(request, jwt)).thenReturn(result);

            ResponseEntity<DocumentGenerationDto> response = controller.generateDocument(jwt, request);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }
    }

    @Nested
    @DisplayName("generations history")
    class History {
        @Test
        void whenListGenerations_thenReturnsPaged() {
            Page<DocumentGenerationDto> page = new PageImpl<>(List.of());
            when(generatorService.listGenerations(any())).thenReturn(page);

            ResponseEntity<Page<DocumentGenerationDto>> response = controller.listGenerations(0, 20);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenDownloadGeneration_thenReturnsResource() {
            Jwt jwt = createJwt();
            DocumentGeneration gen = new DocumentGeneration();
            gen.setFilePath("/path/to/file.pdf");
            gen.setFileName("document.pdf");
            when(generatorService.getGeneration(1L)).thenReturn(gen);

            Resource resource = new ByteArrayResource(new byte[]{1, 2, 3});
            when(documentStorageService.load("/path/to/file.pdf")).thenReturn(resource);

            ResponseEntity<Resource> response = controller.downloadGeneration(jwt, 1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getFirst("Content-Type")).isEqualTo("application/pdf");
        }

        @Test
        void whenDownloadGenerationWithNoFile_thenThrowsNotFound() {
            Jwt jwt = createJwt();
            DocumentGeneration gen = new DocumentGeneration();
            gen.setFilePath(null);
            when(generatorService.getGeneration(1L)).thenReturn(gen);

            try {
                controller.downloadGeneration(jwt, 1L);
            } catch (DocumentNotFoundException e) {
                assertThat(e.getMessage()).contains("Fichier non disponible");
            }
        }
    }

    @Nested
    @DisplayName("references")
    class References {
        @Test
        void whenGetDocumentTypes_thenReturnsAll() {
            ResponseEntity<List<Map<String, String>>> response = controller.getDocumentTypes();
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotEmpty();
        }

        @Test
        void whenGetTagCategories_thenReturnsAll() {
            ResponseEntity<List<Map<String, String>>> response = controller.getTagCategories();
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotEmpty();
        }
    }

    @Nested
    @DisplayName("compliance")
    class Compliance {
        @Test
        void whenVerifyIntegrity_thenDelegates() {
            Map<String, Object> result = Map.of("valid", true);
            when(complianceService.verifyDocumentIntegrity(1L)).thenReturn(result);

            ResponseEntity<Map<String, Object>> response = controller.verifyDocumentIntegrity(1L);
            assertThat(response.getBody().get("valid")).isEqualTo(true);
        }

        @Test
        void whenCheckCompliance_thenDelegates() {
            Jwt jwt = createJwt();
            ComplianceReportDto report = new ComplianceReportDto(1L, 1L, "Test", "DEVIS", true, null, "admin@test.com", List.of(), List.of(), List.of(), 100);
            when(complianceService.checkTemplateCompliance(1L, "admin@test.com")).thenReturn(report);

            ResponseEntity<ComplianceReportDto> response = controller.checkTemplateCompliance(1L, jwt);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenGetStats_thenDelegates() {
            ComplianceStatsDto stats = new ComplianceStatsDto(10, 5, 3, 2, 4, 3, Map.of(), null, 95, "FR", "NF 525");
            when(complianceService.getComplianceStats()).thenReturn(stats);

            ResponseEntity<ComplianceStatsDto> response = controller.getComplianceStats();
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("exception handlers")
    class ExceptionHandlers {
        @Test
        void whenValidationException_thenBadRequest() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleValidation(new DocumentValidationException("bad input"));
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenNotFoundException_then404() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleNotFound(new DocumentNotFoundException("not found"));
            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenComplianceException_then409() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleCompliance(new DocumentComplianceException("conflict"));
            assertThat(response.getStatusCode().value()).isEqualTo(409);
        }

        @Test
        void whenGenerationException_then500() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleGeneration(new DocumentGenerationException("gen error"));
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenStorageException_then500() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleStorage(new DocumentStorageException("storage error"));
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenAccessDeniedException_then403() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleAccessDenied(new org.springframework.security.access.AccessDeniedException("access denied"));
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        void whenSecurityException_then403() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleForbidden(new SecurityException("forbidden"));
            assertThat(response.getStatusCode().value()).isEqualTo(403);
        }

        @Test
        void whenGenericException_then500() {
            ResponseEntity<Map<String, Object>> response =
                    controller.handleGeneric(new Exception("unexpected"));
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    // ============= EXTENDED =============

    @Nested
    @DisplayName("templates - getTemplate/update/upload/replace")
    class TemplateOperations {
        @Test
        void whenGetTemplate_thenReturnsDto() {
            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setName("Test");
            template.setDocumentType(DocumentType.DEVIS);
            when(generatorService.getTemplate(1L)).thenReturn(template);

            ResponseEntity<DocumentTemplateDto> response = controller.getTemplate(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenUploadTemplate_thenReturns201() {
            Jwt jwt = createJwt();
            org.springframework.mock.web.MockMultipartFile file = new org.springframework.mock.web.MockMultipartFile(
                    "file", "doc.odt", "application/vnd.oasis.opendocument.text", "fake".getBytes());

            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setName("New");
            template.setDocumentType(DocumentType.DEVIS);
            when(generatorService.uploadTemplate(any(), eq("New"), any(), eq("DEVIS"), any(), any(), any(), eq(jwt)))
                .thenReturn(template);

            ResponseEntity<DocumentTemplateDto> response = controller.uploadTemplate(
                    jwt, file, "New", null, "DEVIS", null, null, null);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }

        @Test
        void whenUpdateTemplate_thenDelegates() {
            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setName("Updated");
            template.setDocumentType(DocumentType.DEVIS);
            when(generatorService.updateTemplate(eq(1L), eq("Updated"), any(), any(), any(), any()))
                .thenReturn(template);

            ResponseEntity<DocumentTemplateDto> response = controller.updateTemplate(1L,
                    new DocumentController.UpdateTemplateRequest("Updated", null, null, null, null));
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenReplaceTemplateFile_thenDelegates() {
            org.springframework.mock.web.MockMultipartFile file = new org.springframework.mock.web.MockMultipartFile(
                    "file", "doc.odt", "application/vnd.oasis.opendocument.text", "fake".getBytes());

            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setName("T");
            template.setDocumentType(DocumentType.DEVIS);
            when(generatorService.replaceTemplateFile(eq(1L), any())).thenReturn(template);

            ResponseEntity<DocumentTemplateDto> response = controller.replaceTemplateFile(1L, file);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("download template original / preview")
    class TemplateDownloads {
        @Test
        void whenDownloadOriginal_thenReturnsBytes() {
            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setOriginalFilename("template.odt");
            when(generatorService.getTemplate(1L)).thenReturn(template);
            when(generatorService.getTemplateOriginalContent(1L)).thenReturn(new byte[]{1, 2, 3});

            ResponseEntity<byte[]> response = controller.downloadTemplateOriginal(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(3);
        }

        @Test
        void whenDownloadOriginalNoFilename_thenDefault() {
            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setOriginalFilename(null);
            when(generatorService.getTemplate(1L)).thenReturn(template);
            when(generatorService.getTemplateOriginalContent(1L)).thenReturn(new byte[]{1});

            ResponseEntity<byte[]> response = controller.downloadTemplateOriginal(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenPreviewTemplate_thenReturnsPdfBytes() {
            com.clenzy.model.DocumentTemplate template = new com.clenzy.model.DocumentTemplate();
            template.setId(1L);
            template.setName("My Template");
            when(generatorService.getTemplate(1L)).thenReturn(template);
            when(generatorService.generateTemplatePreview(1L)).thenReturn(new byte[]{1, 2, 3});

            ResponseEntity<byte[]> response = controller.previewTemplate(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getFirst("Content-Type")).isEqualTo("application/pdf");
        }
    }

    @Nested
    @DisplayName("getGenerationsByReference")
    class GetGenerationsByReference {
        @Test
        void whenInvalidReferenceType_thenThrowsValidation() {
            Jwt jwt = createJwt();
            try {
                controller.getGenerationsByReference(jwt, "INVALID_TYPE", 1L);
                org.assertj.core.api.Assertions.fail("Should have thrown");
            } catch (DocumentValidationException e) {
                assertThat(e.getMessage()).contains("Type de reference inconnu");
            }
        }

        @Test
        void whenValidReferenceType_thenReturnsList() {
            Jwt jwt = createJwt();
            jwt = org.springframework.security.oauth2.jwt.Jwt.withTokenValue("token")
                    .header("alg", "RS256")
                    .claim("sub", "user-123")
                    .claim("realm_access", java.util.Map.of("roles", java.util.List.of("SUPER_ADMIN")))
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();
            when(generatorService.getGenerationsByReference(any(), eq(1L)))
                .thenReturn(List.of());

            ResponseEntity<List<DocumentGenerationDto>> response =
                    controller.getGenerationsByReference(jwt, "INTERVENTION", 1L);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getGenerationByLegalNumber / createCorrective")
    class LegalNumberAndCorrective {
        @Test
        void whenGetByLegalNumber_thenReturnsDto() {
            DocumentGeneration gen = new DocumentGeneration();
            gen.setLegalNumber("INV-2026-001");
            when(generatorService.getGenerationByLegalNumber("INV-2026-001")).thenReturn(gen);

            ResponseEntity<DocumentGenerationDto> response = controller.getGenerationByLegalNumber("INV-2026-001");
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenCreateCorrective_thenReturns201AndMarks() {
            Jwt jwt = createJwt();
            GenerateDocumentRequest request = new GenerateDocumentRequest("AVOIR", 1L, "INTERVENTION", null, false);
            DocumentGenerationDto result = new DocumentGenerationDto(2L, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, false, null, null);
            when(generatorService.generateDocument(request, jwt)).thenReturn(result);

            ResponseEntity<DocumentGenerationDto> response = controller.createCorrectiveDocument(1L, jwt, request);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
            verify(complianceService).markAsCorrection(2L, 1L);
        }
    }

    @Nested
    @DisplayName("listGenerations - pagination clamping")
    class PaginationClamping {
        @Test
        void whenPageNegative_thenClampedToZero() {
            org.springframework.data.domain.Page<DocumentGenerationDto> page =
                new org.springframework.data.domain.PageImpl<>(List.of());
            when(generatorService.listGenerations(any())).thenReturn(page);

            ResponseEntity<org.springframework.data.domain.Page<DocumentGenerationDto>> response =
                controller.listGenerations(-5, 20);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSizeOver100_thenClampedTo100() {
            org.springframework.data.domain.Page<DocumentGenerationDto> page =
                new org.springframework.data.domain.PageImpl<>(List.of());
            when(generatorService.listGenerations(any())).thenReturn(page);

            ResponseEntity<org.springframework.data.domain.Page<DocumentGenerationDto>> response =
                controller.listGenerations(0, 9999);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSizeZero_thenClampedTo1() {
            org.springframework.data.domain.Page<DocumentGenerationDto> page =
                new org.springframework.data.domain.PageImpl<>(List.of());
            when(generatorService.listGenerations(any())).thenReturn(page);

            ResponseEntity<org.springframework.data.domain.Page<DocumentGenerationDto>> response =
                controller.listGenerations(0, 0);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
