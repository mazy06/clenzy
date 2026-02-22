package com.clenzy.service;

import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SecurityAuditServiceTest {

    @Mock
    private SecurityAuditLogRepository repository;

    private TenantContext tenantContext;
    private SecurityAuditService securityAuditService;

    @Captor
    private ArgumentCaptor<SecurityAuditLog> logCaptor;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        securityAuditService = new SecurityAuditService(
                repository, tenantContext, new ObjectMapper());
    }

    @Nested
    @DisplayName("logLoginSuccess")
    class LogLoginSuccess {

        @Test
        @DisplayName("should save entry with LOGIN_SUCCESS event type and actor info")
        void whenLoginSuccess_thenSavesCorrectEntry() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logLoginSuccess("actor-123", "user@test.com");

            // Assert
            verify(repository).save(logCaptor.capture());
            SecurityAuditLog entry = logCaptor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.LOGIN_SUCCESS);
            assertThat(entry.getAction()).isEqualTo("LOGIN");
            assertThat(entry.getResult()).isEqualTo("SUCCESS");
            assertThat(entry.getActorId()).isEqualTo("actor-123");
            assertThat(entry.getActorEmail()).isEqualTo("user@test.com");
            assertThat(entry.getOrganizationId()).isEqualTo(ORG_ID);
        }
    }

    @Nested
    @DisplayName("logLoginFailure")
    class LogLoginFailure {

        @Test
        @DisplayName("should save entry with LOGIN_FAILURE and reason in details")
        void whenLoginFailure_thenSavesWithReason() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logLoginFailure("fail@test.com", "bad password");

            // Assert
            verify(repository).save(logCaptor.capture());
            SecurityAuditLog entry = logCaptor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.LOGIN_FAILURE);
            assertThat(entry.getAction()).isEqualTo("LOGIN");
            assertThat(entry.getResult()).isEqualTo("DENIED");
            assertThat(entry.getActorEmail()).isEqualTo("fail@test.com");
            assertThat(entry.getDetails()).contains("bad password");
        }

        @Test
        @DisplayName("should use 'unknown' when reason is null")
        void whenReasonIsNull_thenUsesUnknown() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logLoginFailure("fail@test.com", null);

            // Assert
            verify(repository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getDetails()).contains("unknown");
        }
    }

    @Nested
    @DisplayName("logPermissionDenied")
    class LogPermissionDenied {

        @Test
        @DisplayName("should save entry with resource type/id and DENIED result")
        void whenPermissionDenied_thenSavesResourceInfo() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logPermissionDenied("actor-1", "actor@test.com",
                    "Property", "42", "DELETE");

            // Assert
            verify(repository).save(logCaptor.capture());
            SecurityAuditLog entry = logCaptor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.PERMISSION_DENIED);
            assertThat(entry.getAction()).isEqualTo("DELETE");
            assertThat(entry.getResult()).isEqualTo("DENIED");
            assertThat(entry.getActorId()).isEqualTo("actor-1");
            assertThat(entry.getActorEmail()).isEqualTo("actor@test.com");
            assertThat(entry.getResourceType()).isEqualTo("Property");
            assertThat(entry.getResourceId()).isEqualTo("42");
        }
    }

    @Nested
    @DisplayName("logAdminAction")
    class LogAdminAction {

        @Test
        @DisplayName("should save entry with ADMIN_ACTION and SUCCESS result")
        void whenAdminAction_thenSavesWithDetails() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logAdminAction("admin-1", "admin@test.com",
                    "USER_DELETE", "Deleted user 42");

            // Assert
            verify(repository).save(logCaptor.capture());
            SecurityAuditLog entry = logCaptor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.ADMIN_ACTION);
            assertThat(entry.getAction()).isEqualTo("USER_DELETE");
            assertThat(entry.getResult()).isEqualTo("SUCCESS");
            assertThat(entry.getActorId()).isEqualTo("admin-1");
            assertThat(entry.getActorEmail()).isEqualTo("admin@test.com");
            assertThat(entry.getDetails()).isEqualTo("Deleted user 42");
        }
    }

    @Nested
    @DisplayName("logSuspiciousActivity")
    class LogSuspiciousActivity {

        @Test
        @DisplayName("should save entry with JSON-serialized context")
        void whenSuspiciousActivity_thenSavesJsonContext() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));
            Map<String, Object> context = Map.of("attempts", 10, "ip", "192.168.1.1");

            // Act
            securityAuditService.logSuspiciousActivity("suspect-1", "Brute force detected", context);

            // Assert
            verify(repository).save(logCaptor.capture());
            SecurityAuditLog entry = logCaptor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.SUSPICIOUS_ACTIVITY);
            assertThat(entry.getAction()).isEqualTo("Brute force detected");
            assertThat(entry.getResult()).isEqualTo("ERROR");
            assertThat(entry.getActorId()).isEqualTo("suspect-1");
            assertThat(entry.getDetails()).contains("attempts");
            assertThat(entry.getDetails()).contains("192.168.1.1");
        }

        @Test
        @DisplayName("should handle null context map gracefully")
        void whenNullContext_thenDetailsIsNull() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logSuspiciousActivity("suspect-1", "unknown event", null);

            // Assert
            verify(repository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getDetails()).isNull();
        }
    }

    @Nested
    @DisplayName("logDataAccess")
    class LogDataAccess {

        @Test
        @DisplayName("should save entry with DATA_ACCESS, READ action, and resource info")
        void whenDataAccess_thenSavesResourceInfo() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logDataAccess("user-1", "user@test.com", "User", "42");

            // Assert
            verify(repository).save(logCaptor.capture());
            SecurityAuditLog entry = logCaptor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.DATA_ACCESS);
            assertThat(entry.getAction()).isEqualTo("READ");
            assertThat(entry.getResult()).isEqualTo("SUCCESS");
            assertThat(entry.getActorId()).isEqualTo("user-1");
            assertThat(entry.getActorEmail()).isEqualTo("user@test.com");
            assertThat(entry.getResourceType()).isEqualTo("User");
            assertThat(entry.getResourceId()).isEqualTo("42");
        }
    }

    @Nested
    @DisplayName("saveAsync - resilience")
    class SaveAsync {

        @Test
        @DisplayName("should not propagate exception when repository save fails")
        void whenRepositorySaveFails_thenDoesNotThrow() {
            // Arrange
            doThrow(new RuntimeException("DB down")).when(repository).save(any());

            // Act - should not throw
            securityAuditService.logLoginSuccess("actor-1", "test@test.com");

            // Assert - verify save was attempted
            verify(repository).save(any(SecurityAuditLog.class));
        }
    }

    @Nested
    @DisplayName("enrichAndSave - tenant context")
    class EnrichAndSave {

        @Test
        @DisplayName("should save with null organizationId when tenant context has no org")
        void whenTenantContextHasNullOrg_thenStillSaves() {
            // Arrange
            tenantContext.setOrganizationId(null);
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logLoginSuccess("actor-1", "test@test.com");

            // Assert
            verify(repository).save(logCaptor.capture());
            // organizationId may be null but the entry was still saved
            assertThat(logCaptor.getValue().getActorId()).isEqualTo("actor-1");
        }

        @Test
        @DisplayName("should set createdAt timestamp on saved entry")
        void whenSaving_thenCreatedAtIsSet() {
            // Arrange
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            securityAuditService.logLoginSuccess("actor-1", "test@test.com");

            // Assert
            verify(repository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getCreatedAt()).isNotNull();
        }
    }
}
