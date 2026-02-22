package com.clenzy.service;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditLog;
import com.clenzy.model.AuditSource;
import com.clenzy.repository.AuditLogRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
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

    // ===== LOG CREATE =====

    @Nested
    class LogCreate {

        @Test
        void whenCalled_thenSavesWithCreateAction() {
            service.logCreate("Property", "1", "Propriete creee");

            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(auditLogRepository).save(captor.capture());
            AuditLog saved = captor.getValue();

            assertThat(saved.getAction()).isEqualTo(AuditAction.CREATE);
            assertThat(saved.getEntityType()).isEqualTo("Property");
            assertThat(saved.getEntityId()).isEqualTo("1");
            assertThat(saved.getSource()).isEqualTo(AuditSource.WEB);
        }
    }

    // ===== LOG UPDATE =====

    @Nested
    class LogUpdate {

        @Test
        void whenCalled_thenSavesOldAndNewValues() {
            service.logUpdate("User", "5", "ACTIVE", "INACTIVE", "Statut modifie");

            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(auditLogRepository).save(captor.capture());
            AuditLog saved = captor.getValue();

            assertThat(saved.getAction()).isEqualTo(AuditAction.UPDATE);
            assertThat(saved.getOldValue()).isEqualTo("ACTIVE");
            assertThat(saved.getNewValue()).isEqualTo("INACTIVE");
        }
    }

    // ===== LOG DELETE =====

    @Nested
    class LogDelete {

        @Test
        void whenCalled_thenSavesDeleteAction() {
            service.logDelete("Team", "3", "Equipe supprimee");

            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(auditLogRepository).save(captor.capture());
            assertThat(captor.getValue().getAction()).isEqualTo(AuditAction.DELETE);
        }
    }

    // ===== LOG SYNC =====

    @Nested
    class LogSync {

        @Test
        void whenCalled_thenUsesAirbnbSyncSource() {
            service.logSync("AirbnbConnection", "1", "Sync OK");

            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(auditLogRepository).save(captor.capture());
            assertThat(captor.getValue().getSource()).isEqualTo(AuditSource.AIRBNB_SYNC);
        }
    }

    // ===== LOG WEBHOOK =====

    @Nested
    class LogWebhook {

        @Test
        void whenCalled_thenUsesWebhookSource() {
            service.logWebhook("Payment", "99", "Webhook recu");

            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(auditLogRepository).save(captor.capture());
            assertThat(captor.getValue().getSource()).isEqualTo(AuditSource.WEBHOOK);
            assertThat(captor.getValue().getAction()).isEqualTo(AuditAction.WEBHOOK_RECEIVED);
        }
    }

    // ===== LOG STATUS CHANGE =====

    @Nested
    class LogStatusChange {

        @Test
        void whenCalled_thenSavesOldAndNewStatus() {
            service.logStatusChange("Intervention", "7", "PENDING", "IN_PROGRESS");

            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(auditLogRepository).save(captor.capture());
            AuditLog saved = captor.getValue();

            assertThat(saved.getAction()).isEqualTo(AuditAction.STATUS_CHANGE);
            assertThat(saved.getOldValue()).isEqualTo("PENDING");
            assertThat(saved.getNewValue()).isEqualTo("IN_PROGRESS");
        }
    }

    // ===== SAVE ASYNC RESILIENCE =====

    @Nested
    class SaveAsyncResilience {

        @Test
        void whenSaveFails_thenDoesNotPropagate() {
            when(auditLogRepository.save(any(AuditLog.class)))
                    .thenThrow(new RuntimeException("DB error"));

            // Should NOT throw - audit must never break business logic
            service.logCreate("Test", "1", "details");
        }
    }

    // ===== CONSULTATION =====

    @Nested
    class Consultation {

        @Test
        void getByUser_thenDelegatesToRepository() {
            Pageable pageable = PageRequest.of(0, 10);
            when(auditLogRepository.findByUserIdOrderByTimestampDesc("user-1", pageable))
                    .thenReturn(new PageImpl<>(List.of()));

            Page<AuditLog> result = service.getByUser("user-1", pageable);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        void countSince_thenDelegatesToRepository() {
            Instant from = Instant.now().minusSeconds(3600);
            when(auditLogRepository.countByTimestampAfter(from)).thenReturn(42L);

            long count = service.countSince(from);

            assertThat(count).isEqualTo(42L);
        }
    }
}
