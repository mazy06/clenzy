package com.clenzy.service;

import com.clenzy.dto.GdprConsentUpdateDto;
import com.clenzy.dto.GdprExportDto;
import com.clenzy.model.*;
import com.clenzy.repository.AuditLogRepository;
import com.clenzy.repository.GdprConsentRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GdprServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private GdprConsentRepository gdprConsentRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private NotificationService notificationService;
    @Mock private TenantContext tenantContext;

    private GdprService gdprService;

    private User testUser;
    private Property testProperty;

    @BeforeEach
    void setUp() {
        gdprService = new GdprService(
                userRepository, gdprConsentRepository, auditLogRepository,
                auditLogService, notificationService, tenantContext);

        testUser = new User("Jean", "Dupont", "jean@example.com", "password123");
        testUser.setId(1L);
        testUser.setPhoneNumber("+33612345678");
        testUser.setRole(UserRole.HOST);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProfilePictureUrl("https://example.com/photo.jpg");
        testUser.setEmailVerified(true);
        testUser.setPhoneVerified(false);
        testUser.setLastLogin(LocalDateTime.of(2026, 2, 20, 10, 0));
        testUser.setCreatedAt(LocalDateTime.of(2025, 1, 15, 8, 30));
        testUser.setKeycloakId("kc-uuid-123");

        testProperty = new Property();
        testProperty.setId(10L);
        testProperty.setName("Appartement Paris");
        testProperty.setAddress("12 Rue de Rivoli");
        testProperty.setCity("Paris");
        testProperty.setPostalCode("75001");
        testProperty.setCountry("France");
        testProperty.setCreatedAt(LocalDateTime.of(2025, 3, 1, 12, 0));

        testUser.setProperties(new HashSet<>(Set.of(testProperty)));
    }

    // ═══════════════════════════════════════════════════════════════════
    // exportUserData
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void exportUserData_userNotFound_throwsRuntimeException() {
        // Arrange
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> gdprService.exportUserData(99L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Utilisateur introuvable: 99");
    }

    @Test
    void exportUserData_validUser_buildsPersonalDataSection() {
        // Arrange
        arrangeForExport();

        // Act
        GdprExportDto result = gdprService.exportUserData(1L);

        // Assert
        GdprExportDto.UserDataSection personal = result.getPersonalData();
        assertThat(personal).isNotNull();
        assertThat(personal.getId()).isEqualTo(1L);
        assertThat(personal.getFirstName()).isEqualTo("Jean");
        assertThat(personal.getLastName()).isEqualTo("Dupont");
        assertThat(personal.getEmail()).isEqualTo("jean@example.com");
        assertThat(personal.getPhoneNumber()).isEqualTo("+33612345678");
        assertThat(personal.getRole()).isEqualTo("HOST");
        assertThat(personal.getStatus()).isEqualTo("ACTIVE");
        assertThat(personal.getProfilePictureUrl()).isEqualTo("https://example.com/photo.jpg");
        assertThat(personal.getEmailVerified()).isTrue();
        assertThat(personal.getPhoneVerified()).isFalse();
        assertThat(personal.getLastLogin()).isEqualTo(LocalDateTime.of(2026, 2, 20, 10, 0));
        assertThat(personal.getCreatedAt()).isEqualTo(LocalDateTime.of(2025, 1, 15, 8, 30));
    }

    @Test
    void exportUserData_validUser_buildsPropertySections() {
        // Arrange
        arrangeForExport();

        // Act
        GdprExportDto result = gdprService.exportUserData(1L);

        // Assert
        assertThat(result.getProperties()).hasSize(1);
        GdprExportDto.PropertyDataSection prop = result.getProperties().get(0);
        assertThat(prop.getId()).isEqualTo(10L);
        assertThat(prop.getName()).isEqualTo("Appartement Paris");
        assertThat(prop.getAddress()).isEqualTo("12 Rue de Rivoli");
        assertThat(prop.getCity()).isEqualTo("Paris");
        assertThat(prop.getPostalCode()).isEqualTo("75001");
        assertThat(prop.getCountry()).isEqualTo("France");
    }

    @Test
    void exportUserData_validUser_buildsConsentSections() {
        // Arrange
        GdprConsent consent = new GdprConsent(testUser, GdprConsent.ConsentType.MARKETING, true, "192.168.1.1");
        consent.setVersion(2);
        consent.setGrantedAt(LocalDateTime.of(2025, 6, 1, 10, 0));

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findByUserId(1L)).thenReturn(List.of(consent));
        when(auditLogRepository.findByUserIdOrderByTimestampDesc(eq("kc-uuid-123"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        // Act
        GdprExportDto result = gdprService.exportUserData(1L);

        // Assert
        assertThat(result.getConsents()).hasSize(1);
        GdprExportDto.ConsentDataSection consentSection = result.getConsents().get(0);
        assertThat(consentSection.getConsentType()).isEqualTo("MARKETING");
        assertThat(consentSection.isGranted()).isTrue();
        assertThat(consentSection.getVersion()).isEqualTo(2);
    }

    @Test
    void exportUserData_validUser_buildsAuditSections() {
        // Arrange
        Instant now = Instant.now();
        AuditLog auditLog = new AuditLog(AuditAction.LOGIN, "User", "1");
        auditLog.setDetails("Login reussi");
        auditLog.setTimestamp(now);

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(auditLogRepository.findByUserIdOrderByTimestampDesc(eq("kc-uuid-123"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(auditLog)));

        // Act
        GdprExportDto result = gdprService.exportUserData(1L);

        // Assert
        assertThat(result.getActivityLog()).hasSize(1);
        GdprExportDto.AuditDataSection audit = result.getActivityLog().get(0);
        assertThat(audit.getAction()).isEqualTo("LOGIN");
        assertThat(audit.getEntityType()).isEqualTo("User");
        assertThat(audit.getEntityId()).isEqualTo("1");
        assertThat(audit.getDetails()).isEqualTo("Login reussi");
        assertThat(audit.getTimestamp()).isEqualTo(now.toString());
    }

    @Test
    void exportUserData_nullKeycloakId_returnsEmptyAuditLog() {
        // Arrange
        testUser.setKeycloakId(null);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findByUserId(1L)).thenReturn(Collections.emptyList());

        // Act
        GdprExportDto result = gdprService.exportUserData(1L);

        // Assert
        assertThat(result.getActivityLog()).isEmpty();
        verifyNoInteractions(auditLogRepository);
    }

    @Test
    void exportUserData_validUser_setsExportDate() {
        // Arrange
        arrangeForExport();

        // Act
        GdprExportDto result = gdprService.exportUserData(1L);

        // Assert
        assertThat(result.getExportDate()).isNotNull().isNotEmpty();
    }

    @Test
    void exportUserData_validUser_logsAuditAction() {
        // Arrange
        arrangeForExport();

        // Act
        gdprService.exportUserData(1L);

        // Assert
        verify(auditLogService).logAction(
                eq(AuditAction.EXPORT), eq("User"), eq("1"),
                isNull(), isNull(),
                eq("Export RGPD des donnees personnelles"), eq(AuditSource.WEB));
    }

    @Test
    void exportUserData_validUser_sendsNotification() {
        // Arrange
        arrangeForExport();

        // Act
        gdprService.exportUserData(1L);

        // Assert
        verify(notificationService).notifyAdminsAndManagers(
                eq(NotificationKey.GDPR_DATA_EXPORTED),
                eq("Export RGPD"),
                contains("1"),
                eq("/gdpr"));
    }

    @Test
    void exportUserData_notificationFails_doesNotThrow() {
        // Arrange
        arrangeForExport();
        doThrow(new RuntimeException("Notification error"))
                .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

        // Act & Assert
        GdprExportDto result = gdprService.exportUserData(1L);
        assertThat(result).isNotNull();
    }

    @Test
    void exportUserData_userWithNoProperties_returnsEmptyPropertyList() {
        // Arrange
        testUser.setProperties(new HashSet<>());
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(auditLogRepository.findByUserIdOrderByTimestampDesc(eq("kc-uuid-123"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        // Act
        GdprExportDto result = gdprService.exportUserData(1L);

        // Assert
        assertThat(result.getProperties()).isEmpty();
    }

    // ═══════════════════════════════════════════════════════════════════
    // anonymizeUser
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void anonymizeUser_userNotFound_throwsRuntimeException() {
        // Arrange
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> gdprService.anonymizeUser(99L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Utilisateur introuvable: 99");
    }

    @Test
    void anonymizeUser_alreadyAnonymized_returnsEarly() {
        // Arrange
        testUser.setFirstName("Anonyme");
        testUser.setStatus(UserStatus.DELETED);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

        // Act
        gdprService.anonymizeUser(1L);

        // Assert
        verify(userRepository, never()).save(any());
        verifyNoInteractions(gdprConsentRepository);
        verifyNoInteractions(auditLogService);
    }

    @Test
    void anonymizeUser_validUser_anonymizesAllPiiFields() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        // Act
        gdprService.anonymizeUser(1L);

        // Assert
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());

        User saved = captor.getValue();
        assertThat(saved.getFirstName()).isEqualTo("Anonyme");
        assertThat(saved.getLastName()).isEqualTo("Utilisateur");
        assertThat(saved.getEmail()).startsWith("anon_").endsWith("@anonymized.clenzy.fr");
        assertThat(saved.getPassword()).isEqualTo("ANONYMIZED");
        assertThat(saved.getPhoneNumber()).isNull();
        assertThat(saved.getProfilePictureUrl()).isNull();
        assertThat(saved.getCognitoUserId()).isNull();
        assertThat(saved.getKeycloakId()).isNull();
        assertThat(saved.isEmailVerified()).isFalse();
        assertThat(saved.isPhoneVerified()).isFalse();
    }

    @Test
    void anonymizeUser_validUser_setsStatusToDeleted() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        // Act
        gdprService.anonymizeUser(1L);

        // Assert
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(UserStatus.DELETED);
    }

    @Test
    void anonymizeUser_validUser_deletesConsents() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        // Act
        gdprService.anonymizeUser(1L);

        // Assert
        verify(gdprConsentRepository).deleteByUserIdAndOrganizationId(1L, 100L);
    }

    @Test
    void anonymizeUser_validUser_logsAuditWithOldEmail() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        // Act
        gdprService.anonymizeUser(1L);

        // Assert
        verify(auditLogService).logAction(
                eq(AuditAction.DELETE), eq("User"), eq("1"),
                eq("email=jean@example.com"), eq("ANONYMIZED"),
                eq("Anonymisation RGPD irreversible (Article 17)"), eq(AuditSource.SYSTEM));
    }

    @Test
    void anonymizeUser_validUser_sendsNotification() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        // Act
        gdprService.anonymizeUser(1L);

        // Assert
        verify(notificationService).notifyAdminsAndManagers(
                eq(NotificationKey.GDPR_USER_ANONYMIZED),
                eq("Anonymisation RGPD"),
                contains("1"),
                eq("/gdpr"));
    }

    @Test
    void anonymizeUser_notificationFails_doesNotThrow() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);
        doThrow(new RuntimeException("Notification error"))
                .when(notificationService).notifyAdminsAndManagers(any(), any(), any(), any());

        // Act & Assert
        assertThatCode(() -> gdprService.anonymizeUser(1L)).doesNotThrowAnyException();
    }

    @Test
    void anonymizeUser_onlyFirstNameAnonymeButNotDeleted_proceedsWithAnonymization() {
        // Arrange: firstName is "Anonyme" but status is ACTIVE -- not fully anonymized
        testUser.setFirstName("Anonyme");
        testUser.setStatus(UserStatus.ACTIVE);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        // Act
        gdprService.anonymizeUser(1L);

        // Assert: should proceed because status != DELETED
        verify(userRepository).save(any(User.class));
    }

    @Test
    void anonymizeUser_generatesUniqueAnonymousEmail() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        // Act
        gdprService.anonymizeUser(1L);

        // Assert
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        String email = captor.getValue().getEmail();
        assertThat(email).matches("anon_[a-f0-9]{8}@anonymized\\.clenzy\\.fr");
    }

    // ═══════════════════════════════════════════════════════════════════
    // getConsentStatus
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void getConsentStatus_returnsAllConsentTypes() {
        // Arrange
        for (GdprConsent.ConsentType type : GdprConsent.ConsentType.values()) {
            when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, type))
                    .thenReturn(Optional.empty());
        }

        // Act
        Map<String, Object> result = gdprService.getConsentStatus(1L);

        // Assert
        assertThat(result).containsKey("userId");
        assertThat(result.get("userId")).isEqualTo(1L);

        @SuppressWarnings("unchecked")
        Map<String, Object> consents = (Map<String, Object>) result.get("consents");
        assertThat(consents).hasSize(GdprConsent.ConsentType.values().length);

        for (GdprConsent.ConsentType type : GdprConsent.ConsentType.values()) {
            assertThat(consents).containsKey(type.name());
        }
    }

    @Test
    void getConsentStatus_existingConsent_returnsConsentDetails() {
        // Arrange
        GdprConsent consent = new GdprConsent(testUser, GdprConsent.ConsentType.MARKETING, true, "192.168.1.1");
        consent.setVersion(3);
        consent.setGrantedAt(LocalDateTime.of(2025, 6, 1, 10, 0));

        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.MARKETING))
                .thenReturn(Optional.of(consent));
        for (GdprConsent.ConsentType type : GdprConsent.ConsentType.values()) {
            if (type != GdprConsent.ConsentType.MARKETING) {
                when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, type))
                        .thenReturn(Optional.empty());
            }
        }

        // Act
        Map<String, Object> result = gdprService.getConsentStatus(1L);

        // Assert
        @SuppressWarnings("unchecked")
        Map<String, Object> consents = (Map<String, Object>) result.get("consents");
        @SuppressWarnings("unchecked")
        Map<String, Object> marketingConsent = (Map<String, Object>) consents.get("MARKETING");

        assertThat(marketingConsent.get("granted")).isEqualTo(true);
        assertThat(marketingConsent.get("version")).isEqualTo(3);
        assertThat(marketingConsent.get("grantedAt")).isEqualTo(LocalDateTime.of(2025, 6, 1, 10, 0));
        assertThat(marketingConsent.get("revokedAt")).isNull();
    }

    @Test
    void getConsentStatus_missingConsent_returnsDefaultValues() {
        // Arrange
        for (GdprConsent.ConsentType type : GdprConsent.ConsentType.values()) {
            when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, type))
                    .thenReturn(Optional.empty());
        }

        // Act
        Map<String, Object> result = gdprService.getConsentStatus(1L);

        // Assert
        @SuppressWarnings("unchecked")
        Map<String, Object> consents = (Map<String, Object>) result.get("consents");
        @SuppressWarnings("unchecked")
        Map<String, Object> dpConsent = (Map<String, Object>) consents.get("DATA_PROCESSING");

        assertThat(dpConsent.get("granted")).isEqualTo(false);
        assertThat(dpConsent.get("version")).isEqualTo(0);
        assertThat(dpConsent.get("grantedAt")).isNull();
        assertThat(dpConsent.get("revokedAt")).isNull();
    }

    @Test
    void getConsentStatus_revokedConsent_includesRevokedAt() {
        // Arrange
        GdprConsent consent = new GdprConsent(testUser, GdprConsent.ConsentType.ANALYTICS, false, "10.0.0.1");
        consent.setVersion(2);
        consent.setGrantedAt(LocalDateTime.of(2025, 3, 1, 9, 0));
        consent.setRevokedAt(LocalDateTime.of(2025, 5, 1, 14, 0));

        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.ANALYTICS))
                .thenReturn(Optional.of(consent));
        for (GdprConsent.ConsentType type : GdprConsent.ConsentType.values()) {
            if (type != GdprConsent.ConsentType.ANALYTICS) {
                when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, type))
                        .thenReturn(Optional.empty());
            }
        }

        // Act
        Map<String, Object> result = gdprService.getConsentStatus(1L);

        // Assert
        @SuppressWarnings("unchecked")
        Map<String, Object> consents = (Map<String, Object>) result.get("consents");
        @SuppressWarnings("unchecked")
        Map<String, Object> analyticsConsent = (Map<String, Object>) consents.get("ANALYTICS");

        assertThat(analyticsConsent.get("granted")).isEqualTo(false);
        assertThat(analyticsConsent.get("revokedAt")).isEqualTo(LocalDateTime.of(2025, 5, 1, 14, 0));
    }

    // ═══════════════════════════════════════════════════════════════════
    // updateConsents
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void updateConsents_nullConsentsMap_returnsEarlyAfterUserLookup() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(null);

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert: user looked up, but no consents saved or audit logged
        verify(userRepository).findById(1L);
        verifyNoInteractions(gdprConsentRepository);
        verifyNoInteractions(auditLogService);
    }

    @Test
    void updateConsents_emptyConsentsMap_returnsEarlyAfterUserLookup() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(Collections.emptyMap());

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert: user looked up, but no consents saved or audit logged
        verify(userRepository).findById(1L);
        verifyNoInteractions(gdprConsentRepository);
        verifyNoInteractions(auditLogService);
    }

    @Test
    void updateConsents_userNotFound_throwsRuntimeException() {
        // Arrange
        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(Map.of("MARKETING", true));
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> gdprService.updateConsents(99L, dto, "192.168.1.1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Utilisateur introuvable: 99");
    }

    @Test
    void updateConsents_newConsent_createsVersionedConsent() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.MARKETING))
                .thenReturn(Optional.empty());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(Map.of("MARKETING", true));

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert
        ArgumentCaptor<GdprConsent> captor = ArgumentCaptor.forClass(GdprConsent.class);
        verify(gdprConsentRepository).save(captor.capture());

        GdprConsent saved = captor.getValue();
        assertThat(saved.getConsentType()).isEqualTo(GdprConsent.ConsentType.MARKETING);
        assertThat(saved.isGranted()).isTrue();
        assertThat(saved.getVersion()).isEqualTo(1);
        assertThat(saved.getOrganizationId()).isEqualTo(100L);
        assertThat(saved.getRevokedAt()).isNull();
    }

    @Test
    void updateConsents_existingConsent_incrementsVersion() {
        // Arrange
        GdprConsent existing = new GdprConsent(testUser, GdprConsent.ConsentType.ANALYTICS, true, "10.0.0.1");
        existing.setVersion(5);

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.ANALYTICS))
                .thenReturn(Optional.of(existing));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(Map.of("ANALYTICS", false));

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert
        ArgumentCaptor<GdprConsent> captor = ArgumentCaptor.forClass(GdprConsent.class);
        verify(gdprConsentRepository).save(captor.capture());
        assertThat(captor.getValue().getVersion()).isEqualTo(6);
    }

    @Test
    void updateConsents_revokedConsent_setsRevokedAt() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.COOKIES))
                .thenReturn(Optional.empty());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(Map.of("COOKIES", false));

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert
        ArgumentCaptor<GdprConsent> captor = ArgumentCaptor.forClass(GdprConsent.class);
        verify(gdprConsentRepository).save(captor.capture());

        GdprConsent saved = captor.getValue();
        assertThat(saved.isGranted()).isFalse();
        assertThat(saved.getRevokedAt()).isNotNull();
    }

    @Test
    void updateConsents_grantedConsent_doesNotSetRevokedAt() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.DATA_PROCESSING))
                .thenReturn(Optional.empty());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(Map.of("DATA_PROCESSING", true));

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert
        ArgumentCaptor<GdprConsent> captor = ArgumentCaptor.forClass(GdprConsent.class);
        verify(gdprConsentRepository).save(captor.capture());
        assertThat(captor.getValue().getRevokedAt()).isNull();
    }

    @Test
    void updateConsents_unknownConsentType_logsWarningAndContinues() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.MARKETING))
                .thenReturn(Optional.empty());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        Map<String, Boolean> consents = new LinkedHashMap<>();
        consents.put("UNKNOWN_TYPE", true);
        consents.put("MARKETING", true);
        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(consents);

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert: unknown type skipped, valid consent still saved
        verify(gdprConsentRepository, times(1)).save(any(GdprConsent.class));
    }

    @Test
    void updateConsents_multipleConsents_savesAll() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(eq(1L), eq(GdprConsent.ConsentType.MARKETING)))
                .thenReturn(Optional.empty());
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(eq(1L), eq(GdprConsent.ConsentType.ANALYTICS)))
                .thenReturn(Optional.empty());
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(eq(1L), eq(GdprConsent.ConsentType.COOKIES)))
                .thenReturn(Optional.empty());

        Map<String, Boolean> consents = Map.of(
                "MARKETING", true,
                "ANALYTICS", false,
                "COOKIES", true
        );
        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(consents);

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert
        verify(gdprConsentRepository, times(3)).save(any(GdprConsent.class));
    }

    @Test
    void updateConsents_validConsents_logsAudit() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findTopByUserIdAndConsentTypeOrderByVersionDesc(1L, GdprConsent.ConsentType.MARKETING))
                .thenReturn(Optional.empty());
        when(tenantContext.getRequiredOrganizationId()).thenReturn(100L);

        GdprConsentUpdateDto dto = new GdprConsentUpdateDto(Map.of("MARKETING", true));

        // Act
        gdprService.updateConsents(1L, dto, "192.168.1.1");

        // Assert
        verify(auditLogService).logAction(
                eq(AuditAction.UPDATE), eq("GdprConsent"), eq("1"),
                isNull(), anyString(),
                eq("Mise a jour des consentements RGPD"), eq(AuditSource.WEB));
    }

    // ═══════════════════════════════════════════════════════════════════
    // getDataCategories
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void getDataCategories_returns8Categories() {
        // Act
        List<Map<String, String>> categories = gdprService.getDataCategories();

        // Assert
        assertThat(categories).hasSize(8);
    }

    @Test
    void getDataCategories_eachCategoryHasRequiredFields() {
        // Act
        List<Map<String, String>> categories = gdprService.getDataCategories();

        // Assert
        for (Map<String, String> category : categories) {
            assertThat(category).containsKeys("category", "data", "purpose", "legalBasis", "retention");
        }
    }

    @Test
    void getDataCategories_containsExpectedCategoryNames() {
        // Act
        List<Map<String, String>> categories = gdprService.getDataCategories();

        // Assert
        List<String> names = categories.stream()
                .map(c -> c.get("category"))
                .toList();
        assertThat(names).containsExactly(
                "Identite", "Authentification", "Proprietes", "Reservations",
                "Paiements", "Integration Airbnb", "Logs d'audit", "Consentements"
        );
    }

    @Test
    void getDataCategories_noInteractionWithDependencies() {
        // Act
        gdprService.getDataCategories();

        // Assert: pure method, no repository/service calls
        verifyNoInteractions(userRepository, gdprConsentRepository, auditLogRepository,
                auditLogService, notificationService, tenantContext);
    }

    // ─── Helpers ────────────────────────────────────────────────────

    private void arrangeForExport() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(gdprConsentRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(auditLogRepository.findByUserIdOrderByTimestampDesc(eq("kc-uuid-123"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));
    }
}
