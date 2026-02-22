package com.clenzy.service;

import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SecurityAuditServiceTest {

    @Mock private SecurityAuditLogRepository repository;

    private TenantContext tenantContext;
    private SecurityAuditService securityAuditService;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        securityAuditService = new SecurityAuditService(
                repository, tenantContext, new ObjectMapper());
    }

    // ===== LOGIN EVENTS =====

    @Nested
    class LoginEvents {

        @Test
        void logLoginSuccess_savesEntryWithCorrectType() {
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            securityAuditService.logLoginSuccess("actor-123", "user@test.com");

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            SecurityAuditLog entry = captor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.LOGIN_SUCCESS);
            assertThat(entry.getAction()).isEqualTo("LOGIN");
            assertThat(entry.getResult()).isEqualTo("SUCCESS");
            assertThat(entry.getActorId()).isEqualTo("actor-123");
            assertThat(entry.getActorEmail()).isEqualTo("user@test.com");
            assertThat(entry.getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        void logLoginFailure_savesEntryWithReason() {
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            securityAuditService.logLoginFailure("fail@test.com", "bad password");

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            SecurityAuditLog entry = captor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.LOGIN_FAILURE);
            assertThat(entry.getResult()).isEqualTo("DENIED");
            assertThat(entry.getActorEmail()).isEqualTo("fail@test.com");
            assertThat(entry.getDetails()).contains("bad password");
        }

        @Test
        void logLoginFailure_whenReasonIsNull_thenUsesUnknown() {
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            securityAuditService.logLoginFailure("fail@test.com", null);

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            assertThat(captor.getValue().getDetails()).contains("unknown");
        }
    }

    // ===== PERMISSION DENIED =====

    @Nested
    class PermissionDenied {

        @Test
        void logPermissionDenied_savesCorrectEntry() {
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            securityAuditService.logPermissionDenied("actor-1", "actor@test.com",
                    "Property", "42", "DELETE");

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            SecurityAuditLog entry = captor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.PERMISSION_DENIED);
            assertThat(entry.getAction()).isEqualTo("DELETE");
            assertThat(entry.getResult()).isEqualTo("DENIED");
            assertThat(entry.getResourceType()).isEqualTo("Property");
            assertThat(entry.getResourceId()).isEqualTo("42");
        }
    }

    // ===== ADMIN ACTION =====

    @Nested
    class AdminAction {

        @Test
        void logAdminAction_savesCorrectEntry() {
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            securityAuditService.logAdminAction("admin-1", "admin@test.com",
                    "USER_DELETE", "Deleted user 42");

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            SecurityAuditLog entry = captor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.ADMIN_ACTION);
            assertThat(entry.getAction()).isEqualTo("USER_DELETE");
            assertThat(entry.getResult()).isEqualTo("SUCCESS");
            assertThat(entry.getDetails()).isEqualTo("Deleted user 42");
        }
    }

    // ===== SUSPICIOUS ACTIVITY =====

    @Nested
    class SuspiciousActivity {

        @Test
        void logSuspiciousActivity_savesWithJsonContext() {
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, Object> context = Map.of("attempts", 10, "ip", "192.168.1.1");
            securityAuditService.logSuspiciousActivity("suspect-1", "Brute force detected", context);

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            SecurityAuditLog entry = captor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.SUSPICIOUS_ACTIVITY);
            assertThat(entry.getResult()).isEqualTo("ERROR");
            assertThat(entry.getDetails()).contains("attempts");
            assertThat(entry.getDetails()).contains("192.168.1.1");
        }
    }

    // ===== DATA ACCESS =====

    @Nested
    class DataAccess {

        @Test
        void logDataAccess_savesCorrectEntry() {
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            securityAuditService.logDataAccess("user-1", "user@test.com", "User", "42");

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            SecurityAuditLog entry = captor.getValue();
            assertThat(entry.getEventType()).isEqualTo(SecurityAuditEventType.DATA_ACCESS);
            assertThat(entry.getAction()).isEqualTo("READ");
            assertThat(entry.getResult()).isEqualTo("SUCCESS");
            assertThat(entry.getResourceType()).isEqualTo("User");
            assertThat(entry.getResourceId()).isEqualTo("42");
        }
    }

    // ===== RESILIENCE =====

    @Nested
    class Resilience {

        @Test
        void whenRepositorySaveFails_thenDoesNotThrow() {
            doThrow(new RuntimeException("DB down")).when(repository).save(any());

            // Should not throw — audit must never break business logic
            securityAuditService.logLoginSuccess("actor-1", "test@test.com");
        }

        @Test
        void whenTenantContextThrows_thenStillSaves() {
            // Simulate TenantContext unavailable by setting null org
            tenantContext.setOrganizationId(null);
            when(repository.save(any(SecurityAuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

            securityAuditService.logLoginSuccess("actor-1", "test@test.com");

            ArgumentCaptor<SecurityAuditLog> captor = ArgumentCaptor.forClass(SecurityAuditLog.class);
            verify(repository).save(captor.capture());
            // organizationId may be null but the entry was still saved
        }
    }
}
