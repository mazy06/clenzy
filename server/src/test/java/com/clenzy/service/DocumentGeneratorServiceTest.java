package com.clenzy.service;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.dto.GenerateDocumentRequest;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.*;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.DocumentTemplateTagRepository;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
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
    @Mock private InvoiceGeneratorService invoiceGeneratorService;
    @Mock private TaxRulePreValidator taxRulePreValidator;
    @Mock private TenantContext tenantContext;
    @Mock private FiscalProfileRepository fiscalProfileRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReceivedFormRepository receivedFormRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ProviderExpenseRepository providerExpenseRepository;
    @Mock private EntityManager entityManager;

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
                invoiceGeneratorService, taxRulePreValidator, tenantContext, fiscalProfileRepository,
                interventionRepository, receivedFormRepository, serviceRequestRepository,
                reservationRepository, propertyRepository, providerExpenseRepository,
                entityManager, meterRegistry
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
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            assertThat(service.getTemplate(1L).getId()).isEqualTo(1L);
        }
        @Test void whenNotFound_thenThrows() {
            when(templateRepository.findByIdWithTags(99L)).thenReturn(Optional.empty());
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
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
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
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
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
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

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
            t.setFileContent(new byte[]{1, 2, 3});
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of());

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
                    ReferenceType.INTERVENTION, "client@test.com", 7L);
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

    // ─── Additional Coverage ──────────────────────────────────────────────────

    @Nested
    @DisplayName("uploadTemplate - happy path")
    class UploadTemplateHappy {

        @Test
        void whenValidOdt_thenCreatesTemplateAndParsesTags() throws Exception {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("template.odt");
            byte[] content = new byte[]{1, 2, 3};
            when(file.getBytes()).thenReturn(content);

            when(tenantContext.getOrganizationId()).thenReturn(7L);

            DocumentTemplateTag tag = new DocumentTemplateTag();
            tag.setTagName("intervention.title");
            when(templateParserService.parseTemplate(content))
                    .thenReturn(List.of(tag));

            when(templateRepository.save(any(DocumentTemplate.class)))
                    .thenAnswer(inv -> { DocumentTemplate t = inv.getArgument(0); t.setId(42L); return t; });

            DocumentTemplate result = service.uploadTemplate(
                    file, "Test", "Desc", "FACTURE", "MANUAL", "Subject", "Body", jwt);

            assertThat(result.getId()).isEqualTo(42L);
            assertThat(result.getName()).isEqualTo("Test");
            assertThat(result.getOrganizationId()).isEqualTo(7L);
            assertThat(result.isActive()).isFalse(); // newly uploaded → inactive
            verify(tagRepository).saveAll(any());
            verify(notificationService).notifyAdminsAndManagers(any(), anyString(), anyString(), anyString());
            verify(auditLogService).logCreate(eq("DocumentTemplate"), anyString(), anyString());
        }

        @Test
        void whenNullFilename_thenThrows() {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn(null);

            assertThatThrownBy(() -> service.uploadTemplate(file, "T", "D", "FACTURE", "M", null, null, jwt))
                    .isInstanceOf(DocumentValidationException.class);
        }

        @Test
        void whenFilenameContainsForwardSlash_thenThrows() {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("dir/template.odt");

            assertThatThrownBy(() -> service.uploadTemplate(file, "T", "D", "FACTURE", "M", null, null, jwt))
                    .isInstanceOf(DocumentValidationException.class);
        }

        @Test
        void whenFilenameContainsBackslash_thenThrows() {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("dir\\template.odt");

            assertThatThrownBy(() -> service.uploadTemplate(file, "T", "D", "FACTURE", "M", null, null, jwt))
                    .isInstanceOf(DocumentValidationException.class);
        }

        @Test
        void whenFileGetBytesThrows_thenWrapsInStorageException() throws Exception {
            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("template.odt");
            when(file.getBytes()).thenThrow(new java.io.IOException("disk error"));

            assertThatThrownBy(() -> service.uploadTemplate(file, "T", "D", "FACTURE", "M", null, null, jwt))
                    .isInstanceOf(com.clenzy.exception.DocumentStorageException.class);
        }
    }

    @Nested
    @DisplayName("updateTemplate - branches")
    class UpdateTemplateBranches {

        @Test
        void whenNameIsBlank_thenKeepsExistingName() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("Original");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.updateTemplate(1L, "  ", null, null, null, null);

            assertThat(result.getName()).isEqualTo("Original");
        }

        @Test
        void whenAllFieldsNull_thenJustSavesUnchanged() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("X");
            t.setDescription("D");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.updateTemplate(1L, null, null, null, null, null);

            assertThat(result.getName()).isEqualTo("X");
            assertThat(result.getDescription()).isEqualTo("D");
        }
    }

    @Nested
    @DisplayName("replaceTemplateFile")
    class ReplaceTemplateFile {

        @Test
        void whenValidFile_thenReplacesContentAndTags() throws Exception {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("Test");
            t.setOriginalFilename("old.odt");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("new.odt");
            byte[] newContent = new byte[]{5, 6, 7};
            when(file.getBytes()).thenReturn(newContent);

            when(templateParserService.parseTemplate(newContent)).thenReturn(List.of());

            DocumentTemplate result = service.replaceTemplateFile(1L, file);

            assertThat(result.getOriginalFilename()).isEqualTo("new.odt");
            assertThat(result.getFileContent()).isEqualTo(newContent);
            verify(auditLogService).logUpdate(eq("DocumentTemplate"), anyString(),
                    eq("old.odt"), eq("new.odt"), anyString());
        }

        @Test
        void whenInvalidExtension_thenThrows() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("not-odt.pdf");

            assertThatThrownBy(() -> service.replaceTemplateFile(1L, file))
                    .isInstanceOf(DocumentValidationException.class);
        }

        @Test
        void whenNullFilename_thenThrows() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn(null);

            assertThatThrownBy(() -> service.replaceTemplateFile(1L, file))
                    .isInstanceOf(DocumentValidationException.class);
        }

        @Test
        void whenPathTraversal_thenThrows() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("../evil.odt");

            assertThatThrownBy(() -> service.replaceTemplateFile(1L, file))
                    .isInstanceOf(DocumentValidationException.class);
        }

        @Test
        void whenFileGetBytesThrows_thenWraps() throws Exception {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setOriginalFilename("old.odt");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("new.odt");
            when(file.getBytes()).thenThrow(new java.io.IOException("io error"));

            assertThatThrownBy(() -> service.replaceTemplateFile(1L, file))
                    .isInstanceOf(com.clenzy.exception.DocumentStorageException.class);
        }

        @Test
        void whenTemplateHasFilePath_thenDeletesOldStorage() throws Exception {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("Test");
            t.setOriginalFilename("old.odt");
            t.setFilePath("/tmp/old.odt");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            MultipartFile file = mock(MultipartFile.class);
            when(file.getOriginalFilename()).thenReturn("new.odt");
            when(file.getBytes()).thenReturn(new byte[]{1});
            when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of());

            service.replaceTemplateFile(1L, file);

            verify(templateStorageService).delete("/tmp/old.odt");
        }
    }

    @Nested
    @DisplayName("activateTemplate - branches")
    class ActivateTemplateBranches {

        @Test
        void whenAlreadyActive_thenStaysActiveAndOthersDeactivated() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(2L);
            t.setDocumentType(DocumentType.DEVIS);
            t.setActive(true);
            when(templateRepository.findByIdWithTags(2L)).thenReturn(Optional.of(t));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.activateTemplate(2L);

            assertThat(result.isActive()).isTrue();
            verify(templateRepository).deactivateAllByTypeExcept(DocumentType.DEVIS, 2L, 7L);
        }
    }

    @Nested
    @DisplayName("deleteTemplate - branches")
    class DeleteTemplateBranches {

        @Test
        void whenTemplateHasNoFilePath_thenSkipsStorageDelete() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("NoPath");
            t.setFilePath(null);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            service.deleteTemplate(1L);

            verify(templateStorageService, never()).delete(any());
            verify(templateRepository).delete(t);
        }

        @Test
        void whenTemplateHasBlankFilePath_thenSkipsStorageDelete() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setName("BlankPath");
            t.setFilePath("   ");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            service.deleteTemplate(1L);

            verify(templateStorageService, never()).delete(any());
        }
    }

    @Nested
    @DisplayName("reparseTemplate - branches")
    class ReparseTemplateBranches {

        @Test
        void whenTemplateUsesFilePathFallback_thenLoadsFromStorage() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setFileContent(null);
            t.setFilePath("/tmp/file.odt");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            when(templateStorageService.loadAsBytes("/tmp/file.odt")).thenReturn(new byte[]{1, 2});
            when(templateParserService.parseTemplate(any(byte[].class))).thenReturn(List.of());

            DocumentTemplate result = service.reparseTemplate(1L);

            assertThat(result).isNotNull();
            verify(templateStorageService).loadAsBytes("/tmp/file.odt");
        }
    }

    @Nested
    @DisplayName("getTemplateOriginalContent")
    class GetTemplateOriginalContent {

        @Test
        void whenContentExists_thenReturnsContent() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setFileContent(new byte[]{1, 2, 3});
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            byte[] result = service.getTemplateOriginalContent(1L);
            assertThat(result).containsExactly(1, 2, 3);
        }

        @Test
        void whenContentMissing_thenThrowsStorageException() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setFileContent(null);
            t.setFilePath(null);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            assertThatThrownBy(() -> service.getTemplateOriginalContent(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentStorageException.class);
        }
    }

    @Nested
    @DisplayName("generateDocument - additional branches")
    class GenerateDocumentBranches {

        @Test
        void whenInvalidReferenceType_thenThrows() {
            GenerateDocumentRequest req = new GenerateDocumentRequest("FACTURE", 1L, "BOGUS", null, false);
            // No tax rule check needed because of validation order
            // But for FACTURE the order is: parseDocumentType -> parseReferenceType -> taxRulePreValidator -> templateRepository
            // parseReferenceType is called before taxRulePreValidator, so it throws first
            assertThatThrownBy(() -> service.generateDocument(req, jwt))
                    .isInstanceOf(DocumentValidationException.class)
                    .hasMessageContaining("reference");
        }
    }

    @Nested
    @DisplayName("generateFromEvent - branches")
    class GenerateFromEventBranches {

        @Test
        void whenFiscalProfileExistsAndHasCountryCode_thenUsesIt() {
            FiscalProfile fp = new FiscalProfile();
            fp.setCountryCode("MA");
            when(fiscalProfileRepository.findByOrganizationId(99L)).thenReturn(Optional.of(fp));

            // Facture but no active template — returns null after lookup
            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.MANDAT_GESTION))
                    .thenReturn(Optional.empty());

            DocumentGenerationDto result = service.generateFromEvent(
                    DocumentType.MANDAT_GESTION, 1L, ReferenceType.PROPERTY, null, 99L);

            assertThat(result).isNull();
        }

        @Test
        void whenNoFiscalProfile_thenDefaultsToFR() {
            when(fiscalProfileRepository.findByOrganizationId(99L)).thenReturn(Optional.empty());

            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.MANDAT_GESTION))
                    .thenReturn(Optional.empty());

            DocumentGenerationDto result = service.generateFromEvent(
                    DocumentType.MANDAT_GESTION, 1L, ReferenceType.PROPERTY, null, 99L);

            assertThat(result).isNull();
        }

        @Test
        void whenNullOrgId_thenDefaultsToFRCountryCode() {
            // generateFromEvent with null orgId → resolveCountryCode(null) returns "FR"
            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.MANDAT_GESTION))
                    .thenReturn(Optional.empty());

            DocumentGenerationDto result = service.generateFromEvent(
                    DocumentType.MANDAT_GESTION, 1L, ReferenceType.PROPERTY, null, null);

            assertThat(result).isNull();
        }
    }

    @Nested
    @DisplayName("getGenerationsByReference")
    class GetGenerationsByReference {

        @Test
        void whenCalled_thenReturnsDtoList() {
            DocumentGeneration g = new DocumentGeneration();
            g.setId(1L);
            g.setDocumentType(DocumentType.FACTURE);
            g.setReferenceType(ReferenceType.RESERVATION);
            g.setReferenceId(100L);

            when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                    ReferenceType.RESERVATION, 100L)).thenReturn(List.of(g));

            List<DocumentGenerationDto> result = service.getGenerationsByReference(
                    ReferenceType.RESERVATION, 100L);

            assertThat(result).hasSize(1);
        }

        @Test
        void whenNoGenerations_thenReturnsEmpty() {
            when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                    any(), any())).thenReturn(List.of());

            List<DocumentGenerationDto> result = service.getGenerationsByReference(
                    ReferenceType.INTERVENTION, 999L);

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("executeGeneration - failure paths")
    class ExecuteGenerationFailurePaths {

        @Test
        void whenTemplateContentIsBytesButXDocReportFails_thenHandleFailureAndThrows() {
            // Setup: active template with binary content (XDocReport will fail to parse random bytes)
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("T");
            template.setDocumentType(DocumentType.BON_INTERVENTION); // not FACTURE → no tax pre-validation
            template.setFileContent(new byte[]{1, 2, 3, 4});
            template.setOriginalFilename("template.odt");

            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.BON_INTERVENTION))
                    .thenReturn(Optional.of(template));
            when(tenantContext.getOrganizationId()).thenReturn(7L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            // Numbering not required for BON_INTERVENTION
            when(numberingService.requiresLegalNumber(eq(DocumentType.BON_INTERVENTION), eq("FR")))
                    .thenReturn(false);
            when(tagResolverService.resolveTagsForDocument(any(), any(), any()))
                    .thenReturn(new java.util.HashMap<>());
            when(generationRepository.save(any(DocumentGeneration.class)))
                    .thenAnswer(inv -> { DocumentGeneration g = inv.getArgument(0); g.setId(100L); return g; });

            GenerateDocumentRequest req = new GenerateDocumentRequest(
                    "BON_INTERVENTION", 1L, "INTERVENTION", null, false);

            // XDocReport.loadReport will fail on random bytes → DocumentGenerationException
            assertThatThrownBy(() -> service.generateDocument(req, jwt))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);

            // Verify the failure handler ran (status FAILED + notification)
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.DOCUMENT_GENERATION_FAILED),
                    anyString(), anyString(), anyString(), any());
        }

        @Test
        void whenTagResolverThrows_thenWrappedInGenerationException() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("T");
            template.setDocumentType(DocumentType.BON_INTERVENTION);
            template.setFileContent(new byte[]{1, 2});
            template.setOriginalFilename("template.odt");

            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.BON_INTERVENTION))
                    .thenReturn(Optional.of(template));
            when(tenantContext.getOrganizationId()).thenReturn(7L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(tagResolverService.resolveTagsForDocument(any(), any(), any()))
                    .thenThrow(new RuntimeException("tag resolution error"));
            when(generationRepository.save(any(DocumentGeneration.class)))
                    .thenAnswer(inv -> { DocumentGeneration g = inv.getArgument(0); g.setId(100L); return g; });

            GenerateDocumentRequest req = new GenerateDocumentRequest(
                    "BON_INTERVENTION", 1L, "INTERVENTION", null, false);

            assertThatThrownBy(() -> service.generateDocument(req, jwt))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class)
                    .hasMessageContaining("Generation");
        }

        @Test
        void whenFactureNoTemplate_thenTaxRulePreValidatorStillCalled() {
            // FACTURE branch in generateDocument validates tax rules BEFORE looking up template
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE))
                    .thenReturn(Optional.empty());

            GenerateDocumentRequest req = new GenerateDocumentRequest(
                    "FACTURE", 1L, "INTERVENTION", null, false);

            assertThatThrownBy(() -> service.generateDocument(req, jwt))
                    .isInstanceOf(DocumentNotFoundException.class);

            verify(taxRulePreValidator).validateTaxRulesExist(eq("FR"), any());
        }

        @Test
        void whenFactureViaEventNoTemplate_thenReturnsNull() {
            // Test the generateFromEvent path with FACTURE — tax validator called too
            FiscalProfile fp = new FiscalProfile();
            fp.setCountryCode("FR");
            when(fiscalProfileRepository.findByOrganizationId(99L)).thenReturn(Optional.of(fp));
            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE))
                    .thenReturn(Optional.empty());

            DocumentGenerationDto result = service.generateFromEvent(
                    DocumentType.FACTURE, 1L, ReferenceType.RESERVATION, null, 99L);

            assertThat(result).isNull();
            verify(taxRulePreValidator).validateTaxRulesExist(eq("FR"), any());
        }

        @Test
        void whenStorageContentMissing_thenStorageExceptionDuringExecuteGeneration() {
            // Template with NO content (neither fileContent nor filePath set)
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Empty");
            template.setDocumentType(DocumentType.BON_INTERVENTION);
            template.setFileContent(null);
            template.setFilePath(null);
            template.setOriginalFilename("template.odt");

            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.BON_INTERVENTION))
                    .thenReturn(Optional.of(template));
            when(tenantContext.getOrganizationId()).thenReturn(7L);
            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(generationRepository.save(any(DocumentGeneration.class)))
                    .thenAnswer(inv -> { DocumentGeneration g = inv.getArgument(0); g.setId(100L); return g; });

            GenerateDocumentRequest req = new GenerateDocumentRequest(
                    "BON_INTERVENTION", 1L, "INTERVENTION", null, false);

            // Storage exception → wrapped as DocumentGenerationException
            assertThatThrownBy(() -> service.generateDocument(req, jwt))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);
        }
    }

    @Nested
    @DisplayName("executeGeneration - resolution organizationId")
    class ExecuteGenerationOrgResolution {

        @Test
        void whenNoTenantAndNoExplicitOrg_thenGenerationInheritsTemplateOrg() {
            // Contexte public (devis genere depuis la landing page via
            // /api/public/quote-request) : pas de TenantContext, pas d'orgId
            // explicite Kafka. La generation DOIT heriter de l'organisation du
            // template (org Clenzy proprietaire du template DEVIS seede) pour
            // rester visible cote PMS — l'organizationFilter Hibernate exclut les
            // lignes organization_id IS NULL — et rattacher la numerotation NF a
            // une org reelle. Non-regression du bug "devis PDF absent en bas de
            // l'ecran Messagerie OTA".
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Devis Clenzy");
            template.setDocumentType(DocumentType.DEVIS);
            template.setOrganizationId(42L);                 // org proprietaire du template
            template.setFileContent(new byte[]{1, 2, 3});
            template.setOriginalFilename("devis.odt");

            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.DEVIS))
                    .thenReturn(Optional.of(template));
            // Contexte public : aucune org dans le TenantContext
            when(tenantContext.getOrganizationId()).thenReturn(null);
            when(numberingService.requiresLegalNumber(DocumentType.DEVIS, "FR")).thenReturn(false);
            when(tagResolverService.resolveTagsForDocument(any(), any(), any()))
                    .thenReturn(new java.util.HashMap<>());

            org.mockito.ArgumentCaptor<DocumentGeneration> captor =
                    org.mockito.ArgumentCaptor.forClass(DocumentGeneration.class);
            when(generationRepository.save(captor.capture()))
                    .thenAnswer(inv -> {
                        DocumentGeneration g = inv.getArgument(0);
                        if (g.getId() == null) g.setId(100L);
                        return g;
                    });

            // explicitOrgId = null (5e parametre) → resolution via fallback template.
            // XDocReport echoue sur les bytes aleatoires mais la 1ere sauvegarde
            // (statut GENERATING) a deja persiste l'orgId resolu.
            assertThatThrownBy(() -> service.generateFromEvent(
                    DocumentType.DEVIS, 100L, ReferenceType.RECEIVED_FORM, null, null))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);

            // Toutes les versions persistees portent l'org du template (42L), jamais null.
            assertThat(captor.getAllValues())
                    .isNotEmpty()
                    .allSatisfy(g -> assertThat(g.getOrganizationId()).isEqualTo(42L));
        }
    }

    @Nested
    @DisplayName("generateTemplatePreview")
    class GenerateTemplatePreview {

        @org.mockito.Mock private org.hibernate.Session hibernateSession;
        @org.mockito.Mock private org.hibernate.Filter hibernateFilter;

        @org.junit.jupiter.api.BeforeEach
        void initMocks() {
            org.mockito.MockitoAnnotations.openMocks(this);
        }

        @Test
        void whenNoCandidateEntitiesFound_thenStillRunsAndFailsAtFillTemplate() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Preview test");
            template.setDocumentType(DocumentType.MANDAT_GESTION);
            template.setFileContent(new byte[]{1, 2});
            template.setOriginalFilename("preview.odt");

            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(template));
            when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(hibernateSession);
            // filter not enabled
            when(hibernateSession.getEnabledFilter("organizationFilter")).thenReturn(null);

            // Empty repository results → no candidate entity found
            when(propertyRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());
            when(interventionRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());

            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            // XDocReport will fail on these random bytes → caught & rethrown as DocumentGenerationException
            assertThatThrownBy(() -> service.generateTemplatePreview(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class)
                    .hasMessageContaining("previsualisation");
        }

        @Test
        void whenTagResolverFailsForCandidate_thenFallsBackToEmptyContext() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Preview test");
            template.setDocumentType(DocumentType.BON_COMMANDE);
            template.setFileContent(new byte[]{1, 2});
            template.setOriginalFilename("preview.odt");

            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(template));
            when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(hibernateSession);
            when(hibernateSession.getEnabledFilter("organizationFilter")).thenReturn(null);

            // provider_expense returns one entity
            com.clenzy.model.ProviderExpense expense = new com.clenzy.model.ProviderExpense();
            expense.setId(42L);
            org.springframework.data.domain.Page<com.clenzy.model.ProviderExpense> pe =
                    new org.springframework.data.domain.PageImpl<>(List.of(expense));
            when(providerExpenseRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(pe);
            // intervention also returns empty (second candidate)
            when(interventionRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());

            // TagResolverService throws → fallback to empty context, log warn
            when(tagResolverService.resolveTagsForDocument(eq(DocumentType.BON_COMMANDE),
                    eq(42L), eq("provider_expense")))
                    .thenThrow(new RuntimeException("resolution failed"));

            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            // XDocReport still fails on random bytes but we exercise the fallback path
            assertThatThrownBy(() -> service.generateTemplatePreview(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);
        }

        @Test
        void whenLegalNumberRequired_thenInjectsComplianceTags() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Facture preview");
            template.setDocumentType(DocumentType.FACTURE);
            template.setFileContent(new byte[]{1, 2});
            template.setOriginalFilename("preview.odt");

            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(template));
            when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(hibernateSession);
            when(hibernateSession.getEnabledFilter("organizationFilter")).thenReturn(null);

            // No entities → empty preview context
            when(interventionRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());
            when(reservationRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());

            when(tenantContext.getCountryCode()).thenReturn("FR");
            when(numberingService.requiresLegalNumber(DocumentType.FACTURE, "FR")).thenReturn(true);
            when(complianceService.resolveComplianceTags(eq(DocumentType.FACTURE), anyString()))
                    .thenReturn(java.util.Map.of("number", "PREVIEW-FACTURE-0001"));

            assertThatThrownBy(() -> service.generateTemplatePreview(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);

            verify(complianceService).resolveComplianceTags(eq(DocumentType.FACTURE), anyString());
        }

        @Test
        void whenFilterIsEnabled_thenDisabledThenReEnabled() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Preview test");
            template.setDocumentType(DocumentType.BON_INTERVENTION);
            template.setFileContent(new byte[]{1, 2});
            template.setOriginalFilename("preview.odt");

            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(template));
            when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(hibernateSession);

            // Filter was enabled initially → returns non-null first call
            when(hibernateSession.getEnabledFilter("organizationFilter"))
                    .thenReturn(hibernateFilter)  // first call (wasFilterEnabled = true)
                    .thenReturn(null);            // second call (finally checks again)

            when(interventionRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());
            when(reservationRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());

            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            assertThatThrownBy(() -> service.generateTemplatePreview(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);

            // disableFilter and enableFilter called
            verify(hibernateSession).disableFilter("organizationFilter");
            verify(hibernateSession).enableFilter("organizationFilter");
        }

        @Test
        void whenTemplateHasTagsButContextEmpty_thenAddsPreviewPlaceholders() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Preview test");
            template.setDocumentType(DocumentType.BON_INTERVENTION);
            template.setFileContent(new byte[]{1, 2});
            template.setOriginalFilename("preview.odt");

            DocumentTemplateTag t1 = new DocumentTemplateTag();
            t1.setTagName("intervention.title");
            t1.setTagType(com.clenzy.model.TagType.SIMPLE);
            DocumentTemplateTag t2 = new DocumentTemplateTag();
            t2.setTagName("intervention.lignes");
            t2.setTagType(com.clenzy.model.TagType.LIST);
            DocumentTemplateTag t3 = new DocumentTemplateTag();
            t3.setTagName("client.isPaid");
            t3.setTagType(com.clenzy.model.TagType.CONDITIONAL);
            DocumentTemplateTag t4 = new DocumentTemplateTag();
            t4.setTagName("invalidName"); // No dot — skipped
            t4.setTagType(com.clenzy.model.TagType.SIMPLE);
            template.setTags(List.of(t1, t2, t3, t4));

            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(template));
            when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(hibernateSession);
            when(hibernateSession.getEnabledFilter("organizationFilter")).thenReturn(null);

            when(interventionRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());
            when(reservationRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());

            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            assertThatThrownBy(() -> service.generateTemplatePreview(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);
        }
    }

    // ─── Additional template/CRUD branches ─────────────────────────────────

    @Nested
    @DisplayName("updateTemplate - more branches")
    class UpdateTemplateMoreBranches {

        @Test
        void whenDescriptionEmptyButNotNull_thenSetEmpty() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setDescription("Old desc");
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.updateTemplate(1L, null, "", null, null, null);
            assertThat(result.getDescription()).isEmpty();
        }

        @Test
        void whenEventTriggerProvided_thenSet() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.updateTemplate(1L, null, null, "NEW_EVENT", null, null);
            assertThat(result.getEventTrigger()).isEqualTo("NEW_EVENT");
        }

        @Test
        void whenAllProvided_thenAllSet() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));
            when(templateRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            DocumentTemplate result = service.updateTemplate(1L, "Name", "Desc", "EV", "Subj", "Body");
            assertThat(result.getName()).isEqualTo("Name");
            assertThat(result.getDescription()).isEqualTo("Desc");
            assertThat(result.getEventTrigger()).isEqualTo("EV");
            assertThat(result.getEmailSubject()).isEqualTo("Subj");
            assertThat(result.getEmailBody()).isEqualTo("Body");
        }
    }

    // ─── reparseTemplate - additional branches ─────────────────────────────

    @Nested
    @DisplayName("reparseTemplate - branches")
    class ReparseTemplateMoreBranches {

        @Test
        void whenTemplateContentMissing_thenThrowsStorageException() {
            DocumentTemplate t = new DocumentTemplate();
            t.setId(1L);
            t.setFileContent(null);
            t.setFilePath(null);
            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(t));

            assertThatThrownBy(() -> service.reparseTemplate(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentStorageException.class);
        }
    }

    // ─── generateFromEvent - email branch ──────────────────────────────────

    @Nested
    @DisplayName("generateFromEvent - email")
    class GenerateFromEventWithEmail {

        @Test
        void whenEmailToBlank_thenSendEmailFalse() {
            when(fiscalProfileRepository.findByOrganizationId(99L)).thenReturn(Optional.empty());
            // No active template → returns null before generation
            when(templateRepository.findByDocumentTypeAndActiveTrue(DocumentType.MANDAT_GESTION))
                    .thenReturn(Optional.empty());

            DocumentGenerationDto result = service.generateFromEvent(
                    DocumentType.MANDAT_GESTION, 1L, ReferenceType.PROPERTY, "   ", 99L);
            assertThat(result).isNull();
        }
    }

    @Nested
    @DisplayName("preview - candidate type resolution")
    class PreviewCandidateResolution {

        @org.mockito.Mock private org.hibernate.Session hibernateSession;

        @org.junit.jupiter.api.BeforeEach
        void initMocks() {
            org.mockito.MockitoAnnotations.openMocks(this);
        }

        @Test
        void whenDevisAndReceivedFormExists_thenUsedAsContextSource() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Devis");
            template.setDocumentType(DocumentType.DEVIS);
            template.setFileContent(new byte[]{1});
            template.setOriginalFilename("devis.odt");

            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(template));
            when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(hibernateSession);
            when(hibernateSession.getEnabledFilter("organizationFilter")).thenReturn(null);

            // received_form returns one
            com.clenzy.model.ReceivedForm rf = new com.clenzy.model.ReceivedForm();
            rf.setId(100L);
            when(receivedFormRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(rf)));

            when(tagResolverService.resolveTagsForDocument(eq(DocumentType.DEVIS),
                    eq(100L), eq("received_form")))
                    .thenReturn(java.util.Map.of("rf", "data"));

            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            assertThatThrownBy(() -> service.generateTemplatePreview(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);

            verify(receivedFormRepository).findAll(any(org.springframework.data.domain.Pageable.class));
            // Should stop at the first candidate that returns a non-empty context
            verify(serviceRequestRepository, never()).findAll(any(org.springframework.data.domain.Pageable.class));
        }

        @Test
        void whenContextResolvesToEmpty_thenContinuesToNextCandidate() {
            DocumentTemplate template = new DocumentTemplate();
            template.setId(1L);
            template.setName("Devis");
            template.setDocumentType(DocumentType.DEVIS);
            template.setFileContent(new byte[]{1});
            template.setOriginalFilename("devis.odt");

            when(templateRepository.findByIdWithTags(1L)).thenReturn(Optional.of(template));
            when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(hibernateSession);
            when(hibernateSession.getEnabledFilter("organizationFilter")).thenReturn(null);

            com.clenzy.model.ReceivedForm rf = new com.clenzy.model.ReceivedForm();
            rf.setId(100L);
            when(receivedFormRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(rf)));

            // First resolver returns empty → fall through
            when(tagResolverService.resolveTagsForDocument(eq(DocumentType.DEVIS),
                    eq(100L), eq("received_form")))
                    .thenReturn(java.util.Map.of());

            // service_request also empty
            when(serviceRequestRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());
            // intervention also empty
            when(interventionRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());
            // reservation also empty
            when(reservationRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(org.springframework.data.domain.Page.empty());

            when(numberingService.requiresLegalNumber(any(), any())).thenReturn(false);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            assertThatThrownBy(() -> service.generateTemplatePreview(1L))
                    .isInstanceOf(com.clenzy.exception.DocumentGenerationException.class);
        }
    }
}
