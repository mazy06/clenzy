package com.clenzy.service;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.dto.GenerateDocumentRequest;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.*;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import com.clenzy.tenant.TenantContext;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentGeneratorServiceTest {

    @Mock private DocumentTemplateRepository templateRepository;
    @Mock private DocumentTemplateTagRepository tagRepository;
    @Mock private DocumentGenerationRepository generationRepository;
    @Mock private DocumentTemplateStorageService templateStorageService;
    @Mock private DocumentStorageService documentStorageService;
    @Mock private TemplateParserService templateParserService;
    @Mock private TagResolverService tagResolverService;
    @Mock private LibreOfficeConversionService conversionService;
    @Mock private EmailService emailService;
    @Mock private NotificationService notificationService;
    @Mock private AuditLogService auditLogService;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private DocumentNumberingService numberingService;
    @Mock private DocumentComplianceService complianceService;
    @Mock private TenantContext tenantContext;

    private DocumentGeneratorService service;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        MeterRegistry meterRegistry = new SimpleMeterRegistry();
        service = new DocumentGeneratorService(
                templateRepository, tagRepository, generationRepository,
                templateStorageService, documentStorageService,
                templateParserService, tagResolverService, conversionService,
                emailService, notificationService, auditLogService,
                kafkaTemplate, numberingService, complianceService,
                tenantContext, meterRegistry
        );
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("email", "admin@test.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    // ─── Templates CRUD ──────────────────────────────────────────────────────
    @Nested
    @DisplayName("listTemplates")
    class ListTemplates {
        @Test void whenCalled_thenReturnsList() {
            DocumentTemplate t = new DocumentTemplate();
            when(templateRepository.findAllByOrderByDocumentTypeAscVersionDesc()).thenReturn(List.of(t));
            List<DocumentTemplate> result = service.listTemplates();
            assertThat(result).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getTemplate")
    class GetTemplate {
        @Test void whenFound_thenReturns() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            when(templateRepository.findById(1L)).thenReturn(Optional.of(t));
            assertThat(service.getTemplate(1L).getId()).isEqualTo(1L);
        }
        @Test void whenNotFound_thenThrows() {
            when(templateRepository.findById(99L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getTemplate(99L))
                    .isInstanceOf(DocumentNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("uploadTemplate")
    class UploadTemplate {
        @Test void whenInvalidExtension_thenThrows() {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("test.pdf");

            assertThatThrownBy(() -> service.uploadTemplate(file, "Test", "Desc",
                    "FACTURE", "MANUAL", null, null, jwt))
                    .isInstanceOf(DocumentValidationException.class)
                    .hasMessageContaining(".odt");
        }
        @Test void whenPathTraversal_thenThrows() {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("../../evil.odt");

            assertThatThrownBy(() -> service.uploadTemplate(file, "Test", "Desc",
                    "FACTURE", "MANUAL", null, null, jwt))
                    .isInstanceOf(DocumentValidationException.class);
        }
        @Test void whenInvalidDocumentType_thenThrows() {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("template.odt");

            assertThatThrownBy(() -> service.uploadTemplate(file, "Test", "Desc",
                    "INVALID_TYPE", "MANUAL", null, null, jwt))
                    .isInstanceOf(DocumentValidationException.class);
        }
    }

    @Nested
    @DisplayName("updateTemplate")
    class UpdateTemplate {
        @Test void whenFound_thenUpdates() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("Old");
            when(templateRepository.findById(1L)).thenReturn(Optional.of(t));
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.updateTemplate(1L, "New", "Desc", "EVENT", "Subject", "Body");
            assertThat(result.getName()).isEqualTo("New");
        }
    }

    @Nested
    @DisplayName("activateTemplate")
    class ActivateTemplate {
        @Test void whenCalled_thenActivates() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setDocumentType(DocumentType.FACTURE);
            when(templateRepository.findById(1L)).thenReturn(Optional.of(t));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.activateTemplate(1L);
            assertThat(result.isActive()).isTrue();
            verify(templateRepository).deactivateAllByTypeExcept(DocumentType.FACTURE, 1L, 1L);
        }
    }

    @Nested
    @DisplayName("deleteTemplate")
    class DeleteTemplate {
        @Test void whenFound_thenDeletes() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("Test");
            t.setFilePath("/path/to/file.odt");
            when(templateRepository.findById(1L)).thenReturn(Optional.of(t));

            service.deleteTemplate(1L);

            verify(tagRepository).deleteByTemplateId(1L);
            verify(templateStorageService).delete("/path/to/file.odt");
            verify(templateRepository).delete(t);
        }
    }

    @Nested
    @DisplayName("reparseTemplate")
    class ReparseTemplate {
        @Test void whenCalled_thenReparseTags() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setFilePath("/path/file.odt");
            when(templateRepository.findById(1L)).thenReturn(Optional.of(t));
            when(templateStorageService.getAbsolutePath("/path/file.odt")).thenReturn(Path.of("/abs/path/file.odt"));
            when(templateParserService.parseTemplate(any())).thenReturn(List.of());

            DocumentTemplate result = service.reparseTemplate(1L);
            verify(tagRepository).deleteByTemplateId(1L);
        }
    }

    // ─── Generation ──────────────────────────────────────────────────────────
    @Nested
    @DisplayName("generateDocument")
    class GenerateDocument {
        @Test void whenNoActiveTemplate_thenThrows() {
            GenerateDocumentRequest req = new GenerateDocumentRequest("FACTURE", 1L, "INTERVENTION", null, false);
            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.generateDocument(req, jwt))
                    .isInstanceOf(DocumentNotFoundException.class);
        }
        @Test void whenInvalidDocumentType_thenThrows() {
            GenerateDocumentRequest req = new GenerateDocumentRequest("INVALID", 1L, null, null, false);

            assertThatThrownBy(() -> service.generateDocument(req, jwt))
                    .isInstanceOf(DocumentValidationException.class);
        }
    }

    @Nested
    @DisplayName("generateFromEvent")
    class GenerateFromEvent {
        @Test void whenNoTemplate_thenReturnsNull() {
            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE))
                    .thenReturn(Optional.empty());

            DocumentGenerationDto result = service.generateFromEvent(DocumentType.FACTURE, 1L,
                    ReferenceType.INTERVENTION, "client@test.com");
            assertThat(result).isNull();
        }
    }

    // ─── Historique ──────────────────────────────────────────────────────────
    @Nested
    @DisplayName("listGenerations")
    class ListGenerations {
        @Test void whenCalled_thenReturnsPage() {
            Page<DocumentGeneration> page = new PageImpl<>(List.of());
            when(generationRepository.findAllByOrderByCreatedAtDesc(any(Pageable.class))).thenReturn(page);

            Page<DocumentGenerationDto> result = service.listGenerations(Pageable.unpaged());
            assertThat(result.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("getGeneration")
    class GetGeneration {
        @Test void whenFound_thenReturns() {
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            when(generationRepository.findById(1L)).thenReturn(Optional.of(gen));
            assertThat(service.getGeneration(1L).getId()).isEqualTo(1L);
        }
        @Test void whenNotFound_thenThrows() {
            when(generationRepository.findById(99L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getGeneration(99L))
                    .isInstanceOf(DocumentNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("getGenerationByLegalNumber")
    class GetByLegalNumber {
        @Test void whenFound_thenReturns() {
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            when(generationRepository.findByLegalNumber("FAC-001")).thenReturn(Optional.of(gen));
            assertThat(service.getGenerationByLegalNumber("FAC-001").getId()).isEqualTo(1L);
        }
        @Test void whenNotFound_thenThrows() {
            when(generationRepository.findByLegalNumber("INVALID")).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getGenerationByLegalNumber("INVALID"))
                    .isInstanceOf(DocumentNotFoundException.class);
        }
    }
}
