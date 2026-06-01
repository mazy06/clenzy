package com.clenzy.service;

import com.clenzy.dto.DocumentGenerationDto;
import com.clenzy.exception.DocumentNotFoundException;
import com.clenzy.exception.DocumentValidationException;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentGenerationStatus;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.FiscalProfile;
import com.clenzy.model.ReferenceType;
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
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.oauth2.jwt.Jwt;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Tests supplementaires pour {@link DocumentGeneratorService} couvrant les
 * helpers prives via reflection : extractEmail, buildPdfFilename, formatFileSize,
 * parseDocumentType, parseReferenceType, resolveCountryCode.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DocumentGeneratorService — extra coverage (helpers)")
class DocumentGeneratorServiceExtraTest {

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
    }

    private Object invokePrivate(String name, Class<?>[] types, Object[] args) throws Exception {
        Method m = DocumentGeneratorService.class.getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m.invoke(service, args);
    }

    // ─── extractEmail ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("extractEmail (private)")
    class ExtractEmail {
        @Test
        @DisplayName("JWT null -> 'system'")
        void nullJwt_returnsSystem() throws Exception {
            String email = (String) invokePrivate("extractEmail", new Class<?>[]{Jwt.class}, new Object[]{null});
            assertThat(email).isEqualTo("system");
        }

        @Test
        @DisplayName("JWT with email claim -> claim value")
        void jwtWithEmail_returnsEmail() throws Exception {
            Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("email", "user@x.fr")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
            String email = (String) invokePrivate("extractEmail", new Class<?>[]{Jwt.class}, new Object[]{jwt});
            assertThat(email).isEqualTo("user@x.fr");
        }

        @Test
        @DisplayName("JWT without email claim -> subject")
        void jwtWithoutEmail_returnsSubject() throws Exception {
            Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-456")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
            String email = (String) invokePrivate("extractEmail", new Class<?>[]{Jwt.class}, new Object[]{jwt});
            assertThat(email).isEqualTo("user-456");
        }
    }

    // ─── buildPdfFilename ────────────────────────────────────────────────────

    @Nested
    @DisplayName("buildPdfFilename (private)")
    class BuildPdfFilename {
        @Test
        @DisplayName("with referenceId -> filename includes _REF-id_yyyyMMdd_HHmm.pdf")
        void withRef_includesRefInFilename() throws Exception {
            String name = (String) invokePrivate("buildPdfFilename",
                new Class<?>[]{DocumentType.class, Long.class},
                new Object[]{DocumentType.FACTURE, 42L});
            assertThat(name).contains("_REF-42_");
            assertThat(name).endsWith(".pdf");
        }

        @Test
        @DisplayName("without referenceId -> no _REF- prefix")
        void withoutRef_noRefSuffix() throws Exception {
            String name = (String) invokePrivate("buildPdfFilename",
                new Class<?>[]{DocumentType.class, Long.class},
                new Object[]{DocumentType.DEVIS, null});
            assertThat(name).doesNotContain("_REF-");
            assertThat(name).endsWith(".pdf");
        }
    }

    // ─── formatFileSize ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("formatFileSize (private)")
    class FormatFileSize {
        @Test
        @DisplayName("< 1024 -> B suffix")
        void lt1KB_isBytes() throws Exception {
            String fmt = (String) invokePrivate("formatFileSize",
                new Class<?>[]{long.class}, new Object[]{512L});
            assertThat(fmt).isEqualTo("512 B");
        }

        @Test
        @DisplayName("1024..1MB -> KB suffix")
        void inKbRange_isKB() throws Exception {
            String fmt = (String) invokePrivate("formatFileSize",
                new Class<?>[]{long.class}, new Object[]{2048L});
            assertThat(fmt).contains("KB");
        }

        @Test
        @DisplayName(">= 1MB -> MB suffix")
        void inMbRange_isMB() throws Exception {
            String fmt = (String) invokePrivate("formatFileSize",
                new Class<?>[]{long.class}, new Object[]{5_242_880L});
            assertThat(fmt).contains("MB");
        }
    }

    // ─── parseDocumentType / parseReferenceType ──────────────────────────────

    @Nested
    @DisplayName("parseDocumentType + parseReferenceType (private)")
    class ParsersPrivate {
        @Test
        @DisplayName("parseDocumentType: valeur valide -> enum")
        void parseDocumentType_valid() throws Exception {
            DocumentType t = (DocumentType) invokePrivate("parseDocumentType",
                new Class<?>[]{String.class}, new Object[]{"FACTURE"});
            assertThat(t).isEqualTo(DocumentType.FACTURE);
        }

        @Test
        @DisplayName("parseDocumentType: lowercase -> normalise + valide")
        void parseDocumentType_lowercase() throws Exception {
            DocumentType t = (DocumentType) invokePrivate("parseDocumentType",
                new Class<?>[]{String.class}, new Object[]{"devis"});
            assertThat(t).isEqualTo(DocumentType.DEVIS);
        }

        @Test
        @DisplayName("parseDocumentType: invalid -> DocumentValidationException")
        void parseDocumentType_invalid() {
            assertThatThrownBy(() -> invokePrivate("parseDocumentType",
                new Class<?>[]{String.class}, new Object[]{"UNKNOWN_TYPE"}))
                .hasCauseInstanceOf(DocumentValidationException.class);
        }

        @Test
        @DisplayName("parseReferenceType: null -> null")
        void parseReferenceType_null() throws Exception {
            ReferenceType r = (ReferenceType) invokePrivate("parseReferenceType",
                new Class<?>[]{String.class}, new Object[]{null});
            assertThat(r).isNull();
        }

        @Test
        @DisplayName("parseReferenceType: blank -> null")
        void parseReferenceType_blank() throws Exception {
            ReferenceType r = (ReferenceType) invokePrivate("parseReferenceType",
                new Class<?>[]{String.class}, new Object[]{"   "});
            assertThat(r).isNull();
        }

        @Test
        @DisplayName("parseReferenceType: valid -> enum")
        void parseReferenceType_valid() throws Exception {
            ReferenceType r = (ReferenceType) invokePrivate("parseReferenceType",
                new Class<?>[]{String.class}, new Object[]{"intervention"});
            assertThat(r).isEqualTo(ReferenceType.INTERVENTION);
        }

        @Test
        @DisplayName("parseReferenceType: invalid -> DocumentValidationException")
        void parseReferenceType_invalid() {
            assertThatThrownBy(() -> invokePrivate("parseReferenceType",
                new Class<?>[]{String.class}, new Object[]{"BAD_TYPE"}))
                .hasCauseInstanceOf(DocumentValidationException.class);
        }
    }

    // ─── resolveCountryCode ──────────────────────────────────────────────────

    @Nested
    @DisplayName("resolveCountryCode (private)")
    class ResolveCountryCode {
        @Test
        @DisplayName("null orgId -> 'FR' fallback")
        void nullOrgId_returnsFR() throws Exception {
            String code = (String) invokePrivate("resolveCountryCode",
                new Class<?>[]{Long.class}, new Object[]{null});
            assertThat(code).isEqualTo("FR");
        }

        @Test
        @DisplayName("orgId with FiscalProfile -> profile country")
        void withFiscalProfile_returnsCountry() throws Exception {
            FiscalProfile fp = new FiscalProfile();
            fp.setCountryCode("MA");
            when(fiscalProfileRepository.findByOrganizationId(42L)).thenReturn(Optional.of(fp));

            String code = (String) invokePrivate("resolveCountryCode",
                new Class<?>[]{Long.class}, new Object[]{42L});
            assertThat(code).isEqualTo("MA");
        }

        @Test
        @DisplayName("orgId with FiscalProfile but null countryCode -> 'FR'")
        void withFiscalProfile_nullCountry_FR() throws Exception {
            FiscalProfile fp = new FiscalProfile();
            fp.setCountryCode(null);
            when(fiscalProfileRepository.findByOrganizationId(42L)).thenReturn(Optional.of(fp));

            String code = (String) invokePrivate("resolveCountryCode",
                new Class<?>[]{Long.class}, new Object[]{42L});
            assertThat(code).isEqualTo("FR");
        }

        @Test
        @DisplayName("orgId without FiscalProfile -> 'FR'")
        void withoutProfile_returnsFR() throws Exception {
            when(fiscalProfileRepository.findByOrganizationId(99L)).thenReturn(Optional.empty());

            String code = (String) invokePrivate("resolveCountryCode",
                new Class<?>[]{Long.class}, new Object[]{99L});
            assertThat(code).isEqualTo("FR");
        }
    }

    // ─── getGenerationsByReference ───────────────────────────────────────────

    @Nested
    @DisplayName("getGenerationsByReference")
    class GetGenByRef {
        @Test
        @DisplayName("filtre par type + id -> stream mappe en DTO")
        void filtersAndMaps() {
            DocumentGeneration g = DocumentGeneration.builder()
                .documentType(DocumentType.FACTURE)
                .status(DocumentGenerationStatus.COMPLETED)
                .referenceType(ReferenceType.INTERVENTION).referenceId(50L)
                .build();
            g.setId(1L);
            g.setFileName("f.pdf");
            when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                ReferenceType.INTERVENTION, 50L)).thenReturn(List.of(g));

            List<DocumentGenerationDto> result = service.getGenerationsByReference(
                ReferenceType.INTERVENTION, 50L);

            assertThat(result).hasSize(1);
        }

        @Test
        @DisplayName("aucun resultat -> liste vide")
        void empty_returnsEmpty() {
            when(generationRepository.findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(
                any(), any())).thenReturn(List.of());

            List<DocumentGenerationDto> result = service.getGenerationsByReference(
                ReferenceType.RESERVATION, 1L);
            assertThat(result).isEmpty();
        }
    }
}
