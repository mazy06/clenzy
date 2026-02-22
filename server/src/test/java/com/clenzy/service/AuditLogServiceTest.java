package com.clenzy.service;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditLog;
import com.clenzy.model.AuditSource;
import com.clenzy.repository.AuditLogRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock private AuditLogRepository auditLogRepository;

    private TenantContext tenantContext;
    private AuditLogService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new AuditLogService(auditLogRepository, tenantContext);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private AuditLog captureLog() {
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        return captor.getValue();
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("logCreate(entityType, entityId, details)")
    class LogCreate {

        @Test
        @DisplayName("saves with CREATE action and WEB source")
        void whenCalled_thenSavesWithCreateAction() {
            // Arrange & Act
            service.logCreate("Property", "1", "Propriete creee");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.CREATE);
            assertThat(saved.getEntityType()).isEqualTo("Property");
            assertThat(saved.getEntityId()).isEqualTo("1");
            assertThat(saved.getDetails()).isEqualTo("Propriete creee");
            assertThat(saved.getSource()).isEqualTo(AuditSource.WEB);
        }
    }

    @Nested
    @DisplayName("logUpdate(entityType, entityId, oldValue, newValue, details)")
    class LogUpdate {

        @Test
        @DisplayName("saves old and new values with UPDATE action")
        void whenCalled_thenSavesOldAndNewValues() {
            // Arrange & Act
            service.logUpdate("User", "5", "ACTIVE", "INACTIVE", "Statut modifie");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.UPDATE);
            assertThat(saved.getEntityType()).isEqualTo("User");
            assertThat(saved.getEntityId()).isEqualTo("5");
            assertThat(saved.getOldValue()).isEqualTo("ACTIVE");
            assertThat(saved.getNewValue()).isEqualTo("INACTIVE");
            assertThat(saved.getDetails()).isEqualTo("Statut modifie");
            assertThat(saved.getSource()).isEqualTo(AuditSource.WEB);
        }
    }

    @Nested
    @DisplayName("logDelete(entityType, entityId, details)")
    class LogDelete {

        @Test
        @DisplayName("saves with DELETE action")
        void whenCalled_thenSavesDeleteAction() {
            // Arrange & Act
            service.logDelete("Team", "3", "Equipe supprimee");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.DELETE);
            assertThat(saved.getEntityType()).isEqualTo("Team");
            assertThat(saved.getEntityId()).isEqualTo("3");
            assertThat(saved.getDetails()).isEqualTo("Equipe supprimee");
        }
    }

    @Nested
    @DisplayName("logLogin(userId, userEmail)")
    class LogLogin {

        @Test
        @DisplayName("saves LOGIN action with userId and email")
        void whenCalled_thenSavesLoginActionWithUserInfo() {
            // Arrange & Act
            service.logLogin("kc-user-1", "user@example.com");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.LOGIN);
            assertThat(saved.getEntityType()).isEqualTo("User");
            assertThat(saved.getEntityId()).isEqualTo("kc-user-1");
            assertThat(saved.getUserId()).isEqualTo("kc-user-1");
            assertThat(saved.getUserEmail()).isEqualTo("user@example.com");
            assertThat(saved.getDetails()).isEqualTo("Connexion reussie");
            assertThat(saved.getSource()).isEqualTo(AuditSource.WEB);
        }
    }

    @Nested
    @DisplayName("logLoginFailed(userEmail, reason)")
    class LogLoginFailed {

        @Test
        @DisplayName("saves LOGIN_FAILED action with email and failure reason")
        void whenCalled_thenSavesLoginFailedAction() {
            // Arrange & Act
            service.logLoginFailed("user@example.com", "Mot de passe incorrect");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.LOGIN_FAILED);
            assertThat(saved.getEntityType()).isEqualTo("User");
            assertThat(saved.getEntityId()).isNull();
            assertThat(saved.getUserEmail()).isEqualTo("user@example.com");
            assertThat(saved.getDetails()).contains("Mot de passe incorrect");
            assertThat(saved.getSource()).isEqualTo(AuditSource.WEB);
        }
    }

    @Nested
    @DisplayName("logLogout(userId, userEmail)")
    class LogLogout {

        @Test
        @DisplayName("saves LOGOUT action with userId and email")
        void whenCalled_thenSavesLogoutAction() {
            // Arrange & Act
            service.logLogout("kc-user-1", "user@example.com");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.LOGOUT);
            assertThat(saved.getEntityType()).isEqualTo("User");
            assertThat(saved.getEntityId()).isEqualTo("kc-user-1");
            assertThat(saved.getUserId()).isEqualTo("kc-user-1");
            assertThat(saved.getUserEmail()).isEqualTo("user@example.com");
            assertThat(saved.getDetails()).isEqualTo("Deconnexion");
        }
    }

    @Nested
    @DisplayName("logStatusChange(entityType, entityId, oldStatus, newStatus)")
    class LogStatusChange {

        @Test
        @DisplayName("saves STATUS_CHANGE with old and new status as values")
        void whenCalled_thenSavesOldAndNewStatus() {
            // Arrange & Act
            service.logStatusChange("Intervention", "7", "PENDING", "IN_PROGRESS");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.STATUS_CHANGE);
            assertThat(saved.getEntityType()).isEqualTo("Intervention");
            assertThat(saved.getEntityId()).isEqualTo("7");
            assertThat(saved.getOldValue()).isEqualTo("PENDING");
            assertThat(saved.getNewValue()).isEqualTo("IN_PROGRESS");
            assertThat(saved.getDetails()).contains("PENDING").contains("IN_PROGRESS");
        }
    }

    @Nested
    @DisplayName("logPayment(entityType, entityId, details)")
    class LogPayment {

        @Test
        @DisplayName("saves PAYMENT action with WEB source")
        void whenCalled_thenSavesPaymentAction() {
            // Arrange & Act
            service.logPayment("Invoice", "42", "Paiement de 250 EUR recu");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.PAYMENT);
            assertThat(saved.getEntityType()).isEqualTo("Invoice");
            assertThat(saved.getEntityId()).isEqualTo("42");
            assertThat(saved.getDetails()).isEqualTo("Paiement de 250 EUR recu");
            assertThat(saved.getSource()).isEqualTo(AuditSource.WEB);
        }
    }

    @Nested
    @DisplayName("logWebhook(entityType, entityId, details)")
    class LogWebhook {

        @Test
        @DisplayName("saves WEBHOOK_RECEIVED action with WEBHOOK source")
        void whenCalled_thenUsesWebhookSource() {
            // Arrange & Act
            service.logWebhook("Payment", "99", "Webhook recu");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.WEBHOOK_RECEIVED);
            assertThat(saved.getSource()).isEqualTo(AuditSource.WEBHOOK);
            assertThat(saved.getEntityType()).isEqualTo("Payment");
            assertThat(saved.getEntityId()).isEqualTo("99");
        }
    }

    @Nested
    @DisplayName("logSync(entityType, entityId, details)")
    class LogSync {

        @Test
        @DisplayName("saves SYNC action with AIRBNB_SYNC source")
        void whenCalled_thenUsesAirbnbSyncSource() {
            // Arrange & Act
            service.logSync("AirbnbConnection", "1", "Sync OK");

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.SYNC);
            assertThat(saved.getSource()).isEqualTo(AuditSource.AIRBNB_SYNC);
            assertThat(saved.getEntityType()).isEqualTo("AirbnbConnection");
            assertThat(saved.getEntityId()).isEqualTo("1");
        }
    }

    @Nested
    @DisplayName("logAction(action, entityType, entityId, oldValue, newValue, details, source)")
    class LogAction {

        @Test
        @DisplayName("saves with all provided parameters")
        void whenCalledWithAllParams_thenSavesAllFields() {
            // Arrange & Act
            service.logAction(
                    AuditAction.PERMISSION_CHANGE,
                    "Role",
                    "42",
                    "HOST",
                    "SUPER_MANAGER",
                    "Role escalation",
                    AuditSource.ADMIN);

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.PERMISSION_CHANGE);
            assertThat(saved.getEntityType()).isEqualTo("Role");
            assertThat(saved.getEntityId()).isEqualTo("42");
            assertThat(saved.getOldValue()).isEqualTo("HOST");
            assertThat(saved.getNewValue()).isEqualTo("SUPER_MANAGER");
            assertThat(saved.getDetails()).isEqualTo("Role escalation");
            assertThat(saved.getSource()).isEqualTo(AuditSource.ADMIN);
        }

        @Test
        @DisplayName("handles null old/new values gracefully")
        void whenNullValues_thenSavesWithNulls() {
            // Arrange & Act
            service.logAction(
                    AuditAction.EXPORT,
                    "Report",
                    "1",
                    null,
                    null,
                    "Export CSV",
                    AuditSource.WEB);

            // Assert
            AuditLog saved = captureLog();
            assertThat(saved.getAction()).isEqualTo(AuditAction.EXPORT);
            assertThat(saved.getOldValue()).isNull();
            assertThat(saved.getNewValue()).isNull();
            assertThat(saved.getDetails()).isEqualTo("Export CSV");
        }
    }

    @Nested
    @DisplayName("getByUser(userId, pageable)")
    class GetByUser {

        @Test
        @DisplayName("delegates to repository and returns page")
        void whenCalled_thenDelegatesToRepository() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            AuditLog log = new AuditLog(AuditAction.LOGIN, "User", "kc-1");
            Page<AuditLog> expectedPage = new PageImpl<>(List.of(log), pageable, 1);

            when(auditLogRepository.findByUserIdOrderByTimestampDesc("kc-1", pageable))
                    .thenReturn(expectedPage);

            // Act
            Page<AuditLog> result = service.getByUser("kc-1", pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getAction()).isEqualTo(AuditAction.LOGIN);
        }

        @Test
        @DisplayName("returns empty page when no logs exist for user")
        void whenNoLogs_thenReturnsEmptyPage() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            when(auditLogRepository.findByUserIdOrderByTimestampDesc("unknown", pageable))
                    .thenReturn(new PageImpl<>(List.of()));

            // Act
            Page<AuditLog> result = service.getByUser("unknown", pageable);

            // Assert
            assertThat(result.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("getByEntity(entityType, entityId, pageable)")
    class GetByEntity {

        @Test
        @DisplayName("delegates to repository with entityType and entityId")
        void whenCalled_thenDelegatesToRepository() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            AuditLog log = new AuditLog(AuditAction.UPDATE, "Property", "5");
            Page<AuditLog> expectedPage = new PageImpl<>(List.of(log), pageable, 1);

            when(auditLogRepository.findByEntityTypeAndEntityIdOrderByTimestampDesc("Property", "5", pageable))
                    .thenReturn(expectedPage);

            // Act
            Page<AuditLog> result = service.getByEntity("Property", "5", pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getEntityType()).isEqualTo("Property");
            assertThat(result.getContent().get(0).getEntityId()).isEqualTo("5");
        }
    }

    @Nested
    @DisplayName("getByAction(action, pageable)")
    class GetByAction {

        @Test
        @DisplayName("delegates to repository filtering by action type")
        void whenCalled_thenDelegatesToRepository() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            AuditLog log = new AuditLog(AuditAction.DELETE, "Team", "3");
            Page<AuditLog> expectedPage = new PageImpl<>(List.of(log), pageable, 1);

            when(auditLogRepository.findByActionOrderByTimestampDesc(AuditAction.DELETE, pageable))
                    .thenReturn(expectedPage);

            // Act
            Page<AuditLog> result = service.getByAction(AuditAction.DELETE, pageable);

            // Assert
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getAction()).isEqualTo(AuditAction.DELETE);
        }

        @Test
        @DisplayName("returns empty page when no logs match the action")
        void whenNoMatches_thenReturnsEmptyPage() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            when(auditLogRepository.findByActionOrderByTimestampDesc(AuditAction.RECONCILIATION, pageable))
                    .thenReturn(Page.empty(pageable));

            // Act
            Page<AuditLog> result = service.getByAction(AuditAction.RECONCILIATION, pageable);

            // Assert
            assertThat(result.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("countSince(from)")
    class CountSince {

        @Test
        @DisplayName("delegates to repository and returns count")
        void whenCalled_thenDelegatesToRepository() {
            // Arrange
            Instant from = Instant.now().minusSeconds(3600);
            when(auditLogRepository.countByTimestampAfter(from)).thenReturn(42L);

            // Act
            long count = service.countSince(from);

            // Assert
            assertThat(count).isEqualTo(42L);
        }

        @Test
        @DisplayName("returns zero when no logs since the given time")
        void whenNoLogsSince_thenReturnsZero() {
            // Arrange
            Instant from = Instant.now();
            when(auditLogRepository.countByTimestampAfter(from)).thenReturn(0L);

            // Act
            long count = service.countSince(from);

            // Assert
            assertThat(count).isZero();
        }
    }

    @Nested
    @DisplayName("saveAsync resilience")
    class SaveAsyncResilience {

        @Test
        @DisplayName("DB error in save does not propagate to caller")
        void whenSaveFails_thenDoesNotPropagate() {
            // Arrange
            when(auditLogRepository.save(any(AuditLog.class)))
                    .thenThrow(new RuntimeException("DB error"));

            // Act & Assert (should NOT throw)
            service.logCreate("Test", "1", "details");
        }
    }
}
